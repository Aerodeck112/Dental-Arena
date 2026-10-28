<?php
/**
 * /admin/setari/chat (administrators): the AI assistant on the site: on or off, the model, how
 * bookings work (a request for reception, or straight into the calendar after an SMS code),
 * limits, how long talks are kept. Durations, notice and days ahead: Setări → Programări online.
 */
declare(strict_types=1);

$s = chat_settings();
$before = $s;
$ai = ai_settings();
$errors = [];
$smsLive = messaging_live() && messaging()['smslink_id'] !== '' && messaging()['smslink_pass'] !== '';
if (is_post()) {
    csrf_check();
    $s['enabled'] = post('enabled') === '1';
    $s['model'] = isset(AI_MODELS[post('model')]) ? post('model') : CHAT_DEFAULTS['model'];
    $s['mode'] = isset(CHAT_MODES[post('mode')]) ? post('mode') : 'cerere';
    $s['daily_limit'] = max(10, min(5000, (int) post('daily_limit')));
    $s['retention_days'] = max(7, min(730, (int) post('retention_days')));
    if ($s['enabled'] && $ai['api_key'] === '') {
        $errors['enabled'] = 'Pentru chat trebuie întâi cheia API Anthropic, în Setări → Asistentul AI.';
    }
    if ($s['mode'] === 'direct' && !$smsLive) {
        $errors['mode'] = 'Programarea direct în calendar cere SMS-urile pornite (Setări → Mesaje, mod „Trimitere reală” cu SMSLink).';
    }
    if ($errors === []) {
        setting_save('chat', $s);
        audit('setari-chat', changes_text($before, $s, ['enabled' => 'chat pornit', 'model' => 'modelul', 'mode' => 'programările din chat', 'daily_limit' => 'conversații pe zi', 'retention_days' => 'păstrate (zile)']));
        flash('Setările chatului au fost salvate.');
        redirect('/admin/setari/chat');
    }
}

$scheduled = db_all('SELECT d.public_name, dl.location_id, dl.schedule FROM doctor_locations dl JOIN doctors d ON d.id = dl.doctor_id WHERE dl.schedule IS NOT NULL ORDER BY d.sort_order');
$names = admin_clinic_names();
$schedRows = '';
foreach ($scheduled as $r) {
    $sch = schedule_decode($r['schedule']);
    if ($sch !== []) {
        $schedRows .= '<li class="border-t border-linie py-2 first:border-t-0"><span class="font-semibold">' . e($r['public_name']) . '</span> · ' . e($names[(int) $r['location_id']] ?? '') . '<br><span class="text-mic text-discret">' . e(schedule_text($sch)) . '</span></li>';
    }
}
$next = $schedRows !== '' ? free_slots(['limit' => 6, 'per_day' => 2]) : [];
$docs = doctor_short_names();
$nextList = implode('', array_map(static fn ($x) => '<li class="cifre">' . e(day_label($x['start']) . ', ' . substr($x['start'], 11, 5) . ' · ' . ($names[$x['location_id']] ?? '') . ' · ' . ($docs[$x['doctor_id']] ?? '')) . '</li>', $next));

$form = '<form method="post" novalidate class="flex flex-col gap-5 rounded-panou border border-linie bg-suprafata p-6">' . csrf_field() . error_summary($errors)
    . checkbox_field('enabled', 'Chatul este pornit pe site', ['checked' => (bool) $s['enabled'], 'error' => $errors['enabled'] ?? null, 'description' => 'Apare un buton „Întrebați-ne” în colțul paginilor site-ului.'])
    . select_field('model', 'Modelul', AI_MODELS, ['value' => $s['model'], 'hint' => 'Sonnet răspunde mai repede și costă mai puțin; e potrivit pentru chat.'])
    . radio_group('mode', 'Programările din chat', CHAT_MODES, ['value' => $s['mode'], 'error' => $errors['mode'] ?? null])
    . '<div class="grid gap-5 sm:grid-cols-2">'
    . text_field('daily_limit', 'Conversații noi pe zi, cel mult', ['type' => 'number', 'value' => (string) $s['daily_limit'], 'min' => 10, 'hint' => 'Limitează costul dacă cineva abuzează.'])
    . text_field('retention_days', 'Conversațiile se șterg după (zile)', ['type' => 'number', 'value' => (string) $s['retention_days'], 'min' => 7, 'max' => 730])
    . '</div><p class="text-mic text-discret">Durata programărilor, cât de devreme și cu câte zile înainte se pot face se aleg la <a class="text-link underline" href="/admin/setari/programari">Setări → Programări online</a>, la fel pentru site și chat.</p><div><button type="submit" class="' . e(btn('primary')) . '">Salvați</button></div></form>';

$body = '<p class="mb-4"><a href="/admin/setari" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Setări</a></p>'
    . admin_header('Chatul de pe site', 'Un asistent AI care răspunde vizitatorilor la orice oră, din datele clinicii (servicii, prețuri, medici, program), și îi programează pe orele libere din calendar.', '<a href="/admin/chat" class="' . e(btn('secondary')) . '">' . admin_icon('bot', 18) . 'Conversațiile</a>')
    . ($ai['api_key'] === '' ? '<p class="mb-6 flex items-start gap-3 rounded-panou border border-mustar bg-mustar-pal p-4 text-corp">' . icon('info', 20, 'mt-0.5') . '<span>Întâi salvați cheia API Anthropic în <a class="text-link underline" href="/admin/setari/ai">Setări → Asistentul AI</a>.</span></p>' : '')
    . '<div class="grid max-w-6xl gap-8 lg:grid-cols-12"><div class="min-w-0 lg:col-span-7">' . $form . '</div>'
    . '<div class="flex min-w-0 flex-col gap-8 lg:col-span-5">'
    . admin_section_open('Programul medicilor', 'program', 'Din el se calculează orele libere. Se completează la Echipa → medic → „Unde și când lucrează”.')
    . ($schedRows !== '' ? '<ul class="mt-3 text-corp">' . $schedRows . '</ul>' : '<p class="mt-3 text-corp text-mustar-text">Niciun medic nu are program încă: chatul răspunde la întrebări, dar nu poate propune ore.</p>')
    . ($nextList !== '' ? '<p class="mt-4 text-mic font-semibold">Primele ore libere acum:</p><ul class="mt-1 text-mic">' . $nextList . '</ul>' : '') . '</section>'
    . admin_section_open('Siguranță și date personale', 'gdpr')
    . '<ul class="mt-3 list-disc pl-5 text-corp">'
    . '<li>Asistentul nu vede fișele pacienților: știe doar serviciile, prețurile, medicii, programul și orele libere.</li>'
    . '<li>Programează doar pe ore libere reale; în modul direct, doar după codul primit prin SMS pe telefonul pacientului.</li>'
    . '<li>Ce scrie vizitatorul (inclusiv numele și telefonul) ajunge la Anthropic pentru răspuns. Menționați asta în Politica de confidențialitate.</li>'
    . '<li>Conversațiile se văd în panou și se șterg automat după ' . (int) $s['retention_days'] . ' de zile.</li></ul></section>'
    . '</div></div>';
admin_page('Chatul de pe site', $body, $user);
