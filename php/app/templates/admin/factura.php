<?php
/**
 * /admin/facturi/{id}: an invoice: the lines, the totals, the payments, a payment for what is
 * still open, printing, and cancelling (administrators, with a reason).
 */
declare(strict_types=1);

$inv = db_one('SELECT v.*, p.first_name, p.last_name, p.file_number FROM invoices v JOIN patients p ON p.id = v.patient_id WHERE v.id = ?', [(int) $param]);
if ($inv === null || !can_see_invoice($inv, $user)) {
    admin_not_found($user);
}
$id = (int) $inv['id'];
$number = doc_number($inv['series'], (int) $inv['number']);
$errors = [];

if (is_post()) {
    csrf_check();
    try {
        if (post('op') === 'anuleaza' && can('billing.cancel', $user)) {
            $reason = trim(post('motiv'));
            if (mb_strlen($reason) < 3) {
                throw new DomainException('Scrieți motivul anulării.');
            }
            cancel_invoice($id, $reason, $user);
            flash("Factura {$number} a fost anulată. Plățile ei au rămas în contul pacientului, ca avans.");
            redirect("/admin/facturi/{$id}");
        }
        if (post('op') === 'incasare') {
            $amount = parse_lei(post('amount'));
            if ($amount === null) {
                throw new DomainException('Scrieți suma încasată.');
            }
            $pid = db_tx(static fn () => insert_payment([
                'patient_id' => (int) $inv['patient_id'], 'invoice_id' => $id, 'location_id' => (int) $inv['location_id'], 'amount' => $amount,
                'method' => post('method'), 'paid_at' => now_sql(), 'reference' => post('reference') ?: null, 'notes' => null,
            ], $user));
            flash('Încasarea de ' . lei($amount) . ' a fost înregistrată.');
            redirect("/admin/facturi/{$id}?incasare={$pid}");
        }
    } catch (DomainException $e) {
        $errors['amount'] = $e->getMessage();
    } catch (InvalidArgumentException $e) {
        $errors['amount'] = 'Scrieți suma, de exemplu 250 sau 250,50.';
    }
}

$items = db_all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id', [$id]);
$payments = payments_where('y.invoice_id = ?', [$id]);
$state = payment_state($inv);
$open = open_amount($inv);
$doctors = doctor_short_names();
$names = admin_clinic_names();
$users = array_column(db_all('SELECT id, name FROM users'), 'name', 'id');

$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$lineRows = '';
foreach ($items as $n => $it) {
    $lineRows .= '<tr class="border-t border-linie align-top"><td class="px-3 py-2 text-discret cifre">' . ($n + 1) . '</td>'
        . '<td class="px-3 py-2">' . e($it['description']) . ($it['tooth'] ? ' <span class="text-discret">· dinte ' . (int) $it['tooth'] . '</span>' : '') . ($it['doctor_id'] ? '<span class="block text-mic text-discret">' . e($doctors[(int) $it['doctor_id']] ?? '') . '</span>' : '') . '</td>'
        . '<td class="cifre px-3 py-2 text-right">' . (int) $it['quantity'] . '</td>'
        . '<td class="cifre whitespace-nowrap px-3 py-2 text-right">' . e(lei((int) $it['unit_price'])) . '</td>'
        . '<td class="cifre whitespace-nowrap px-3 py-2 text-right">' . ((int) $it['discount'] > 0 ? '−' . e(lei((int) $it['discount'])) : '') . '</td>'
        . '<td class="cifre whitespace-nowrap px-3 py-2 text-right font-semibold">' . e(lei((int) $it['total'])) . '</td></tr>';
}
$totals = '<dl class="ml-auto mt-4 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-corp">'
    . '<dt class="text-discret">Valoare</dt><dd class="cifre text-right">' . e(lei((int) $inv['subtotal'])) . '</dd>'
    . ((int) $inv['discount_total'] > 0 ? '<dt class="text-discret">Reduceri</dt><dd class="cifre text-right">−' . e(lei((int) $inv['discount_total'])) . '</dd>' : '')
    . ((int) $inv['vat_total'] > 0 ? '<dt class="text-discret">TVA</dt><dd class="cifre text-right">' . e(lei((int) $inv['vat_total'])) . '</dd>' : '')
    . '<dt class="font-semibold">Total</dt><dd class="cifre text-right font-display text-[1.5rem]">' . e(lei((int) $inv['total'])) . '</dd>'
    . ($inv['status'] === 'emisa' ? '<dt class="text-discret">Achitat</dt><dd class="cifre text-right">' . e(lei((int) $inv['amount_paid'])) . '</dd><dt class="font-semibold">Rest de plată</dt><dd class="cifre text-right font-semibold">' . e(lei($open)) . '</dd>' : '')
    . '</dl>';

$buyer = '<p class="font-semibold">' . e($inv['buyer_name']) . '</p>'
    . ($inv['buyer_cui'] ? '<p>CUI ' . e($inv['buyer_cui']) . ($inv['buyer_reg_com'] ? ' · ' . e($inv['buyer_reg_com']) : '') . '</p>' : '')
    . ($inv['buyer_address'] ? '<p>' . e($inv['buyer_address']) . '</p>' : '')
    . ($inv['buyer_email'] ? '<p>' . e($inv['buyer_email']) . '</p>' : '')
    . '<p class="mt-2 text-mic text-discret">Pacient: <a class="text-link underline" href="/admin/pacienti/' . (int) $inv['patient_id'] . '/financiar">' . e(patient_name($inv)) . '</a>, fișa nr. ' . (int) $inv['file_number'] . '</p>';

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$payForm = '';
if ($inv['status'] === 'emisa' && $open > 0) {
    $payForm = admin_section_open('Încasare', 'incasare')
        . '<form method="post" novalidate class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="incasare">'
        . text_field('amount', 'Suma (lei)', ['value' => post('amount') ?: lei_input($open), 'inputmode' => 'decimal', 'error' => $err('amount'), 'hint' => 'Rest de plată: ' . lei($open)])
        . radio_group('method', 'Metoda', PAYMENT_METHODS, ['inline' => true, 'value' => post('method') ?: 'numerar'])
        . text_field('reference', 'Referința', ['optional' => true, 'value' => post('reference')])
        . '<div><button type="submit" class="' . e(btn('primary')) . '">' . icon('wallet', 18) . 'Înregistrați încasarea</button></div></form></section>';
}
$cancel = '';
if ($inv['status'] === 'emisa' && can('billing.cancel', $user)) {
    $cancel = '<details class="rounded-panou border border-linie bg-suprafata p-4"><summary class="cursor-pointer font-medium text-carmin">Anulați factura</summary>'
        . '<form method="post" class="mt-3 flex flex-col gap-3" data-confirma="Anulați factura ' . e($number) . '? Numărul rămâne folosit, iar plățile trec în contul pacientului.">' . csrf_field() . '<input type="hidden" name="op" value="anuleaza">'
        . text_field('motiv', 'Motivul', ['required' => true, 'hint' => 'De exemplu: date greșite ale cumpărătorului, se reemite.'])
        . '<div><button type="submit" class="' . e(btn('secondary')) . '">Anulați factura</button></div></form></details>';
}
$receipt = '';
if (($rid = admin_int(query('incasare'))) !== null) {
    $pay = db_one('SELECT * FROM payments WHERE id = ? AND invoice_id = ?', [$rid, $id]);
    if ($pay && $pay['receipt_number'] !== null) {
        $receipt = '<a href="/admin/incasari/' . $rid . '/chitanta" class="' . e(btn('secondary')) . '">' . icon('printer', 18) . 'Chitanța ' . e(doc_number($pay['receipt_series'], (int) $pay['receipt_number'])) . '</a>';
    }
}

$meta = 'Emisă ' . format_datetime($inv['issued_at']) . ' · ' . ($names[(int) $inv['location_id']] ?? '') . ($inv['created_by'] ? ' · de ' . ($users[(int) $inv['created_by']] ?? '') : '') . ($inv['due_date'] ? ' · scadentă ' . format_date($inv['due_date']) : '');
$body = '<p class="mb-4"><a href="/admin/facturi" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Facturi</a></p>'
    . admin_header('Factura ' . $number, $meta, $receipt . '<a href="/admin/facturi/' . $id . '/tipar" class="' . e(btn('primary')) . '">' . icon('printer', 18) . 'Tipăriți</a>')
    . '<div class="-mt-4 mb-8 flex flex-wrap items-center gap-3">' . pay_state_chip($state)
    . ($inv['status'] === 'anulata' ? '<span class="text-corp text-carmin">Anulată ' . e(format_datetime($inv['cancelled_at'])) . ' de ' . e($users[(int) $inv['cancelled_by']] ?? '') . ': ' . e((string) $inv['cancel_reason']) . '</span>' : '') . '</div>'
    . '<div class="grid gap-8 lg:grid-cols-12"><div class="flex min-w-0 flex-col gap-8 lg:col-span-8">'
    . admin_section_open('Linii', 'linii')
    . '<div class="mt-3 relative overflow-x-auto"><table class="w-full min-w-[36rem] border-collapse text-corp"><thead><tr><th scope="col" class="' . $th . '">Nr.</th><th scope="col" class="' . $th . '">Serviciul</th><th scope="col" class="' . $th . ' text-right">Cant.</th><th scope="col" class="' . $th . ' text-right">Preț</th><th scope="col" class="' . $th . ' text-right">Reducere</th><th scope="col" class="' . $th . ' text-right">Valoare</th></tr></thead><tbody>' . $lineRows . '</tbody></table></div>'
    . $totals . ($inv['notes'] ? '<p class="mt-4 whitespace-pre-line text-corp text-discret">' . e($inv['notes']) . '</p>' : '') . '</section>'
    . admin_section_open('Plăți', 'plati') . payments_table($payments, $user, false) . '</section>'
    . '</div><div class="flex min-w-0 flex-col gap-8 lg:col-span-4">'
    . admin_section_open('Cumpărătorul', 'cumparator') . '<div class="mt-3 text-corp">' . $buyer . '</div></section>'
    . $payForm . $cancel
    . '</div></div>';
admin_page('Factura ' . $number, $body, $user);
