<?php
/**
 * Messages to patients and staff: SMS (SMSLink), WhatsApp (Meta WhatsApp Business Platform,
 * Cloud API) and e-mail. Every message goes into the `messages` table first and is sent from
 * there (cron.php every few minutes, and after each panel request), so a slow provider never
 * slows the panel and nothing is lost. In „probă” mode nothing leaves the server: the messages
 * are marked „probă” and written to the log.
 *
 * Patients get the notices the clinic switched on in Setări → Mesaje, on the phone channel
 * they chose (SMS, WhatsApp or none) and by e-mail; marketing only with their explicit consent
 * for that channel, and with a way to unsubscribe. Staff get the notices each person ticked in
 * „Contul meu”.
 */
declare(strict_types=1);

const MSG_CHANNELS = ['sms' => 'SMS', 'whatsapp' => 'WhatsApp', 'email' => 'E-mail'];
const MSG_STATUS = [
    'in-asteptare' => 'În așteptare',
    'se-trimite' => 'Se trimite',
    'trimis' => 'Trimis',
    'livrat' => 'Livrat',
    'citit' => 'Citit',
    'esuat' => 'Eșuat',
    'proba' => 'Probă (netrimis)',
    'primit' => 'Primit',
    'anulat' => 'Anulat',
];
const PHONE_CHANNELS = ['sms' => 'SMS', 'whatsapp' => 'WhatsApp', 'nu' => 'Fără mesaje pe telefon'];

/**
 * The notices to patients: label, when, whether it is marketing (consent needed), the default
 * switches, the texts, and the order of the WhatsApp template's {{1}}, {{2}}, … parameters.
 */
const PATIENT_EVENTS = [
    'programare-noua' => [
        'label' => 'Programare făcută', 'when' => 'Imediat după ce recepția face programarea.', 'marketing' => false, 'phone' => true, 'email' => true,
        'sms' => 'Dental Arena: programarea dvs. este {data}, ora {ora}, la {clinica} ({medic}). Pentru modificari sunati la {telefon_clinica}.',
        'subject' => 'Programarea dumneavoastră la Dental Arena',
        'body' => "Bună ziua, {prenume},\n\nprogramarea dumneavoastră este {data}, la ora {ora}, la Dental Arena {clinica} ({adresa}), cu {medic}.\n\nDacă doriți să o mutați sau nu puteți veni, vă rugăm să ne sunați: {telefon_clinica}.\n\nVă așteptăm,\nDental Arena",
        'params' => ['prenume', 'data', 'ora', 'clinica', 'medic', 'telefon_clinica'],
    ],
    'programare-mutata' => [
        'label' => 'Programare mutată', 'when' => 'Când se schimbă ziua sau ora.', 'marketing' => false, 'phone' => true, 'email' => true,
        'sms' => 'Dental Arena: programarea dvs. a fost mutata pe {data}, ora {ora}, la {clinica}. Intrebari: {telefon_clinica}.',
        'subject' => 'Programarea dumneavoastră a fost mutată',
        'body' => "Bună ziua, {prenume},\n\nprogramarea dumneavoastră a fost mutată pe {data}, la ora {ora}, la Dental Arena {clinica} ({adresa}).\n\nPentru întrebări: {telefon_clinica}.\n\nDental Arena",
        'params' => ['prenume', 'data', 'ora', 'clinica', 'telefon_clinica'],
    ],
    'programare-anulata' => [
        'label' => 'Programare anulată', 'when' => 'Când programarea se anulează.', 'marketing' => false, 'phone' => true, 'email' => true,
        'sms' => 'Dental Arena: programarea dvs. din {data}, ora {ora} a fost anulata. Pentru o noua programare sunati la {telefon_clinica}.',
        'subject' => 'Programarea dumneavoastră a fost anulată',
        'body' => "Bună ziua, {prenume},\n\nprogramarea dumneavoastră din {data}, ora {ora}, a fost anulată.\n\nPentru o programare nouă ne găsiți la {telefon_clinica}.\n\nDental Arena",
        'params' => ['prenume', 'data', 'ora', 'telefon_clinica'],
    ],
    'reamintire' => [
        'label' => 'Reamintire cu o zi înainte', 'when' => 'În ziua dinaintea programării, între 10 și 21 (doar pentru programările făcute cu cel puțin 18 ore înainte).', 'marketing' => false, 'phone' => true, 'email' => true,
        'sms' => 'Dental Arena: va asteptam maine, {data}, la ora {ora}, la {clinica}. Daca nu puteti veni, sunati la {telefon_clinica}.',
        'subject' => 'Programarea de mâine la Dental Arena',
        'body' => "Bună ziua, {prenume},\n\nvă reamintim programarea de mâine la Dental Arena {clinica}:\n\n{data}, ora {ora}\n{medic}\n{adresa}\n\nDacă nu puteți veni, vă rugăm să ne sunați: {telefon_clinica}.\n\nVă așteptăm,\nDental Arena",
        'params' => ['prenume', 'data', 'ora', 'clinica', 'telefon_clinica'],
    ],
    'cerere-primita' => [
        'label' => 'Cerere de pe site primită', 'when' => 'Când cineva trimite cererea de programare de pe site (e-mailul de confirmare pleacă oricum).', 'marketing' => false, 'phone' => false, 'email' => false,
        'sms' => 'Dental Arena: am primit cererea dvs. de programare. Va sunam in cel mult o zi lucratoare. Urgente: {telefon_clinica}.',
        'subject' => 'Am primit cererea de programare',
        'body' => "Bună ziua,\n\nam primit cererea dumneavoastră de programare. Vă sunăm în cel mult o zi lucrătoare.\n\nDental Arena",
        'params' => ['telefon_clinica'],
    ],
    'factura-emisa' => [
        'label' => 'Factură emisă', 'when' => 'Când se emite o factură.', 'marketing' => false, 'phone' => false, 'email' => false,
        'sms' => 'Dental Arena: factura {factura}, total {suma}. Va multumim!',
        'subject' => 'Factura {factura} de la Dental Arena',
        'body' => "Bună ziua, {prenume},\n\nvă mulțumim! Factura {factura}, în valoare de {suma}, a fost emisă. O puteți primi tipărită la recepție.\n\nDental Arena",
        'params' => ['prenume', 'factura', 'suma'],
    ],
    'plata-primita' => [
        'label' => 'Plată primită', 'when' => 'Când se înregistrează o încasare.', 'marketing' => false, 'phone' => false, 'email' => false,
        'sms' => 'Dental Arena: am primit plata de {suma}. Va multumim!',
        'subject' => 'Am primit plata dumneavoastră',
        'body' => "Bună ziua, {prenume},\n\nam primit plata de {suma}. Vă mulțumim!\n\nDental Arena",
        'params' => ['prenume', 'suma'],
    ],
    'rechemare' => [
        'label' => 'Rechemare la control', 'when' => 'Cu 7 zile înainte de data rechemării (o singură dată).', 'marketing' => false, 'phone' => false, 'email' => false,
        'sms' => 'Dental Arena: se apropie controlul periodic recomandat. Sunati-ne la {telefon_clinica} sa stabilim ora potrivita.',
        'subject' => 'E timpul pentru controlul periodic',
        'body' => "Bună ziua, {prenume},\n\nse apropie controlul periodic recomandat de medic ({motiv}). Sunați-ne la {telefon_clinica} ca să stabilim o oră potrivită.\n\nDental Arena",
        'params' => ['prenume', 'telefon_clinica'],
    ],
    'dupa-vizita' => [
        'label' => 'Mulțumire după vizită și părere', 'when' => 'A doua zi după o programare finalizată, la ora 11.', 'marketing' => true, 'phone' => false, 'email' => false,
        'sms' => 'Dental Arena: va multumim pentru vizita! Ne lasati o parere? {link_recenzie}',
        'subject' => 'Vă mulțumim pentru vizită',
        'body' => "Bună ziua, {prenume},\n\nvă mulțumim că ne-ați vizitat! Dacă aveți un minut, părerea dumneavoastră ne ajută mult: {link_recenzie}\n\nDental Arena",
        'params' => ['prenume', 'link_recenzie'],
    ],
    'zi-nastere' => [
        'label' => 'La mulți ani', 'when' => 'De ziua pacientului, la ora 10.', 'marketing' => true, 'phone' => false, 'email' => false,
        'sms' => 'La multi ani, {prenume}! Echipa Dental Arena va doreste sanatate si zambete frumoase.',
        'subject' => 'La mulți ani, {prenume}!',
        'body' => "La mulți ani, {prenume}!\n\nEchipa Dental Arena vă dorește sănătate și multe zâmbete.\n\nDental Arena",
        'params' => ['prenume'],
    ],
];

/** The notices to staff (each person chooses in „Contul meu”). */
const STAFF_EVENTS = [
    'staff-programare-noua' => ['label' => 'Programare nouă la mine', 'who' => 'medic', 'sms' => 'Programare noua: {pacient}, {data} ora {ora}, {clinica}. {motiv}', 'params' => ['pacient', 'data', 'ora', 'clinica']],
    'staff-programare-mutata' => ['label' => 'Programare mutată', 'who' => 'medic', 'sms' => 'Programare mutata: {pacient}, acum {data} ora {ora}, {clinica}.', 'params' => ['pacient', 'data', 'ora', 'clinica']],
    'staff-programare-anulata' => ['label' => 'Programare anulată', 'who' => 'medic', 'sms' => 'Programare anulata: {pacient}, {data} ora {ora}, {clinica}.', 'params' => ['pacient', 'data', 'ora', 'clinica']],
    'staff-pacient-sosit' => ['label' => 'Pacientul a sosit', 'who' => 'medic', 'sms' => '{pacient} a sosit (programarea de la {ora}, {clinica}).', 'params' => ['pacient', 'ora', 'clinica']],
    'staff-agenda' => ['label' => 'Programările zilei, dimineața la 7', 'who' => 'medic', 'sms' => 'Programarile de azi, {data}: {lista}', 'params' => ['data', 'lista']],
    'staff-cerere-noua' => ['label' => 'Cerere nouă de pe site', 'who' => 'receptie', 'sms' => 'Cerere noua de pe site: {pacient}, {telefon}, {serviciu}, {clinica}.', 'params' => ['pacient', 'telefon', 'serviciu', 'clinica']],
    'staff-whatsapp-primit' => ['label' => 'Mesaj nou de la un pacient pe WhatsApp', 'who' => 'receptie', 'sms' => 'Mesaj WhatsApp de la {pacient}: {text}', 'params' => ['pacient', 'text']],
];

const MESSAGING_DEFAULTS = [
    'mode' => 'proba',
    'smslink_id' => '',
    'smslink_pass' => '',
    'sms_sender' => '',
    'sms_ascii' => true,
    'wa_phone_id' => '',
    'wa_token' => '',
    'wa_app_secret' => '',
    'wa_verify' => '',
    'wa_version' => 'v23.0',
    'wa_lang' => 'ro',
    'review_link' => '',
    'quiet_start' => 9,
    'quiet_end' => 20,
];

// ── Secrets (API keys and passwords stored in the database, encrypted with config.php's secret) ──

function secret_key(): string
{
    return hash('sha256', 'secrete|' . (CONFIG['secret'] ?? ''), true);
}

function secret_seal(string $plain): string
{
    if ($plain === '') {
        return '';
    }
    $iv = random_bytes(12);
    $tag = '';
    $ct = openssl_encrypt($plain, 'aes-256-gcm', secret_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return 'v1:' . base64_encode($iv . $tag . $ct);
}

function secret_open(string $sealed): string
{
    if (!str_starts_with($sealed, 'v1:')) {
        return '';
    }
    $raw = base64_decode(substr($sealed, 3), true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }
    $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', secret_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $plain === false ? '' : $plain;
}

function messaging(): array
{
    $m = setting('mesagerie');
    return array_merge(MESSAGING_DEFAULTS, is_array($m) ? $m : []);
}

function messaging_live(): bool
{
    return messaging()['mode'] === 'live';
}

/** The settings of a patient notice (the defaults, with what the clinic changed). */
function patient_event(string $event): array
{
    $saved = setting('notificari');
    $over = is_array($saved) && is_array($saved[$event] ?? null) ? $saved[$event] : [];
    return array_merge(PATIENT_EVENTS[$event] + ['wa' => ''], array_intersect_key($over, array_flip(['phone', 'email', 'sms', 'subject', 'body', 'wa'])));
}

function staff_event(string $event): array
{
    $saved = setting('notificari');
    $over = is_array($saved) && is_array($saved[$event] ?? null) ? $saved[$event] : [];
    return array_merge(STAFF_EVENTS[$event] + ['wa' => ''], array_intersect_key($over, array_flip(['sms', 'wa'])));
}

// ── Text ─────────────────────────────────────────────────────────────────────

/** Replaces {name} with the values; unknown names are left out. */
function fill_template(string $text, array $vars): string
{
    return trim((string) preg_replace_callback('/\{([a-z_]+)\}/', static fn ($m) => (string) ($vars[$m[1]] ?? ''), $text));
}

function strip_diacritics(string $s): string
{
    return strtr($s, ['ă' => 'a', 'â' => 'a', 'î' => 'i', 'ș' => 's', 'ş' => 's', 'ț' => 't', 'ţ' => 't', 'Ă' => 'A', 'Â' => 'A', 'Î' => 'I', 'Ș' => 'S', 'Ş' => 'S', 'Ț' => 'T', 'Ţ' => 'T', '„' => '"', '”' => '"', '–' => '-', '—' => '-', '…' => '...', NBSP => ' ']);
}

/** How many SMS a text costs: 160/153 characters in the basic alphabet, 70/67 with diacritics. */
function sms_parts(string $text): int
{
    $len = mb_strlen($text);
    if ($len === 0) {
        return 0;
    }
    $gsm = preg_match('/^[\x20-\x7E\r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà]*$/u', $text) === 1;
    if ($gsm) {
        $len += preg_match_all('/[\[\]{}|^~\\\\€]/u', $text);
        return $len <= 160 ? 1 : (int) ceil($len / 153);
    }
    return $len <= 70 ? 1 : (int) ceil($len / 67);
}

/** 0744 123 456 → 40744123456 (for WhatsApp); null when it is not a usable number. */
function phone_e164(string $phone): ?string
{
    $d = preg_replace('/\D+/', '', $phone) ?? '';
    if (str_starts_with($d, '00')) {
        $d = substr($d, 2);
    }
    if (preg_match('/^0[2-9]\d{8}$/', $d)) {
        return '40' . substr($d, 1);
    }
    return preg_match('/^[1-9]\d{9,14}$/', $d) ? $d : null;
}

/** A Romanian mobile number as SMSLink wants it (07xxxxxxxx), else null. */
function phone_ro_mobile(string $phone): ?string
{
    $e = phone_e164($phone);
    return $e !== null && preg_match('/^407\d{8}$/', $e) ? '0' . substr($e, 2) : null;
}

/** The common values of an appointment for the texts. */
function appointment_vars(array $a): array
{
    $c = null;
    foreach (clinics() as $cl) {
        if ($cl['id'] === (int) $a['location_id']) {
            $c = $cl;
        }
    }
    $doc = db_one('SELECT public_name, last_name FROM doctors WHERE id = ?', [(int) $a['doctor_id']]);
    return [
        'data' => format_date(substr($a['starts_at'], 0, 10), true),
        'ora' => substr($a['starts_at'], 11, 5),
        'clinica' => $c['shortName'] ?? '',
        'adresa' => $c ? clinic_address($c) : '',
        'telefon_clinica' => $c ? format_phone($c['phone']) : '',
        'medic' => $doc['public_name'] ?? '',
        'motiv' => (string) ($a['reason'] ?? ''),
    ];
}

function patient_vars(array $p): array
{
    return ['prenume' => (string) $p['first_name'], 'nume' => trim($p['last_name'] . ' ' . $p['first_name']), 'pacient' => trim($p['last_name'] . ' ' . $p['first_name'])];
}

/** The link that takes a patient out of marketing messages (one click, no login). */
function unsubscribe_url(array $p): string
{
    $token = $p['unsubscribe_token'] ?? null;
    if (!$token) {
        $token = substr(strtr(base64_encode(random_bytes(9)), '+/', 'xy'), 0, 12);
        db_update('patients', ['unsubscribe_token' => $token], 'id = :id', ['id' => $p['id']]);
    }
    return absolute_url('/d/' . $token);
}

// ── Queueing ─────────────────────────────────────────────────────────────────

/** Moves a time into the hours when patients may be written to (marketing: 10–20). */
function within_hours(DateTimeImmutable $t, bool $marketing): DateTimeImmutable
{
    $m = messaging();
    $start = $marketing ? max(10, (int) $m['quiet_start']) : (int) $m['quiet_start'];
    $end = $marketing ? min(20, (int) $m['quiet_end']) : (int) $m['quiet_end'];
    $h = (int) $t->format('G');
    if ($h < $start) {
        return $t->setTime($start, 0);
    }
    if ($h >= $end) {
        return $t->modify('+1 day')->setTime($start, 0);
    }
    return $t;
}

function queue_message(array $m): int
{
    return db_insert('messages', $m + [
        'direction' => 'out',
        'status' => 'in-asteptare',
        'send_after' => now_sql(),
        'created_by' => current_user()['id'] ?? null,
        'created_at' => now_sql(),
    ]);
}

/**
 * Queues a patient notice on the channels switched on for it and allowed by the patient.
 * $vars are the values for the texts; $o: appointment_id, send_after, channels (to force).
 * Returns how many messages were queued.
 */
function notify_patient(string $event, array $p, array $vars = [], array $o = []): int
{
    if (!isset(PATIENT_EVENTS[$event]) || ($p['anonymized_at'] ?? null) !== null || (int) ($p['active'] ?? 1) === 0) {
        return 0;
    }
    $cfg = patient_event($event);
    $marketing = (bool) $cfg['marketing'];
    $vars += patient_vars($p) + ['link_recenzie' => messaging()['review_link']];
    $when = within_hours(new DateTimeImmutable($o['send_after'] ?? 'now'), $marketing)->format('Y-m-d H:i:s');
    $n = 0;
    $base = ['event' => $event, 'patient_id' => (int) $p['id'], 'appointment_id' => $o['appointment_id'] ?? null, 'campaign_id' => $o['campaign_id'] ?? null, 'send_after' => $when];
    // The phone: SMS or WhatsApp, as the patient chose.
    $channel = $p['phone_channel'] ?? 'sms';
    if (!empty($cfg['phone']) && $channel !== 'nu' && ($p['phone'] ?? '') !== '' && (!$marketing || (int) ($p['marketing_' . $channel] ?? 0) === 1)) {
        $text = fill_template((string) $cfg['sms'], $vars);
        if ($marketing && $channel === 'sms') {
            $text .= ' Dezabonare: ' . unsubscribe_url($p);
        }
        if ($channel === 'whatsapp' && trim((string) $cfg['wa']) !== '') {
            $n += (int) (bool) queue_message($base + ['channel' => 'whatsapp', 'to_address' => (string) phone_e164($p['phone']), 'body' => $text, 'template' => trim((string) $cfg['wa']), 'template_params' => json_encode(array_map(static fn ($k) => (string) ($vars[$k] ?? ''), $cfg['params']), JSON_UNESCAPED_UNICODE)]);
        } elseif (phone_ro_mobile($p['phone']) !== null) {
            // No WhatsApp template for this notice: SMS instead.
            $n += (int) (bool) queue_message($base + ['channel' => 'sms', 'to_address' => (string) phone_ro_mobile($p['phone']), 'body' => $text]);
        }
    }
    if (!empty($cfg['email']) && filter_var($p['email'] ?? '', FILTER_VALIDATE_EMAIL) && (int) ($marketing ? ($p['marketing_email'] ?? 0) : ($p['email_reminders'] ?? 1)) === 1) {
        $body = fill_template((string) $cfg['body'], $vars) . ($marketing ? "\n\nNu mai doriți astfel de mesaje? " . unsubscribe_url($p) : '');
        $n += (int) (bool) queue_message($base + ['channel' => 'email', 'to_address' => (string) $p['email'], 'subject' => fill_template((string) $cfg['subject'], $vars), 'body' => $body]);
    }
    return $n;
}

/** A notice to someone who is not a patient yet (a request from the site). */
function notify_contact(string $event, string $phone, array $vars = []): int
{
    $cfg = patient_event($event);
    if (empty($cfg['phone']) || ($to = phone_ro_mobile($phone)) === null) {
        return 0;
    }
    return (int) (bool) queue_message(['channel' => 'sms', 'event' => $event, 'to_address' => $to, 'body' => fill_template((string) $cfg['sms'], $vars), 'send_after' => within_hours(new DateTimeImmutable(), false)->format('Y-m-d H:i:s')]);
}

/** @return array<string,list<string>> event → channels a user chose */
function user_notify_prefs(array $u): array
{
    $p = json_decode((string) ($u['notify_prefs'] ?? ''), true);
    return is_array($p) ? $p : [];
}

/** Queues a staff notice to each user who chose it, on the channels they chose. */
function notify_staff(string $event, array $users, array $vars, array $o = []): int
{
    if (!isset(STAFF_EVENTS[$event])) {
        return 0;
    }
    $cfg = staff_event($event);
    $text = fill_template((string) $cfg['sms'], $vars);
    $n = 0;
    foreach ($users as $u) {
        if ((int) ($u['active'] ?? 1) === 0) {
            continue;
        }
        foreach (user_notify_prefs($u)[$event] ?? [] as $ch) {
            $row = ['event' => $event, 'user_id' => (int) $u['id'], 'appointment_id' => $o['appointment_id'] ?? null, 'send_after' => $o['send_after'] ?? now_sql()];
            if ($ch === 'sms' && ($to = phone_ro_mobile((string) $u['phone'])) !== null) {
                $n += (int) (bool) queue_message($row + ['channel' => 'sms', 'to_address' => $to, 'body' => $text]);
            } elseif ($ch === 'whatsapp' && trim((string) $cfg['wa']) !== '' && ($to = phone_e164((string) $u['phone'])) !== null) {
                $n += (int) (bool) queue_message($row + ['channel' => 'whatsapp', 'to_address' => $to, 'body' => $text, 'template' => trim((string) $cfg['wa']), 'template_params' => json_encode(array_map(static fn ($k) => (string) ($vars[$k] ?? ''), $cfg['params']), JSON_UNESCAPED_UNICODE)]);
            } elseif ($ch === 'email' && filter_var($u['email'], FILTER_VALIDATE_EMAIL)) {
                $n += (int) (bool) queue_message($row + ['channel' => 'email', 'to_address' => $u['email'], 'subject' => 'Dental Arena: ' . STAFF_EVENTS[$event]['label'], 'body' => $text . "\n\n" . absolute_url('/admin')]);
            }
        }
    }
    return $n;
}

/** The users who are a doctor's account. */
function users_of_doctor(?int $doctorId): array
{
    return $doctorId ? db_all('SELECT * FROM users WHERE doctor_id = ? AND active = 1', [$doctorId]) : [];
}

/** Reception and administrators who see a clinic (a request without a clinic: everyone). */
function front_desk_users(?int $locationId): array
{
    $rows = db_all("SELECT * FROM users WHERE active = 1 AND role IN ('admin', 'receptie')");
    if ($locationId === null) {
        return $rows;
    }
    $at = array_map('intval', array_column(db_all('SELECT user_id FROM user_locations WHERE location_id = ?', [$locationId]), 'user_id'));
    return array_values(array_filter($rows, static fn ($u) => $u['role'] === 'admin' || in_array((int) $u['id'], $at, true)));
}

/** Patient + doctor notices of an appointment event (new, moved, cancelled, arrived). */
function notify_appointment(string $what, int $appointmentId): void
{
    try {
        $a = db_one('SELECT * FROM appointments WHERE id = ?', [$appointmentId]);
        $p = $a ? db_one('SELECT * FROM patients WHERE id = ?', [(int) $a['patient_id']]) : null;
        if ($a === null || $p === null) {
            return;
        }
        $vars = appointment_vars($a) + patient_vars($p);
        $future = strtotime($a['starts_at']) > time();
        if ($future && in_array($what, ['programare-noua', 'programare-mutata', 'programare-anulata'], true)) {
            notify_patient($what, $p, $vars, ['appointment_id' => $appointmentId]);
        }
        $staff = ['programare-noua' => 'staff-programare-noua', 'programare-mutata' => 'staff-programare-mutata', 'programare-anulata' => 'staff-programare-anulata', 'sosit' => 'staff-pacient-sosit'][$what] ?? null;
        if ($staff !== null && ($future || $what === 'sosit')) {
            $others = array_filter(users_of_doctor((int) $a['doctor_id']), static fn ($u) => (int) $u['id'] !== (int) (current_user()['id'] ?? 0));
            notify_staff($staff, $others, $vars, ['appointment_id' => $appointmentId]);
        }
    } catch (Throwable $e) {
        app_log('error', "notify_appointment({$what}): " . $e->getMessage());
    }
}

// ── Sending ──────────────────────────────────────────────────────────────────

/** A small HTTP client (cURL when present, else PHP streams). @return array{0:int,1:string,2:string} status, body, error */
function http_call(string $method, string $url, array $headers = [], ?string $body = null, int $timeout = 20): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $res = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = $res === false ? curl_error($ch) : '';
        curl_close($ch);
        return [$status, $res === false ? '' : (string) $res, $err];
    }
    $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body ?? '', 'timeout' => $timeout, 'ignore_errors' => true]]);
    $res = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
            $status = (int) $m[1];
        }
    }
    return [$status, $res === false ? '' : $res, $res === false ? 'conexiunea a eșuat' : ''];
}

/** @return array{ok:bool,id:?string,error:?string} */
function smslink_send(string $to, string $text, bool $test = false): array
{
    $m = messaging();
    if ($m['smslink_id'] === '' || $m['smslink_pass'] === '') {
        return ['ok' => false, 'id' => null, 'error' => 'SMSLink nu este configurat (Setări → Mesaje).'];
    }
    $params = ['connection_id' => $m['smslink_id'], 'password' => secret_open($m['smslink_pass']), 'to' => $to, 'message' => $m['sms_ascii'] ? strip_diacritics($text) : $text];
    if ($m['sms_sender'] !== '') {
        $params['sender'] = $m['sms_sender'];
    }
    if ($test) {
        $params['test'] = 1;
    }
    [$status, $body, $err] = http_call('POST', 'https://secure.smslink.ro/sms/gateway/communicate/', ['Content-Type: application/x-www-form-urlencoded'], http_build_query($params));
    $body = trim($body);
    if ($err !== '' || $status >= 400) {
        return ['ok' => false, 'id' => null, 'error' => 'SMSLink: ' . ($err ?: "HTTP {$status}")];
    }
    // MESSAGE;<cod>;<descriere>;<variabile separate prin virgulă> sau ERROR;<cod>;<descriere>
    $parts = explode(';', $body, 4);
    if (($parts[0] ?? '') === 'MESSAGE') {
        return ['ok' => true, 'id' => explode(',', $parts[3] ?? '')[0] ?: null, 'error' => null];
    }
    return ['ok' => false, 'id' => null, 'error' => 'SMSLink: ' . mb_substr($parts[2] ?? $body, 0, 200)];
}

/**
 * WhatsApp Cloud API: a template (business-initiated: notices, marketing) or free text (only in
 * the 24 hours after the patient wrote to the clinic).
 *
 * @return array{ok:bool,id:?string,error:?string}
 */
function whatsapp_send(string $to, ?string $template, array $params, string $text, ?string $lang = null): array
{
    $m = messaging();
    $token = secret_open($m['wa_token']);
    if ($m['wa_phone_id'] === '' || $token === '') {
        return ['ok' => false, 'id' => null, 'error' => 'WhatsApp nu este configurat (Setări → Mesaje).'];
    }
    $payload = ['messaging_product' => 'whatsapp', 'to' => $to];
    if ($template !== null && $template !== '') {
        $payload += ['type' => 'template', 'template' => ['name' => $template, 'language' => ['code' => $lang ?? ($m['wa_lang'] ?: 'ro')]]];
        if ($params !== []) {
            $payload['template']['components'] = [['type' => 'body', 'parameters' => array_map(static fn ($v) => ['type' => 'text', 'text' => $v !== '' ? $v : '-'], $params)]];
        }
    } else {
        $payload += ['type' => 'text', 'text' => ['body' => $text, 'preview_url' => true]];
    }
    $url = 'https://graph.facebook.com/' . rawurlencode($m['wa_version'] ?: 'v23.0') . '/' . rawurlencode($m['wa_phone_id']) . '/messages';
    [$status, $body, $err] = http_call('POST', $url, ['Authorization: Bearer ' . $token, 'Content-Type: application/json'], json_encode($payload, JSON_UNESCAPED_UNICODE));
    $res = json_decode($body, true);
    if ($err === '' && $status < 300 && isset($res['messages'][0]['id'])) {
        return ['ok' => true, 'id' => (string) $res['messages'][0]['id'], 'error' => null];
    }
    $msg = $res['error']['error_data']['details'] ?? $res['error']['message'] ?? ($err ?: "HTTP {$status}");
    return ['ok' => false, 'id' => null, 'error' => 'WhatsApp: ' . mb_substr((string) $msg, 0, 200)];
}

/** Sends one queued message (or, in „probă” mode, only logs it). */
function deliver_message(array $msg): array
{
    if (!messaging_live()) {
        app_log('info', "mesaj de probă #{$msg['id']} [{$msg['channel']}] către {$msg['to_address']}: " . str_replace("\n", ' | ', $msg['body']));
        return ['ok' => true, 'id' => null, 'error' => null, 'status' => 'proba'];
    }
    return match ($msg['channel']) {
        'sms' => smslink_send($msg['to_address'], $msg['body']),
        'whatsapp' => whatsapp_send($msg['to_address'], $msg['template'], $msg['template'] ? (json_decode((string) $msg['template_params'], true) ?: []) : [], $msg['body']),
        'email' => send_mail($msg['to_address'], (string) $msg['subject'], $msg['body']) ? ['ok' => true, 'id' => null, 'error' => null] : ['ok' => false, 'id' => null, 'error' => 'E-mailul nu a putut fi trimis.'],
        default => ['ok' => false, 'id' => null, 'error' => 'Canal necunoscut.'],
    };
}

/** Sends what is due in the queue; returns how many were handled. */
function process_message_queue(int $limit = 40): int
{
    // A message stuck in „se trimite” (a request that died) goes back to the queue.
    db_run("UPDATE messages SET status = 'in-asteptare' WHERE status = 'se-trimite' AND updated_at < ?", [date('Y-m-d H:i:s', time() - 600)]);
    $rows = db_all("SELECT * FROM messages WHERE status = 'in-asteptare' AND send_after <= ? ORDER BY send_after, id LIMIT " . max(1, $limit), [now_sql()]);
    $n = 0;
    foreach ($rows as $msg) {
        // Claim it: only one process sends a message.
        if (db_run("UPDATE messages SET status = 'se-trimite', updated_at = ? WHERE id = ? AND status = 'in-asteptare'", [now_sql(), $msg['id']]) !== 1) {
            continue;
        }
        try {
            $r = deliver_message($msg);
        } catch (Throwable $e) {
            $r = ['ok' => false, 'id' => null, 'error' => mb_substr($e->getMessage(), 0, 200)];
        }
        $attempts = (int) $msg['attempts'] + 1;
        if ($r['ok']) {
            db_update('messages', ['status' => $r['status'] ?? 'trimis', 'provider_id' => $r['id'], 'error' => null, 'attempts' => $attempts, 'sent_at' => now_sql(), 'updated_at' => now_sql()], 'id = :id', ['id' => $msg['id']]);
        } else {
            // Up to 3 tries, 10 and 30 minutes apart.
            $retry = $attempts < 3;
            db_update('messages', ['status' => $retry ? 'in-asteptare' : 'esuat', 'error' => $r['error'], 'attempts' => $attempts, 'send_after' => $retry ? date('Y-m-d H:i:s', time() + ($attempts === 1 ? 600 : 1800)) : $msg['send_after'], 'updated_at' => now_sql()], 'id = :id', ['id' => $msg['id']]);
            app_log('warning', "mesaj #{$msg['id']} [{$msg['channel']}]: {$r['error']}");
        }
        $n++;
    }
    return $n;
}

/**
 * After the page has gone to the browser, sends what is due (so a notice leaves at once even
 * without the cron job). Register once per request.
 */
function send_queue_after_response(): void
{
    static $registered = false;
    if ($registered) {
        return;
    }
    $registered = true;
    register_shutdown_function(static function (): void {
        try {
            if ((int) db_value("SELECT COUNT(*) FROM messages WHERE status = 'in-asteptare' AND send_after <= ?", [now_sql()]) === 0) {
                return;
            }
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } elseif (function_exists('litespeed_finish_request')) {
                litespeed_finish_request();
            }
            ignore_user_abort(true);
            @set_time_limit(60);
            process_message_queue(15);
        } catch (Throwable $e) {
            app_log('error', 'coada de mesaje: ' . $e->getMessage());
        }
    });
}

// ── Daily jobs (cron.php; the panel runs them too, as a fallback) ─────────────

/** Runs a job at most once a day, from the given hour. */
function daily_job(string $name, int $fromHour, DateTimeImmutable $now, callable $fn): void
{
    if ((int) $now->format('G') < $fromHour) {
        return;
    }
    $marker = APP_DIR . '/storage/zilnic-' . preg_replace('/[^a-z0-9-]/', '', $name) . '.txt';
    if (@file_get_contents($marker) === $now->format('Y-m-d')) {
        return;
    }
    @file_put_contents($marker, $now->format('Y-m-d'));
    try {
        $fn();
    } catch (Throwable $e) {
        app_log('error', "job {$name}: " . $e->getMessage());
    }
}

function run_daily_jobs(?DateTimeImmutable $now = null): void
{
    $now ??= new DateTimeImmutable();
    $today = $now->format('Y-m-d');

    // The doctors' agenda of the day.
    daily_job('agenda', 7, $now, static function () use ($today): void {
        $rows = db_all("SELECT a.*, p.first_name, p.last_name FROM appointments a JOIN patients p ON p.id = a.patient_id
            WHERE a.starts_at >= ? AND a.starts_at < ? AND a.status IN ('programat', 'confirmat') ORDER BY a.starts_at", ["{$today} 00:00:00", "{$today} 23:59:59"]);
        $byDoctor = [];
        foreach ($rows as $r) {
            $byDoctor[(int) $r['doctor_id']][] = substr($r['starts_at'], 11, 5) . ' ' . trim($r['last_name'] . ' ' . $r['first_name']);
        }
        foreach ($byDoctor as $doc => $list) {
            notify_staff('staff-agenda', users_of_doctor($doc), ['data' => format_date($today), 'lista' => implode(', ', $list)]);
        }
    });

    // Birthdays (marketing: only with consent).
    daily_job('zi-nastere', 10, $now, static function () use ($now): void {
        foreach (db_all("SELECT * FROM patients WHERE active = 1 AND anonymized_at IS NULL AND birth_date IS NOT NULL AND MONTH(birth_date) = ? AND DAY(birth_date) = ?", [(int) $now->format('n'), (int) $now->format('j')]) as $p) {
            notify_patient('zi-nastere', $p);
        }
    });

    // Thanks and a review request, the day after a finished visit (once per patient a month).
    daily_job('dupa-vizita', 11, $now, static function () use ($now): void {
        $y = $now->modify('-1 day')->format('Y-m-d');
        $rows = db_all("SELECT DISTINCT p.* FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.status = 'finalizat' AND a.starts_at >= ? AND a.starts_at < ?", ["{$y} 00:00:00", "{$y} 23:59:59"]);
        foreach ($rows as $p) {
            if (!db_value("SELECT 1 FROM messages WHERE event = 'dupa-vizita' AND patient_id = ? AND created_at > ?", [$p['id'], $now->modify('-30 days')->format('Y-m-d H:i:s')])) {
                notify_patient('dupa-vizita', $p);
            }
        }
    });

    // Recalls due in 7 days, once each.
    daily_job('rechemari', 10, $now, static function () use ($now): void {
        $rows = db_all("SELECT r.reason, p.* FROM recalls r JOIN patients p ON p.id = r.patient_id WHERE r.status = 'de-facut' AND r.due_date = ?", [$now->modify('+7 days')->format('Y-m-d')]);
        foreach ($rows as $p) {
            $c = null;
            foreach (clinics() as $cl) {
                if ($cl['id'] === (int) $p['preferred_location_id'] || $c === null) {
                    $c = $cl;
                }
            }
            notify_patient('rechemare', $p, ['motiv' => $p['reason'], 'telefon_clinica' => $c ? format_phone($c['phone']) : '']);
        }
    });
}

// ── WhatsApp webhook (/webhook/whatsapp): delivery statuses and the patients' replies ──

function whatsapp_webhook(): never
{
    $m = messaging();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        if (($_GET['hub_mode'] ?? '') === 'subscribe' && $m['wa_verify'] !== '' && hash_equals($m['wa_verify'], (string) ($_GET['hub_verify_token'] ?? ''))) {
            header('Content-Type: text/plain');
            echo (string) ($_GET['hub_challenge'] ?? '');
            exit;
        }
        http_response_code(403);
        exit;
    }
    $raw = (string) file_get_contents('php://input');
    $secret = secret_open($m['wa_app_secret']);
    $sig = (string) ($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
    if ($secret === '' || !hash_equals('sha256=' . hash_hmac('sha256', $raw, $secret), $sig)) {
        http_response_code(401);
        exit;
    }
    $data = json_decode($raw, true);
    foreach ($data['entry'] ?? [] as $entry) {
        foreach ($entry['changes'] ?? [] as $change) {
            $v = $change['value'] ?? [];
            foreach ($v['statuses'] ?? [] as $s) {
                $map = ['sent' => 'trimis', 'delivered' => 'livrat', 'read' => 'citit', 'failed' => 'esuat'];
                $to = $map[$s['status'] ?? ''] ?? null;
                $msg = $to !== null ? db_one('SELECT id, status FROM messages WHERE provider_id = ?', [(string) ($s['id'] ?? '')]) : null;
                if ($msg === null) {
                    continue;
                }
                // A status only moves forward (a late „delivered” does not undo „read”).
                $rank = ['se-trimite' => 0, 'trimis' => 1, 'livrat' => 2, 'citit' => 3];
                if ($to === 'esuat' || ($rank[$to] ?? 0) > ($rank[$msg['status']] ?? -1)) {
                    $row = ['status' => $to, 'updated_at' => now_sql()];
                    if ($to === 'esuat') {
                        $row['error'] = mb_substr('WhatsApp: ' . ($s['errors'][0]['error_data']['details'] ?? $s['errors'][0]['title'] ?? 'nelivrat'), 0, 255);
                    }
                    db_update('messages', $row, 'id = :id', ['id' => $msg['id']]);
                }
            }
            foreach ($v['messages'] ?? [] as $in) {
                $from = (string) ($in['from'] ?? '');
                $text = (string) ($in['text']['body'] ?? $in['button']['text'] ?? $in['interactive']['button_reply']['title'] ?? ('[' . ($in['type'] ?? 'mesaj') . ']'));
                $patient = null;
                foreach (db_all("SELECT * FROM patients WHERE phone <> '' AND anonymized_at IS NULL") as $p) {
                    if (phone_e164($p['phone']) === $from) {
                        $patient = $p;
                        break;
                    }
                }
                if (db_value('SELECT 1 FROM messages WHERE provider_id = ?', [(string) ($in['id'] ?? '')])) {
                    continue;
                }
                db_insert('messages', ['direction' => 'in', 'channel' => 'whatsapp', 'event' => 'raspuns', 'patient_id' => $patient['id'] ?? null, 'to_address' => $from, 'body' => mb_substr($text, 0, 4000), 'status' => 'primit', 'provider_id' => (string) ($in['id'] ?? ''), 'send_after' => now_sql(), 'created_at' => now_sql()]);
                if ($patient && preg_match('/^\s*(stop|dezabonare|dezabonez)\s*$/iu', $text)) {
                    db_update('patients', ['marketing_whatsapp' => 0, 'updated_at' => now_sql()], 'id = :id', ['id' => $patient['id']]);
                }
                notify_staff('staff-whatsapp-primit', front_desk_users($patient && $patient['preferred_location_id'] ? (int) $patient['preferred_location_id'] : null), ['pacient' => $patient ? trim($patient['last_name'] . ' ' . $patient['first_name']) : '+' . $from, 'text' => mb_substr($text, 0, 120)]);
            }
        }
    }
    send_queue_after_response();
    http_response_code(200);
    echo 'ok';
    exit;
}

/** Whether free text may go to a WhatsApp number now (the patient wrote in the last 24 hours). */
function whatsapp_window_open(string $e164): bool
{
    return (bool) db_value("SELECT 1 FROM messages WHERE direction = 'in' AND channel = 'whatsapp' AND to_address = ? AND created_at > ?", [$e164, date('Y-m-d H:i:s', time() - 86400 + 300)]);
}
