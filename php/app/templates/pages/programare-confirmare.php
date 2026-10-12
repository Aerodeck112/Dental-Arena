<?php
/**
 * /programare?confirmare={token}: after an online booking. The hour, the clinic, the doctor, how
 * the patient said they feel, „Adăugați în calendar” (.ics), the map, what to bring, and the
 * link to confirm or cancel. $a: the appointment of the token (null: the link no longer works).
 */
declare(strict_types=1);

header('X-Robots-Tag: noindex');
$clinic = null;
foreach (clinics() as $c) {
    if ($a !== null && $c['id'] === (int) $a['location_id']) {
        $clinic = $c;
    }
}
$doctor = $a ? db_value('SELECT public_name FROM doctors WHERE id = ?', [(int) $a['doctor_id']]) : null;
$token = query('confirmare');
$body = capture(function () use ($a, $clinic, $doctor, $token): void {
    ?>
<div class="<?= CONTAINER ?> py-sectiune">
  <div class="mx-auto max-w-[44rem]">
    <?php if ($a === null || $clinic === null) { ?>
      <h1 class="font-display text-h1">Linkul nu mai este valabil</h1>
      <p class="mt-6 text-lead text-discret">Pentru detalii despre programare, sunați-ne.</p>
    <?php } else { ?>
      <span class="flex size-16 items-center justify-center rounded-full bg-menta-pal text-actiune"><?= icon('check-check', 32) ?></span>
      <h1 class="mt-6 font-display text-h1 text-cerneala">Ora de <?= e(substr($a['starts_at'], 11, 5)) ?> este rezervată</h1>
      <p class="mt-3 text-lead text-discret first-letter:uppercase"><?= e(day_label($a['starts_at'])) ?>, la Dental Arena <?= e($clinic['shortName']) ?><?= $doctor ? ', cu ' . e($doctor) : '' ?>.</p>
      <div class="mt-8 rounded-panou border border-linie bg-suprafata p-6">
        <p class="font-semibold"><?= e(clinic_address($clinic)) ?></p>
        <p class="mt-1 text-corp">Telefon: <a class="font-semibold underline" href="<?= e(tel_href($clinic['phone'])) ?>"><?= e(format_phone($clinic['phone'])) ?></a></p>
        <?php if (in_array($a['comfort'], ['emotii', 'frica'], true)) { ?>
        <p class="mt-4 rounded-panou bg-menta-pal p-3 text-corp">Am notat că <?= $a['comfort'] === 'frica' ? 'vă e teamă' : 'aveți emoții' ?>. Medicul știe înainte să intrați și vă explică fiecare pas<?= (int) $a['wants_sedation'] === 1 ? '; pregătim inhalosedarea' : '' ?>.</p>
        <?php } ?>
        <div class="mt-5 flex flex-wrap gap-3">
          <a href="/p/<?= e($token) ?>/ics" class="<?= e(btn('primary')) ?>"><?= icon('calendar-plus', 18) ?>Adăugați în calendar</a>
          <a href="https://www.google.com/maps/search/?api=1&query=<?= e(rawurlencode('Dental Arena ' . clinic_address($clinic))) ?>" target="_blank" rel="noopener" class="<?= e(btn('secondary')) ?>"><?= icon('map-pin', 18) ?>Deschideți harta</a>
        </div>
      </div>
      <section class="mt-8" aria-labelledby="aveti">
        <h2 id="aveti" class="text-h3 font-semibold">Ce să aveți la dumneavoastră</h2>
        <ul class="mt-3 list-disc pl-5 text-corp">
          <li>Actul de identitate.</li>
          <li>Lista medicamentelor pe care le luați și, dacă aveți, radiografii sau documente medicale recente.</li>
          <li>Veniți cu 5–10 minute mai devreme, ca să completăm fișa.</li>
        </ul>
      </section>
      <p class="mt-8 text-corp">Ați primit (sau primiți) confirmarea pe telefon. Dacă nu mai puteți veni: <a class="font-semibold text-link underline" href="/p/<?= e($token) ?>">confirmați sau anulați programarea</a>.</p>
      <p class="mt-6"><a href="/programare" class="<?= e(btn('secondary')) ?>">Faceți o altă programare</a></p>
    <?php } ?>
  </div>
</div>
    <?php
});
render_page($body, page_meta(['title' => 'Programarea este făcută', 'description' => 'Programarea la Dental Arena.', 'path' => '/programare', 'noindex' => true]));
