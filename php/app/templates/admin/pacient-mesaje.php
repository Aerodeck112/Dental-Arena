<?php
/**
 * /admin/pacienti/{id}/mesaje: every message to and from the patient (SMS, WhatsApp, e-mail),
 * newest first, and a message written now. WhatsApp free text only goes out in the 24 hours
 * after the patient wrote; otherwise WhatsApp allows only approved templates, so use SMS.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$errors = [];
$wa = phone_e164((string) $p['phone']);
$windowOpen = $wa !== null && whatsapp_window_open($wa);

if (is_post() && $p['anonymized_at'] === null) {
    csrf_check();
    $channel = post('channel');
    $text = trim(str_replace("\r\n", "\n", post('text')));
    if (mb_strlen($text) < 2) {
        $errors['text'] = 'Scrieți mesajul.';
    }
    $row = ['event' => 'manual', 'patient_id' => $pid, 'body' => mb_substr($text, 0, 2000)];
    if ($channel === 'sms') {
        $to = phone_ro_mobile((string) $p['phone']);
        if ($to === null) {
            $errors['channel'] = 'Pacientul nu are un număr de mobil românesc.';
        } else {
            $row += ['channel' => 'sms', 'to_address' => $to];
        }
    } elseif ($channel === 'whatsapp') {
        if ($wa === null) {
            $errors['channel'] = 'Pacientul nu are număr de telefon.';
        } elseif (!$windowOpen) {
            $errors['channel'] = 'Pe WhatsApp, un mesaj liber se poate trimite doar în 24 de ore după ce pacientul v-a scris. Trimiteți SMS.';
        } else {
            $row += ['channel' => 'whatsapp', 'to_address' => $wa];
        }
    } elseif ($channel === 'email') {
        if (filter_var($p['email'], FILTER_VALIDATE_EMAIL)) {
            $row += ['channel' => 'email', 'to_address' => $p['email'], 'subject' => mb_substr(trim(post('subject')) ?: 'Mesaj de la Dental Arena', 0, 190)];
        } else {
            $errors['channel'] = 'Pacientul nu are e-mail.';
        }
    } else {
        $errors['channel'] = 'Alegeți canalul.';
    }
    if ($errors === []) {
        $id = queue_message($row);
        audit('mesaj-trimis', MSG_CHANNELS[$channel], null, $pid);
        // It leaves now, while the page waits, so the answer says whether it went.
        [$sent, $note] = send_message_now($id);
        flash($note, $sent ? 'succes' : 'eroare');
        redirect("/admin/pacienti/{$pid}/mesaje");
    }
}

// Opening the conversation marks the patient's messages as seen.
db_run("UPDATE messages SET status = 'citit', updated_at = ? WHERE patient_id = ? AND direction = 'in' AND status = 'primit'", [now_sql(), $pid]);
$rows = db_all('SELECT * FROM messages WHERE patient_id = ? ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 200', [$pid]);
$list = implode('', array_map(static fn ($m) => message_bubble($m), $rows));

$channels = [];
if (phone_ro_mobile((string) $p['phone']) !== null) {
    $channels['sms'] = 'SMS';
}
if ($windowOpen) {
    $channels['whatsapp'] = 'WhatsApp';
}
if (filter_var($p['email'], FILTER_VALIDATE_EMAIL)) {
    $channels['email'] = 'E-mail';
}
$prefs = 'Notificări: ' . (PHONE_CHANNELS[$p['phone_channel'] ?? 'sms'] ?? 'SMS') . ((int) $p['email_reminders'] === 1 && $p['email'] ? ' + e-mail' : '')
    . ' · Oferte: ' . (implode(', ', array_filter([(int) $p['marketing_sms'] ? 'SMS' : null, (int) $p['marketing_whatsapp'] ? 'WhatsApp' : null, (int) $p['marketing_email'] ? 'e-mail' : null])) ?: 'nu');
$form = $p['anonymized_at'] !== null || $channels === [] ? '<p class="mt-3 text-corp text-discret">Nu există un canal pe care să-i scrieți (telefon mobil sau e-mail).</p>'
    : '<form method="post" novalidate class="mt-4 flex flex-col gap-4">' . csrf_field() . error_summary($errors)
    . radio_group('channel', 'Pe', $channels, ['inline' => true, 'value' => post('channel') ?: (string) array_key_first($channels), 'error' => $errors['channel'] ?? null])
    . (isset($channels['email']) ? text_field('subject', 'Subiect (pentru e-mail)', ['optional' => true, 'value' => post('subject')]) : '')
    . text_area('text', 'Mesajul', ['rows' => 4, 'value' => post('text'), 'error' => $errors['text'] ?? null, 'maxlength' => 2000, 'hint' => 'Un SMS are 160 de caractere fără diacritice.'])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . admin_icon('send', 18) . 'Trimiteți acum</button></div>'
    . (!$windowOpen && $wa !== null ? '<p class="text-mic text-discret">WhatsApp apare aici după ce pacientul vă scrie (24 de ore pentru răspuns).</p>' : '')
    . '</form>';

$body = patient_header($p, $user, 'mesaje')
    . '<div class="grid gap-8 lg:grid-cols-12">'
    . '<div class="min-w-0 lg:col-span-7">' . admin_section_open('Conversația', 'conversatie', $prefs) . ($list !== '' ? '<ul class="mt-4 flex flex-col gap-3">' . $list . '</ul>' : '<p class="mt-3 text-corp text-discret">Niciun mesaj.</p>') . '</section></div>'
    . '<div class="min-w-0 lg:col-span-5">' . admin_section_open('Mesaj nou', 'mesaj-nou') . $form . '</section></div>'
    . '</div>';
admin_page('Mesaje: ' . patient_name($p), $body, $user);
