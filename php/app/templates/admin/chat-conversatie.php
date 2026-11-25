<?php
/** /admin/chat/{id}: one conversation of the site's assistant, as the visitor saw it. */
declare(strict_types=1);

$c = db_one('SELECT * FROM chat_conversations WHERE id = ?', [(int) $param]);
if ($c === null) {
    admin_not_found($user);
}
if (is_post() && is_admin($user) && post('op') === 'sterge') {
    csrf_check();
    db_run('DELETE FROM chat_conversations WHERE id = ?', [$c['id']]);
    audit('chat-sters', '#' . $c['id']);
    flash('Conversația a fost ștearsă.');
    redirect('/admin/chat');
}

$bubbles = '';
foreach (db_all('SELECT role, display, created_at FROM chat_messages WHERE conversation_id = ? AND display IS NOT NULL ORDER BY id', [$c['id']]) as $m) {
    $time = '<span class="mt-1 block text-[11px] text-discret cifre">' . e(substr($m['created_at'], 11, 5)) . '</span>';
    if ($m['role'] === 'assistant') {
        $d = json_decode($m['display'], true) ?: ['text' => ''];
        $extra = '';
        if (!empty($d['slots'])) {
            $extra .= '<p class="mt-2 text-mic text-discret">Ore propuse: ' . e(implode('; ', array_map(static fn ($s) => "{$s['day']} {$s['time']}, {$s['clinic']}", $d['slots']))) . '</p>';
        }
        if (!empty($d['booked'])) {
            $extra .= '<p class="mt-2 text-mic font-semibold text-actiune">' . e(($d['booked']['confirmed'] ? 'Programat: ' : 'Cerere: ') . $d['booked']['label']) . '</p>';
        }
        $bubbles .= '<li class="flex"><div class="max-w-[85%] rounded-[1.25rem] rounded-bl-md border border-linie bg-suprafata px-4 py-3"><p class="whitespace-pre-line text-corp">' . e((string) $d['text']) . '</p>' . $extra . $time . '</div></li>';
    } else {
        $bubbles .= '<li class="flex justify-end"><div class="max-w-[85%] rounded-[1.25rem] rounded-br-md bg-menta-pal px-4 py-3"><p class="whitespace-pre-line text-corp">' . e((string) $m['display']) . '</p>' . $time . '</div></li>';
    }
}
$links = '';
if ($c['appointment_id'] && db_value('SELECT 1 FROM appointments WHERE id = ?', [$c['appointment_id']])) {
    $links .= '<a href="/admin/programari/' . (int) $c['appointment_id'] . '" class="' . e(btn('primary')) . '">' . icon('calendar', 18) . 'Programarea</a>';
}
if ($c['patient_id'] && find_patient((int) $c['patient_id'], $user)) {
    $links .= '<a href="/admin/pacienti/' . (int) $c['patient_id'] . '" class="' . e(btn('secondary')) . '">' . icon('user', 18) . 'Fișa pacientului</a>';
}
if ($c['lead_id'] && db_value('SELECT 1 FROM leads WHERE id = ?', [$c['lead_id']])) {
    $links .= '<a href="/admin/cereri/' . (int) $c['lead_id'] . '" class="' . e(btn('secondary')) . '">' . admin_icon('inbox', 18) . 'Cererea</a>';
}

$facts = '<dl class="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-corp">'
    . '<dt class="text-discret">Început</dt><dd class="cifre">' . e(format_datetime($c['started_at'])) . '</dd>'
    . '<dt class="text-discret">Ultimul mesaj</dt><dd class="cifre">' . e(format_datetime($c['last_at'])) . '</dd>'
    . '<dt class="text-discret">Telefon</dt><dd>' . ($c['phone'] ? e(format_phone((string) $c['phone'])) . ($c['phone_verified_at'] ? ' <span class="text-mic text-actiune">(verificat prin SMS)</span>' : '') : '—') . '</dd>'
    . '<dt class="text-discret">Tokeni</dt><dd class="cifre">' . number_format((int) $c['input_tokens'], 0, ',', '.') . ' / ' . number_format((int) $c['output_tokens'], 0, ',', '.') . '</dd></dl>';

$body = '<p class="mb-4"><a href="/admin/chat" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Toate conversațiile</a></p>'
    . admin_header('Conversația #' . (int) $c['id'], '', $links)
    . '<div class="grid gap-8 lg:grid-cols-12"><div class="min-w-0 lg:col-span-8"><section aria-label="Mesajele" class="rounded-panou border border-linie bg-fundal p-4 md:p-6"><ul class="flex flex-col gap-3">' . $bubbles . '</ul></section></div>'
    . '<div class="min-w-0 lg:col-span-4">' . admin_section_open('Detalii', 'detalii') . $facts . '</section>'
    . (is_admin($user) ? '<form method="post" class="mt-6" data-confirma="Ștergeți definitiv conversația?">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><button type="submit" class="' . e(btn('danger', 's')) . '">' . icon('trash-2', 16) . 'Ștergeți conversația</button></form>' : '')
    . '</div></div>';
admin_page('Conversația #' . (int) $c['id'], $body, $user);
