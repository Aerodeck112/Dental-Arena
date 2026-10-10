<?php
/**
 * /admin/rechemari: patients due for a check-up. Call, note the attempt, book, or mark that the
 * patient does not want it. By default: overdue and the next 14 days, at the current clinic.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$clinicId = current_clinic_id($user);
if ($clinicId !== null) {
    remember_clinic($clinicId);
}
if (is_post()) {
    csrf_check();
    $r = db_one('SELECT r.*, p.preferred_location_id FROM recalls r JOIN patients p ON p.id = r.patient_id WHERE r.id = ?', [(int) post('id')]);
    $loc = $r ? ($r['location_id'] ?? $r['preferred_location_id']) : null;
    if ($r === null || (!is_admin($user) && $loc !== null && !in_array((int) $loc, allowed_location_ids($user), true))) {
        admin_not_found($user);
    }
    $note = mb_substr(post('nota'), 0, 1000);
    $row = ['updated_at' => now_sql()];
    if ($note !== '') {
        $row['outcome_note'] = trim(($r['outcome_note'] ? $r['outcome_note'] . "\n" : '') . date('d.m') . ': ' . $note);
    }
    match (post('op')) {
        'sunat' => $row += ['status' => 'contactat', 'attempts' => (int) $r['attempts'] + 1, 'last_attempt_at' => now_sql()],
        'refuzat' => $row += ['status' => 'refuzat'],
        'amana' => $row += ['due_date' => date('Y-m-d', strtotime('+1 month', strtotime($r['due_date']))), 'status' => 'de-facut'],
        default => null,
    };
    db_update('recalls', $row, 'id = :id', ['id' => $r['id']]);
    audit('rechemare', "#{$r['id']} " . post('op'), null, (int) $r['patient_id']);
    flash('Rechemarea a fost actualizată.');
    redirect(admin_url('/admin/rechemari', ['clinica' => $clinicId, 'toate' => query('toate')]));
}

$all = query('toate') === '1';
$params = [];
$where = "r.status IN ('de-facut', 'contactat') AND p.active = 1";
if (!$all) {
    $where .= ' AND r.due_date <= ?';
    $params[] = date('Y-m-d', strtotime('+14 days'));
}
if ($clinicId !== null) {
    $where .= ' AND (r.location_id = ? OR (r.location_id IS NULL AND (p.preferred_location_id = ? OR p.preferred_location_id IS NULL)))';
    $params[] = $clinicId;
    $params[] = $clinicId;
}
$rows = db_all("SELECT r.*, p.first_name, p.last_name, p.phone FROM recalls r JOIN patients p ON p.id = r.patient_id WHERE {$where} ORDER BY r.due_date, r.id LIMIT 200", $params);
$today = date('Y-m-d');
$items = '';
foreach ($rows as $r) {
    $late = $r['due_date'] < $today;
    $items .= '<li class="grid gap-3 border-t border-linie py-4 first:border-t-0 lg:grid-cols-[1fr_auto] lg:items-center">'
        . '<div><p class="flex flex-wrap items-center gap-2"><a href="/admin/pacienti/' . (int) $r['patient_id'] . '" class="text-h3 font-semibold text-link underline-offset-4 hover:underline">' . e(patient_name($r)) . '</a>'
        . ($r['phone'] !== '' ? '<a href="' . e(tel_href($r['phone'])) . '" class="telefon inline-flex items-center gap-1 text-control underline">' . icon('phone', 16) . e(format_phone($r['phone'])) . '</a>' : '') . '</p>'
        . '<p class="mt-1 text-mic"><span class="' . ($late ? 'font-semibold text-carmin' : 'text-discret') . ' cifre">' . ($late ? 'Întârziată: ' : '') . e(format_date($r['due_date'])) . '</span> · ' . e($r['reason'])
        . ((int) $r['attempts'] > 0 ? ' · ' . (int) $r['attempts'] . ((int) $r['attempts'] === 1 ? ' apel' : ' apeluri') . ($r['last_attempt_at'] ? ', ultimul ' . e(format_datetime($r['last_attempt_at'])) : '') : '') . '</p>'
        . ($r['outcome_note'] ? '<p class="mt-1 whitespace-pre-line text-mic text-discret">' . e($r['outcome_note']) . '</p>' : '') . '</div>'
        . '<form method="post" class="flex flex-wrap items-center gap-2">' . csrf_field() . '<input type="hidden" name="id" value="' . (int) $r['id'] . '">'
        . '<label class="sr-only" for="nota-' . (int) $r['id'] . '">Notă</label><input id="nota-' . (int) $r['id'] . '" name="nota" placeholder="Notă (opțional)" class="' . e(input_classes('h-control-s w-44')) . '">'
        . '<button type="submit" name="op" value="sunat" class="' . e(btn('secondary', 's')) . '">Am sunat</button>'
        . '<a href="/admin/programari/noua?rechemare=' . (int) $r['id'] . '" class="' . e(btn('primary', 's')) . '">Programați</a>'
        . '<button type="submit" name="op" value="amana" class="' . e(btn('text', 's')) . '">Peste o lună</button>'
        . '<button type="submit" name="op" value="refuzat" class="' . e(btn('text', 's')) . '">Nu dorește</button></form></li>';
}
$switch = '';
foreach (allowed_location_ids($user) as $id) {
    if (!isset($names[$id])) {
        continue;
    }
    $on = $id === $clinicId;
    $switch .= '<a href="' . e(admin_url('/admin/rechemari', ['clinica' => $id, 'toate' => $all ? '1' : ''])) . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-control', $on ? 'bg-actiune font-semibold text-pe-actiune' : 'hover:bg-adancit')) . '">' . e($names[$id]) . '</a>';
}
$body = admin_header('Rechemări', 'Pacienții de sunat pentru control. ' . ($all ? 'Toate rechemările deschise.' : 'Întârziate și din următoarele 14 zile.'),
    '<nav aria-label="Clinica" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $switch . '</nav>'
    . '<a href="' . e(admin_url('/admin/rechemari', ['clinica' => $clinicId, 'toate' => $all ? '' : '1'])) . '" class="' . e(btn('secondary')) . '">' . ($all ? 'Doar cele apropiate' : 'Toate') . '</a>')
    . admin_section_open('De sunat', 'de-sunat', count($rows) . (count($rows) === 1 ? ' pacient' : ' pacienți'))
    . ($items !== '' ? '<ul class="mt-2">' . $items . '</ul>' : '<p class="mt-3 text-corp text-discret">Nimic de sunat acum.</p>') . '</section>';
admin_page('Rechemări', $body, $user);
