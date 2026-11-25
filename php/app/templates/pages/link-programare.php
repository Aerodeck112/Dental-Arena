<?php
/**
 * /p/{token} and /p/{token}/ics: the patient's link to an appointment (in the confirmation SMS,
 * e-mail and reminder). Shows only the first name, the day, the hour, the clinic and the doctor
 * (never the reason or health data); confirm, cancel (until N hours before) and add to calendar.
 * A GET never changes anything (phones open links in advance).
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/lib.php';
require_once APP_DIR . '/src/admin/crm.php';
require_once APP_DIR . '/src/booking.php';

header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

$token = (string) $m[1];
$ics = !empty($m[2]);
if (!rate_hit('link:' . client_ip_hash(), 30, 600)) {
    http_response_code(429);
    exit('Prea multe încercări. Reveniți peste câteva minute.');
}
$a = appointment_from_token($token);
$clinic = null;
foreach (clinics() as $c) {
    if ($a !== null && $c['id'] === (int) $a['location_id']) {
        $clinic = $c;
    }
}
$p = $a ? db_one('SELECT first_name FROM patients WHERE id = ?', [(int) $a['patient_id']]) : null;
$doctor = $a ? db_one('SELECT public_name FROM doctors WHERE id = ?', [(int) $a['doctor_id']]) : null;

if ($ics) {
    if ($a === null || $clinic === null) {
        http_response_code(404);
        exit('Linkul nu mai este valabil.');
    }
    $fmt = static fn (string $d) => gmdate('Ymd\THis\Z', strtotime($d));
    $esc = static fn (string $s) => str_replace(["\\", ';', ',', "\n"], ['\\\\', '\;', '\,', '\n'], $s);
    $status = match ($a['status']) { 'confirmat', 'sosit', 'in-tratament', 'finalizat' => 'CONFIRMED', 'anulat', 'neprezentat' => 'CANCELLED', default => 'TENTATIVE' };
    $lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dental Arena//Programari//RO', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        'UID:' . (int) $a['id'] . '@dentalarena.ro', 'SEQUENCE:' . (int) $a['token_version'], 'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        'DTSTART:' . $fmt($a['starts_at']), 'DTEND:' . $fmt($a['ends_at']), 'STATUS:' . $status,
        'SUMMARY:' . $esc('Dental Arena ' . $clinic['shortName']),
        'LOCATION:' . $esc(clinic_address($clinic)),
        'DESCRIPTION:' . $esc(($doctor['public_name'] ?? '') . '. Telefon: ' . format_phone($clinic['phone'])),
        'BEGIN:VALARM', 'TRIGGER:-PT120M', 'ACTION:DISPLAY', 'DESCRIPTION:' . $esc('Programare la Dental Arena'), 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR',
    ];
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="programare-dental-arena.ics"');
    echo implode("\r\n", $lines) . "\r\n";
    exit;
}

$cfg = booking_settings();
$future = $a && strtotime($a['starts_at']) > time();
$canConfirm = $future && $a['status'] === 'programat';
$canCancel = $future && in_array($a['status'], ['programat', 'confirmat'], true) && strtotime($a['starts_at']) - (int) $cfg['cancel_hours'] * 3600 > time();
$done = null;
if ($a !== null && is_post()) {
    csrf_check();
    if (post('op') === 'confirma' && $canConfirm) {
        set_appointment_status((int) $a['id'], 'confirmat', ['id' => null]);
        db_update('appointments', ['confirmed_via' => 'link'], 'id = :id', ['id' => $a['id']]);
        $_SESSION['link_mesaj'] = 'Mulțumim! Programarea este confirmată.';
        redirect('/p/' . $token);
    }
    if (post('op') === 'anuleaza' && $canCancel) {
        set_appointment_status((int) $a['id'], 'anulat', ['id' => null], 'Anulată de pacient din link', 'pacient');
        $who = db_one('SELECT * FROM patients WHERE id = ?', [(int) $a['patient_id']]);
        $to = $clinic['email'] ?? (string) setting('notify_email');
        @send_mail($to, 'Programare anulată de pacient: ' . patient_name($who), "Pacientul a anulat programarea din linkul primit:\n\n" . patient_name($who) . ', ' . format_phone((string) $who['phone']) . "\n" . day_label($a['starts_at']) . ', ora ' . substr($a['starts_at'], 11, 5) . ', ' . ($doctor['public_name'] ?? '') . "\n\nOra este acum liberă în calendar.\n" . absolute_url('/admin/programari/' . (int) $a['id']) . "\n");
        $_SESSION['link_anulat'] = ['day' => day_label($a['starts_at']), 'time' => substr($a['starts_at'], 11, 5)];
        redirect('/p/anulat');
    }
}
session_begin();
$flash = $_SESSION['link_mesaj'] ?? null;
unset($_SESSION['link_mesaj']);

$phones = implode(' · ', array_map(static fn ($c) => '<a class="font-semibold underline" href="' . e(tel_href($c['phone'])) . '">' . e($c['shortName'] . ' ' . format_phone($c['phone'])) . '</a>', clinics()));
$body = capture(function () use ($a, $p, $doctor, $clinic, $token, $canConfirm, $canCancel, $cfg, $flash, $phones): void {
    ?>
<div class="<?= CONTAINER ?> py-sectiune">
  <div class="mx-auto max-w-[40rem]">
    <?php if ($a === null || $clinic === null) { ?>
      <h1 class="font-display text-h1 text-cerneala">Linkul nu mai este valabil</h1>
      <p class="mt-6 text-lead text-discret">Programarea a fost mutată, anulată sau a trecut. Pentru orice modificare, sunați-ne: <?= $phones ?>.</p>
    <?php } else {
        $status = $a['status']; ?>
      <p class="text-lead text-discret">Bună ziua<?= $p ? ', ' . e($p['first_name']) : '' ?>!</p>
      <h1 class="mt-1 font-display text-h1 text-cerneala">Programarea dumneavoastră</h1>
      <?php if ($flash) { ?><div class="mt-6"><?= success_panel($flash) ?></div><?php } ?>
      <div class="mt-8 rounded-panou border border-linie bg-suprafata p-6 shadow-sm">
        <p class="font-display text-[2rem] leading-tight first-letter:uppercase"><?= e(day_label($a['starts_at'])) ?>, ora <?= e(substr($a['starts_at'], 11, 5)) ?></p>
        <p class="mt-2 text-corp"><?= e('Dental Arena ' . $clinic['shortName']) ?> · <?= e(clinic_address($clinic)) ?></p>
        <p class="text-corp text-discret"><?= e($doctor['public_name'] ?? '') ?></p>
        <p class="mt-3"><span class="<?= e(cn('inline-flex rounded-full px-3 py-1 text-mic font-semibold', $status === 'confirmat' ? 'bg-menta-pal text-actiune' : ($status === 'anulat' ? 'bg-carmin-pal text-carmin' : 'bg-mustar-pal text-mustar-text'))) ?>"><?= e(APPT_STATUS[$status] ?? $status) ?></span></p>
      </div>
      <div class="mt-6 flex flex-wrap gap-3">
        <?php if ($canConfirm) { ?>
          <form method="post"><?= csrf_field() ?><input type="hidden" name="op" value="confirma"><button type="submit" class="<?= e(btn('primary', 'l')) ?>"><?= icon('check', 20) ?>Confirm programarea</button></form>
        <?php } ?>
        <a href="/p/<?= e($token) ?>/ics" class="<?= e(btn('secondary', 'l')) ?>"><?= icon('calendar-plus', 20) ?>Adăugați în calendar</a>
        <a href="https://www.google.com/maps/search/?api=1&query=<?= e(rawurlencode('Dental Arena ' . clinic_address($clinic))) ?>" target="_blank" rel="noopener" class="<?= e(btn('secondary', 'l')) ?>"><?= icon('map-pin', 20) ?>Deschideți harta</a>
      </div>
      <?php if ($canCancel) { ?>
        <details class="mt-8 rounded-panou border border-linie p-4">
          <summary class="cursor-pointer font-semibold text-carmin">Anulez programarea</summary>
          <p class="mt-3 text-corp">Sigur nu puteți veni? Ora devine liberă pentru alți pacienți.</p>
          <form method="post" class="mt-3 flex flex-wrap gap-3"><?= csrf_field() ?><input type="hidden" name="op" value="anuleaza">
            <button type="submit" class="<?= e(btn('danger')) ?>">Da, anulez</button>
          </form>
        </details>
      <?php } elseif (in_array($a['status'], ['programat', 'confirmat'], true)) { ?>
        <p class="mt-8 text-corp text-discret">Cu mai puțin de <?= (int) $cfg['cancel_hours'] ?> ore înainte, programarea se anulează sau se mută doar la telefon: <?= $phones ?>.</p>
      <?php } ?>
      <p class="mt-8 text-mic text-discret">Pentru a muta programarea, sunați-ne: <?= $phones ?>.</p>
    <?php } ?>
  </div>
</div>
    <?php
});
render_page($body, page_meta(['title' => 'Programarea dumneavoastră', 'description' => 'Programarea la Dental Arena.', 'path' => '/p', 'noindex' => true]));
