<?php
/**
 * POST /admin/calendar/muta: an appointment dragged or stretched in the calendar (assets/admin.js).
 * In: id, start (Y-m-d H:i), minutes, doctor or cabinet, force, undo. A doctor away or a closed
 * clinic blocks; any other problem comes back as „warn” and the calendar asks „Mutați oricum?”.
 * The answer carries „undo” (the old place), sent back the same way by „Anulați”. The message to
 * the patient about the new time waits two minutes, so a move undone at once sends nothing.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$out = static function (array $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
};
if (!is_post()) {
    $out(['error' => 'Doar POST.'], 405);
}
csrf_check();
$a = db_one('SELECT * FROM appointments WHERE id = ?', [(int) post('id')]);
if ($a === null || !can_see_appointment($a, $user)) {
    $out(['error' => 'Programarea nu a fost găsită.'], 404);
}
if (!in_array($a['status'], ['programat', 'confirmat', 'sosit', 'in-tratament'], true)) {
    $out(['error' => 'O programare „' . mb_strtolower(APPT_STATUS[$a['status']] ?? $a['status']) . '” nu se mai mută.'], 422);
}
$loc = (int) $a['location_id'];
$start = DateTimeImmutable::createFromFormat('!Y-m-d H:i', post('start'));
$minutes = (int) post('minutes');
if ($start === false || $minutes < 5 || $minutes > 480) {
    $out(['error' => 'Ora sau durata nu sunt corecte.'], 422);
}
$doc = admin_int(post('doctor')) ?? (int) $a['doctor_id'];
if (!in_array($doc, array_column(doctors_at($loc), 'id'), true)) {
    $out(['error' => 'Medicul nu lucrează la această clinică.'], 422);
}
$cabinet = post('cabinet') !== '' ? admin_int(post('cabinet')) : ($a['cabinet'] !== null ? (int) $a['cabinet'] : null);
if ($cabinet !== null && ($cabinet < 1 || $cabinet > (int) db_value('SELECT cabinets FROM locations WHERE id = ?', [$loc]))) {
    $cabinet = null;
}
$startsAt = $start->format('Y-m-d H:i:s');
$endsAt = $start->modify("+{$minutes} minutes")->format('Y-m-d H:i:s');
$undo = ['id' => (int) $a['id'], 'start' => substr($a['starts_at'], 0, 16), 'minutes' => (int) ((strtotime($a['ends_at']) - strtotime($a['starts_at'])) / 60), 'doctor' => (int) $a['doctor_id'], 'cabinet' => $a['cabinet'] !== null ? (int) $a['cabinet'] : ''];
$label = static fn () => hm($startsAt) . '–' . hm($endsAt) . ', ' . (doctor_short_names()[$doc] ?? '');
if ($startsAt === $a['starts_at'] && $endsAt === $a['ends_at'] && $doc === (int) $a['doctor_id'] && $cabinet === ($a['cabinet'] !== null ? (int) $a['cabinet'] : null)) {
    $out(['ok' => true, 'label' => $label(), 'undo' => null]);
}
$isUndo = post('undo') === '1';
$check = appointment_checks($doc, $loc, $startsAt, $endsAt, (int) $a['patient_id'], (int) $a['id'], $cabinet);
if ($check['block'] !== null) {
    $out(['block' => $check['block']]);
}
if ($check['warn'] !== [] && post('force') !== '1' && !$isUndo) {
    $out(['warn' => $check['warn']]);
}

$timeChanged = $startsAt !== $a['starts_at'] || $doc !== (int) $a['doctor_id'];
$row = ['starts_at' => $startsAt, 'ends_at' => $endsAt, 'doctor_id' => $doc, 'cabinet' => $cabinet, 'updated_by' => $user['id'], 'updated_at' => now_sql()];
if ($timeChanged) {
    // The patient's old link stops working; a new start gets a new reminder.
    $row['token_version'] = (int) $a['token_version'] + 1;
    if ($startsAt !== $a['starts_at']) {
        $row['reminder_sent_at'] = null;
    }
}
db_update('appointments', $row, 'id = :id', ['id' => $a['id']]);
if ($startsAt !== $a['starts_at']) {
    drop_pending_reminder((int) $a['id']);
}

$future = strtotime($startsAt) > time() && in_array($a['status'], ['programat', 'confirmat'], true);
if ($timeChanged && $future) {
    // Undo right away: the notices of the move were not sent yet, so none goes out.
    $dropped = $isUndo ? db_run("DELETE FROM messages WHERE appointment_id = ? AND status = 'in-asteptare' AND event IN ('programare-mutata', 'staff-programare-mutata') AND created_at > ?", [$a['id'], date('Y-m-d H:i:s', time() - 600)]) : 0;
    if (!$isUndo || $dropped === 0) {
        db_run("DELETE FROM messages WHERE appointment_id = ? AND status = 'in-asteptare' AND event IN ('programare-mutata', 'staff-programare-mutata')", [$a['id']]);
        notify_appointment('programare-mutata', (int) $a['id']);
        db_run("UPDATE messages SET send_after = ? WHERE appointment_id = ? AND status = 'in-asteptare' AND event IN ('programare-mutata', 'staff-programare-mutata')", [date('Y-m-d H:i:s', time() + 120), $a['id']]);
    }
}
audit($isUndo ? 'programare-mutare-anulata' : 'programare-mutata', "#{$a['id']}: " . substr($a['starts_at'], 0, 16) . ' → ' . substr($startsAt, 0, 16) . ($doc !== (int) $a['doctor_id'] ? ', alt medic' : '') . ($endsAt !== $a['ends_at'] && $startsAt === $a['starts_at'] ? ', altă durată' : ''), null, (int) $a['patient_id']);
$out(['ok' => true, 'label' => $label(), 'undo' => $isUndo ? null : $undo]);
