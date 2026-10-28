<?php
/**
 * /admin/facturi: the invoices of a period (this month by default), filtered by clinic, payment
 * state and number or patient; totals for the period; export for the accountant (CSV).
 */
declare(strict_types=1);

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
[$from, $to, $toEx] = admin_period(date('Y-m-01'), date('Y-m-d'));
$clinic = admin_int(query('clinica'));
$state = query('stare');
$q = trim(query('q'));
$page = max(1, (int) query('pagina'));

[$scope, $params] = billing_scope_sql($user, 'v.location_id');
$where = [$scope, 'v.issued_at >= ?', 'v.issued_at < ?'];
$params = array_merge($params, ["{$from} 00:00:00", "{$toEx} 00:00:00"]);
if ($clinic !== null && in_array($clinic, $allowed, true)) {
    $where[] = 'v.location_id = ?';
    $params[] = $clinic;
}
if ($state === 'neplatite') {
    $where[] = "v.status = 'emisa' AND v.amount_paid < v.total";
} elseif ($state === 'platite') {
    $where[] = "v.status = 'emisa' AND v.amount_paid >= v.total";
} elseif ($state === 'anulate') {
    $where[] = "v.status = 'anulata'";
}
if ($q !== '') {
    if (preg_match('/^(?:([A-Za-z]{1,8})[\s-]*)?0*(\d{1,9})$/', $q, $m)) {
        $where[] = '(v.number = ?' . ($m[1] !== '' ? ' AND v.series = ?' : '') . ' OR p.search_text LIKE ?)';
        $params[] = (int) $m[2];
        if ($m[1] !== '') {
            $params[] = strtoupper($m[1]);
        }
        $params[] = '%' . fold_text($q) . '%';
    } else {
        $where[] = '(p.search_text LIKE ? OR v.buyer_name LIKE ?)';
        $params[] = '%' . fold_text($q) . '%';
        $params[] = '%' . $q . '%';
    }
}
$sqlWhere = implode(' AND ', $where);
$base = "FROM invoices v JOIN patients p ON p.id = v.patient_id WHERE {$sqlWhere}";

if (query('csv') === '1') {
    $rows = db_all("SELECT v.*, p.first_name, p.last_name, p.file_number {$base} ORDER BY v.issued_at, v.number", $params);
    audit('export-facturi', "{$from} – {$to}");
    csv_download("facturi-{$from}-{$to}.csv", ['Seria', 'Numărul', 'Data', 'Clinica', 'Cumpărător', 'CUI', 'Pacient', 'Fișa', 'Valoare', 'Reduceri', 'TVA', 'Total', 'Achitat', 'Rest', 'Stare'], array_map(static fn ($r) => [
        $r['series'], (int) $r['number'], date('d.m.Y', strtotime($r['issued_at'])), $names[(int) $r['location_id']] ?? '', $r['buyer_name'], (string) $r['buyer_cui'], patient_name($r), (int) $r['file_number'],
        csv_lei((int) $r['subtotal']), csv_lei((int) $r['discount_total']), csv_lei((int) $r['vat_total']), csv_lei((int) $r['total']), csv_lei((int) $r['amount_paid']), csv_lei(open_amount($r)), PAY_STATE[payment_state($r)],
    ], $rows));
}

$count = (int) db_value("SELECT COUNT(*) {$base}", $params);
$sums = db_one("SELECT COALESCE(SUM(CASE WHEN v.status = 'emisa' THEN v.total END), 0) AS total, COALESCE(SUM(CASE WHEN v.status = 'emisa' THEN v.amount_paid END), 0) AS paid {$base}", $params);
$rows = db_all("SELECT v.*, p.first_name, p.last_name {$base} ORDER BY v.issued_at DESC, v.number DESC LIMIT " . ADMIN_PER_PAGE . ' OFFSET ' . (($page - 1) * ADMIN_PER_PAGE), $params);

$filters = ['de' => $from, 'pana' => $to, 'clinica' => $clinic, 'stare' => $state, 'q' => $q];
$clinicOptions = ['' => count($allowed) > 1 ? 'Toate clinicile' : ($names[$allowed[0] ?? 0] ?? '')];
foreach ($allowed as $l) {
    $clinicOptions[(string) $l] = $names[$l];
}
$form = '<form method="get" class="mb-6 grid gap-3 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">'
    . text_field('de', 'De la', ['type' => 'date', 'value' => $from])
    . text_field('pana', 'Până la', ['type' => 'date', 'value' => $to])
    . (count($allowed) > 1 ? select_field('clinica', 'Clinica', $clinicOptions, ['value' => (string) ($clinic ?? '')]) : '')
    . select_field('stare', 'Starea', ['' => 'Toate', 'neplatite' => 'Neplătite', 'platite' => 'Plătite', 'anulate' => 'Anulate'], ['value' => $state])
    . text_field('q', 'Număr sau pacient', ['value' => $q, 'autocomplete' => 'off'])
    . '<button type="submit" class="' . e(btn('primary', 'm', 'w-full')) . '">' . icon('filter', 18) . 'Filtrați</button></form>';
$tile = static fn (string $label, string $value) => '<div class="rounded-panou border border-linie bg-suprafata p-4"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.6rem] leading-tight cifre">' . e($value) . '</p></div>';
$tiles = '<div class="mb-6 grid gap-3 sm:grid-cols-3">' . $tile('Facturat', lei((int) $sums['total'])) . $tile('Încasat pe facturi', lei((int) $sums['paid'])) . $tile('Rest de încasat', lei(max(0, (int) $sums['total'] - (int) $sums['paid']))) . '</div>';

$pages = (int) ceil($count / ADMIN_PER_PAGE);
$pager = $pages > 1 ? '<nav aria-label="Pagini" class="mt-4 flex gap-2">'
    . ($page > 1 ? '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/facturi', $filters + ['pagina' => $page - 1])) . '">Înapoi</a>' : '')
    . '<span class="inline-flex items-center px-2 text-mic text-discret">Pagina ' . $page . ' din ' . $pages . '</span>'
    . ($page < $pages ? '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/facturi', $filters + ['pagina' => $page + 1])) . '">Înainte</a>' : '') . '</nav>' : '';

$actions = '<a href="' . e(admin_url('/admin/facturi', $filters + ['csv' => 1])) . '" class="' . e(btn('secondary')) . '">' . icon('download', 18) . 'Export Excel (CSV)</a>'
    . '<a href="/admin/facturi/noua" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Factură nouă</a>';
$body = admin_header('Facturi', $count . ($count === 1 ? ' factură' : ' facturi') . ' între ' . format_date($from) . ' și ' . format_date($to) . '.', $actions)
    . $form . $tiles
    . '<div class="rounded-panou border border-linie bg-suprafata p-2 md:p-4">' . invoices_table($rows) . '</div>' . $pager;
admin_page('Facturi', $body, $user);
