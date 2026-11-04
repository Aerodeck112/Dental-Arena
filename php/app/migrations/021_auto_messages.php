<?php
/**
 * October 2026: the patients get on their own only the message of a new appointment. Moved,
 * cancelled and the reminder of the day before are switched off (a doctor moving an appointment
 * a few times sent as many SMS); reception sends them by hand („Trimiteți SMS acum”), and
 * Setări → Mesaje can switch them on again. The doctors keep their programme of the morning.
 */
declare(strict_types=1);

$st = $pdo->prepare('SELECT v FROM settings WHERE k = ?');
$st->execute(['notificari']);
$raw = $st->fetchColumn();
$saved = is_string($raw) ? json_decode($raw, true) : null;
if (is_array($saved)) {
    foreach (['programare-mutata', 'programare-anulata', 'reamintire'] as $event) {
        $saved[$event] = ['phone' => false, 'email' => false] + (is_array($saved[$event] ?? null) ? $saved[$event] : []);
    }
    $pdo->prepare('UPDATE settings SET v = ? WHERE k = ?')->execute([json_encode($saved, JSON_UNESCAPED_UNICODE), 'notificari']);
}
