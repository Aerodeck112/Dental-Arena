<?php
/**
 * /admin/setari/mesaje (administrators): the SMS and WhatsApp accounts, „probă” or live sending,
 * a test message, and for every notice: on/off per channel, the texts and the WhatsApp template.
 * Passwords and tokens are stored encrypted; the form never shows them back.
 */
declare(strict_types=1);

$m = messaging();
$errors = [];
if ($m['wa_verify'] === '') {
    $m['wa_verify'] = bin2hex(random_bytes(12));
    setting_save('mesagerie', $m);
}

if (is_post()) {
    csrf_check();
    if (post('op') === 'proba') {
        $to = post('test_to');
        $channel = post('test_channel');
        $text = 'Dental Arena: mesaj de probă din panou, ' . date('d.m.Y H:i') . '.';
        $r = match ($channel) {
            'sms' => phone_ro_mobile($to) !== null ? smslink_send((string) phone_ro_mobile($to), $text) : ['ok' => false, 'error' => 'Scrieți un număr de mobil românesc, de exemplu 0744 123 456.'],
            // Without a template name: Meta's test template „hello_world”, which is in English.
            'whatsapp' => phone_e164($to) !== null ? whatsapp_send((string) phone_e164($to), trim(post('test_template')) ?: 'hello_world', [], $text, trim(post('test_template')) === '' ? 'en_US' : null) : ['ok' => false, 'error' => 'Scrieți numărul de telefon.'],
            default => ['ok' => false, 'error' => 'Alegeți canalul.'],
        };
        flash($r['ok'] ? 'Mesajul de probă a plecat. Verificați telefonul.' : 'Nu a mers: ' . $r['error'], $r['ok'] ? 'succes' : 'eroare');
        audit('mesaj-proba', MSG_CHANNELS[$channel] ?? $channel);
        redirect('/admin/setari/mesaje#proba');
    }
    // Accounts.
    $m['mode'] = post('mode') === 'live' ? 'live' : 'proba';
    $m['smslink_id'] = trim(post('smslink_id'));
    if (post('smslink_pass') !== '') {
        $m['smslink_pass'] = secret_seal(post('smslink_pass'));
    }
    $m['sms_sender'] = trim(post('sms_sender'));
    $m['sms_ascii'] = post('sms_ascii') === '1';
    $m['wa_phone_id'] = trim(post('wa_phone_id'));
    if (post('wa_token') !== '') {
        $m['wa_token'] = secret_seal(trim(post('wa_token')));
    }
    if (post('wa_app_secret') !== '') {
        $m['wa_app_secret'] = secret_seal(trim(post('wa_app_secret')));
    }
    $m['wa_version'] = preg_match('/^v\d{2}\.\d$/', trim(post('wa_version'))) ? trim(post('wa_version')) : 'v23.0';
    $m['wa_lang'] = preg_match('/^[a-z]{2}(_[A-Z]{2})?$/', trim(post('wa_lang'))) ? trim(post('wa_lang')) : 'ro';
    $m['review_link'] = trim(post('review_link'));
    if ($m['review_link'] !== '' && !preg_match('#^https://#', $m['review_link'])) {
        $errors['review_link'] = 'Linkul începe cu https://';
    }
    foreach (['quiet_start' => [6, 12], 'quiet_end' => [17, 23]] as $k => [$lo, $hi]) {
        $h = (int) post($k);
        $m[$k] = max($lo, min($hi, $h));
    }
    if ($m['sms_sender'] !== '' && !preg_match('/^[A-Za-z0-9 .-]{3,11}$/', $m['sms_sender'])) {
        $errors['sms_sender'] = 'Expeditorul are 3–11 litere sau cifre și trebuie aprobat întâi de SMSLink.';
    }
    // Notices.
    $notices = [];
    foreach (PATIENT_EVENTS as $ev => $def) {
        $notices[$ev] = [
            'phone' => post("{$ev}_phone") === '1',
            'email' => post("{$ev}_email") === '1',
            'sms' => mb_substr(trim(post("{$ev}_sms")), 0, 640) ?: $def['sms'],
            'subject' => mb_substr(trim(post("{$ev}_subject")), 0, 190) ?: $def['subject'],
            'body' => mb_substr(trim(str_replace("\r\n", "\n", post("{$ev}_body"))), 0, 4000) ?: $def['body'],
            'wa' => preg_replace('/[^a-z0-9_]/', '', strtolower(post("{$ev}_wa"))),
        ];
    }
    foreach (STAFF_EVENTS as $ev => $def) {
        $notices[$ev] = ['sms' => mb_substr(trim(post("{$ev}_sms")), 0, 640) ?: $def['sms'], 'wa' => preg_replace('/[^a-z0-9_]/', '', strtolower(post("{$ev}_wa")))];
    }
    if ($errors === []) {
        setting_save('mesagerie', $m);
        setting_save('notificari', $notices);
        audit('setari-mesaje', $m['mode'] === 'live' ? 'trimitere reală' : 'mod de probă');
        flash('Setările mesajelor au fost salvate.' . ($m['mode'] === 'live' ? ' Mesajele pleacă de acum la pacienți.' : ' Mod de probă: mesajele nu pleacă, apar doar în jurnal.'));
        redirect('/admin/setari/mesaje');
    }
}

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$hours = static fn (int $a, int $b) => array_combine(array_map('strval', range($a, $b)), array_map(static fn ($h) => sprintf('%02d:00', $h), range($a, $b)));
$set = static fn (string $k) => $m[$k] !== '' ? 'Salvat. Scrieți altul doar ca să-l schimbați.' : null;

$accounts = admin_section_open('Cum pleacă mesajele', 'mod')
    . '<div class="mt-4">' . radio_group('mode', 'Trimitere', ['proba' => ['label' => 'Mod de probă', 'description' => 'Nimic nu pleacă: mesajele apar în jurnal ca „probă”. Pentru copia de test și pentru început.'], 'live' => ['label' => 'Trimitere reală', 'description' => 'Mesajele pleacă la pacienți și la echipă, prin SMSLink, WhatsApp și e-mail.']], ['value' => $m['mode']]) . '</div>'
    . '<div class="mt-4 grid gap-4 sm:grid-cols-2">' . select_field('quiet_start', 'Pacienților le scriem de la ora', $hours(6, 12), ['value' => (string) $m['quiet_start']]) . select_field('quiet_end', 'până la ora', $hours(17, 23), ['value' => (string) $m['quiet_end']]) . '</div>'
    . '<p class="mt-2 text-mic text-discret">Ce ar pleca în afara orelor așteaptă până dimineață. Ofertele pleacă doar între 10 și 20. Mesajele către echipă pleacă imediat.</p></section>'
    . admin_section_open('SMS prin SMSLink', 'smslink', 'Din contul SMSLink → SMS Gateway → Configurare: creați o conexiune și copiați aici Connection ID și parola ei.')
    . '<div class="mt-4 grid gap-4 md:grid-cols-2">'
    . text_field('smslink_id', 'Connection ID', ['value' => $m['smslink_id'], 'autocomplete' => 'off'])
    . text_field('smslink_pass', 'Parola conexiunii', ['type' => 'password', 'autocomplete' => 'new-password', 'hint' => $set('smslink_pass')])
    . text_field('sms_sender', 'Expeditor (opțional)', ['value' => $m['sms_sender'], 'optional' => true, 'error' => $err('sms_sender'), 'hint' => 'De exemplu DentalArena, după ce SMSLink îl aprobă. Gol = număr scurt.'])
    . '</div>' . checkbox_field('sms_ascii', 'Trimite SMS-urile fără diacritice', ['checked' => (bool) $m['sms_ascii'], 'description' => 'Cu diacritice, un SMS are doar 70 de caractere în loc de 160, deci costă de până la 2 ori mai mult.', 'class' => 'mt-3']) . '</section>'
    . admin_section_open('WhatsApp (Meta, WhatsApp Business Platform)', 'whatsapp', 'Din Meta for Developers → aplicația → WhatsApp → API Setup: Phone number ID și un token permanent (System User). App Secret e în App Settings → Basic.')
    . '<div class="mt-4 grid gap-4 md:grid-cols-2">'
    . text_field('wa_phone_id', 'Phone number ID', ['value' => $m['wa_phone_id'], 'autocomplete' => 'off'])
    . text_field('wa_token', 'Token de acces (permanent)', ['type' => 'password', 'autocomplete' => 'new-password', 'hint' => $set('wa_token')])
    . text_field('wa_app_secret', 'App Secret', ['type' => 'password', 'autocomplete' => 'new-password', 'hint' => $set('wa_app_secret') ?? 'Verifică mesajele primite de la Meta.'])
    . text_field('wa_lang', 'Limba șabloanelor', ['value' => $m['wa_lang'], 'hint' => 'ro pentru română.'])
    . text_field('wa_version', 'Versiunea API Graph', ['value' => $m['wa_version'], 'hint' => 'Lăsați-o așa dacă nu vi se cere alta.'])
    . '</div>'
    . '<div class="mt-4 rounded-panou bg-fundal p-4 text-mic"><p class="font-semibold">Webhook (în Meta → WhatsApp → Configuration):</p>'
    . '<p class="mt-1">Callback URL: <code class="break-all">' . e(absolute_url('/webhook/whatsapp')) . '</code></p>'
    . '<p>Verify token: <code class="break-all">' . e($m['wa_verify']) . '</code></p>'
    . '<p class="mt-1 text-discret">Abonați câmpul „messages”. Așa aflăm când mesajele au fost livrate și citite și primim răspunsurile pacienților în panou.</p></div></section>'
    . admin_section_open('Linkul pentru recenzii', 'recenzii')
    . '<div class="mt-4">' . text_field('review_link', 'Linkul Google pentru recenzii', ['value' => $m['review_link'], 'optional' => true, 'error' => $err('review_link'), 'hint' => 'Din Google Business Profile → „Cereți recenzii”. Apare în mesajul de mulțumire după vizită.']) . '</div></section>';

$noticeRows = '';
foreach (PATIENT_EVENTS as $ev => $def) {
    $c = patient_event($ev);
    $noticeRows .= '<details class="rounded-panou border border-linie bg-suprafata p-4">'
        . '<summary class="flex cursor-pointer list-none flex-wrap items-center gap-3"><span class="font-semibold">' . e($def['label']) . '</span>'
        . ($def['marketing'] ? '<span class="rounded-chip bg-mustar-pal px-2 py-0.5 text-mic text-mustar-text">ofertă: doar cu acordul pacientului</span>' : '')
        . '<span class="ml-auto text-mic text-discret">' . e(implode(' + ', array_filter([$c['phone'] ? 'SMS/WhatsApp' : null, $c['email'] ? 'e-mail' : null])) ?: 'oprit') . '</span></summary>'
        . '<p class="mt-2 text-mic text-discret">' . e($def['when']) . '</p>'
        . '<div class="mt-3 flex flex-wrap gap-x-8">' . checkbox_field("{$ev}_phone", 'Pe telefon (SMS sau WhatsApp, cum a ales pacientul)', ['checked' => (bool) $c['phone']]) . checkbox_field("{$ev}_email", 'Pe e-mail', ['checked' => (bool) $c['email']]) . '</div>'
        . '<div class="mt-3 grid gap-4">'
        . text_area("{$ev}_sms", 'Textul SMS / WhatsApp', ['value' => $c['sms'], 'rows' => 2, 'hint' => 'Se completează: ' . implode(', ', array_map(static fn ($k) => '{' . $k . '}', array_unique(array_merge(['prenume'], $def['params'])))) . '.'])
        . text_field("{$ev}_wa", 'Numele șablonului WhatsApp aprobat de Meta', ['value' => $c['wa'], 'optional' => true, 'hint' => 'Parametrii șablonului, în ordine: ' . implode(', ', array_map(static fn ($i, $k) => '{{' . ($i + 1) . '}} = ' . $k, array_keys($def['params']), $def['params'])) . '. Fără șablon, pacienții cu WhatsApp primesc SMS.'])
        . text_field("{$ev}_subject", 'Subiectul e-mailului', ['value' => $c['subject']])
        . text_area("{$ev}_body", 'Textul e-mailului', ['value' => $c['body'], 'rows' => 5])
        . '</div></details>';
}
$staffRows = '';
foreach (STAFF_EVENTS as $ev => $def) {
    $c = staff_event($ev);
    $staffRows .= '<div class="grid gap-3 border-t border-linie pt-4 first:border-t-0 first:pt-0 md:grid-cols-2">'
        . text_area("{$ev}_sms", $def['label'], ['value' => $c['sms'], 'rows' => 2])
        . text_field("{$ev}_wa", 'Șablon WhatsApp', ['value' => $c['wa'], 'optional' => true, 'hint' => 'Parametri: ' . implode(', ', array_map(static fn ($i, $k) => '{{' . ($i + 1) . '}} = ' . $k, array_keys($def['params']), $def['params'])) . '.'])
        . (isset($def['wa_text']) ? '<p class="text-mic text-discret md:col-span-2">Text propus pentru șablonul de la Meta (categoria „Utility”, limba română): <span class="font-medium text-cerneala">' . e($def['wa_text']) . '</span></p>' : '')
        . '</div>';
}

$test = admin_section_open('Mesaj de probă', 'proba', 'Pleacă de-adevăratelea (chiar și în modul de probă), ca să verificați contul. Salvați întâi setările.')
    . '<form method="post" class="mt-4 grid gap-4 md:grid-cols-4 md:items-end">' . csrf_field() . '<input type="hidden" name="op" value="proba">'
    . select_field('test_channel', 'Canalul', ['sms' => 'SMS', 'whatsapp' => 'WhatsApp'])
    . text_field('test_to', 'La numărul', ['type' => 'tel', 'value' => (string) ($user['phone'] ?? '')])
    . text_field('test_template', 'Șablon WhatsApp', ['optional' => true, 'hint' => 'Gol = hello_world (șablonul de test Meta).'])
    . '<button type="submit" class="' . e(btn('secondary')) . '">Trimiteți proba</button></form></section>';

$body = '<p class="mb-4"><a href="/admin/setari" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Setări</a></p>'
    . admin_header('Mesaje: SMS, WhatsApp, e-mail', 'Ce mesaje primesc pacienții și echipa, pe ce canal și cu ce text. Fiecare om din echipă își alege notificările în „Contul meu”.', '<a href="/admin/mesaje" class="' . e(btn('secondary')) . '">Jurnalul mesajelor</a>')
    . '<form method="post" novalidate class="flex max-w-4xl flex-col gap-8">' . csrf_field() . error_summary($errors)
    . $accounts
    . admin_section_open('Mesaje către pacienți', 'pacienti', 'Notificările pleacă pe canalul ales de pacient în fișă (SMS, WhatsApp sau deloc) și pe e-mail. Ofertele pleacă doar pacienților care și-au dat acordul pentru acel canal.') . '<div class="mt-4 flex flex-col gap-3">' . $noticeRows . '</div></section>'
    . admin_section_open('Mesaje către echipă', 'echipa', 'Textele; cine le primește și pe ce canal alege fiecare în „Contul meu”.') . '<div class="mt-4 flex flex-col gap-4">' . $staffRows . '</div></section>'
    . '<div class="sticky bottom-0 -mx-4 border-t border-linie bg-fundal/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-panou md:border"><button type="submit" class="' . e(btn('primary', 'l')) . '">Salvați</button></div>'
    . '</form><div class="mt-8 max-w-4xl">' . $test . '</div>';
admin_page('Mesaje', $body, $user);
