<?php
/** /admin/echipa: the doctors shown on the site. */
declare(strict_types=1);

$rows = db_all('SELECT * FROM doctors ORDER BY sort_order, last_name');
$items = '';
foreach ($rows as $r) {
    $d = public_doctor($r);
    $items .= '<li><a href="/admin/echipa/' . (int) $r['id'] . '" class="flex items-center gap-4 rounded-panou border border-linie bg-suprafata p-3 hover:border-cerneala">'
        . '<span class="w-16 shrink-0">' . doctor_portrait($d, '64px') . '</span>'
        . '<span class="min-w-0"><span class="block text-h3 font-semibold">' . e($r['public_name']) . '</span><span class="block text-mic text-discret">' . e($r['role_line']) . '</span>'
        . ((int) $r['public_visible'] === 0 ? '<span class="mt-1 inline-block rounded-chip bg-adancit px-2 text-mic">Nu apare pe site</span>' : '') . '</span></a></li>';
}
$body = admin_header('Echipa', 'Medicii de pe site: portretul, numele, specialitatea, descrierea și serviciile fiecăruia.', '<a href="/admin/echipa/nou" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Adăugați un medic</a>')
    . '<ul class="grid gap-3 md:grid-cols-2">' . $items . '</ul>';
admin_page('Echipa', $body, $user);
