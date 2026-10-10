<?php
/** /admin/cereri: the requests from the site, filtered by status, kind and clinic, newest first. */
declare(strict_types=1);

[$scope, $params] = lead_scope_sql($user);
$where = [$scope];
$stare = query('stare');
$tip = query('tip');
$clinica = query('clinica');
if (isset(LEAD_STATUS[$stare])) {
    $where[] = 'status = ?';
    $params[] = $stare;
}
if (in_array($tip, ['programare', 'contact'], true)) {
    $where[] = 'kind = ?';
    $params[] = $tip;
}
$names = admin_clinic_names();
$allowed = allowed_location_ids($user);
if ($clinica === 'fara') {
    $where[] = 'location_id IS NULL';
} elseif (($cid = admin_int($clinica)) !== null && in_array($cid, $allowed, true)) {
    $where[] = 'location_id = ?';
    $params[] = $cid;
}
$sql = implode(' AND ', $where);
$total = (int) db_value("SELECT COUNT(*) FROM leads WHERE {$sql}", $params);
$pages = max(1, (int) ceil($total / ADMIN_PER_PAGE));
$pagina = min($pages, max(1, (int) query('pagina', '1')));
$leads = db_all("SELECT * FROM leads WHERE {$sql} ORDER BY created_at DESC, id DESC LIMIT " . ADMIN_PER_PAGE . ' OFFSET ' . (($pagina - 1) * ADMIN_PER_PAGE), $params);

$clinicOptions = ['' => 'Toate clinicile'];
foreach ($allowed as $id) {
    if (isset($names[$id])) {
        $clinicOptions[(string) $id] = $names[$id];
    }
}
$clinicOptions['fara'] = 'Fără clinică';
$filters = '<form method="get" action="/admin/cereri" class="mb-6 grid gap-4 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">'
    . select_field('stare', 'Starea', ['' => 'Toate'] + LEAD_STATUS, ['value' => $stare])
    . select_field('tip', 'Tipul', ['' => 'Toate', 'programare' => 'Cereri de programare', 'contact' => 'Mesaje'], ['value' => $tip])
    . select_field('clinica', 'Clinica', $clinicOptions, ['value' => $clinica])
    . '<div class="flex gap-3"><button type="submit" class="' . e(btn('primary')) . '">' . icon('filter', 18) . 'Filtrați</button>'
    . '<a href="/admin/cereri" class="' . e(btn('text')) . '">Toate</a></div></form>';

$nav = '';
if ($pages > 1) {
    $q = ['stare' => $stare, 'tip' => $tip, 'clinica' => $clinica];
    $nav = '<nav aria-label="Pagini" class="mt-6 flex items-center gap-4">'
        . ($pagina > 1 ? '<a href="' . e(admin_url('/admin/cereri', $q + ['pagina' => $pagina - 1])) . '" class="' . e(btn('secondary', 's')) . '">' . icon('chevron-left', 16) . 'Înapoi</a>' : '')
        . '<span class="text-mic text-discret cifre">Pagina ' . $pagina . ' din ' . $pages . '</span>'
        . ($pagina < $pages ? '<a href="' . e(admin_url('/admin/cereri', $q + ['pagina' => $pagina + 1])) . '" class="' . e(btn('secondary', 's')) . '">Înainte' . icon('chevron-right', 16) . '</a>' : '')
        . '</nav>';
}

$body = admin_header('Cereri', 'Cererile de programare și mesajele trimise de pe site. Sunați pacientul, apoi treceți cererea la „Programat” sau „Închisă”.')
    . $filters
    . '<p class="mb-3 text-mic text-discret cifre">' . $total . ($total === 1 ? ' cerere' : ' cereri') . '</p>'
    . leads_table($leads) . $nav;
admin_page('Cereri', $body, $user);
