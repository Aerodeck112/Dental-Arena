<?php
/**
 * /admin („Azi”): the day at one clinic: the appointments in order, each with its next step
 * (Confirmat, A sosit, Începe tratamentul, Finalizat), the patient's alerts, the new requests
 * from the site and the recalls due. An administrator also sees what VITIM (the technical
 * account) changed since they last looked.
 */
declare(strict_types=1);

purge_old_leads();
if (in_array($user['role'], ['admin', 'admin-medic'], true) && is_post() && post('op') === 'vitim-vazut') {
    csrf_check();
    db_update('users', ['changes_seen_id' => max((int) $user['changes_seen_id'], (int) post('pana'))], 'id = :id', ['id' => $user['id']]);
    redirect('/admin');
}
// The team's notes („Notițe”): added by anyone, ticked when done.
if (is_post() && in_array(post('op'), ['nota', 'nota-gata', 'nota-sterge'], true)) {
    csrf_check();
    $nid = (int) post('id');
    if (post('op') === 'nota' && trim(post('nota')) !== '') {
        $loc = admin_int(post('clinica'));
        db_insert('team_notes', ['location_id' => $loc !== null && in_array($loc, allowed_location_ids($user), true) ? $loc : null, 'body' => mb_substr(trim(post('nota')), 0, 500), 'created_by' => (int) $user['id'], 'created_at' => now_sql()]);
    } elseif (post('op') === 'nota-gata') {
        db_run('UPDATE team_notes SET done_at = IF(done_at IS NULL, ?, NULL), done_by = IF(done_at IS NULL, NULL, ?) WHERE id = ?', [now_sql(), (int) $user['id'], $nid]);
    } elseif (post('op') === 'nota-sterge') {
        db_run('DELETE FROM team_notes WHERE id = ? AND (created_by = ? OR ?)', [$nid, (int) $user['id'], (int) is_admin($user)]);
    }
    redirect('/admin#notite');
}
$techNews = in_array($user['role'], ['admin', 'admin-medic'], true) ? tech_changes((int) $user['changes_seen_id'], 15) : [];
$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($id) => isset($names[$id])));
$clinicId = current_clinic_id($user);
if ($clinicId !== null) {
    remember_clinic($clinicId);
}
$today = date('Y-m-d');
$docs = doctor_short_names();
$appts = $clinicId === null ? [] : db_all(
    "SELECT a.*, p.first_name, p.last_name, p.phone, p.file_number FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE a.location_id = ? AND a.starts_at >= ? AND a.starts_at < ? ORDER BY a.starts_at, a.id",
    [$clinicId, "{$today} 00:00:00", date('Y-m-d', strtotime('+1 day')) . ' 00:00:00'],
);
$newLeads = $clinicId === null ? [] : db_all("SELECT * FROM leads WHERE status = 'nou' AND (location_id = ? OR location_id IS NULL) ORDER BY created_at DESC LIMIT 6", [$clinicId]);
$recallsDue = $clinicId === null ? 0 : (int) db_value("SELECT COUNT(*) FROM recalls WHERE status IN ('de-facut', 'contactat') AND due_date <= ? AND (location_id = ? OR location_id IS NULL)", [date('Y-m-d', strtotime('+7 days')), $clinicId]);
$active = array_filter($appts, static fn ($a) => $a['status'] !== 'anulat');

$switch = '';
if (count($allowed) > 1) {
    $switch = '<nav aria-label="Clinica" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">';
    foreach ($allowed as $id) {
        $on = $id === $clinicId;
        $switch .= '<a href="/admin?clinica=' . $id . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center rounded-[calc(var(--radius-control)-2px)] px-4 text-control', $on ? 'bg-actiune font-semibold text-pe-actiune' : 'hover:bg-adancit')) . '">' . e($names[$id]) . '</a>';
    }
    $switch .= '</nav>';
}

$rows = '';
foreach ($appts as $a) {
    $id = (int) $a['id'];
    $alerts = medical_alerts((int) $a['patient_id']);
    $buttons = '';
    foreach (APPT_NEXT[$a['status']] ?? [] as $st => $label) {
        $buttons .= '<button type="submit" name="stare" value="' . e($st) . '" class="' . e(btn($st === 'finalizat' || $st === 'in-tratament' ? 'primary' : 'secondary', 's')) . '">' . e($label) . '</button>';
    }
    if (in_array($a['status'], ['programat', 'confirmat'], true) && strtotime($a['starts_at']) < time()) {
        $buttons .= '<button type="submit" name="stare" value="neprezentat" class="' . e(btn('text', 's')) . '">Nu a venit</button>';
    }
    $muted = in_array($a['status'], ['anulat', 'neprezentat'], true);
    $rows .= '<li class="' . e(cn('grid gap-3 border-t border-linie py-4 first:border-t-0 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center', $muted ? 'opacity-60' : '')) . '">'
        . '<p class="font-display text-[1.75rem] leading-none cifre">' . e(hm($a['starts_at'])) . '<span class="block pt-1 font-sans text-mic text-discret">până la ' . e(hm($a['ends_at'])) . '</span></p>'
        . '<div class="min-w-0"><p><a href="/admin/pacienti/' . (int) $a['patient_id'] . '" class="text-h3 font-semibold text-cerneala underline-offset-4 hover:underline">' . e(patient_name($a)) . '</a></p>'
        . (($chips = (appt_no_answer($a) ? appt_no_answer_chip($a) : '') . alert_chips($alerts) . comfort_chip($a['comfort'])) !== '' ? '<p class="mt-1 flex flex-wrap gap-1.5">' . $chips . '</p>' : '')
        . '<p class="mt-1 text-mic text-discret">' . e(implode(', ', array_filter([$docs[(int) $a['doctor_id']] ?? '', $a['reason'] ?: service_title($a['category_slug'])]))) . '</p>'
        . (in_array($a['status'], ['programat', 'confirmat'], true) ? '<div class="mt-2">' . appt_no_answer_form($a, '/admin') . '</div>' : '') . '</div>'
        . '<form method="post" action="/admin/programari/' . $id . '" class="flex flex-wrap items-center gap-2 sm:justify-end">' . csrf_field()
        . '<input type="hidden" name="op" value="stare"><input type="hidden" name="inapoi" value="/admin">'
        . appt_status_chip($a['status']) . $buttons
        . '<a href="/admin/programari/' . $id . '" class="' . e(btn('text', 's')) . '" aria-label="Deschideți programarea: ' . e(patient_name($a)) . '">' . icon('ellipsis', 18) . '</a></form>'
        . '</li>';
}
$leadItems = '';
foreach ($newLeads as $l) {
    $leadItems .= '<li class="border-t border-linie py-3 first:border-t-0"><a href="/admin/cereri/' . (int) $l['id'] . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e($l['name']) . '</a>'
        . '<span class="block text-mic text-discret">' . e(lead_kind_label($l['kind']) . ($l['category_slug'] ? ' · ' . service_title($l['category_slug']) : '') . ' · ' . format_datetime($l['created_at'])) . '</span></li>';
}

$summary = count($active) . (count($active) === 1 ? ' programare' : ' programări') . ', ' . count($newLeads) . (count($newLeads) === 1 ? ' cerere nouă' : ' cereri noi') . ', ' . $recallsDue . ' de rechemat săptămâna aceasta.';
$techCard = '';
if ($techNews !== []) {
    $techCard = '<section aria-labelledby="vitim" class="mb-8 rounded-panou border-2 border-mustar bg-mustar-pal p-5">'
        . '<h2 id="vitim" class="flex items-center gap-2 text-h3 font-semibold">' . icon('settings', 20) . 'Suportul tehnic (VITIM) a făcut modificări</h2>'
        . '<ul class="mt-3 flex flex-col gap-1 text-corp">' . implode('', array_map(static fn ($c) => '<li>' . e(tech_change_line($c)) . '</li>', $techNews)) . '</ul>'
        . (count($techNews) === 15 ? '<p class="mt-2 text-mic">Și altele, mai vechi, în <a class="text-link underline" href="/admin/jurnal">Jurnal</a>.</p>' : '')
        . '<form method="post" class="mt-4">' . csrf_field() . '<input type="hidden" name="op" value="vitim-vazut"><input type="hidden" name="pana" value="' . (int) $techNews[0]['id'] . '">'
        . '<button type="submit" class="' . e(btn('secondary', 's')) . '">' . icon('check', 16) . 'Am văzut</button></form></section>';
}
// „Încasat azi”: what Casa shows for the clinic today (the procedures' payments, in the account's
// ledger), plus the invoices' payments when the invoices are on.
$cashToday = $cashCash = $invoiceToday = 0;
if ($clinicId !== null) {
    require_once APP_DIR . '/src/admin/procedures.php';
    [$lw, $lp] = proc_scope_sql(['ledger' => proc_scope($user)['ledger']], 'pp', 'paid_on');
    $sums = db_one("SELECT COALESCE(SUM(pp.amount), 0) AS total, COALESCE(SUM(CASE WHEN pp.method = 'numerar' THEN pp.amount END), 0) AS cash FROM procedure_payments pp WHERE pp.cancelled_at IS NULL AND pp.paid_on = ? AND pp.location_id = ?" . $lw, array_merge([$today, $clinicId], $lp));
    $cashToday = (int) $sums['total'];
    $cashCash = (int) $sums['cash'];
    if (can('billing', $user)) {
        $invoiceToday = (int) db_value('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE cancelled_at IS NULL AND location_id = ? AND paid_at >= ?', [$clinicId, "{$today} 00:00:00"]);
        $cashToday += $invoiceToday;
    }
}
// „Notițe”: what the team must not forget, for this clinic or for all; the done ones of today below.
$inLoc = implode(',', array_map('intval', allowed_location_ids($user) ?: [0]));
$notes = db_all("SELECT n.*, u.name AS author FROM team_notes n LEFT JOIN users u ON u.id = n.created_by WHERE (n.location_id IS NULL OR n.location_id IN ({$inLoc})) AND (n.done_at IS NULL OR n.done_at >= ?) ORDER BY n.done_at IS NOT NULL, n.created_at DESC LIMIT 40", ["{$today} 00:00:00"]);
$noteItems = '';
foreach ($notes as $n) {
    $done = $n['done_at'] !== null;
    $noteItems .= '<li class="flex items-start gap-2 border-t border-linie py-2 first:border-t-0">'
        . '<form method="post">' . csrf_field() . '<input type="hidden" name="op" value="nota-gata"><input type="hidden" name="id" value="' . (int) $n['id'] . '">'
        . '<button type="submit" class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border-2 ' . ($done ? 'border-actiune bg-actiune text-pe-actiune' : 'border-linie-control hover:border-actiune') . '" aria-label="' . e(($done ? 'Nebifați: ' : 'Gata: ') . $n['body']) . '">' . ($done ? icon('check', 14) : '') . '</button></form>'
        . '<div class="min-w-0 flex-1"><p class="' . e(cn('whitespace-pre-line break-words text-corp', $done ? 'text-discret line-through' : '')) . '">' . e($n['body']) . '</p>'
        . '<p class="text-mic text-discret">' . e(implode(' · ', array_filter([$n['author'], date('d.m H:i', strtotime($n['created_at'])), $n['location_id'] !== null ? ($names[(int) $n['location_id']] ?? '') : '']))) . '</p></div>'
        . ((int) $n['created_by'] === (int) $user['id'] || is_admin($user) ? '<form method="post" data-confirma="Ștergeți notița?">' . csrf_field() . '<input type="hidden" name="op" value="nota-sterge"><input type="hidden" name="id" value="' . (int) $n['id'] . '"><button type="submit" class="' . e(btn('text', 's', 'px-1')) . '" aria-label="Ștergeți notița">' . icon('trash-2', 16) . '</button></form>' : '')
        . '</li>';
}
$noteClinics = ['' => 'Ambele clinici'];
foreach ($allowed as $l) {
    $noteClinics[(string) $l] = $names[$l];
}
$notesBox = admin_section_open('Notițe', 'notite', 'Ce nu trebuie uitat; le vede toată echipa. Bifați-le când sunt gata.')
    . '<form method="post" class="mt-3 flex flex-col gap-2">' . csrf_field() . '<input type="hidden" name="op" value="nota">'
    . '<label class="sr-only" for="field-nota">Notiță nouă</label><textarea id="field-nota" name="nota" rows="2" maxlength="500" placeholder="De exemplu: de sunat laboratorul pentru lucrarea lui …" class="' . e(input_classes('py-2')) . '"></textarea>'
    . '<div class="flex flex-wrap items-center gap-2">' . (count($allowed) > 1 ? '<label class="sr-only" for="field-nota-clinica">Pentru</label><select id="field-nota-clinica" name="clinica" class="' . e(input_classes('h-control-s w-auto')) . '">' . implode('', array_map(static fn ($k, $l) => '<option value="' . e((string) $k) . '"' . ((string) $k === (string) $clinicId ? ' selected' : '') . '>' . e($l) . '</option>', array_keys($noteClinics), $noteClinics)) . '</select>' : '')
    . '<button type="submit" class="' . e(btn('primary', 's')) . '">' . icon('plus', 16) . 'Adăugați</button></div></form>'
    . ($noteItems !== '' ? '<ul class="mt-3">' . $noteItems . '</ul>' : '<p class="mt-3 text-mic text-discret">Nicio notiță.</p>') . '</section>';
$body = admin_header('Azi, ' . format_date(new DateTimeImmutable(), true), $clinicId !== null ? ($names[$clinicId] ?? '') . ': ' . $summary : 'Contul nu are nicio clinică bifată.', $switch . '<a href="/admin/programari/noua' . ($clinicId ? '?clinica=' . $clinicId : '') . '" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Programare nouă</a>')
    . $techCard
    . '<div class="grid gap-8 lg:grid-cols-12">'
    . '<div class="lg:col-span-8">' . admin_section_open('Programările de azi', 'azi')
    . ($rows !== '' ? '<ul class="mt-2">' . $rows . '</ul>' : '<p class="mt-4 text-corp text-discret">Nicio programare azi. <a href="/admin/calendar" class="text-link underline">Deschideți calendarul</a>.</p>')
    . '</section></div>'
    . '<div class="flex flex-col gap-8 lg:col-span-4">'
    . admin_section_open('Cereri online noi', 'cereri-noi') . ($leadItems !== '' ? '<ul class="mt-2">' . $leadItems . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio cerere nouă.</p>')
    . '<a href="/admin/cereri" class="mt-3 inline-flex min-h-control items-center font-medium text-link underline underline-offset-4">Toate cererile</a></section>'
    . $notesBox
    . ($clinicId !== null && (can('procedures.pay', $user) || can('billing', $user)) ? admin_section_open('Încasat azi', 'incasat-azi')
        . '<p class="mt-2 font-display text-[2rem] cifre">' . e(lei($cashToday)) . '</p>'
        . '<p class="text-mic text-discret">Din Casa: numerar ' . e(lei($cashCash)) . ($invoiceToday > 0 ? ' · din facturi ' . e(lei($invoiceToday)) : '') . '</p>'
        . (can('procedures.pay', $user) ? '<a href="/admin/casa?clinica=' . $clinicId . '" class="mt-2 inline-flex min-h-control items-center font-medium text-link underline underline-offset-4">Casa de azi</a>' : '<a href="/admin/incasari?clinica=' . $clinicId . '" class="mt-2 inline-flex min-h-control items-center font-medium text-link underline underline-offset-4">Jurnalul încasărilor</a>') . '</section>' : '')
    . admin_section_open('Rechemări', 'rechemari-azi') . '<p class="mt-2 text-corp"><span class="font-display text-[2rem] cifre">' . $recallsDue . '</span> pacienți de sunat pentru control în următoarele 7 zile.</p>'
    . '<a href="/admin/rechemari" class="mt-2 inline-flex min-h-control items-center font-medium text-link underline underline-offset-4">Lista de rechemări</a></section>'
    . '</div></div>';
admin_page('Azi', $body, $user);
