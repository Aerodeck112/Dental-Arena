<?php
/**
 * /programare: the booking REQUEST. The Next.js version booked live slots; on shared hosting the
 * clinic confirms by phone, so the patient leaves the clinic, the service, the day and time window
 * they prefer, and how they feel about the dentist. Prefilled from ?clinica=, ?serviciu=, ?confort=.
 * POST saves the request (Cereri in the panel) and e-mails the clinic, then shows the confirmation.
 */
declare(strict_types=1);

$clinics = clinics();
$errors = [];
$values = [
    'location' => array_key_exists(query('clinica'), $clinics) ? query('clinica') : '',
    'serviciu' => in_array(query('serviciu'), service_slugs(), true) ? query('serviciu') : '',
    'confort' => array_key_exists(query('confort'), COMFORT_LABELS) ? query('confort') : '',
    'interval' => 'oricand',
];
$sentMessage = null;

if (is_post()) {
    csrf_check();
    $r = submit_lead('programare');
    if ($r['ok']) {
        $_SESSION['programare_trimisa'] = $r['message'];
        redirect('/programare#cerere', 303);
    }
    $errors = $r['errors'];
    $values = $r['values'] + $values;
} elseif (isset($_COOKIE['da_sesiune'])) {
    session_begin();
    $sentMessage = $_SESSION['programare_trimisa'] ?? null;
    unset($_SESSION['programare_trimisa']);
}

$body = capture(function () use ($clinics, $errors, $values, $sentMessage): void {
    $err = static fn (string $k): ?string => $errors[$k] ?? null;
    $services = ['' => 'Nu știu încă: o consultație'];
    foreach (content('services') as $s) {
        $services[$s['slug']] = $s['title'];
    }
    $clinicOptions = [];
    foreach ($clinics as $slug => $c) {
        $clinicOptions[$slug] = ['label' => $c['shortName'], 'description' => clinic_address($c)];
    }
    $comfort = ['' => 'Nu vreau să spun'] + array_map(static fn ($l) => $l, COMFORT_LABELS);
    $comfort['frica'] = 'Mi-e frică';
    ?>
<div class="<?= CONTAINER ?> pt-6 pb-sectiune md:pt-10">
  <nav aria-label="Cale de navigare" class="text-mic text-discret">
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <li class="inline-flex items-center gap-2"><a class="text-discret underline underline-offset-4 hover:text-link hover:decoration-2" href="/">Acasă</a><span aria-hidden="true" class="text-linie-control">/</span></li>
      <li class="inline-flex items-center gap-2"><span aria-current="page" class="text-cerneala">Programare</span></li>
    </ol>
  </nav>
  <div class="mt-8 grid grid-cols-1 gap-x-gutter gap-y-12 lg:mt-12 lg:grid-cols-12">
    <div class="lg:col-span-7">
      <h1 class="font-display text-h1 text-cerneala">Programare online</h1>
      <p class="mt-5 text-lead text-discret masura-lead">Lăsați-ne datele și vă sunăm în cel mult o zi lucrătoare ca să stabilim ora.</p>
      <div id="cerere" class="mt-10 scroll-mt-28">
        <?php if ($sentMessage !== null) { ?>
        <?= success_panel($sentMessage, 'Dacă vă grăbiți, sunați direct la clinică.') ?>
        <p class="mt-6"><a href="/" class="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">Înapoi la prima pagină</a></p>
        <?php } else { ?>
        <form method="post" action="/programare#cerere" novalidate class="flex flex-col gap-8">
          <?= error_summary($errors) ?>
          <?= csrf_field() ?>
          <?= bot_fields() ?>
          <?= radio_group('location', 'La ce clinică veniți?', $clinicOptions, ['required' => true, 'value' => $values['location'] ?? '', 'error' => $err('location')]) ?>
          <?= select_field('serviciu', 'Pentru ce veniți?', $services, ['value' => $values['serviciu'] ?? '', 'hint' => 'Dacă nu știți sigur, alegeți consultația: medicul vă spune ce e de făcut.']) ?>
          <div class="grid gap-6 sm:grid-cols-2">
            <?= text_field('data', 'Ziua dorită', ['type' => 'date', 'value' => $values['data'] ?? '', 'optional' => true, 'min' => date('Y-m-d'), 'max' => date('Y-m-d', strtotime('+6 months')), 'error' => $err('data')]) ?>
          </div>
          <?= radio_group('interval', 'Când vă convine?', TIME_WINDOWS, ['inline' => true, 'value' => $values['interval'] ?? 'oricand']) ?>
          <?= radio_group('confort', 'Cum vă simțiți când vă gândiți la dentist?', $comfort, ['inline' => true, 'optional' => true, 'value' => $values['confort'] ?? '', 'hint' => 'Medicul vede răspunsul înainte să intrați. Dacă vă e frică, putem lucra sub inhalosedare.']) ?>
          <fieldset class="flex flex-col gap-6">
            <legend class="mb-1 text-h3 font-semibold text-cerneala">Datele dumneavoastră</legend>
            <?= text_field('name', 'Nume și prenume', ['value' => $values['name'] ?? '', 'required' => true, 'autocomplete' => 'name', 'maxlength' => 80, 'error' => $err('name')]) ?>
            <div class="grid gap-6 sm:grid-cols-2">
              <?= text_field('phone', 'Telefon', ['type' => 'tel', 'value' => $values['phone'] ?? '', 'required' => true, 'autocomplete' => 'tel', 'maxlength' => 20, 'error' => $err('phone'), 'hint' => 'Vă sunăm la acest număr.']) ?>
              <?= text_field('email', 'E-mail', ['type' => 'email', 'value' => $values['email'] ?? '', 'optional' => true, 'autocomplete' => 'email', 'maxlength' => 190, 'error' => $err('email'), 'hint' => 'Vă trimitem confirmarea cererii.']) ?>
            </div>
            <?= text_area('message', 'Ceva ce ar trebui să știm', ['value' => $values['message'] ?? '', 'optional' => true, 'rows' => 4, 'maxlength' => 2000]) ?>
          </fieldset>
          <?= checkbox_field('consent', 'Sunt de acord ca Dental Arena să folosească aceste date ca să mă contacteze pentru programare, conform <a href="/politica-de-confidentialitate" class="text-link underline underline-offset-4">Politicii de confidențialitate</a>', [
              'required' => true,
              'checked' => ($values['consent'] ?? '') === '1',
              'error' => $err('consent'),
          ]) ?>
          <div><?= submit_button('Trimiteți cererea') ?></div>
        </form>
        <?php } ?>
      </div>
    </div>
    <aside aria-labelledby="sunati-direct" class="lg:col-span-4 lg:col-start-9">
      <div class="flex flex-col gap-6 lg:sticky lg:top-28">
        <section class="rounded-panou bg-suprafata p-6">
          <h2 id="sunati-direct" class="text-h3 font-semibold text-cerneala">Vă grăbiți? Sunați direct</h2>
          <ul class="mt-4 flex flex-col gap-3">
            <?php foreach ($clinics as $c) { ?>
            <li>
              <p class="text-mic text-discret"><?= e($c['shortName']) ?></p>
              <?= phone_link_full($c, false, true, 'text-h3', 'font-semibold') ?>
              <?php if ($c['hoursText']) { ?><p class="text-mic text-discret cifre"><?= e(strtok($c['hoursText'], "\n")) ?></p><?php } ?>
            </li>
            <?php } ?>
          </ul>
        </section>
        <section aria-labelledby="ce-urmeaza" class="rounded-panou border border-linie p-6">
          <h2 id="ce-urmeaza" class="text-h3 font-semibold text-cerneala">Ce urmează</h2>
          <ol class="mt-4 flex flex-col gap-3 text-corp text-cerneala">
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">1</span>Vă sunăm în cel mult o zi lucrătoare.</li>
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">2</span>Stabilim împreună ziua și ora.</li>
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">3</span>Vă așteptăm la clinică. Prima vizită începe cu o consultație.</li>
          </ol>
        </section>
        <?= comfort_note('Vă e teamă?', 'Spuneți-ne în formular. Putem lucra sub inhalosedare: rămâneți conștient, doar mult mai relaxat.') ?>
      </div>
    </aside>
  </div>
</div>
    <?php
});

render_page($body, page_meta([
    'title' => 'Programare online',
    'description' => 'Programați-vă la Dental Arena Cristești, lângă Târgu Mureș, sau Luduș: alegeți clinica, serviciul și ora care vă convine. Vă sunăm ca să confirmăm.',
    'path' => '/programare',
]), json_ld(breadcrumb_ld([['name' => 'Programare', 'path' => '/programare']])));
