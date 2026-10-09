<?php
/** /admin: what is new, per clinic, and the latest requests. */
declare(strict_types=1);

purge_old_leads();
[$scope, $params] = lead_scope_sql($user);
$names = admin_clinic_names();
$counts = [];
foreach (db_all("SELECT location_id, COUNT(*) AS n FROM leads WHERE status = 'nou' AND {$scope} GROUP BY location_id", $params) as $r) {
    $counts[$r['location_id'] === null ? 'fara' : (int) $r['location_id']] = (int) $r['n'];
}
$latest = db_all("SELECT * FROM leads WHERE {$scope} ORDER BY created_at DESC, id DESC LIMIT 10", $params);

$tiles = '';
foreach (allowed_location_ids($user) as $id) {
    if (!isset($names[$id])) {
        continue;
    }
    $n = $counts[$id] ?? 0;
    $tiles .= '<a href="' . e(admin_url('/admin/cereri', ['clinica' => $id, 'stare' => 'nou'])) . '" class="flex flex-col rounded-panou border border-linie bg-suprafata p-5 hover:border-cerneala">'
        . '<span class="text-mic text-discret">' . e($names[$id]) . '</span>'
        . '<span class="mt-1 font-display text-[2.5rem] leading-none cifre">' . $n . '</span>'
        . '<span class="mt-1 text-mic">' . ($n === 1 ? 'cerere nouă' : 'cereri noi') . '</span></a>';
}
if (isset($counts['fara'])) {
    $tiles .= '<a href="' . e(admin_url('/admin/cereri', ['clinica' => 'fara', 'stare' => 'nou'])) . '" class="flex flex-col rounded-panou border border-linie bg-suprafata p-5 hover:border-cerneala">'
        . '<span class="text-mic text-discret">Fără clinică</span><span class="mt-1 font-display text-[2.5rem] leading-none cifre">' . $counts['fara'] . '</span><span class="mt-1 text-mic">mesaje noi</span></a>';
}

$links = '';
if (is_admin($user)) {
    foreach ([['/admin/servicii', 'Prețurile', 'tag'], ['/admin/fotografii', 'Fotografiile site-ului', 'image'], ['/admin/utilizatori', 'Conturile echipei', 'shield'], ['/admin/setari', 'Datele firmei și ale clinicilor', 'settings']] as [$href, $label, $ico]) {
        $links .= '<li><a href="' . $href . '" class="flex min-h-control-l items-center gap-3 rounded-control border border-linie bg-suprafata px-4 hover:border-cerneala">' . admin_icon($ico, 20, 'text-actiune') . e($label) . '</a></li>';
    }
}

$hello = 'Bună ziua, ' . explode(' ', trim($user['name']))[0];
$body = admin_header($hello, format_date(new DateTimeImmutable(), true))
    . '<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">' . $tiles . '</div>'
    . '<div class="mt-10">' . admin_section_open('Ultimele cereri', 'ultimele')
    . '<div class="mt-4">' . leads_table($latest) . '</div>'
    . '<a href="/admin/cereri" class="mt-4 inline-flex min-h-control items-center font-medium text-link underline underline-offset-4">Toate cererile</a></section></div>'
    . ($links !== '' ? '<div class="mt-10"><h2 class="text-h3 font-semibold">Pe site</h2><ul class="mt-4 grid gap-3 sm:grid-cols-2">' . $links . '</ul></div>' : '');
admin_page('Acasă', $body, $user);
