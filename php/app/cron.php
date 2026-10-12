<?php
/**
 * Scheduled work, for cPanel → Cron Jobs (every 5 minutes):
 *   php /home/CONT/dentalarena/cron.php
 * Sends the queued messages (SMS, WhatsApp, e-mail), queues tomorrow's reminders and the daily
 * notices (doctors' agenda, birthdays, thanks after a visit, recalls) and deletes old closed
 * requests. Without a cron job the same happens when someone opens the panel, so this only makes
 * it punctual.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
define('APP_DIR', __DIR__);
$public = is_dir(__DIR__ . '/../public_html') ? __DIR__ . '/../public_html' : __DIR__ . '/../public';
define('PUBLIC_DIR', (string) realpath($public));
require __DIR__ . '/bootstrap.php';
if (!INSTALLED) {
    fwrite(STDERR, "Site-ul nu este instalat încă (lipsește config.php).\n");
    exit(1);
}
require __DIR__ . '/src/admin/lib.php';
require __DIR__ . '/src/admin/crm.php';
require __DIR__ . '/src/admin/billing.php';
require __DIR__ . '/src/admin/clinical.php';

$queued = send_due_reminders();
run_daily_jobs();
purge_old_leads();
@file_put_contents(__DIR__ . '/storage/reminders.txt', (string) time());
$sent = 0;
do {
    $batch = process_message_queue(50);
    $sent += $batch;
} while ($batch === 50 && $sent < 500);
echo date('c') . " reamintiri puse în coadă: {$queued}, mesaje trimise: {$sent}\n";
