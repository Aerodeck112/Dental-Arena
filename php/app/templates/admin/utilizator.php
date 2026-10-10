<?php
/**
 * /admin/utilizatori/{id|nou}: name, e-mail, role, the clinics (Cristești / Luduș checkboxes),
 * active, and a password. A new account must choose its own password at the first login.
 */
declare(strict_types=1);

$isNew = $param === 'nou';
$acc = $isNew ? null : db_one('SELECT * FROM users WHERE id = ?', [(int) $param]);
if (!$isNew && $acc === null) {
    admin_not_found($user);
}
$self = !$isNew && (int) $acc['id'] === (int) $user['id'];
$clinicNames = admin_clinic_names();
$errors = [];
$v = [
    'name' => $acc['name'] ?? '',
    'email' => $acc['email'] ?? '',
    'role' => $acc['role'] ?? 'receptie',
    'active' => (string) ($acc['active'] ?? 1),
    'doctor_id' => (string) ($acc['doctor_id'] ?? ''),
    'locations' => $isNew ? [] : array_map('intval', array_column(db_all('SELECT location_id FROM user_locations WHERE user_id = ?', [$acc['id']]), 'location_id')),
];

if (is_post()) {
    csrf_check();
    $v['name'] = post('name');
    $v['email'] = mb_strtolower(post('email'));
    $v['role'] = post('role');
    $v['active'] = post('active') === '1' ? '1' : '0';
    $v['doctor_id'] = (string) (admin_int(post('doctor_id')) ?? '');
    $v['locations'] = array_values(array_filter(array_map('intval', is_array($_POST['locations'] ?? null) ? $_POST['locations'] : []), static fn ($id) => isset($clinicNames[$id])));
    $password = (string) ($_POST['password'] ?? '');
    if ($self) {
        // Nobody locks themself out: an administrator keeps the role and stays active.
        $v['role'] = 'admin';
        $v['active'] = '1';
    }
    if (mb_strlen($v['name']) < 3) {
        $errors['name'] = 'Scrieți numele și prenumele.';
    }
    if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Scrieți o adresă de e-mail corectă.';
    } elseif (db_value('SELECT 1 FROM users WHERE email = ? AND id <> ?', [$v['email'], $acc['id'] ?? 0])) {
        $errors['email'] = 'Există deja un cont cu acest e-mail.';
    }
    if (!isset(ROLES[$v['role']])) {
        $errors['role'] = 'Alegeți rolul.';
    } elseif ($v['role'] !== 'admin' && $v['locations'] === []) {
        $errors['locations'] = 'Bifați cel puțin o clinică.';
    }
    if ($isNew || $password !== '') {
        if (($p = password_problem($password)) !== null) {
            $errors['password'] = $p;
        }
    }
    if ($errors === []) {
        $id = db_tx(static function () use ($v, $isNew, $acc, $password) {
            $row = ['name' => mb_substr($v['name'], 0, 120), 'email' => $v['email'], 'role' => $v['role'], 'active' => (int) $v['active'],
                'doctor_id' => $v['role'] === 'medic' && $v['doctor_id'] !== '' && db_value('SELECT 1 FROM doctors WHERE id = ?', [(int) $v['doctor_id']]) ? (int) $v['doctor_id'] : null];
            if ($isNew) {
                $id = db_insert('users', $row + ['password_hash' => password_hash($password, PASSWORD_DEFAULT), 'must_change_password' => 1, 'created_at' => now_sql()]);
            } else {
                $id = (int) $acc['id'];
                db_update('users', $row, 'id = :id', ['id' => $id]);
            }
            db_run('DELETE FROM user_locations WHERE user_id = ?', [$id]);
            $locs = $v['role'] === 'admin' ? array_map('intval', array_column(db_all('SELECT id FROM locations'), 'id')) : $v['locations'];
            foreach ($locs as $lid) {
                db_run('INSERT INTO user_locations (user_id, location_id) VALUES (?, ?)', [$id, $lid]);
            }
            return $id;
        });
        if (!$isNew && $password !== '') {
            set_password($id, $password, !$self);
        }
        audit($isNew ? 'utilizator-nou' : 'utilizator', "{$v['email']} ({$v['role']})" . ($password !== '' && !$isNew ? ', parolă nouă' : ''));
        flash($isNew ? 'Contul a fost creat. Dați-i persoanei e-mailul și parola; la prima intrare își alege o parolă nouă.' : 'Contul a fost salvat.');
        redirect("/admin/utilizatori/{$id}");
    }
}

$clinicBoxes = '';
foreach ($clinicNames as $id => $n) {
    $clinicBoxes .= checkbox_field('locations[]', e($n), ['id' => "field-locations-{$id}", 'value' => (string) $id, 'checked' => in_array($id, $v['locations'], true)]);
}
$body = '<p class="mb-4"><a href="/admin/utilizatori" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Utilizatori</a></p>'
    . admin_header($isNew ? 'Cont nou' : $acc['name'], $isNew ? '' : ($acc['last_login_at'] ? 'Ultima intrare: ' . format_datetime($acc['last_login_at']) : 'Nu a intrat încă.'))
    . '<form method="post" novalidate class="flex max-w-3xl flex-col gap-8" autocomplete="off">' . csrf_field() . error_summary($errors)
    . admin_section_open('Persoana', 'persoana')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . text_field('name', 'Nume și prenume', ['value' => $v['name'], 'required' => true, 'error' => $errors['name'] ?? null])
    . text_field('email', 'E-mail (cu el intră în panou)', ['type' => 'email', 'value' => $v['email'], 'required' => true, 'error' => $errors['email'] ?? null])
    . '</div></section>'
    . admin_section_open('Ce vede', 'acces')
    . '<div class="mt-4 flex flex-col gap-6">'
    . ($self ? '<p class="text-corp">Sunteți administrator. Nu vă puteți schimba singur rolul.</p>' : radio_group('role', 'Rolul', [
        'receptie' => ['label' => 'Recepție', 'description' => 'Vede și rezolvă cererile clinicilor bifate.'],
        'medic' => ['label' => 'Medic', 'description' => 'Vede cererile clinicilor bifate.'],
        'admin' => ['label' => 'Administrator', 'description' => 'Vede tot: prețuri, fotografii, echipa, conturile și setările.'],
    ], ['value' => $v['role'], 'error' => $errors['role'] ?? null]))
    . '<fieldset id="field-locations" tabindex="-1" class="flex flex-col gap-1"><legend class="mb-1.5 text-control font-medium">Clinica în care lucrează</legend>'
    . '<p class="-mt-1 mb-1 text-mic text-discret">Pentru recepție și medici. Administratorul vede ambele clinici.</p>'
    . '<div class="flex flex-wrap gap-x-8">' . $clinicBoxes . '</div>' . field_error('field-locations-error', $errors['locations'] ?? null) . '</fieldset>'
    . select_field('doctor_id', 'Profilul de medic (pentru rolul Medic)', ['' => 'Niciunul'] + array_map(static fn ($n) => (string) $n, array_column(db_all('SELECT id, public_name FROM doctors ORDER BY sort_order'), 'public_name', 'id')), ['value' => $v['doctor_id'], 'hint' => 'Programările noi făcute de acest cont se pun implicit la acest medic.'])
    . ($self ? '' : checkbox_field('active', 'Contul este activ', ['checked' => $v['active'] === '1', 'description' => 'Un cont dezactivat nu mai poate intra în panou.']))
    . '</div></section>'
    . admin_section_open($isNew ? 'Parola de început' : 'Parolă nouă', 'parola', $isNew ? 'O spuneți persoanei; la prima intrare își alege una nouă.' : 'Completați doar dacă persoana și-a uitat parola. Va fi rugată să-și aleagă una nouă.')
    . '<div class="mt-4 max-w-md">' . text_field('password', 'Parola', ['type' => 'text', 'required' => $isNew, 'optional' => !$isNew, 'autocomplete' => 'new-password', 'error' => $errors['password'] ?? null, 'hint' => 'Cel puțin 10 caractere.']) . '</div></section>'
    . '<div><button type="submit" class="' . e(btn('primary', 'l')) . '">' . ($isNew ? 'Creați contul' : 'Salvați') . '</button></div></form>';
admin_page($isNew ? 'Cont nou' : $acc['name'], $body, $user);
