<?php
/**
 * /admin/tablete: the tablets allowed to open /tableta. Opened on the tablet itself, „Asociați
 * această tabletă” leaves a random token in its browser and signs the account out, so the
 * patients who use it never reach the panel. A lost tablet is cut off with „Opriți”.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$here = kiosk_device();
$errors = [];
if (is_post()) {
    csrf_check();
    $op = post('op');
    if ($op === 'asociaza') {
        $name = trim(post('name'));
        $loc = (int) post('location_id');
        if ($name === '') {
            $errors['name'] = 'Dați tabletei un nume, de exemplu „Recepție Luduș”.';
        }
        if ($errors === []) {
            kiosk_pair($name, isset($names[$loc]) ? $loc : null, $user);
            // The tablet stays in patients' hands: nobody is signed in on it any more.
            audit('iesire');
            logout();
            redirect('/tableta');
        }
    }
    if ($op === 'opreste') {
        $d = db_one('SELECT * FROM kiosk_devices WHERE id = ? AND revoked_at IS NULL', [(int) post('id')]);
        if ($d) {
            db_update('kiosk_devices', ['revoked_at' => now_sql()], 'id = :id', ['id' => $d['id']]);
            audit('tableta-oprita', $d['name']);
            flash('Tableta „' . $d['name'] . '” nu mai poate deschide pagina de semnare.');
        }
        redirect('/admin/tablete');
    }
}

$rows = '';
foreach (db_all('SELECT k.*, u.name AS author, (SELECT COUNT(*) FROM consent_sessions s WHERE s.device_id = k.id) AS signed FROM kiosk_devices k LEFT JOIN users u ON u.id = k.created_by ORDER BY k.revoked_at IS NULL DESC, k.created_at DESC') as $d) {
    $off = $d['revoked_at'] !== null;
    $rows .= '<tr class="border-t border-linie' . ($off ? ' text-discret' : '') . '">'
        . '<td class="py-3 pr-4"><span class="font-semibold">' . e($d['name']) . '</span>' . ($here && (int) $here['id'] === (int) $d['id'] ? ' <span class="ml-1 rounded-full bg-menta-pal px-2 py-0.5 text-mic text-actiune">acest dispozitiv</span>' : '') . '</td>'
        . '<td class="py-3 pr-4">' . e($names[(int) $d['location_id']] ?? '—') . '</td>'
        . '<td class="py-3 pr-4 text-mic">' . e(format_datetime($d['created_at'])) . ($d['author'] ? '<br>' . e($d['author']) : '') . '</td>'
        . '<td class="py-3 pr-4 text-mic">' . ($d['last_seen_at'] ? e(format_datetime($d['last_seen_at'])) : '—') . '</td>'
        . '<td class="py-3 pr-4 text-right cifre">' . (int) $d['signed'] . '</td>'
        . '<td class="py-3 text-right">' . ($off ? '<span class="text-mic">Oprită ' . e(format_date($d['revoked_at'])) . '</span>'
            : '<form method="post" data-confirma="Tableta „' . e($d['name']) . '” nu va mai putea deschide pagina de semnare. Continuați?">' . csrf_field() . '<input type="hidden" name="op" value="opreste"><input type="hidden" name="id" value="' . (int) $d['id'] . '"><button type="submit" class="' . e(btn('text', 's')) . '">Opriți</button></form>')
        . '</td></tr>';
}
$th = 'py-2 pr-4 text-left text-mic font-semibold text-discret';
$list = $rows !== '' ? '<div class="relative mt-4 overflow-x-auto"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead><tr><th scope="col" class="' . $th . '">Tableta</th><th scope="col" class="' . $th . '">Clinica</th><th scope="col" class="' . $th . '">Asociată</th><th scope="col" class="' . $th . '">Folosită ultima dată</th><th scope="col" class="' . $th . ' text-right">Semnări</th><th scope="col" class="py-2"><span class="sr-only">Acțiuni</span></th></tr></thead><tbody>' . $rows . '</tbody></table></div>'
    : '<p class="mt-4 text-corp text-discret">Nicio tabletă încă.</p>';

$pair = $here !== null
    ? '<div class="mt-4 flex flex-wrap items-center gap-4 rounded-panou bg-menta-pal p-4">' . icon('check', 20, 'text-actiune') . '<p class="min-w-0 flex-1">Acest dispozitiv este tableta „' . e($here['name']) . '”.</p><a href="/tableta" class="' . e(btn('primary', 's')) . '">Deschideți pagina de semnare</a></div>'
    : '<form method="post" novalidate class="mt-4 grid gap-4 md:grid-cols-12 md:items-end">' . csrf_field() . '<input type="hidden" name="op" value="asociaza">'
        . error_summary($errors)
        . text_field('name', 'Numele tabletei', ['value' => post('name') ?: 'Recepție ' . ($names[current_clinic_id($user) ?? 0] ?? ''), 'error' => $errors['name'] ?? null, 'class' => 'min-w-0 md:col-span-5'])
        . select_field('location_id', 'Clinica', ['' => '—'] + $names, ['value' => post('location_id') ?: (string) (current_clinic_id($user) ?? ''), 'class' => 'min-w-0 md:col-span-4'])
        . '<div class="md:col-span-3"><button type="submit" class="' . e(btn('primary', 'm', 'w-full')) . '">' . admin_icon('tablet', 18) . 'Asociați această tabletă</button></div></form>';

$steps = '<ol class="mt-4 grid gap-4 md:grid-cols-3">'
    . '<li class="rounded-panou border border-linie p-4"><p class="font-semibold">1. Pe tabletă</p><p class="mt-1 text-mic text-discret">Deschideți această pagină pe tableta de la recepție, intrați cu contul de administrator și apăsați „Asociați această tabletă”. Contul se închide singur pe tabletă.</p></li>'
    . '<li class="rounded-panou border border-linie p-4"><p class="font-semibold">2. În fișa pacientului</p><p class="mt-1 text-mic text-discret">La Documente → „Semnare pe tabletă” alegeți acordurile și apăsați „Dați un cod”. Spuneți pacientului codul din 6 cifre (e valabil ' . KIOSK_CODE_MINUTES . ' de minute).</p></li>'
    . '<li class="rounded-panou border border-linie p-4"><p class="font-semibold">3. Pacientul semnează</p><p class="mt-1 text-mic text-discret">Introduce codul, citește, bifează și semnează cu degetul. În fișă apar acordurile semnate, semnătura și, dacă a completat, chestionarul medical.</p></li></ol>'
    . '<p class="mt-4 text-mic text-discret">Sfat: pe tabletă puneți pagina pe ecranul principal („Adăugați pe ecranul de pornire”) și activați modul „acces ghidat” (iPad) sau „fixare aplicație” (Android), ca pacienții să nu poată ieși din ea.</p>';

$body = admin_header('Tablete de semnare', 'Pacienții semnează acordurile pe tableta de la recepție, cu un cod din 6 cifre dat de dumneavoastră.')
    . '<div class="flex max-w-5xl flex-col gap-8">'
    . admin_section_open('Cum funcționează', 'cum') . $steps . '</section>'
    . admin_section_open('Acest dispozitiv', 'asociere') . $pair . '</section>'
    . admin_section_open('Tabletele', 'lista') . $list . '</section>'
    . '</div>';
admin_page('Tablete de semnare', $body, $user);
