<?php
/**
 * /admin/incasari: the payments journal (today by default): totals per method and per day, the
 * list, the CSV export, and cancelling a payment (administrators, with a reason).
 */
declare(strict_types=1);

if (is_post()) {
    csrf_check();
    $back = admin_safe_return(post('inapoi')) ?? '/admin/incasari';
    if (post('op') === 'anuleaza' && can('billing.cancel', $user)) {
        $pay = db_one('SELECT * FROM payments WHERE id = ?', [(int) post('id')]);
        $reason = trim(post('motiv'));
        if ($pay === null || !can_see_invoice($pay, $user)) {
            admin_not_found($user);
        }
        if (mb_strlen($reason) < 3) {
            flash('Scrieți motivul anulării încasării.', 'eroare');
        } else {
            try {
                cancel_payment((int) $pay['id'], $reason, $user);
                flash('Încasarea a fost anulată.');
            } catch (DomainException $e) {
                flash($e->getMessage(), 'eroare');
            }
        }
    }
    redirect($back);
}

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
[$from, $to, $toEx] = admin_period(date('Y-m-d'), date('Y-m-d'));
$clinic = admin_int(query('clinica'));
$method = query('metoda');
[$scope, $params] = billing_scope_sql($user, 'y.location_id');
$where = [$scope, 'y.paid_at >= ?', 'y.paid_at < ?'];
$params = array_merge($params, ["{$from} 00:00:00", "{$toEx} 00:00:00"]);
if ($clinic !== null && in_array($clinic, $allowed, true)) {
    $where[] = 'y.location_id = ?';
    $params[] = $clinic;
}
if (isset(PAYMENT_METHODS[$method])) {
    $where[] = 'y.method = ?';
    $params[] = $method;
}
$rows = payments_where(implode(' AND ', $where), $params, 2000);

if (query('csv') === '1') {
    audit('export-incasari', "{$from} – {$to}");
    csv_download("incasari-{$from}-{$to}.csv", ['Data', 'Ora', 'Clinica', 'Pacient', 'Fișa', 'Factura', 'Metoda', 'Chitanța', 'Referința', 'Suma', 'Anulată', 'Motivul anulării', 'Încasat de'], array_map(static fn ($r) => [
        date('d.m.Y', strtotime($r['paid_at'])), substr($r['paid_at'], 11, 5), $names[(int) $r['location_id']] ?? '', patient_name($r), (int) $r['file_number'],
        $r['invoice_id'] !== null ? doc_number($r['inv_series'], (int) $r['inv_number']) : 'avans', PAYMENT_METHODS[$r['method']] ?? $r['method'],
        $r['receipt_number'] !== null ? doc_number($r['receipt_series'], (int) $r['receipt_number']) : '', (string) $r['reference'], csv_lei((int) $r['amount']),
        $r['cancelled_at'] !== null ? 'da' : '', (string) $r['cancel_reason'], (string) $r['receiver'],
    ], array_reverse($rows)));
}

$byMethod = array_fill_keys(array_keys(PAYMENT_METHODS), 0);
$total = 0;
$byDay = [];
foreach ($rows as $r) {
    if ($r['cancelled_at'] !== null) {
        continue;
    }
    $byMethod[$r['method']] += (int) $r['amount'];
    $total += (int) $r['amount'];
    $d = substr($r['paid_at'], 0, 10);
    $byDay[$d] ??= array_fill_keys(array_keys(PAYMENT_METHODS), 0);
    $byDay[$d][$r['method']] += (int) $r['amount'];
}

$filters = ['de' => $from, 'pana' => $to, 'clinica' => $clinic, 'metoda' => $method];
$clinicOptions = ['' => count($allowed) > 1 ? 'Toate clinicile' : ($names[$allowed[0] ?? 0] ?? '')];
foreach ($allowed as $l) {
    $clinicOptions[(string) $l] = $names[$l];
}
$quick = '<p class="mb-3 flex flex-wrap gap-2">'
    . '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/incasari', ['clinica' => $clinic])) . '">Azi</a>'
    . '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/incasari', ['de' => date('Y-m-d', strtotime('-1 day')), 'pana' => date('Y-m-d', strtotime('-1 day')), 'clinica' => $clinic])) . '">Ieri</a>'
    . '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/incasari', ['de' => date('Y-m-01'), 'pana' => date('Y-m-d'), 'clinica' => $clinic])) . '">Luna aceasta</a></p>';
$form = '<form method="get" class="mb-6 grid gap-3 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">'
    . text_field('de', 'De la', ['type' => 'date', 'value' => $from])
    . text_field('pana', 'Până la', ['type' => 'date', 'value' => $to])
    . (count($allowed) > 1 ? select_field('clinica', 'Clinica', $clinicOptions, ['value' => (string) ($clinic ?? '')]) : '')
    . select_field('metoda', 'Metoda', ['' => 'Toate'] + PAYMENT_METHODS, ['value' => $method])
    . '<button type="submit" class="' . e(btn('primary', 'm', 'w-full')) . '">' . icon('filter', 18) . 'Filtrați</button></form>';
$tile = static fn (string $label, string $value, string $cls = '') => '<div class="' . e(cn('rounded-panou border border-linie bg-suprafata p-4', $cls)) . '"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.6rem] leading-tight cifre">' . e($value) . '</p></div>';
$tiles = '<div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">' . $tile('Total încasat', lei($total), 'bg-menta-pal');
foreach (PAYMENT_METHODS as $k => $label) {
    $tiles .= $tile($label, lei($byMethod[$k]));
}
$tiles .= '</div>';
$days = '';
if (count($byDay) > 1) {
    $th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
    $dr = '';
    foreach ($byDay as $d => $m) {
        $dr .= '<tr class="border-t border-linie"><td class="px-3 py-2">' . e(format_date($d, true)) . '</td>';
        foreach (PAYMENT_METHODS as $k => $l) {
            $dr .= '<td class="cifre px-3 py-2 text-right">' . e(lei($m[$k])) . '</td>';
        }
        $dr .= '<td class="cifre px-3 py-2 text-right font-semibold">' . e(lei(array_sum($m))) . '</td></tr>';
    }
    $head = '<th scope="col" class="' . $th . '">Ziua</th>';
    foreach (PAYMENT_METHODS as $l) {
        $head .= '<th scope="col" class="' . $th . ' text-right">' . e($l) . '</th>';
    }
    $days = admin_section_open('Pe zile', 'pe-zile') . '<div class="mt-3 relative overflow-x-auto"><table class="w-full min-w-[36rem] border-collapse text-corp"><thead><tr>' . $head . '<th scope="col" class="' . $th . ' text-right">Total</th></tr></thead><tbody>' . $dr . '</tbody></table></div></section>';
}

$actions = '<a href="' . e(admin_url('/admin/incasari', $filters + ['csv' => 1])) . '" class="' . e(btn('secondary')) . '">' . icon('download', 18) . 'Export Excel (CSV)</a>';
$body = admin_header('Încasări', ($from === $to ? 'Ziua ' . format_date($from, true) : 'Între ' . format_date($from) . ' și ' . format_date($to)) . '. Încasările anulate nu intră în totaluri.', $actions)
    . $quick . $form . $tiles
    . '<div class="flex flex-col gap-8">' . $days
    . admin_section_open('Lista încasărilor', 'lista') . payments_table($rows, $user) . '</section></div>';
admin_page('Încasări', $body, $user);
