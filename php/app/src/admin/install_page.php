<?php
/** /admin/instalare: the one-time setup form (only while config.php does not exist). */
declare(strict_types=1);

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$errors = [];
$values = [
    'db_host' => 'localhost',
    'db_name' => '',
    'db_user' => '',
    'admin_name' => '',
    'admin_email' => '',
    'url' => site_url(),
    'site_mode' => 'live',
];
$checks = install_checks();
$blocking = array_filter($checks, static fn ($c) => !$c['ok'] && !str_contains($c['label'], 'GD'));

if (is_post() && $blocking === []) {
    csrf_check();
    foreach (array_keys($values) as $k) {
        $values[$k] = post($k, $values[$k]);
    }
    $result = run_install($_POST);
    if ($result['ok']) {
        session_begin();
        flash('Site-ul este instalat. Intrați cu adresa de e-mail și parola alese.');
        redirect('/admin/intrare');
    }
    $errors = $result['errors'];
}

$body = capture(function () use ($errors, $values, $checks, $blocking): void {
    ?>
<main id="continut" class="mx-auto w-full max-w-3xl px-margine py-12">
  <?= logo('h-12 w-auto', true, '150px', 'Dental Arena') ?>
  <h1 class="mt-10 font-display text-h1">Instalarea site-ului</h1>
  <p class="mt-4 text-lead text-discret">Un singur pas: legăm site-ul de baza de date creată în cPanel și alegeți contul de administrator. Durează un minut.</p>

  <section aria-labelledby="verificari" class="mt-10 rounded-panou border border-linie bg-suprafata p-6">
    <h2 id="verificari" class="text-h3 font-semibold">Serverul</h2>
    <ul class="mt-4 flex flex-col gap-3">
      <?php foreach ($checks as $c) { ?>
      <li class="flex items-start gap-3">
        <?= $c['ok'] ? icon('check', 22, 'text-actiune') : icon('alert-triangle', 22, 'text-carmin') ?>
        <span><span class="text-corp"><?= e($c['label']) ?></span><?php if (!$c['ok']) { ?><span class="block text-mic text-discret"><?= e($c['fix']) ?></span><?php } ?></span>
      </li>
      <?php } ?>
    </ul>
  </section>

  <?php if ($blocking !== []) { ?>
  <p class="mt-8 rounded-panou border-2 border-carmin bg-carmin-pal p-5 text-corp">Rezolvați întâi punctele marcate cu roșu, apoi reîncărcați pagina.</p>
  <?php } else { ?>
  <form method="post" class="mt-10 flex flex-col gap-10" novalidate>
    <?= csrf_field() ?>
    <?= error_summary($errors) ?>
    <fieldset class="flex flex-col gap-6">
      <legend class="text-h3 font-semibold">Baza de date</legend>
      <p class="-mt-3 text-corp text-discret">Din cPanel → MySQL Databases: creați o bază, un utilizator cu parolă și adăugați utilizatorul la bază cu toate drepturile (ALL PRIVILEGES).</p>
      <?= text_field('db_name', 'Numele bazei de date', ['value' => $values['db_name'], 'required' => true, 'error' => $errors['db_name'] ?? null, 'hint' => 'De forma contcpanel_dentalarena', 'autocomplete' => 'off']) ?>
      <?= text_field('db_user', 'Utilizatorul bazei de date', ['value' => $values['db_user'], 'required' => true, 'error' => $errors['db_user'] ?? null, 'autocomplete' => 'off']) ?>
      <?= text_field('db_pass', 'Parola utilizatorului', ['type' => 'password', 'autocomplete' => 'off']) ?>
      <?= text_field('db_host', 'Serverul bazei de date', ['value' => $values['db_host'], 'hint' => 'Lăsați localhost, dacă firma de hosting nu v-a spus altceva.']) ?>
    </fieldset>
    <fieldset class="flex flex-col gap-6">
      <legend class="text-h3 font-semibold">Site-ul</legend>
      <?= text_field('url', 'Adresa site-ului', ['value' => $values['url'], 'required' => true, 'error' => $errors['url'] ?? null, 'hint' => 'Cu https, fără / la final. De exemplu https://dentalarena.ro']) ?>
      <?= radio_group('site_mode', 'Ce fel de instalare este?', [
          'live' => ['label' => 'Site-ul public', 'description' => 'Apare în Google, trimite e-mailuri.'],
          'test' => ['label' => 'Copie de test', 'description' => 'Nu apare în Google; e-mailurile se scriu doar în jurnal.'],
      ], ['value' => $values['site_mode']]) ?>
    </fieldset>
    <fieldset class="flex flex-col gap-6">
      <legend class="text-h3 font-semibold">Contul de administrator</legend>
      <?= text_field('admin_name', 'Numele dumneavoastră', ['value' => $values['admin_name'], 'required' => true, 'error' => $errors['admin_name'] ?? null, 'autocomplete' => 'name']) ?>
      <?= text_field('admin_email', 'E-mail (cu el intrați în panou)', ['type' => 'email', 'value' => $values['admin_email'], 'required' => true, 'error' => $errors['admin_email'] ?? null, 'autocomplete' => 'email']) ?>
      <?= text_field('admin_password', 'Parola', ['type' => 'password', 'required' => true, 'error' => $errors['admin_password'] ?? null, 'hint' => 'Cel puțin 10 caractere.', 'autocomplete' => 'new-password']) ?>
      <?= text_field('admin_password2', 'Parola, încă o dată', ['type' => 'password', 'required' => true, 'error' => $errors['admin_password2'] ?? null, 'autocomplete' => 'new-password']) ?>
    </fieldset>
    <div><?= submit_button('Instalați site-ul') ?></div>
  </form>
  <?php } ?>
</main>
    <?php
});

render_page($body, page_meta(['title' => 'Instalarea site-ului', 'description' => 'Instalarea site-ului Dental Arena.', 'path' => '/admin/instalare', 'noindex' => true]), '', false);
