<?php
/** /admin/cereri/{id}: one request; change its status, keep a note; an administrator can delete it. */
declare(strict_types=1);

$lead = db_one('SELECT * FROM leads WHERE id = ?', [(int) $param]);
if ($lead === null || !can_see_lead($lead, $user)) {
    admin_not_found($user);
}
$id = (int) $lead['id'];

if (is_post()) {
    csrf_check();
    if (post('actiune') === 'sterge' && is_admin($user)) {
        db_run('DELETE FROM leads WHERE id = ?', [$id]);
        audit('stergere-cerere', "#{$id} {$lead['name']}");
        flash('Cererea a fost ștearsă.');
        redirect('/admin/cereri');
    }
    $status = post('status');
    if (!isset(LEAD_STATUS[$status])) {
        $status = $lead['status'];
    }
    db_update('leads', ['status' => $status, 'note' => mb_substr(post('note'), 0, 4000) ?: null, 'updated_at' => now_sql(), 'updated_by' => $user['id']], 'id = :id', ['id' => $id]);
    if ($status !== $lead['status']) {
        audit('stare-cerere', "#{$id}: {$lead['status']} → {$status}");
    }
    flash('Cererea a fost salvată.');
    redirect("/admin/cereri/{$id}");
}

$clinic = $lead['location_id'] !== null ? (admin_clinic_names()[(int) $lead['location_id']] ?? '') : null;
$lines = '';
foreach (lead_summary_lines($lead) as $line) {
    [$k, $v] = array_pad(explode(':', $line, 2), 2, '');
    $lines .= '<div class="grid gap-1 border-t border-linie py-3 sm:grid-cols-[12rem_1fr]"><dt class="text-mic font-semibold text-discret">' . e(trim($k)) . '</dt><dd class="whitespace-pre-line text-corp">' . e(trim($v)) . '</dd></div>';
}
$actions = '';
if ($lead['phone'] !== '') {
    $actions .= '<a href="' . e(tel_href($lead['phone'])) . '" class="' . e(btn('primary')) . '">' . icon('phone', 20) . 'Sunați: <span class="telefon">' . e(format_phone($lead['phone'])) . '</span></a>';
}
if ($lead['email'] && ($mail = admin_mailto($lead['email'])) !== null) {
    $actions .= '<a href="' . e($mail) . '" class="' . e(btn('secondary')) . '">' . icon('mail', 20) . 'Scrieți un e-mail</a>';
}

$body = '<p class="mb-4"><a href="/admin/cereri" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Toate cererile</a></p>'
    . admin_header(($lead['kind'] === 'programare' ? 'Cerere de programare' : 'Mesaj') . ': ' . $lead['name'], 'Primită ' . format_datetime($lead['created_at']) . ($clinic ? " · {$clinic}" : ''), $actions)
    . '<div class="grid gap-8 lg:grid-cols-12">'
    . '<div class="lg:col-span-7">' . admin_section_open('Ce ne-a trimis', 'detalii') . '<dl class="mt-3">' . $lines . '</dl></section></div>'
    . '<div class="lg:col-span-5">' . admin_section_open('Ce s-a făcut', 'urmarire')
    . '<form method="post" class="mt-4 flex flex-col gap-5">' . csrf_field()
    . '<p>' . lead_status_chip($lead['status']) . ($lead['updated_at'] ? ' <span class="text-mic text-discret">modificată ' . e(format_datetime($lead['updated_at'])) . '</span>' : '') . '</p>'
    . radio_group('status', 'Starea', LEAD_STATUS, ['value' => $lead['status']])
    . text_area('note', 'Notă internă', ['value' => (string) $lead['note'], 'rows' => 4, 'optional' => true, 'hint' => 'Nu o vede pacientul. De exemplu: „programat joi la 10, dr. Marcoci”.'])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">Salvați</button></div></form></section>'
    . (is_admin($user) ? '<form method="post" class="mt-6" data-confirma="Ștergeți definitiv această cerere?">' . csrf_field() . '<input type="hidden" name="actiune" value="sterge"><button type="submit" class="' . e(btn('danger', 's')) . '">' . icon('trash-2', 16) . 'Ștergeți cererea</button><p class="mt-2 text-mic text-discret">Pentru o cerere de ștergere a datelor (GDPR). Nu se poate anula.</p></form>' : '')
    . '</div></div>';
admin_page('Cerere', $body, $user);
