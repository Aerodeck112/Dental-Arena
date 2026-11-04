<?php
/**
 * /d/{token}: the link at the end of a marketing SMS or e-mail. One button takes the patient out
 * of all marketing messages (SMS, WhatsApp, e-mail); appointment notices are not affected.
 * The link carries no personal data and is never indexed.
 */
declare(strict_types=1);

$token = (string) ($m[1] ?? '');
$p = db_one('SELECT * FROM patients WHERE unsubscribe_token = ?', [$token]);
$done = false;
if ($p !== null && is_post()) {
    csrf_check();
    db_update('patients', ['marketing_sms' => 0, 'marketing_whatsapp' => 0, 'marketing_email' => 0, 'updated_at' => now_sql()], 'id = :id', ['id' => $p['id']]);
    audit('dezabonare', 'din mesajele de marketing', null, (int) $p['id']);
    $done = true;
}
$subscribed = $p !== null && ((int) $p['marketing_sms'] + (int) $p['marketing_whatsapp'] + (int) $p['marketing_email']) > 0;

$body = capture(function () use ($p, $done, $subscribed): void {
    ?>
<div class="<?= CONTAINER ?> py-sectiune">
  <div class="max-w-[40rem]">
    <h1 class="font-display text-h1 text-cerneala">Dezabonare</h1>
    <?php if ($p === null) { ?>
      <p class="mt-6 text-lead text-discret">Linkul nu mai este valabil. Dacă primiți în continuare mesaje pe care nu le doriți, sunați-ne și vă scoatem din listă.</p>
    <?php } elseif ($done || !$subscribed) { ?>
      <?= success_panel('Nu veți mai primi oferte și noutăți de la Dental Arena.', '<p class="mt-3 text-corp">Reamintirile programărilor rămân, ca să nu le pierdeți. Dacă vă răzgândiți, spuneți-ne la recepție.</p>') ?>
    <?php } else { ?>
      <p class="mt-6 text-lead text-discret">Apăsați butonul și nu veți mai primi oferte și noutăți de la Dental Arena, pe niciun canal. Reamintirile programărilor rămân.</p>
      <form method="post" class="mt-8"><?= csrf_field() ?><button type="submit" class="<?= e(btn('primary', 'l')) ?>">Nu mai doresc oferte și noutăți</button></form>
    <?php } ?>
    <p class="mt-10"><a href="/" class="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em]">Mergeți la prima pagină</a></p>
  </div>
</div>
    <?php
});
header('X-Robots-Tag: noindex, nofollow');
render_page($body, page_meta(['title' => 'Dezabonare', 'description' => 'Dezabonare de la mesajele Dental Arena.', 'path' => '/dezabonare', 'noindex' => true]));
