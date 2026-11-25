<?php
/** /admin/intrare: e-mail and password; ?inapoi= brings the user back to the panel page they asked for. */
declare(strict_types=1);

$back = admin_safe_return(query('inapoi')) ?? '/admin';
if (current_user() !== null) {
    redirect($back);
}
$error = null;
$email = '';
if (is_post()) {
    csrf_check();
    $email = mb_strtolower(post('email'));
    $back = admin_safe_return(post('inapoi')) ?? '/admin';
    $error = ($email === '' || post('password') === '') ? 'Scrieți e-mailul și parola.' : attempt_login($email, (string) ($_POST['password'] ?? ''));
    if ($error === null) {
        redirect($back);
    }
}

$body = '<div class="mx-auto mt-6 max-w-md lg:mt-16">'
    . '<a href="/" aria-label="Dental Arena, site-ul">' . logo('h-12 w-auto', true, '150px') . '</a>'
    . '<h1 class="mt-10 font-display text-h1">Intrare în panou</h1>'
    . '<p class="mt-2 text-corp text-discret">Pentru echipa Dental Arena.</p>'
    . '<form method="post" action="/admin/intrare" novalidate class="mt-8 flex flex-col gap-5 rounded-panou border border-linie bg-suprafata p-6">'
    . csrf_field()
    . '<input type="hidden" name="inapoi" value="' . e($back) . '">'
    . ($error !== null ? '<p role="alert" data-autofocus tabindex="-1" class="flex items-start gap-2 rounded-panou border-2 border-carmin bg-carmin-pal p-3 text-corp">' . icon('alert-triangle', 20, 'mt-0.5 text-carmin') . e($error) . '</p>' : '')
    . text_field('email', 'E-mail', ['type' => 'email', 'value' => $email, 'required' => true, 'autocomplete' => 'username'])
    . text_field('password', 'Parola', ['type' => 'password', 'required' => true, 'autocomplete' => 'current-password'])
    . '<button type="submit" class="' . e(btn('primary', 'l', 'w-full')) . '">' . icon('log-in', 20) . 'Intrați</button>'
    . '</form>'
    . '<p class="mt-6 text-mic text-discret">Ați uitat parola? Cereți administratorului clinicii să vă seteze una nouă din Utilizatori.</p>'
    . '</div>';
admin_page('Intrare', $body);
