<?php
/**
 * /admin/cereri/{id}: one request, handled like a small pipeline: who takes care of it, what was
 * done (calls with their outcome, SMS, e-mails, notes), the status (and why it was lost, when it
 * ends without an appointment), the patients it may already be, and the appointment. An
 * administrator can delete it (a GDPR request).
 */
declare(strict_types=1);

$lead = db_one('SELECT * FROM leads WHERE id = ?', [(int) $param]);
if ($lead === null || !can_see_lead($lead, $user)) {
    admin_not_found($user);
}
$id = (int) $lead['id'];
$lead['appointment_id'] = db_value('SELECT id FROM appointments WHERE lead_id = ? ORDER BY id DESC LIMIT 1', [$id]);
$chatId = db_value('SELECT id FROM chat_conversations WHERE lead_id = ?', [$id]);
$handlers = lead_handlers();
$errors = [];

if (is_post()) {
    csrf_check();
    $op = post('op');
    if ($op === 'sterge' && is_admin($user)) {
        db_run('DELETE FROM leads WHERE id = ?', [$id]);
        audit('stergere-cerere', "#{$id} {$lead['name']}");
        flash('Cererea a fost ștearsă.');
        redirect('/admin/cereri');
    }
    // Someone working on a new request takes it: „În lucru”, theirs.
    $take = static function () use ($lead, $id, $user): void {
        $row = [];
        if ($lead['status'] === 'nou') {
            $row['status'] = 'in-lucru';
            lead_log($id, 'stare', 'in-lucru', null, $user);
        }
        if ($lead['assigned_to'] === null && in_array($user['role'], ['admin', 'receptie'], true)) {
            $row['assigned_to'] = $user['id'];
        }
        if ($row !== []) {
            db_update('leads', $row + ['updated_at' => now_sql(), 'updated_by' => $user['id']], 'id = :id', ['id' => $id]);
        }
    };
    if ($op === 'apel' && isset(CALL_OUTCOMES[post('outcome')])) {
        lead_log($id, 'apel', post('outcome'), post('body'), $user);
        $take();
        flash('Apelul a fost notat: ' . mb_strtolower(CALL_OUTCOMES[post('outcome')]) . '.');
        redirect("/admin/cereri/{$id}#istoric");
    }
    if ($op === 'activitate' && in_array(post('kind'), ['nota', 'sms', 'email'], true) && trim(post('body')) !== '') {
        lead_log($id, post('kind'), null, post('body'), $user);
        $take();
        flash('A fost adăugat în istoric.');
        redirect("/admin/cereri/{$id}#istoric");
    }
    if ($op === 'atribuie') {
        $to = admin_int(post('assigned_to'));
        $to = $to !== null && isset($handlers[$to]) ? $to : null;
        if ($to !== ($lead['assigned_to'] !== null ? (int) $lead['assigned_to'] : null)) {
            db_update('leads', ['assigned_to' => $to, 'updated_at' => now_sql(), 'updated_by' => $user['id']], 'id = :id', ['id' => $id]);
            lead_log($id, 'atribuire', null, $to !== null ? $handlers[$to] : 'nimeni', $user);
            flash($to !== null ? "Cererea este la {$handlers[$to]}." : 'Cererea nu mai este a nimănui.');
        }
        redirect("/admin/cereri/{$id}");
    }
    if ($op === 'stare') {
        $status = isset(LEAD_STATUS[post('status')]) ? post('status') : $lead['status'];
        $reason = isset(LEAD_LOST_REASONS[post('lost_reason')]) ? post('lost_reason') : null;
        if ($status === 'inchis' && empty($lead['appointment_id']) && $reason === null) {
            $errors['lost_reason'] = 'Alegeți de ce se închide fără programare.';
        }
        if ($errors === []) {
            db_update('leads', ['status' => $status, 'lost_reason' => $status === 'inchis' ? $reason : null, 'note' => mb_substr(post('note'), 0, 4000) ?: null, 'updated_at' => now_sql(), 'updated_by' => $user['id']], 'id = :id', ['id' => $id]);
            if ($status !== $lead['status']) {
                lead_log($id, 'stare', $status, $status === 'inchis' && $reason ? LEAD_LOST_REASONS[$reason] : null, $user);
                audit('stare-cerere', "#{$id}: {$lead['status']} → {$status}" . ($reason ? " ({$reason})" : ''));
            }
            flash('Cererea a fost salvată.');
            redirect("/admin/cereri/{$id}");
        }
        $lead['status'] = $status;
    }
}

$clinic = $lead['location_id'] !== null ? (admin_clinic_names()[(int) $lead['location_id']] ?? '') : null;
$lines = '';
foreach (lead_summary_lines($lead) as $line) {
    [$k, $v] = array_pad(explode(':', $line, 2), 2, '');
    $lines .= '<div class="grid gap-1 border-t border-linie py-3 sm:grid-cols-[12rem_1fr]"><dt class="text-mic font-semibold text-discret">' . e(trim($k)) . '</dt><dd class="whitespace-pre-line text-corp">' . e(trim($v)) . '</dd></div>';
}
$actions = '';
if (!empty($lead['appointment_id'])) {
    $actions .= '<a href="/admin/programari/' . (int) $lead['appointment_id'] . '" class="' . e(btn('secondary')) . '">' . icon('calendar', 20) . 'Vedeți programarea</a>';
} elseif ($lead['kind'] !== 'contact' || $lead['phone'] !== '') {
    $actions .= '<a href="/admin/programari/noua?cerere=' . $id . ($lead['patient_id'] ? '&pacient=' . (int) $lead['patient_id'] : '') . '" class="' . e(btn('primary')) . '">' . icon('calendar-plus', 20) . 'Faceți programarea</a>';
}
if ($chatId) {
    $actions .= '<a href="/admin/chat/' . (int) $chatId . '" class="' . e(btn('secondary')) . '">' . admin_icon('bot', 20) . 'Conversația</a>';
}
if ($lead['phone'] !== '') {
    $actions .= '<a href="' . e(tel_href($lead['phone'])) . '" class="' . e(btn('secondary')) . '">' . icon('phone', 20) . 'Sunați: <span class="telefon">' . e(format_phone($lead['phone'])) . '</span></a>';
}
if ($lead['email'] && ($mail = admin_mailto($lead['email'])) !== null) {
    $actions .= '<a href="' . e($mail) . '" class="' . e(btn('secondary')) . '">' . icon('mail', 20) . 'Scrieți un e-mail</a>';
}

// The patients this may already be.
$parts = preg_split('/\s+/', trim($lead['name'])) ?: [];
$dupes = empty($lead['appointment_id']) ? possible_duplicates(['phone' => $lead['phone'], 'email' => $lead['email'], 'last_name' => count($parts) > 1 ? $parts[0] : '', 'first_name' => count($parts) > 1 ? $parts[1] : '']) : [];
$dupeList = '';
foreach ($dupes as $d) {
    $dupeList .= '<li class="flex flex-wrap items-center justify-between gap-3 border-t border-linie py-3 first:border-t-0"><span class="min-w-0"><a class="font-semibold text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $d['id'] . '">' . e(patient_name($d)) . '</a>'
        . '<span class="block text-mic text-discret">Fișa nr. ' . (int) $d['file_number'] . ($d['phone'] !== '' ? ' · ' . e(format_phone($d['phone'])) : '') . ($d['birth_date'] ? ' · născut(ă) ' . e(format_date($d['birth_date'])) : '') . ' · ' . e($d['why']) . '</span></span>'
        . '<a href="/admin/programari/noua?cerere=' . $id . '&pacient=' . (int) $d['id'] . '" class="' . e(btn('secondary', 's')) . '">' . icon('calendar-plus', 16) . 'Programare pe această fișă</a></li>';
}
$dupeSection = $dupes !== [] ? admin_section_open('Poate este deja pacient', 'dubluri', 'Verificați înainte de programare, ca să nu faceți o fișă dublă. „Faceți programarea” de sus face o fișă nouă, dacă nu se potrivește nimeni.') . '<ul class="mt-2">' . $dupeList . '</ul></section>' : '';

// The history.
$acts = db_all('SELECT a.*, u.name AS who FROM lead_activities a LEFT JOIN users u ON u.id = a.user_id WHERE a.lead_id = ? ORDER BY a.created_at DESC, a.id DESC', [$id]);
$timeline = '';
foreach ($acts as $a) {
    $what = match ($a['kind']) {
        'apel' => 'Apel: ' . mb_strtolower(CALL_OUTCOMES[$a['outcome']] ?? (string) $a['outcome']),
        'stare' => 'Starea: ' . (LEAD_STATUS[$a['outcome']] ?? (string) $a['outcome']),
        'atribuire' => 'Preluată de: ' . ($a['body'] ?? ''),
        default => LEAD_ACTIVITY[$a['kind']] ?? $a['kind'],
    };
    $ico = match ($a['kind']) { 'apel' => 'phone', 'sms', 'email' => 'mail', 'stare' => 'check', 'atribuire' => 'user-round', default => 'nota' };
    $timeline .= '<li class="grid grid-cols-[1.5rem_1fr] gap-3 border-t border-linie py-3 first:border-t-0"><span class="mt-0.5 text-discret">' . admin_icon($ico, 18) . '</span><span class="min-w-0">'
        . '<span class="font-semibold">' . e($what) . '</span> <span class="text-mic text-discret">' . e(format_datetime($a['created_at']) . ($a['who'] ? ' · ' . $a['who'] : '')) . '</span>'
        . ($a['body'] !== null && $a['kind'] !== 'atribuire' ? '<span class="mt-1 block whitespace-pre-line text-corp">' . e($a['body']) . '</span>' : '') . '</span></li>';
}
$timeline .= '<li class="grid grid-cols-[1.5rem_1fr] gap-3 border-t border-linie py-3 first:border-t-0"><span class="mt-0.5 text-discret">' . icon('inbox', 18) . '</span><span><span class="font-semibold">Primită de pe site</span> <span class="text-mic text-discret">' . e(format_datetime($lead['created_at'])) . '</span></span></li>';

$callButtons = '';
foreach (CALL_OUTCOMES as $k => $label) {
    $callButtons .= '<button type="submit" name="outcome" value="' . e($k) . '" class="' . e(btn($k === 'raspuns' ? 'primary' : 'secondary', 's')) . '">' . e($label) . '</button>';
}
$history = admin_section_open('Istoric', 'istoric', 'Ce s-a făcut, cu cine și când. Primul apel sau prima notă trec cererea „În lucru” și o dau celui care a lucrat-o.')
    . '<form method="post" class="mt-4 flex flex-col gap-3 rounded-panou bg-fundal p-4">' . csrf_field() . '<input type="hidden" name="op" value="apel">'
    . '<p class="text-control font-medium">Am sunat</p>'
    . text_field('body', 'Ce s-a vorbit (opțional)', ['id' => 'field-apel-body', 'maxlength' => 500])
    . '<div class="flex flex-wrap gap-2">' . $callButtons . '</div></form>'
    . '<form method="post" class="mt-3 flex flex-col gap-3 rounded-panou bg-fundal p-4">' . csrf_field() . '<input type="hidden" name="op" value="activitate">'
    . radio_group('kind', 'Altceva', ['nota' => 'Notă', 'sms' => 'Am trimis SMS', 'email' => 'Am trimis e-mail'], ['id' => 'field-kind', 'inline' => true, 'value' => 'nota'])
    . text_area('body', 'Ce anume', ['id' => 'field-activitate-body', 'rows' => 2, 'maxlength' => 4000])
    . '<div><button type="submit" class="' . e(btn('secondary', 's')) . '">Adăugați în istoric</button></div></form>'
    . '<ul class="mt-4">' . $timeline . '</ul></section>';

$assign = '<form method="post" class="mt-4 flex flex-wrap items-end gap-3">' . csrf_field() . '<input type="hidden" name="op" value="atribuie">'
    . '<div class="min-w-[12rem] flex-1">' . select_field('assigned_to', 'Se ocupă', ['' => 'Nimeni încă'] + array_map('strval', $handlers), ['value' => (string) ($lead['assigned_to'] ?? '')]) . '</div>'
    . '<button type="submit" class="' . e(btn('secondary')) . '">Salvați</button>'
    . (in_array($user['role'], ['admin', 'receptie'], true) && (int) ($lead['assigned_to'] ?? 0) !== (int) $user['id'] ? '<button type="submit" name="assigned_to" value="' . (int) $user['id'] . '" class="' . e(btn('text')) . '">Mi-o iau eu</button>' : '')
    . '</form>';

$statusForm = '<form method="post" class="mt-4 flex flex-col gap-5">' . csrf_field() . '<input type="hidden" name="op" value="stare">' . error_summary($errors)
    . '<p>' . lead_status_chip($lead['status']) . ($lead['lost_reason'] ? ' <span class="text-mic text-discret">' . e(LEAD_LOST_REASONS[$lead['lost_reason']] ?? '') . '</span>' : '') . ($lead['updated_at'] ? ' <span class="text-mic text-discret">modificată ' . e(format_datetime($lead['updated_at'])) . '</span>' : '') . '</p>'
    . radio_group('status', 'Starea', LEAD_STATUS, ['value' => $lead['status']])
    . '<div data-motiv-pierdut>' . select_field('lost_reason', 'De ce se închide fără programare', ['' => '—'] + LEAD_LOST_REASONS, ['value' => (string) ($lead['lost_reason'] ?? post('lost_reason')), 'error' => $errors['lost_reason'] ?? null, 'hint' => 'Pentru rapoarte: de ce nu ajung cererile programări.']) . '</div>'
    . text_area('note', 'Notă internă', ['value' => (string) $lead['note'], 'rows' => 3, 'optional' => true, 'hint' => 'Nu o vede pacientul.'])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">Salvați</button></div></form>';

$body = '<p class="mb-4"><a href="/admin/cereri" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Toate cererile</a></p>'
    . admin_header(match ($lead['kind']) { 'programare' => 'Cerere de programare', 'chat' => 'Din chat', default => 'Mesaj' } . ': ' . $lead['name'], 'Primită ' . format_datetime($lead['created_at']) . ($clinic ? " · {$clinic}" : '') . ($lead['assigned_to'] && isset($handlers[(int) $lead['assigned_to']]) ? ' · se ocupă ' . $handlers[(int) $lead['assigned_to']] : ''), $actions)
    . '<div class="grid gap-8 lg:grid-cols-12">'
    . '<div class="flex min-w-0 flex-col gap-8 lg:col-span-7">' . admin_section_open('Ce ne-a trimis', 'detalii') . '<dl class="mt-3">' . $lines . '</dl></section>' . $dupeSection . $history . '</div>'
    . '<div class="flex min-w-0 flex-col gap-8 lg:col-span-5">'
    . admin_section_open('Cine se ocupă', 'atribuire') . $assign . '</section>'
    . admin_section_open('Starea', 'urmarire') . $statusForm . '</section>'
    . (is_admin($user) ? '<form method="post" data-confirma="Ștergeți definitiv această cerere?">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><button type="submit" class="' . e(btn('danger', 's')) . '">' . icon('trash-2', 16) . 'Ștergeți cererea</button><p class="mt-2 text-mic text-discret">Pentru o cerere de ștergere a datelor (GDPR). Nu se poate anula.</p></form>' : '')
    . '</div></div>';
admin_page('Cerere', $body, $user);
