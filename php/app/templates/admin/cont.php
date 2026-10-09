<?php
/** /admin/cont: the user's own password. A new account is sent here until it picks its own. */
declare(strict_types=1);

$errors = [];
$forced = (int) $user['must_change_password'] === 1;
if (is_post()) {
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
$body = admin_header('Contul meu', $forced ? 'Alegeți o parolă a dumneavoastră înainte să continuați.' : $user['email'])
    . '<form method="post" novalidate class="flex max-w-md flex-col gap-5 rounded-panou border border-linie bg-suprafata p-6">' . csrf_field() . error_summary($errors)
    . '<h2 class="text-h3 font-semibold">Schimbați parola</h2>'
    . text_field('current', 'Parola de acum', ['type' => 'password', 'required' => true, 'autocomplete' => 'current-password', 'error' => $errors['current'] ?? null])
    . text_field('new', 'Parola nouă', ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password', 'hint' => 'Cel puțin 10 caractere.', 'error' => $errors['new'] ?? null])
    . text_field('again', 'Parola nouă, încă o dată', ['type' => 'password', 'required' => true, 'autocomplete' => 'new-password', 'error' => $errors['again'] ?? null])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">Schimbați parola</button></div></form>';
admin_page('Contul meu', $body, $user);
