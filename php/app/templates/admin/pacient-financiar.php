<?php
/**
 * /admin/pacienti/{id}/financiar: the patient's balance, invoices and payments, and a payment
 * form (on an open invoice or as an advance on the account). Administrators and reception.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$id = (int) $p['id'];
$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
[$scope, $scopeParams] = billing_scope_sql($user, 'location_id');
$openInvoices = db_all("SELECT * FROM invoices WHERE patient_id = ? AND status = 'emisa' AND amount_paid < total AND {$scope} ORDER BY issued_at", array_merge([$id], $scopeParams));
$errors = [];
$v = ['amount' => '', 'method' => 'numerar', 'invoice_id' => (string) ($openInvoices[0]['id'] ?? ''), 'location_id' => (string) (current_clinic_id($user) ?? ''), 'reference' => '', 'paid_on' => date('Y-m-d')];

if (is_post()) {
    csrf_check();
    foreach (array_keys($v) as $k) {
        $v[$k] = post($k);
    }
    $amount = null;
    try {
        $amount = parse_lei($v['amount']);
    } catch (InvalidArgumentException $e) {
        $errors['amount'] = 'Scrieți suma, de exemplu 250 sau 250,50.';
    }
    if ($amount === null || $amount <= 0) {
        $errors['amount'] ??= 'Scrieți suma încasată.';
    }
    $invoiceId = admin_int($v['invoice_id']);
    $loc = admin_int($v['location_id']);
    if ($invoiceId !== null) {
        $inv = db_one('SELECT * FROM invoices WHERE id = ? AND patient_id = ?', [$invoiceId, $id]);
        $loc = $inv ? (int) $inv['location_id'] : null;
    }
    if ($loc === null || !in_array($loc, $allowed, true)) {
        $errors['location_id'] = 'Alegeți clinica.';
    }
    $day = DateTimeImmutable::createFromFormat('!Y-m-d', $v['paid_on']);
    if ($day === false || $v['paid_on'] > date('Y-m-d') || $v['paid_on'] < date('Y-m-d', strtotime('-60 days'))) {
        $errors['paid_on'] = 'Data plății este azi sau în ultimele 60 de zile.';
    }
    if ($errors === []) {
        try {
            $pid = db_tx(static fn () => insert_payment([
                'patient_id' => $id,
                'invoice_id' => $invoiceId,
                'location_id' => $loc,
                'amount' => $amount,
                'method' => $v['method'],
                'paid_at' => $v['paid_on'] === date('Y-m-d') ? now_sql() : $v['paid_on'] . ' 12:00:00',
                'reference' => $v['reference'] !== '' ? $v['reference'] : null,
                'notes' => null,
            ], $user));
            $pay = db_one('SELECT * FROM payments WHERE id = ?', [$pid]);
            flash('Încasarea de ' . lei($amount) . ' a fost înregistrată' . ($pay['receipt_number'] !== null ? ', chitanța ' . doc_number($pay['receipt_series'], (int) $pay['receipt_number']) : '') . '.');
            redirect("/admin/pacienti/{$id}/financiar" . ($pay['receipt_number'] !== null ? "?chitanta={$pid}" : ''));
        } catch (DomainException $e) {
            $errors['amount'] = $e->getMessage();
        }
    }
}

$bal = patient_balance($id);
$invoices = db_all("SELECT v.*, p.first_name, p.last_name FROM invoices v JOIN patients p ON p.id = v.patient_id WHERE v.patient_id = ? AND {$scope} ORDER BY v.issued_at DESC", array_merge([$id], array_values($scopeParams)));
$payments = payments_where('y.patient_id = ?', [$id]);
$candidates = count(invoice_candidates($id));

$tile = static fn (string $label, string $value, string $cls = '') => '<div class="' . e(cn('rounded-panou border border-linie bg-suprafata p-4', $cls)) . '"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.75rem] leading-tight cifre">' . e($value) . '</p></div>';
$tiles = '<div class="mb-8 grid gap-3 sm:grid-cols-3">'
    . $tile('Facturat', lei($bal['invoiced']))
    . $tile('Plătit', lei($bal['paid']))
    . ($bal['balance'] > 0 ? $tile('Rest de plată', lei($bal['balance']), 'border-carmin bg-carmin-pal') : $tile($bal['balance'] < 0 ? 'Avans în cont' : 'Sold', lei(abs($bal['balance'])), 'bg-menta-pal'))
    . '</div>';

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$invOptions = ['' => 'În cont (avans, fără factură)'];
foreach ($openInvoices as $i) {
    $invOptions[(string) $i['id']] = 'Factura ' . doc_number($i['series'], (int) $i['number']) . ' · rest ' . format_amount(open_amount($i)) . ' lei';
}
$locOptions = [];
foreach ($allowed as $l) {
    $locOptions[(string) $l] = $names[$l];
}
$receiptLink = '';
if (($rid = admin_int(query('chitanta'))) !== null) {
    $receiptLink = '<p class="mb-6"><a href="/admin/incasari/' . $rid . '/chitanta" class="' . e(btn('secondary')) . '">' . icon('printer', 18) . 'Tipăriți chitanța</a></p>';
}
$payForm = $p['anonymized_at'] !== null ? '<p class="mt-3 text-corp text-discret">Fișa este anonimizată.</p>' : '<form method="post" novalidate class="mt-4 flex flex-col gap-4">' . csrf_field() . error_summary($errors)
    . '<div class="grid gap-4 sm:grid-cols-2">'
    . text_field('amount', 'Suma (lei)', ['value' => $v['amount'], 'inputmode' => 'decimal', 'required' => true, 'error' => $err('amount'), 'autocomplete' => 'off',
        'hint' => $openInvoices !== [] ? 'Restul facturii: ' . format_amount(open_amount($openInvoices[0])) . ' lei.' : null])
    . text_field('paid_on', 'Data', ['type' => 'date', 'value' => $v['paid_on'], 'max' => date('Y-m-d'), 'error' => $err('paid_on')])
    . '</div>'
    . radio_group('method', 'Metoda', PAYMENT_METHODS, ['inline' => true, 'value' => $v['method']])
    . select_field('invoice_id', 'Pentru', $invOptions, ['value' => $v['invoice_id']])
    . (count($allowed) > 1 ? select_field('location_id', 'Clinica (pentru avans)', $locOptions, ['value' => $v['location_id'], 'error' => $err('location_id')]) : '<input type="hidden" name="location_id" value="' . e((string) ($allowed[0] ?? '')) . '">')
    . text_field('reference', 'Referința', ['value' => $v['reference'], 'optional' => true, 'hint' => 'Pentru card sau transfer: ultimele cifre, numărul ordinului de plată.'])
    . '<p class="text-mic text-discret">La numerar se dă chitanță cu număr.</p>'
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . icon('wallet', 18) . 'Înregistrați încasarea</button></div></form>';

$actions = $p['anonymized_at'] === null ? '<a href="/admin/facturi/noua?pacient=' . $id . '" class="' . e(btn('primary')) . '">' . icon('receipt', 18) . 'Factură nouă</a>' : '';
$body = patient_header($p, $user, 'financiar', $actions)
    . $receiptLink . $tiles
    . ($candidates > 0 ? '<p class="mb-8 flex flex-wrap items-center gap-3 rounded-panou bg-mustar-pal p-4 text-corp">' . icon('clipboard-list', 20) . e($candidates . ($candidates === 1 ? ' lucrare din planul de tratament nu este facturată.' : ' lucrări din planurile de tratament nu sunt facturate.'))
        . '<a href="/admin/facturi/noua?pacient=' . $id . '" class="ml-auto font-semibold text-link underline">Facturați</a></p>' : '')
    . '<div class="flex flex-col gap-8">'
    . '<details id="incasare-noua"' . ($errors !== [] || query('incaseaza') === '1' ? ' open' : '') . ' class="group rounded-panou border border-linie bg-suprafata p-4 md:p-6">'
    . '<summary class="flex cursor-pointer list-none items-center gap-2 text-h3 font-semibold">' . icon('wallet', 22, 'text-actiune') . 'Înregistrați o încasare' . icon('chevron-down', 20, 'ml-auto transition-transform group-open:rotate-180') . '</summary>'
    . '<div class="max-w-2xl">' . $payForm . '</div></details>'
    . admin_section_open('Facturi', 'facturi') . invoices_table($invoices, false) . '</section>'
    . admin_section_open('Încasări', 'incasari') . payments_table($payments, $user, false) . '</section>'
    . '</div>';
admin_page('Facturi și plăți: ' . patient_name($p), $body, $user);
