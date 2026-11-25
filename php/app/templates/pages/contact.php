<?php
/**
 * /contact (src/app/(site)/(pagini)/contact/page.tsx): both clinics split on the axis (ClinicSplit)
 * with the maps behind consent (MapConsent), and „Scrieți-ne” (ContactForm).
 * POST checks and saves the message, then redirects back (no second message on reload).
 */
declare(strict_types=1);

$errors = [];
$values = [];
$sentMessage = null;

if (is_post()) {
    csrf_check();
    $r = submit_lead('contact');
    if ($r['ok']) {
        // Kept in the session for the next GET (a key of its own, so the panel's flash messages stay).
        $_SESSION['contact_trimis'] = $r['message'];
        redirect('/contact#scrieti-ne', 303);
    }
    $errors = $r['errors'];
    $values = $r['values'];
} elseif (isset($_COOKIE['da_sesiune'])) {
    session_begin();
    $sentMessage = $_SESSION['contact_trimis'] ?? null;
    unset($_SESSION['contact_trimis']);
}

$clinics = clinics();

$body = capture(function () use ($clinics, $errors, $values, $sentMessage): void {
    service_hero([
        'breadcrumbs' => [['href' => '/', 'label' => 'Acasă'], ['label' => 'Contact']],
        'title' => 'Contact',
        'lead' => 'Sunați direct la clinica la care veniți, programați-vă online sau scrieți-ne. Vă răspundem în cel mult o zi lucrătoare.',
        'bookingHref' => '/programare',
        'secondary' => null,
        'art' => 'molar',
    ]);
    ?>
<section id="clinici" aria-labelledby="clinici-titlu" class="scroll-mt-24 py-sectiune">
  <div class="<?= CONTAINER ?>">
    <h2 id="clinici-titlu" class="sr-only">Clinicile</h2>
    <div class="relative grid grid-cols-1 gap-y-16 md:grid-cols-2">
      <span aria-hidden="true" class="absolute inset-y-0 left-1/2 hidden w-px bg-linie md:block"></span>
      <?php $i = 0;
      foreach ($clinics as $slug => $c) {
          $hours = $c['hoursText'] ? array_values(array_filter(array_map('trim', preg_split('/\R/', $c['hoursText']) ?: []), static fn ($l) => $l !== '')) : []; ?>
      <article id="<?= e($slug) ?>" aria-labelledby="clinica-<?= e($slug) ?>" class="<?= e(cn('flex scroll-mt-28 flex-col', $i++ === 0 ? 'md:pr-[calc(var(--spacing-gutter)*2)]' : 'md:pl-[calc(var(--spacing-gutter)*2)]')) ?>">
        <div class="relative aspect-[4/3] w-full overflow-hidden rounded-mare bg-adancit">
          <?= photo(site_image("clinica.{$slug}"), '(min-width: 1280px) 600px, (min-width: 768px) 46vw, 100vw') ?>
        </div>
        <h2 id="clinica-<?= e($slug) ?>" class="mt-6 font-display text-nume text-cerneala"><?= e($c['name']) ?></h2>
        <p class="mt-2 text-corp text-cerneala"><?= e(clinic_address($c)) ?><?php if ($c['area']) { ?><span class="block text-discret"><?= e($c['area']) ?></span><?php } ?></p>
        <?= phone_link_full($c, false, true, 'mt-2 self-start text-h3', 'font-semibold') ?>
        <?php if ($hours !== []) { ?>
        <div class="mt-4">
          <p class="text-control font-semibold text-cerneala">Program</p>
          <ul class="mt-1 text-corp text-cerneala cifre">
            <?php foreach ($hours as $line) { ?><li><?= e($line) ?></li><?php } ?>
          </ul>
        </div>
        <?php } ?>
        <div class="mt-auto pt-6">
          <?php // site.js swaps the placeholder for the Google map once the visitor agreed (cookie da_consent). ?>
          <div data-harta data-src="<?= e($c['mapsEmbed']) ?>" data-title="Harta: <?= e($c['name']) ?>" class="relative aspect-[3/2] w-full overflow-hidden rounded-foto bg-adancit">
            <div class="flex size-full flex-col items-start justify-end gap-3 p-5 sm:p-6">
              <?= icon('map-pin', 28, 'text-discret') ?>
              <p class="max-w-[34ch] text-corp text-cerneala">Harta Google poate seta cookie-uri, de aceea o afișăm doar dacă sunteți de acord.</p>
              <div class="flex flex-wrap items-center gap-x-5 gap-y-1">
                <button type="button" data-incarca-harta data-mereu class="<?= e(btn('secondary')) ?>">Afișați harta</button>
                <a href="<?= e($c['mapsLink']) ?>" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">Deschideți în Google Maps<span class="sr-only"> (se deschide într-o filă nouă)</span></a>
              </div>
            </div>
          </div>
        </div>
      </article>
      <?php } ?>
    </div>
  </div>
</section>

<section aria-labelledby="scrieti-ne" class="bg-suprafata py-sectiune">
  <div class="<?= CONTAINER ?> grid grid-cols-1 gap-x-gutter gap-y-10 lg:grid-cols-12">
    <div class="lg:col-span-4">
      <h2 id="scrieti-ne" class="scroll-mt-28 font-display text-h2 text-cerneala">Scrieți-ne</h2>
      <p class="mt-4 text-corp text-cerneala">Pentru o întrebare despre un tratament sau un preț. Pentru o programare, trimiteți-ne o cerere de programare sau sunați la clinică.</p>
      <a href="/programare" class="<?= e(btn('secondary', 'm', 'mt-6')) ?>">Programați-vă online</a>
      <p class="mt-8 text-corp text-cerneala">E-mail: <a href="mailto:<?= e(content('site.email')) ?>" class="text-link underline underline-offset-[0.2em] hover:decoration-2"><?= e(content('site.email')) ?></a></p>
    </div>
    <div class="lg:col-span-7 lg:col-start-6">
      <?php if ($sentMessage !== null) { ?>
      <?= success_panel($sentMessage, 'Dacă este urgent, sunați direct la clinica la care veniți.') ?>
      <?php } else {
          $err = static fn (string $k): ?string => $errors[$k] ?? null;
          $locations = [];
          foreach ($clinics as $slug => $c) {
              $locations[$slug] = $c['shortName'];
          }
          $locations[''] = 'Nu contează'; ?>
      <form method="post" action="/contact#scrieti-ne" novalidate class="flex flex-col gap-6">
        <?= error_summary($errors) ?>
        <?= csrf_field() ?>
        <?= bot_fields() ?>
        <?= text_field('name', 'Nume și prenume', ['value' => $values['name'] ?? '', 'required' => true, 'autocomplete' => 'name', 'maxlength' => 80, 'error' => $err('name')]) ?>
        <div class="grid gap-6 sm:grid-cols-2">
          <?= text_field('phone', 'Telefon', ['type' => 'tel', 'value' => $values['phone'] ?? '', 'optional' => true, 'autocomplete' => 'tel', 'maxlength' => 20, 'error' => $err('phone')]) ?>
          <?= text_field('email', 'E-mail', ['type' => 'email', 'value' => $values['email'] ?? '', 'optional' => true, 'autocomplete' => 'email', 'maxlength' => 190, 'error' => $err('email')]) ?>
        </div>
        <p class="-mt-3 text-mic text-discret">Lăsați-ne cel puțin un telefon sau un e-mail, ca să vă putem răspunde.</p>
        <?= radio_group('location', 'Despre ce clinică ne scrieți?', $locations, ['inline' => true, 'value' => $values['location'] ?? '', 'error' => $err('location')]) ?>
        <?= text_area('message', 'Mesajul dumneavoastră', ['value' => $values['message'] ?? '', 'required' => true, 'rows' => 6, 'maxlength' => 2000, 'error' => $err('message')]) ?>
        <?= checkbox_field('consent', 'Sunt de acord ca Dental Arena să folosească aceste date ca să îmi răspundă, conform <a href="/politica-de-confidentialitate" class="text-link underline underline-offset-4">Politicii de confidențialitate</a>', [
            'required' => true,
            'checked' => ($values['consent'] ?? '') === '1',
            'error' => $err('consent'),
        ]) ?>
        <div><?= submit_button('Trimiteți mesajul') ?></div>
      </form>
      <?php } ?>
    </div>
  </div>
</section>
    <?php
});

$ld = json_ld(breadcrumb_ld([['name' => 'Contact', 'path' => '/contact']]), ...array_map('dentist_ld', array_values($clinics)));
render_page($body, page_meta([
    'title' => 'Contact: clinicile din Cristești și Luduș',
    'description' => 'Adresa, telefonul și harta clinicilor Dental Arena din Cristești, lângă Târgu Mureș, și din Luduș. Sunați, scrieți-ne sau programați-vă online.',
    'path' => '/contact',
]), $ld);
