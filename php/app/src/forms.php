<?php
/**
 * The two forms of the public site: the booking request (/programare) and the contact message
 * (/contact). Each one is checked, saved as a request in the panel (Cereri) and sent by e-mail
 * to the clinic; the patient gets a confirmation when they left an e-mail address.
 * Bots: a hidden field, a minimum fill time and at most 5 requests per 10 minutes per network.
 */
declare(strict_types=1);

const TIME_WINDOWS = [
    'dimineata' => 'Dimineața (9–12)',
    'pranz' => 'La prânz (12–15)',
    'dupa-amiaza' => 'După-amiaza (15–19)',
    'oricand' => 'Oricând',
];
const COMFORT_LABELS = [
    'fara-emotii' => 'Fără emoții',
    'emotii' => 'Am emoții',
    'frica' => 'Mi-e frică (vrea să afle despre inhalosedare)',
];
const LEAD_STATUS = ['nou' => 'Nouă', 'in-lucru' => 'În lucru', 'programat' => 'Programat', 'inchis' => 'Închisă'];

/** The hidden fields that keep bots out: an empty trap field and a signed start time. */
function bot_fields(): string
{
    $t = (string) time();
    $sig = hash_hmac('sha256', $t, (string) (CONFIG['secret'] ?? 'dentalarena'));
    return '<div aria-hidden="true" class="absolute -left-[9999px] h-px w-px overflow-hidden">'
        . '<label>Nu completați acest câmp<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'
        . '<input type="hidden" name="_t" value="' . e($t . '.' . $sig) . '">';
}

/** True when the request looks like a bot (filled the trap, or sent the form within 3 seconds). */
function looks_like_bot(): bool
{
    if (post('website') !== '') {
        return true;
    }
    [$t, $sig] = array_pad(explode('.', post('_t'), 2), 2, '');
    if (!hash_equals(hash_hmac('sha256', $t, (string) (CONFIG['secret'] ?? 'dentalarena')), $sig)) {
        return true;
    }
    return time() - (int) $t < 3;
}

function too_many_requests(): bool
{
    $since = date('Y-m-d H:i:s', time() - 600);
    return (int) db_value('SELECT COUNT(*) FROM leads WHERE ip_hash = ? AND created_at > ?', [client_ip_hash(), $since]) >= 5;
}

/**
 * Checks and saves a request.
 *
 * @return array{ok:bool,errors:array<string,string>,values:array<string,string>,message?:string}
 */
function submit_lead(string $kind): array
{
    $v = [
        'name' => mb_substr(post('name'), 0, 120),
        'phone' => mb_substr(post('phone'), 0, 40),
        'email' => mb_substr(post('email'), 0, 190),
        'location' => post('location'),
        'serviciu' => post('serviciu'),
        'data' => post('data'),
        'interval' => post('interval'),
        'confort' => post('confort'),
        'message' => mb_substr(post('message'), 0, 2000),
        'consent' => post('consent'),
    ];
    $errors = [];
    if (mb_strlen($v['name']) < 3) {
        $errors['name'] = 'Scrieți numele și prenumele.';
    }
    if ($v['phone'] !== '' && national_digits($v['phone']) === null && !preg_match('/^\+?[\d\s().-]{8,20}$/', $v['phone'])) {
        $errors['phone'] = 'Scrieți un număr de telefon corect, de exemplu 0744 123 456.';
    }
    if ($v['email'] !== '' && !filter_var($v['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Scrieți o adresă de e-mail corectă, de exemplu nume@exemplu.ro.';
    }
    $clinics = clinics();
    if ($kind === 'programare') {
        if ($v['phone'] === '') {
            $errors['phone'] = 'Scrieți un număr de telefon, ca să vă putem suna pentru confirmare.';
        }
        if (!isset($clinics[$v['location']])) {
            $errors['location'] = 'Alegeți clinica la care veniți.';
        }
        if ($v['serviciu'] !== '' && !in_array($v['serviciu'], service_slugs(), true)) {
            $v['serviciu'] = '';
        }
        if ($v['data'] !== '') {
            $d = DateTimeImmutable::createFromFormat('!Y-m-d', $v['data']);
            if ($d === false || $d < new DateTimeImmutable('today')) {
                $errors['data'] = 'Alegeți o zi de azi încolo.';
            } elseif ($d > new DateTimeImmutable('+6 months')) {
                $errors['data'] = 'Alegeți o zi din următoarele 6 luni.';
            }
        }
        if (!isset(TIME_WINDOWS[$v['interval']])) {
            $v['interval'] = 'oricand';
        }
        if (!isset(COMFORT_LABELS[$v['confort']])) {
            $v['confort'] = '';
        }
    } else {
        if ($v['phone'] === '' && $v['email'] === '') {
            $errors['phone'] = 'Lăsați-ne un telefon sau un e-mail, ca să vă putem răspunde.';
        }
        if ($v['location'] !== '' && !isset($clinics[$v['location']])) {
            $v['location'] = '';
        }
        if (mb_strlen($v['message']) < 5) {
            $errors['message'] = 'Scrieți mesajul.';
        }
    }
    if ($v['consent'] !== '1') {
        $errors['consent'] = 'Bifați acordul pentru folosirea datelor, ca să vă putem răspunde.';
    }
    if ($errors !== []) {
        return ['ok' => false, 'errors' => $errors, 'values' => $v];
    }
    $success = $kind === 'programare'
        ? 'Am primit cererea. Vă sunăm în cel mult o zi lucrătoare ca să stabilim ora.'
        : 'Mesajul a fost trimis. Vă răspundem în cel mult o zi lucrătoare.';
    // A bot sees the same answer, and nothing is saved.
    if (looks_like_bot()) {
        return ['ok' => true, 'errors' => [], 'values' => [], 'message' => $success];
    }
    if (too_many_requests()) {
        return ['ok' => false, 'errors' => ['form' => 'Ați trimis deja mai multe cereri. Pentru o cerere nouă, sunați-ne sau încercați peste 10 minute.'], 'values' => $v];
    }
    $clinic = $clinics[$v['location']] ?? null;
    $id = db_insert('leads', [
        'kind' => $kind,
        'location_id' => $clinic['id'] ?? null,
        'category_slug' => $v['serviciu'] !== '' ? $v['serviciu'] : null,
        'preferred_date' => $v['data'] !== '' ? $v['data'] : null,
        'preferred_time' => $kind === 'programare' ? $v['interval'] : null,
        'comfort' => $v['confort'] !== '' ? $v['confort'] : null,
        'name' => $v['name'],
        'phone' => $v['phone'],
        'email' => $v['email'] !== '' ? $v['email'] : null,
        'message' => $v['message'] !== '' ? $v['message'] : null,
        'status' => 'nou',
        'ip_hash' => client_ip_hash(),
        'created_at' => now_sql(),
    ]);
    notify_new_lead($id);
    return ['ok' => true, 'errors' => [], 'values' => [], 'message' => $success];
}

function lead_summary_lines(array $lead): array
{
    $clinic = null;
    foreach (clinics() as $c) {
        if ($c['id'] !== null && (int) $lead['location_id'] === $c['id']) {
            $clinic = $c;
        }
    }
    $service = $lead['category_slug'] ? (service_content($lead['category_slug'])['title'] ?? $lead['category_slug']) : null;
    return array_values(array_filter([
        'Nume: ' . $lead['name'],
        $lead['phone'] !== '' ? 'Telefon: ' . format_phone($lead['phone']) : null,
        $lead['email'] ? 'E-mail: ' . $lead['email'] : null,
        $clinic ? 'Clinica: ' . $clinic['shortName'] : null,
        $service ? 'Serviciul: ' . $service : null,
        $lead['preferred_date'] ? 'Ziua dorită: ' . format_date($lead['preferred_date'], true) : null,
        $lead['preferred_time'] ? 'Intervalul: ' . (TIME_WINDOWS[$lead['preferred_time']] ?? $lead['preferred_time']) : null,
        $lead['comfort'] ? 'Cum se simte: ' . (COMFORT_LABELS[$lead['comfort']] ?? $lead['comfort']) : null,
        $lead['message'] ? "Mesaj:\n" . $lead['message'] : null,
    ]));
}

function notify_new_lead(int $id): void
{
    $lead = db_one('SELECT * FROM leads WHERE id = ?', [$id]);
    if ($lead === null) {
        return;
    }
    $isBooking = $lead['kind'] === 'programare';
    $lines = lead_summary_lines($lead);
    $to = (string) setting('notify_email');
    foreach (clinics() as $c) {
        if ($c['id'] !== null && (int) $lead['location_id'] === $c['id'] && $c['email'] !== '') {
            $to = $c['email'];
        }
    }
    $subject = ($isBooking ? 'Cerere de programare' : 'Mesaj de pe site') . ': ' . $lead['name'];
    $text = ($isBooking ? "O cerere nouă de programare de pe site.\n\n" : "Un mesaj nou de pe site.\n\n")
        . implode("\n", $lines)
        . "\n\nToate cererile: " . absolute_url('/admin/cereri/' . $id) . "\n";
    send_mail($to, $subject, $text, $lead['email']);

    if ($lead['email']) {
        $patient = $isBooking
            ? "Bună ziua,\n\nam primit cererea dumneavoastră de programare la Dental Arena. Vă sunăm în cel mult o zi lucrătoare ca să stabilim ora.\n\n"
            : "Bună ziua,\n\nam primit mesajul dumneavoastră. Vă răspundem în cel mult o zi lucrătoare.\n\n";
        $patient .= "Ce ne-ați trimis:\n" . implode("\n", $lines) . "\n\nDacă e urgent, sunați-ne:\n";
        foreach (clinics() as $c) {
            $patient .= "{$c['shortName']}: " . format_phone($c['phone']) . "\n";
        }
        $patient .= "\nDental Arena\n" . site_url() . "\n";
        send_mail($lead['email'], $isBooking ? 'Am primit cererea de programare' : 'Am primit mesajul dumneavoastră', $patient);
    }
}

/** Closed requests older than the retention period are deleted (GDPR). Runs when the panel opens. */
function purge_old_leads(): void
{
    $days = max(30, (int) setting('lead_retention_days'));
    $cutoff = date('Y-m-d H:i:s', time() - $days * 86400);
    $n = db_run("DELETE FROM leads WHERE status = 'inchis' AND COALESCE(updated_at, created_at) < ?", [$cutoff]);
    if ($n > 0) {
        audit('stergere-cereri-vechi', "{$n} cereri închise mai vechi de {$days} zile");
    }
}
