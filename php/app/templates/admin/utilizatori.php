<?php
/** /admin/utilizatori: the panel's accounts, with their role and clinics. */
declare(strict_types=1);

$names = admin_clinic_names();
$rows = db_all('SELECT * FROM users ORDER BY active DESC, role, name');
$locs = [];
foreach (db_all('SELECT user_id, location_id FROM user_locations') as $l) {
    $locs[(int) $l['user_id']][] = $names[(int) $l['location_id']] ?? '';
}
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$tr = '';
foreach ($rows as $u) {
    $id = (int) $u['id'];
    $tr .= '<tr class="border-t border-linie' . ((int) $u['active'] === 0 ? ' text-discret' : '') . '">'
        . '<td class="px-3 py-2"><a href="/admin/utilizatori/' . $id . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e($u['name']) . '</a><span class="block text-mic text-discret">' . e($u['email']) . '</span></td>'
        . '<td class="px-3 py-2">' . e(ROLES[$u['role']] ?? $u['role']) . '</td>'
        . '<td class="px-3 py-2">' . e($u['role'] === 'admin' ? 'Toate' : implode(', ', $locs[$id] ?? ['—'])) . '</td>'
        . '<td class="cifre px-3 py-2 text-mic">' . ($u['last_login_at'] ? e(format_datetime($u['last_login_at'])) : '<span class="text-discret">niciodată</span>') . '</td>'
        . '<td class="px-3 py-2 text-mic">' . ((int) $u['active'] === 1 ? 'Activ' : 'Dezactivat') . '</td></tr>';
}
$body = admin_header('Utilizatori', 'Conturile echipei. Recepția și medicii văd doar cererile clinicilor bifate pe contul lor.', '<a href="/admin/utilizatori/nou" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Cont nou</a>')
    . '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
    . '<th scope="col" class="' . $th . '">Nume</th><th scope="col" class="' . $th . '">Rol</th><th scope="col" class="' . $th . '">Clinici</th><th scope="col" class="' . $th . '">Ultima intrare</th><th scope="col" class="' . $th . '">Stare</th>'
    . '</tr></thead><tbody>' . $tr . '</tbody></table></div>';
admin_page('Utilizatori', $body, $user);
