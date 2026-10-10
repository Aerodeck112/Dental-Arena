<?php
/**
 * Invoices and payments (stage 3). All money is in bani. Totals are computed here and stored;
 * invoice and receipt numbers are gap-free (number_sequences, locked inside the transaction).
 * An issued invoice is never deleted, only cancelled (administrators); its payments then stay
 * on the patient's account as credit. Who may bill: administrators and reception.
 */
declare(strict_types=1);

const PAYMENT_METHODS = ['numerar' => 'Numerar', 'card' => 'Card', 'transfer' => 'Transfer bancar'];
const PAY_STATE = ['anulata' => 'Anulată', 'neplatita' => 'Neplătită', 'partial' => 'Plătită parțial', 'platita' => 'Plătită'];
/** The plan lines that may go on an invoice. */
const INVOICEABLE_ITEM_STATUS = ['acceptat', 'programat', 'efectuat'];

function invoicing(): array
{
    return setting('invoicing');
}

/** „DA-000012” */
function doc_number(?string $series, ?int $number): string
{
    return $series === null || $number === null ? '' : $series . '-' . str_pad((string) $number, 6, '0', STR_PAD_LEFT);
}

/** The next number of a series. Call it inside db_tx(): the row stays locked until the commit. */
function next_sequence(string $key): int
{
    db_run('INSERT INTO number_sequences (k, v) VALUES (?, 1) ON DUPLICATE KEY UPDATE v = v + 1', [$key]);
    return (int) db_value('SELECT v FROM number_sequences WHERE k = ? FOR UPDATE', [$key]);
}

/** The number the next document of a series will get (for Setări). */
function peek_sequence(string $key): int
{
    return (int) (db_value('SELECT v FROM number_sequences WHERE k = ?', [$key]) ?? 0) + 1;
}

/** @return array{gross:int,discount:int,net:int,vat:int,total:int} VAT is rounded half-up per line. */
function line_totals(int $qty, int $price, int $discount, int $vatRate): array
{
    $gross = $qty * $price;
    $net = $gross - $discount;
    $vat = (int) round($net * $vatRate / 100);
    return ['gross' => $gross, 'discount' => $discount, 'net' => $net, 'vat' => $vat, 'total' => $net + $vat];
}

/** @param list<array{quantity:int,unit_price:int,discount:int,vat_rate:int}> $lines */
function invoice_totals(array $lines): array
{
    $t = ['subtotal' => 0, 'discount_total' => 0, 'vat_total' => 0, 'total' => 0, 'lines' => []];
    foreach ($lines as $l) {
        $lt = line_totals($l['quantity'], $l['unit_price'], $l['discount'], $l['vat_rate']);
        $t['subtotal'] += $lt['gross'];
        $t['discount_total'] += $lt['discount'];
        $t['vat_total'] += $lt['vat'];
        $t['lines'][] = $lt;
    }
    $t['total'] = $t['subtotal'] - $t['discount_total'] + $t['vat_total'];
    return $t;
}

/** What is wrong with one invoice line; [] = valid. */
function line_problems(array $l): array
{
    $out = [];
    if (trim($l['description']) === '') {
        $out[] = 'Completați descrierea.';
    }
    if ($l['quantity'] < 1 || $l['quantity'] > 999) {
        $out[] = 'Cantitatea este între 1 și 999.';
    }
    if ($l['unit_price'] < 0) {
        $out[] = 'Prețul nu poate fi negativ.';
    }
    if ($l['discount'] < 0) {
        $out[] = 'Reducerea nu poate fi negativă.';
    } elseif ($l['discount'] > $l['quantity'] * $l['unit_price']) {
        $out[] = 'Reducerea nu poate depăși valoarea liniei.';
    }
    if ($l['vat_rate'] < 0 || $l['vat_rate'] > 100) {
        $out[] = 'Cota TVA este între 0 și 100.';
    }
    return $out;
}

function payment_state(array $inv): string
{
    if ($inv['status'] === 'anulata') {
        return 'anulata';
    }
    if ((int) $inv['amount_paid'] <= 0 && (int) $inv['total'] > 0) {
        return 'neplatita';
    }
    return (int) $inv['amount_paid'] < (int) $inv['total'] ? 'partial' : 'platita';
}

function open_amount(array $inv): int
{
    return $inv['status'] === 'anulata' ? 0 : max(0, (int) $inv['total'] - (int) $inv['amount_paid']);
}

function pay_state_chip(string $state): string
{
    $cls = match ($state) {
        'platita' => 'bg-menta-pal text-cerneala',
        'partial' => 'bg-mustar-pal text-mustar-text',
        'neplatita' => 'border border-carmin text-carmin',
        default => 'bg-adancit text-discret line-through',
    };
    return '<span class="' . e(cn('inline-flex items-center whitespace-nowrap rounded-chip px-2.5 py-0.5 text-mic font-medium', $cls)) . '">' . e(PAY_STATE[$state] ?? $state) . '</span>';
}

/** „1.250,00 lei” (always with bani, as on financial documents). */
function lei(int $bani): string
{
    $neg = $bani < 0;
    $bani = abs($bani);
    return ($neg ? '−' : '') . number_format(intdiv($bani, 100), 0, ',', '.') . ',' . str_pad((string) ($bani % 100), 2, '0', STR_PAD_LEFT) . NBSP . 'lei';
}

/** „1.250,50” (two decimals, no currency) for the columns of printed documents. */
function amount_2d(int $bani): string
{
    return number_format($bani / 100, 2, ',', '.');
}

/** The patient's balance: issued invoices − valid payments. Positive = owes; negative = credit. */
function patient_balance(int $patientId): array
{
    $invoiced = (int) db_value("SELECT COALESCE(SUM(total), 0) FROM invoices WHERE patient_id = ? AND status = 'emisa'", [$patientId]);
    $paid = (int) db_value('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE patient_id = ? AND cancelled_at IS NULL', [$patientId]);
    return ['invoiced' => $invoiced, 'paid' => $paid, 'balance' => $invoiced - $paid];
}

function can_see_invoice(array $inv, array $user): bool
{
    return can('billing', $user) && (is_admin($user) || in_array((int) $inv['location_id'], allowed_location_ids($user), true));
}

/** The location condition for invoices and payments of the user's clinics. */
function billing_scope_sql(array $user, string $col): array
{
    if (is_admin($user)) {
        return ['1 = 1', []];
    }
    $ids = allowed_location_ids($user);
    return $ids === [] ? ['1 = 0', []] : ["{$col} IN (" . implode(',', array_fill(0, count($ids), '?')) . ')', $ids];
}

/**
 * Plan lines that can be invoiced: accepted, booked or done, of plans not cancelled or refused,
 * and not yet on an issued invoice.
 */
function invoice_candidates(int $patientId): array
{
    $in = "'" . implode("','", INVOICEABLE_ITEM_STATUS) . "'";
    return db_all(
        "SELECT i.*, p.title AS plan_title, p.doctor_id AS plan_doctor_id FROM treatment_plan_items i JOIN treatment_plans p ON p.id = i.plan_id
         WHERE p.patient_id = ? AND p.status NOT IN ('anulat', 'respins') AND i.status IN ({$in})
           AND NOT EXISTS (SELECT 1 FROM invoice_items ii JOIN invoices v ON v.id = ii.invoice_id WHERE ii.plan_item_id = i.id AND v.status = 'emisa')
         ORDER BY p.created_at, i.phase, i.sort_order, i.id",
        [$patientId],
    );
}

/**
 * Issues an invoice and, optionally, records the payment at once. One transaction.
 *
 * @param array{patient_id:int,location_id:int,lines:list<array>,buyer_name:string,buyer_address:?string,buyer_email:?string,buyer_company:?string,buyer_cui:?string,buyer_reg_com:?string,notes:?string,pay_method:?string,pay_amount:?int} $d
 * @return array{id:int,number:string,payment_id:?int}
 */
function create_invoice(array $d, array $user): array
{
    $cfg = invoicing();
    $totals = invoice_totals($d['lines']);
    return db_tx(static function () use ($d, $user, $cfg, $totals): array {
        $planIds = array_values(array_filter(array_map(static fn ($l) => $l['plan_item_id'] ?? null, $d['lines'])));
        if ($planIds !== []) {
            $in = implode(',', array_fill(0, count($planIds), '?'));
            $taken = (int) db_value("SELECT COUNT(*) FROM invoice_items ii JOIN invoices v ON v.id = ii.invoice_id WHERE v.status = 'emisa' AND ii.plan_item_id IN ({$in}) FOR UPDATE", $planIds);
            if ($taken > 0) {
                throw new DomainException('O linie din plan a fost deja facturată între timp. Reîncărcați pagina.');
            }
        }
        $series = $cfg['invoiceSeries'];
        $number = next_sequence("factura:{$series}");
        $issued = now_sql();
        $id = db_insert('invoices', [
            'series' => $series,
            'number' => $number,
            'patient_id' => $d['patient_id'],
            'location_id' => $d['location_id'],
            'issued_at' => $issued,
            'due_date' => (int) $cfg['paymentTermDays'] > 0 ? date('Y-m-d', strtotime('+' . (int) $cfg['paymentTermDays'] . ' days')) : null,
            'subtotal' => $totals['subtotal'],
            'discount_total' => $totals['discount_total'],
            'vat_total' => $totals['vat_total'],
            'total' => $totals['total'],
            'buyer_name' => $d['buyer_name'],
            'buyer_address' => $d['buyer_address'],
            'buyer_email' => $d['buyer_email'],
            'buyer_company' => $d['buyer_company'],
            'buyer_cui' => $d['buyer_cui'],
            'buyer_reg_com' => $d['buyer_reg_com'],
            'notes' => $d['notes'],
            'created_by' => $user['id'],
            'created_at' => $issued,
        ]);
        foreach ($d['lines'] as $i => $l) {
            db_insert('invoice_items', [
                'invoice_id' => $id,
                'service_id' => $l['service_id'] ?? null,
                'plan_item_id' => $l['plan_item_id'] ?? null,
                'doctor_id' => $l['doctor_id'] ?? null,
                'description' => mb_substr($l['description'], 0, 255),
                'tooth' => $l['tooth'] ?? null,
                'quantity' => $l['quantity'],
                'unit_price' => $l['unit_price'],
                'discount' => $l['discount'],
                'vat_rate' => $l['vat_rate'],
                'total' => $totals['lines'][$i]['total'],
                'sort_order' => $i,
            ]);
        }
        $number = doc_number($series, $number);
        audit('factura-emisa', "{$number}, " . lei($totals['total']), null, $d['patient_id']);
        $paymentId = null;
        if ($d['pay_method'] !== null && $totals['total'] > 0) {
            $paymentId = insert_payment([
                'patient_id' => $d['patient_id'],
                'invoice_id' => $id,
                'location_id' => $d['location_id'],
                'amount' => $d['pay_amount'] ?? $totals['total'],
                'method' => $d['pay_method'],
                'paid_at' => $issued,
                'reference' => null,
                'notes' => null,
            ], $user);
        }
        return ['id' => $id, 'number' => $number, 'payment_id' => $paymentId];
    });
}

/** Re-reads Σ valid payments of an invoice into invoices.amount_paid. */
function recompute_amount_paid(int $invoiceId): void
{
    db_run('UPDATE invoices SET amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ? AND cancelled_at IS NULL) WHERE id = ?', [$invoiceId, $invoiceId]);
}

/**
 * Records a payment (inside a transaction). Cash gets a receipt number. A payment on an invoice
 * may not exceed what is still open on it; without an invoice it is credit on the account.
 */
function insert_payment(array $p, array $user): int
{
    if ($p['amount'] <= 0) {
        throw new DomainException('Suma trebuie să fie mai mare decât 0.');
    }
    if (!isset(PAYMENT_METHODS[$p['method']])) {
        throw new DomainException('Alegeți metoda de plată.');
    }
    if ($p['invoice_id'] !== null) {
        $inv = db_one('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [$p['invoice_id']]);
        if ($inv === null || (int) $inv['patient_id'] !== $p['patient_id']) {
            throw new DomainException('Factura nu există pentru acest pacient.');
        }
        if ($inv['status'] === 'anulata') {
            throw new DomainException('Factura este anulată; înregistrați plata în cont.');
        }
        $open = open_amount($inv);
        if ($open === 0) {
            throw new DomainException('Factura este deja plătită integral.');
        }
        if ($p['amount'] > $open) {
            throw new DomainException('Suma depășește restul de plată al facturii (' . lei($open) . ').');
        }
    }
    $series = null;
    $number = null;
    if ($p['method'] === 'numerar') {
        $series = invoicing()['receiptSeries'];
        $number = next_sequence("chitanta:{$series}");
    }
    $id = db_insert('payments', [
        'patient_id' => $p['patient_id'],
        'invoice_id' => $p['invoice_id'],
        'location_id' => $p['location_id'],
        'amount' => $p['amount'],
        'method' => $p['method'],
        'paid_at' => $p['paid_at'],
        'receipt_series' => $series,
        'receipt_number' => $number,
        'reference' => $p['reference'] !== null ? mb_substr($p['reference'], 0, 120) : null,
        'notes' => $p['notes'] !== null ? mb_substr($p['notes'], 0, 255) : null,
        'received_by' => $user['id'],
        'created_at' => now_sql(),
    ]);
    if ($p['invoice_id'] !== null) {
        recompute_amount_paid($p['invoice_id']);
    }
    audit('incasare', lei($p['amount']) . ' ' . PAYMENT_METHODS[$p['method']] . ($number !== null ? ', chitanța ' . doc_number($series, $number) : '') . ($p['invoice_id'] === null ? ', în cont' : ''), null, $p['patient_id']);
    return $id;
}

/** Administrators only: the invoice becomes „Anulată”; its payments stay as credit on the account. */
function cancel_invoice(int $id, string $reason, array $user): void
{
    db_tx(static function () use ($id, $reason, $user): void {
        $inv = db_one('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [$id]);
        if ($inv === null || $inv['status'] === 'anulata') {
            throw new DomainException('Factura este deja anulată.');
        }
        db_run('UPDATE payments SET invoice_id = NULL WHERE invoice_id = ?', [$id]);
        db_update('invoices', ['status' => 'anulata', 'amount_paid' => 0, 'cancelled_at' => now_sql(), 'cancelled_by' => $user['id'], 'cancel_reason' => mb_substr($reason, 0, 255)], 'id = :id', ['id' => $id]);
        audit('factura-anulata', doc_number($inv['series'], (int) $inv['number']) . ": {$reason}", null, (int) $inv['patient_id']);
    });
}

function cancel_payment(int $id, string $reason, array $user): void
{
    db_tx(static function () use ($id, $reason, $user): void {
        $p = db_one('SELECT * FROM payments WHERE id = ? FOR UPDATE', [$id]);
        if ($p === null || $p['cancelled_at'] !== null) {
            throw new DomainException('Încasarea este deja anulată.');
        }
        db_update('payments', ['cancelled_at' => now_sql(), 'cancelled_by' => $user['id'], 'cancel_reason' => mb_substr($reason, 0, 255)], 'id = :id', ['id' => $id]);
        if ($p['invoice_id'] !== null) {
            recompute_amount_paid((int) $p['invoice_id']);
        }
        audit('incasare-anulata', lei((int) $p['amount']) . ": {$reason}", null, (int) $p['patient_id']);
    });
}

/** Payments with patient, invoice and receiver, newest first. */
function payments_where(string $where, array $params, int $limit = 500): array
{
    return db_all(
        "SELECT y.*, p.first_name, p.last_name, p.file_number, v.series AS inv_series, v.number AS inv_number, u.name AS receiver
         FROM payments y JOIN patients p ON p.id = y.patient_id LEFT JOIN invoices v ON v.id = y.invoice_id LEFT JOIN users u ON u.id = y.received_by
         WHERE {$where} ORDER BY y.paid_at DESC, y.id DESC LIMIT {$limit}",
        $params,
    );
}

/** The payments as rows: date, patient, what for, method, receipt, amount, actions. */
function payments_table(array $rows, array $user, bool $showPatient = true): string
{
    if ($rows === []) {
        return '<p class="mt-3 text-corp text-discret">Nicio încasare.</p>';
    }
    $th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
    $out = '';
    foreach ($rows as $r) {
        $cancelled = $r['cancelled_at'] !== null;
        $what = $r['invoice_id'] !== null ? '<a class="whitespace-nowrap text-link underline-offset-4 hover:underline" href="/admin/facturi/' . (int) $r['invoice_id'] . '">Factura ' . e(doc_number($r['inv_series'], (int) $r['inv_number'])) . '</a>' : 'În cont';
        $receipt = $r['receipt_number'] !== null ? '<a class="whitespace-nowrap text-link underline-offset-4 hover:underline" href="/admin/incasari/' . (int) $r['id'] . '/chitanta">' . e(doc_number($r['receipt_series'], (int) $r['receipt_number'])) . '</a>' : '';
        $actions = '';
        if (!$cancelled && can('billing.cancel', $user)) {
            $actions = '<details class="relative"><summary class="inline-flex min-h-control-s cursor-pointer list-none items-center text-mic text-link underline">Anulați</summary>'
                . '<form method="post" action="/admin/incasari" class="absolute right-0 z-20 mt-1 flex w-72 flex-col gap-2 rounded-panou border border-linie bg-suprafata p-3 shadow-float" data-confirma="Anulați încasarea de ' . e(lei((int) $r['amount'])) . '?">' . csrf_field()
                . '<input type="hidden" name="op" value="anuleaza"><input type="hidden" name="id" value="' . (int) $r['id'] . '"><input type="hidden" name="inapoi" value="' . e($_SERVER['REQUEST_URI'] ?? '/admin/incasari') . '">'
                . '<label class="text-mic font-medium" for="motiv-' . (int) $r['id'] . '">Motivul anulării</label><input id="motiv-' . (int) $r['id'] . '" name="motiv" required class="' . e(input_classes('h-control-s')) . '">'
                . '<button type="submit" class="' . e(btn('secondary', 's')) . '">Anulați încasarea</button></form></details>';
        }
        $out .= '<tr class="' . e(cn('border-t border-linie align-top', $cancelled ? 'text-discret' : '')) . '">'
            . '<td class="cifre whitespace-nowrap px-3 py-2">' . e(date('d.m.Y H:i', strtotime($r['paid_at']))) . '</td>'
            . ($showPatient ? '<td class="px-3 py-2"><a class="font-semibold text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $r['patient_id'] . '/financiar">' . e(patient_name($r)) . '</a></td>' : '')
            . '<td class="px-3 py-2">' . $what . ($r['reference'] ? '<span class="block text-mic text-discret">' . e($r['reference']) . '</span>' : '') . ($cancelled ? '<span class="block text-mic text-carmin">Anulată: ' . e((string) $r['cancel_reason']) . '</span>' : '') . '</td>'
            . '<td class="px-3 py-2">' . e(PAYMENT_METHODS[$r['method']] ?? $r['method']) . ($receipt !== '' ? '<span class="block text-mic">' . $receipt . '</span>' : '') . '</td>'
            . '<td class="cifre whitespace-nowrap px-3 py-2 text-right font-semibold' . ($cancelled ? ' line-through' : '') . '">' . e(lei((int) $r['amount'])) . '</td>'
            . '<td class="px-3 py-2">' . $actions . '</td></tr>';
    }
    return '<div class="mt-3 relative overflow-x-auto"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead><tr>'
        . '<th scope="col" class="' . $th . '">Data</th>' . ($showPatient ? '<th scope="col" class="' . $th . '">Pacient</th>' : '')
        . '<th scope="col" class="' . $th . '">Pentru</th><th scope="col" class="' . $th . '">Metoda</th><th scope="col" class="' . $th . ' text-right">Suma</th><th scope="col" class="' . $th . '"><span class="sr-only">Acțiuni</span></th>'
        . '</tr></thead><tbody>' . $out . '</tbody></table></div>';
}

/** Invoices as a table. */
function invoices_table(array $rows, bool $showPatient = true): string
{
    if ($rows === []) {
        return '<p class="mt-3 text-corp text-discret">Nicio factură.</p>';
    }
    $th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
    $clinics = admin_clinic_names();
    $out = '';
    foreach ($rows as $r) {
        $out .= '<tr class="border-t border-linie hover:bg-fundal">'
            . '<td class="whitespace-nowrap px-3 py-2"><a class="font-semibold text-link underline-offset-4 hover:underline cifre" href="/admin/facturi/' . (int) $r['id'] . '">' . e(doc_number($r['series'], (int) $r['number'])) . '</a></td>'
            . '<td class="cifre whitespace-nowrap px-3 py-2">' . e(date('d.m.Y', strtotime($r['issued_at']))) . '</td>'
            . ($showPatient ? '<td class="px-3 py-2"><a class="text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $r['patient_id'] . '/financiar">' . e(patient_name($r)) . '</a></td>' : '')
            . '<td class="px-3 py-2">' . e($clinics[(int) $r['location_id']] ?? '') . '</td>'
            . '<td class="cifre whitespace-nowrap px-3 py-2 text-right">' . e(lei((int) $r['total'])) . '</td>'
            . '<td class="cifre whitespace-nowrap px-3 py-2 text-right">' . e(lei(open_amount($r))) . '</td>'
            . '<td class="px-3 py-2">' . pay_state_chip(payment_state($r)) . '</td></tr>';
    }
    return '<div class="mt-3 relative overflow-x-auto"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead><tr>'
        . '<th scope="col" class="' . $th . '">Numărul</th><th scope="col" class="' . $th . '">Data</th>' . ($showPatient ? '<th scope="col" class="' . $th . '">Pacient</th>' : '')
        . '<th scope="col" class="' . $th . '">Clinica</th><th scope="col" class="' . $th . ' text-right">Total</th><th scope="col" class="' . $th . ' text-right">Rest de plată</th><th scope="col" class="' . $th . '">Stare</th>'
        . '</tr></thead><tbody>' . $out . '</tbody></table></div>';
}

// ── The amount in words, for receipts („două sute cincizeci de lei”) ─────────────

function ro_words_999(int $n, bool $fem): string
{
    $small = ['', $fem ? 'una' : 'unu', $fem ? 'două' : 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă', 'zece',
        'unsprezece', $fem ? 'douăsprezece' : 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece'];
    $tens = [2 => 'douăzeci', 3 => 'treizeci', 4 => 'patruzeci', 5 => 'cincizeci', 6 => 'șaizeci', 7 => 'șaptezeci', 8 => 'optzeci', 9 => 'nouăzeci'];
    $parts = [];
    $h = intdiv($n, 100);
    if ($h === 1) {
        $parts[] = 'o sută';
    } elseif ($h > 1) {
        $parts[] = ($h === 2 ? 'două' : $small[$h]) . ' sute';
    }
    $r = $n % 100;
    if ($r > 0 && $r < 20) {
        $parts[] = $small[$r];
    } elseif ($r >= 20) {
        $parts[] = $tens[intdiv($r, 10)] . ($r % 10 > 0 ? ' și ' . $small[$r % 10] : '');
    }
    return implode(' ', $parts);
}

/** „de” goes before the noun when the last two digits are 00 or 20 and above. */
function ro_needs_de(int $n): bool
{
    $r = $n % 100;
    return $n > 0 && ($r === 0 || $r >= 20);
}

function ro_count(int $n, string $one, string $many, bool $fem = false): string
{
    if ($n === 1) {
        return ($fem ? 'o ' : 'un ') . $one;
    }
    $parts = [];
    $m = intdiv($n, 1000000);
    $t = intdiv($n % 1000000, 1000);
    $u = $n % 1000;
    if ($m > 0) {
        $parts[] = $m === 1 ? 'un milion' : ro_words_999($m, true) . (ro_needs_de($m) ? ' de' : '') . ' milioane';
    }
    if ($t > 0) {
        $parts[] = $t === 1 ? 'o mie' : ro_words_999($t, true) . (ro_needs_de($t) ? ' de' : '') . ' mii';
    }
    if ($u > 0) {
        $parts[] = ro_words_999($u, $fem);
    }
    if ($parts === []) {
        return 'zero ' . $many;
    }
    return implode(' ', $parts) . (ro_needs_de($n) ? ' de ' : ' ') . $many;
}

function lei_in_words(int $bani): string
{
    $lei = intdiv($bani, 100);
    $b = $bani % 100;
    $out = ro_count($lei, 'leu', 'lei');
    return $b > 0 ? $out . ' și ' . ro_count($b, 'ban', 'bani') : $out;
}
