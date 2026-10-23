<?php
/**
 * /admin/cont: the user's own password, phone, and which notices they want (SMS, WhatsApp,
 * e-mail). A new account is sent here until it picks its own password.
 */
declare(strict_types=1);

$errors = [];
$forced = (int) $user['must_change_password'] === 1;
if (is_post() && in_array(post('op'), ['sesiuni', 'tema'], true) && !$forced) {
    csrf_check();
    if (post('op') === 'sesiuni') {
        end_all_sessions((int) $user['id'], true);
        audit('sesiuni-inchise', 'contul propriu, celelalte dispozitive');
        flash('Ați ieșit din cont de pe toate celelalte dispozitive.');
    } else {
        db_update('users', ['theme' => isset(PANEL_THEMES[post('theme')]) ? post('theme') : null], 'id = :id', ['id' => $user['id']]);
        flash('Aspectul a fost salvat.');
    }
    redirect('/admin/cont');
}
$prefs = user_notify_prefs($user);
$phone = (string) ($user['phone'] ?? '');
if (is_post() && post('op') === 'notificari' && !$forced) {
    csrf_check();
    $phone = trim(post('phone'));
    if ($phone !== '' && phone_e164($phone) === null) {
        $errors['phone'] = 'Scrieți numărul ca 0744 123 456.';
    }
    $prefs = [];
    foreach (STAFF_EVENTS as $ev => $def) {
        foreach (array_keys(MSG_CHANNELS) as $ch) {
            if (post("{$ev}_{$ch}") === '1') {
                $prefs[$ev][] = $ch;
            }
        }
    }
    if ($errors === [] && $phone === '' && array_filter($prefs, static fn ($chs) => array_diff($chs, ['email']) !== []) !== []) {
        $errors['phone'] = 'Pentru SMS sau WhatsApp scrieți numărul de telefon.';
    }
    if ($errors === []) {
        db_update('users', ['phone' => $phone !== '' ? format_phone($phone) : null, 'notify_prefs' => json_encode($prefs)], 'id = :id', ['id' => $user['id']]);
        flash('Notificările au fost salvate.');
        redirect('/admin/cont#notificari');
    }
} elseif (is_post()) {
    csrf_check();
    $current = (string) ($_POST['current'] ?? '');
    $new = (string) ($_POST['new'] ?? '');
    $again = (string) ($_POST['again'] ?? '');
    $row = db_one('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
    if (!password_verify($current, (string) $row['password_hash'])) {
        $errors['current'] = 'Parola de acum nu este corectă.';
    }
    if (($p = password_problem($new)) !== null) {
        $errors['new'] = $p;
    } elseif ($new === $current) {
        $errors['new'] = 'Alegeți o parolă diferită de cea de acum.';
    } elseif ($new !== $again) {
        $errors['again'] = 'Cele două parole nu sunt la fel.';
    }
    if ($errors === []) {
        set_password((int) $user['id'], $new, false);
        audit('parola-schimbata', $user['email']);
        flash('Parola a fost schimbată.');
        redirect('/admin');
    }
}

$password = '<form method="post" novalidate class="flex min-w-0 flex-col gap-5 rounded-panou border border-linie bg-suprafata p-6">' . csrf_field() . (post('op') !== 'notificari' ? error_summary($errors) : '')
    . '<h2 class="text-h3 font-semibold">Schimbați parola</h2>'
    . text_field('current', 'Parola de acum', ['type' => 'password', 'required' => true, 'autocomplete' => 'current-password', 'error' => $errors['current'] ?? null])
    . text_field('new', 'Parola nouă', ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password', 'hint' => 'Cel puțin 10 caractere.', 'error' => $errors['new'] ?? null])
    . text_field('again', 'Parola nouă, încă o dată', ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password', 'error' => $errors['again'] ?? null])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">Schimbați parola</button></div></form>';

$notices = '';
if (!$forced) {
    $rows = '';
    foreach (STAFF_EVENTS as $ev => $def) {
        if ($def['who'] === 'medic' && $user['role'] !== 'medic' && !is_admin($user)) {
            continue;
        }
        if ($def['who'] === 'receptie' && $user['role'] === 'medic') {
            continue;
        }
        $boxes = '';
        foreach (MSG_CHANNELS as $ch => $label) {
            $boxes .= '<td class="px-2 py-2 text-center"><input type="checkbox" name="' . e("{$ev}_{$ch}") . '" value="1" aria-label="' . e($def['label'] . ' pe ' . $label) . '"' . (in_array($ch, $prefs[$ev] ?? [], true) ? ' checked' : '') . ' class="size-5 cursor-pointer accent-[var(--da-actiune)]"></td>';
        }
        $rows .= '<tr class="border-t border-linie"><th scope="row" class="py-2 pr-3 text-left font-normal">' . e($def['label']) . ($def['who'] === 'medic' ? '<span class="block text-mic text-discret">pentru programările la medicul legat de contul dvs.</span>' : '') . '</th>' . $boxes . '</tr>';
    }
    $th = 'px-2 py-2 text-center text-mic font-semibold text-discret';
    $notices = '<form id="notificari" method="post" novalidate class="flex min-w-0 flex-col gap-5 rounded-panou border border-linie bg-suprafata p-6">' . csrf_field() . '<input type="hidden" name="op" value="notificari">'
        . (post('op') === 'notificari' ? error_summary($errors) : '')
        . '<h2 class="text-h3 font-semibold">Notificările mele</h2>'
        . (is_doctor($user) && !$user['doctor_id'] ? '<p class="text-mic text-mustar-text">Contul nu e legat de un medic din echipă; administratorul îl leagă din Utilizatori.</p>' : '')
        . text_field('phone', 'Telefonul meu', ['type' => 'tel', 'value' => $phone, 'optional' => true, 'error' => $errors['phone'] ?? null, 'hint' => 'Pentru SMS și WhatsApp.'])
        . '<div class="relative overflow-x-auto"><table class="w-full min-w-[26rem] border-collapse text-corp"><thead><tr><th scope="col" class="py-2 text-left text-mic font-semibold text-discret">Când</th><th scope="col" class="' . $th . '">SMS</th><th scope="col" class="' . $th . '">WhatsApp</th><th scope="col" class="' . $th . '">E-mail</th></tr></thead><tbody>' . $rows . '</tbody></table></div>'
        . '<p class="text-mic text-discret">WhatsApp merge doar pentru notificările care au șablon aprobat în Setări → Mesaje.</p>'
        . '<div><button type="submit" class="' . e(btn('primary')) . '">Salvați notificările</button></div></form>';
}

$extra = $forced ? '' : '<form method="post" class="flex min-w-0 flex-col gap-4 rounded-panou border border-linie bg-suprafata p-6">' . csrf_field() . '<input type="hidden" name="op" value="tema">'
    . '<h2 class="text-h3 font-semibold">Aspectul panoului</h2>'
    . radio_group('theme', 'Culorile', PANEL_THEMES, ['value' => (string) ($user['theme'] ?? 'luminos'), 'inline' => true])
    . '<div><button type="submit" class="' . e(btn('secondary')) . '">Salvați</button></div></form>'
    . '<form method="post" class="flex min-w-0 flex-col gap-4 rounded-panou border border-linie bg-suprafata p-6" data-confirma="Ieșiți din cont de pe toate celelalte dispozitive?">' . csrf_field() . '<input type="hidden" name="op" value="sesiuni">'
    . '<h2 class="text-h3 font-semibold">Dispozitivele mele</h2>'
    . '<p class="text-corp text-discret">Dacă ați intrat în cont pe un calculator sau telefon pe care nu-l mai folosiți (sau l-ați pierdut), ieșiți de peste tot. Aici rămâneți în cont.</p>'
    . '<div><button type="submit" class="' . e(btn('secondary')) . '">' . icon('log-out', 18) . 'Ieșiți de pe celelalte dispozitive</button></div></form>';
$body = admin_header('Contul meu', $forced ? 'Alegeți o parolă a dumneavoastră înainte să continuați.' : $user['email'])
    . '<div class="grid max-w-5xl gap-8 lg:grid-cols-2">' . $password . $notices . $extra . '</div>';
admin_page('Contul meu', $body, $user);
