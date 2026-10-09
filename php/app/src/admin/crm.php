<?php
/**
 * The clinical side of the panel (stage 2): patients, their medical history, appointments,
 * recalls and the e-mail reminders. Who sees what: an administrator everything; reception and
 * doctors the clinics ticked on their account; the medical history and clinical notes only
 * doctors and administrators.
 */
declare(strict_types=1);

const APPT_STATUS = [
    'programat' => 'Programat',
    'confirmat' => 'Confirmat',
    'sosit' => 'A sosit',
    'in-tratament' => 'În tratament',
    'finalizat' => 'Finalizat',
    'neprezentat' => 'Nu s-a prezentat',
    'anulat' => 'Anulat',
];
/** The statuses that still hold the doctor's time. */
const APPT_ACTIVE = ['programat', 'confirmat', 'sosit', 'in-tratament', 'finalizat'];
/** Next step offered on the „Azi” list, by status. */
const APPT_NEXT = [
    'programat' => ['confirmat' => 'Confirmat', 'sosit' => 'A sosit'],
    'confirmat' => ['sosit' => 'A sosit'],
    'sosit' => ['in-tratament' => 'Începe tratamentul'],
    'in-tratament' => ['finalizat' => 'Finalizat'],
];
/** The comfort answers, short, for the panel. */
const COMFORT_SHORT = ['fara-emotii' => 'Fără emoții', 'emotii' => 'Are emoții', 'frica' => 'Mi-e frică'];
const RECALL_STATUS = ['de-facut' => 'De sunat', 'contactat' => 'Contactat', 'programat' => 'Programat', 'refuzat' => 'Nu dorește', 'anulat' => 'Anulată'];
const HISTORY_FLAGS = [
    'anticoagulants' => 'Anticoagulante',
    'cardiac_disease' => 'Boală cardiacă',
    'hypertension' => 'Hipertensiune',
    'diabetes' => 'Diabet',
    'asthma' => 'Astm',
    'epilepsy' => 'Epilepsie',
    'hepatitis' => 'Hepatită',
    'hiv' => 'HIV',
    'bleeding_disorder' => 'Tulburări de coagulare',
    'bisphosphonates' => 'Tratament cu bifosfonați',
    'pregnancy' => 'Sarcină',
    'smoker' => 'Fumător',
];
/** Months until the usual check-up after a visit, by service page. */
const RECALL_MONTHS = ['consultatie-profilaxie' => 6, 'stomatologie-generala' => 6, 'parodontologie' => 3, 'pedodontie' => 6, 'implantologie' => 6, 'ortodontie' => 1, 'protetica-dentara' => 6];
const CAL_START_HOUR = 8;
const CAL_END_HOUR = 20;
const CAL_SLOT_MIN = 15;
const DURATIONS = [15 => '15 minute', 30 => '30 de minute', 45 => '45 de minute', 60 => 'o oră', 90 => 'o oră și jumătate', 120 => 'două ore'];

function can_see_clinical(?array $u = null): bool
{
    $u ??= current_user();
    return $u !== null && in_array($u['role'], ['admin', 'medic'], true);
}

// ── CNP (Romanian personal number): checked, stored encrypted, deduplicated by hash ─────

function cnp_key(): string
{
    return hash('sha256', 'cnp|' . (CONFIG['secret'] ?? ''), true);
}

function cnp_valid(string $cnp): bool
{
    if (!preg_match('/^[1-9]\d{12}$/', $cnp)) {
        return false;
    }
    $w = '279146358279';
    $sum = 0;
    for ($i = 0; $i < 12; $i++) {
        $sum += (int) $cnp[$i] * (int) $w[$i];
    }
    $c = $sum % 11;
    return ($c === 10 ? 1 : $c) === (int) $cnp[12];
}

/** @return array{birth:?string,sex:?string} what the CNP says about birth date and sex */
function cnp_facts(string $cnp): array
{
    $s = (int) $cnp[0];
    $century = match ($s) { 1, 2 => 1900, 3, 4 => 1800, 5, 6 => 2000, default => null };
    $birth = null;
    if ($century !== null) {
        $y = $century + (int) substr($cnp, 1, 2);
        $m = (int) substr($cnp, 3, 2);
        $d = (int) substr($cnp, 5, 2);
        $birth = checkdate($m, $d, $y) ? sprintf('%04d-%02d-%02d', $y, $m, $d) : null;
    }
    return ['birth' => $birth, 'sex' => in_array($s, [1, 3, 5, 7], true) ? 'M' : (in_array($s, [2, 4, 6, 8], true) ? 'F' : null)];
}

function cnp_encrypt(string $cnp): string
{
    $iv = random_bytes(12);
    $tag = '';
    $ct = openssl_encrypt($cnp, 'aes-256-gcm', cnp_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $ct);
}

function cnp_decrypt(?string $enc): ?string
{
    if ($enc === null || $enc === '') {
        return null;
    }
    $raw = base64_decode($enc, true);
    if ($raw === false || strlen($raw) < 29) {
        return null;
    }
    $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', cnp_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $plain === false ? null : $plain;
}

function cnp_hash(string $cnp): string
{
    return hash_hmac('sha256', $cnp, cnp_key());
}

/** „1••••••••••23” */
function cnp_masked(?string $cnp): string
{
    return $cnp === null ? '' : $cnp[0] . str_repeat('•', 10) . substr($cnp, -2);
}

// ── Patients ─────────────────────────────────────────────────────────────────

function fold_text(string $s): string
{
    $map = ['ă' => 'a', 'â' => 'a', 'î' => 'i', 'ș' => 's', 'ş' => 's', 'ț' => 't', 'ţ' => 't'];
    return strtr(mb_strtolower($s), $map);
}

function patient_search_text(array $p): string
{
    $digits = preg_replace('/\D+/', '', (string) ($p['phone'] ?? '')) ?? '';
    return mb_substr(fold_text(trim("{$p['last_name']} {$p['first_name']} {$p['first_name']} {$p['last_name']} {$digits} " . ($p['email'] ?? ''))), 0, 400);
}

function patient_name(array $p): string
{
    return trim("{$p['last_name']} {$p['first_name']}");
}

function next_file_number(): int
{
    return (int) db_value('SELECT COALESCE(MAX(file_number), 0) + 1 FROM patients');
}

/**
 * Patients a user may see: an administrator all; the others those of their clinics (preferred
 * clinic or an appointment there) and those not yet tied to a clinic.
 *
 * @return array{0:string,1:list<int>}
 */
function patient_scope_sql(array $user, string $alias = 'p'): array
{
    if (is_admin($user)) {
        return ['1 = 1', []];
    }
    $ids = allowed_location_ids($user);
    if ($ids === []) {
        return ['1 = 0', []];
    }
    $in = implode(',', array_fill(0, count($ids), '?'));
    return [
        "({$alias}.preferred_location_id IS NULL OR {$alias}.preferred_location_id IN ({$in}) OR EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = {$alias}.id AND a.location_id IN ({$in})))",
        array_merge($ids, $ids),
    ];
}

function find_patient(int $id, array $user): ?array
{
    [$scope, $params] = patient_scope_sql($user);
    return db_one("SELECT p.* FROM patients p WHERE p.id = ? AND {$scope}", array_merge([$id], $params));
}

/** A patient by phone (same digits), else a new file: used when a site request becomes an appointment. */
function find_or_create_patient(string $name, string $phone, ?string $email, ?int $locationId, int $userId): int
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    $nat = national_digits($phone);
    if ($nat !== null) {
        foreach (db_all("SELECT id, phone FROM patients WHERE phone <> '' AND active = 1") as $p) {
            if (national_digits($p['phone']) === $nat) {
                return (int) $p['id'];
            }
        }
    }
    $parts = preg_split('/\s+/', trim($name)) ?: [$name];
    $last = count($parts) > 1 ? array_shift($parts) : '';
    $first = implode(' ', $parts);
    if ($last === '') {
        $last = $first;
        $first = '';
    }
    $row = [
        'first_name' => mb_substr($first, 0, 80),
        'last_name' => mb_substr($last, 0, 80),
        'phone' => $digits !== '' ? format_phone($phone) : '',
        'email' => $email ?: null,
        'preferred_location_id' => $locationId,
    ];
    return db_insert('patients', $row + [
        'file_number' => next_file_number(),
        'search_text' => patient_search_text($row),
        'created_by' => $userId,
        'created_at' => now_sql(),
        'updated_at' => now_sql(),
    ]);
}

/** The alerts a doctor must see before treating: allergies and the ticked conditions. */
function medical_alerts(int $patientId): array
{
    $h = db_one('SELECT * FROM medical_histories WHERE patient_id = ?', [$patientId]);
    if ($h === null) {
        return [];
    }
    $out = [];
    if (trim((string) $h['allergies']) !== '') {
        $out[] = 'Alergie: ' . trim((string) $h['allergies']);
    }
    foreach (HISTORY_FLAGS as $k => $label) {
        if ((int) $h[$k] === 1) {
            $out[] = $label;
        }
    }
    return $out;
}

function alert_chips(array $alerts, string $size = 'text-mic'): string
{
    $out = '';
    foreach ($alerts as $a) {
        $out .= '<span class="' . e(cn('inline-flex items-center gap-1 rounded-chip border border-carmin bg-carmin-pal px-2 py-0.5 font-medium text-carmin', $size)) . '">' . icon('alert-triangle', 14) . e($a) . '</span>';
    }
    return $out;
}

function comfort_chip(?string $comfort, bool $sedation = false): string
{
    if (($comfort === null || $comfort === '' || $comfort === 'fara-emotii') && !$sedation) {
        return '';
    }
    $label = $sedation ? 'Inhalosedare' : ($comfort === 'frica' ? 'Mi-e frică' : 'Emoții');
    return '<span class="inline-flex items-center gap-1.5 rounded-chip bg-mustar-pal px-2 py-0.5 text-mic font-medium text-mustar-text"><span aria-hidden="true" class="inline-block size-2 rounded-full bg-mustar ring-1 ring-mustar-text"></span>' . e($label) . '</span>';
}

// ── Doctors and clinics ──────────────────────────────────────────────────────

/** @return list<array{id:int,name:string,short:string}> the doctors who work at a clinic. */
function doctors_at(int $locationId): array
{
    return array_map(
        static fn ($d) => ['id' => (int) $d['id'], 'name' => $d['public_name'], 'short' => 'Dr. ' . $d['last_name']],
        db_all('SELECT d.* FROM doctors d JOIN doctor_locations dl ON dl.doctor_id = d.id WHERE dl.location_id = ? ORDER BY d.sort_order, d.last_name', [$locationId]),
    );
}

/** @return array<int,string> every doctor by id → „Dr. Marcoci” */
function doctor_short_names(): array
{
    static $names = null;
    if ($names === null) {
        $names = [];
        foreach (db_all('SELECT id, last_name FROM doctors ORDER BY sort_order') as $d) {
            $names[(int) $d['id']] = 'Dr. ' . $d['last_name'];
        }
    }
    return $names;
}

/** The clinic shown by default: the one in the query, else the user's first. */
function current_clinic_id(array $user): ?int
{
    $allowed = allowed_location_ids($user);
    $q = admin_int(query('clinica'));
    if ($q !== null && in_array($q, $allowed, true)) {
        return $q;
    }
    session_begin();
    $s = (int) ($_SESSION['clinica'] ?? 0);
    return in_array($s, $allowed, true) ? $s : ($allowed[0] ?? null);
}

function remember_clinic(int $id): void
{
    session_begin();
    $_SESSION['clinica'] = $id;
}

// ── Appointments ─────────────────────────────────────────────────────────────

/** Overlapping appointments of the same doctor (an empty list means the time is free). */
function appointment_conflicts(int $doctorId, string $start, string $end, ?int $exceptId = null): array
{
    $in = "'" . implode("','", APPT_ACTIVE) . "'";
    return db_all(
        "SELECT a.*, p.first_name, p.last_name FROM appointments a JOIN patients p ON p.id = a.patient_id
         WHERE a.doctor_id = ? AND a.status IN ({$in}) AND a.starts_at < ? AND a.ends_at > ? AND a.id <> ?",
        [$doctorId, $end, $start, $exceptId ?? 0],
    );
}

function can_see_appointment(array $a, array $user): bool
{
    return is_admin($user) || in_array((int) $a['location_id'], allowed_location_ids($user), true);
}

/** Moves an appointment to a status, stamping when it happened. */
function set_appointment_status(int $id, string $status, array $user, ?string $reason = null): void
{
    if (!isset(APPT_STATUS[$status])) {
        return;
    }
    $stamp = [
        'confirmat' => 'confirmed_at',
        'sosit' => 'arrived_at',
        'in-tratament' => 'started_at',
        'finalizat' => 'completed_at',
        'anulat' => 'cancelled_at',
        'neprezentat' => 'no_show_at',
    ][$status] ?? null;
    $row = ['status' => $status, 'updated_by' => $user['id'], 'updated_at' => now_sql()];
    if ($stamp !== null) {
        $row[$stamp] = now_sql();
    }
    if ($status === 'anulat') {
        $row['cancel_reason'] = $reason !== null ? mb_substr($reason, 0, 255) : null;
    }
    db_update('appointments', $row, 'id = :id', ['id' => $id]);
    audit('programare-' . $status, "#{$id}");
}

function appt_status_chip(string $status): string
{
    $cls = match ($status) {
        'programat' => 'border border-dashed border-linie-control text-discret',
        'confirmat' => 'border border-actiune text-actiune',
        'sosit' => 'bg-menta-pal text-cerneala',
        'in-tratament' => 'bg-menta text-pe-menta',
        'finalizat' => 'bg-adancit text-discret',
        'neprezentat' => 'bg-carmin-pal text-carmin',
        default => 'bg-adancit text-discret line-through',
    };
    return '<span class="' . e(cn('inline-flex items-center whitespace-nowrap rounded-chip px-2.5 py-0.5 text-mic font-medium', $cls)) . '">' . e(APPT_STATUS[$status] ?? $status) . '</span>';
}

function service_title(?string $slug): string
{
    if ($slug === null || $slug === '') {
        return '';
    }
    return service_content($slug)['title'] ?? $slug;
}

/** „14:30” */
function hm(string $datetime): string
{
    return substr($datetime, 11, 5);
}

/** „joi, 8 oct.” */
function short_day(string $date): string
{
    $d = new DateTimeImmutable($date);
    return RO_WEEKDAYS[(int) $d->format('N') - 1] . ', ' . (int) $d->format('j') . ' ' . mb_substr(RO_MONTHS[(int) $d->format('n') - 1], 0, 3) . '.';
}

// ── Reminders (cron.php, or the panel's own visits as a fallback) ─────────────

/**
 * E-mails the patients whose appointment is tomorrow. They go out from 10:00 to 21:00 the day
 * before (whenever cron.php or the panel runs), except for appointments made in the last
 * 18 hours: those patients know already. Returns how many were sent.
 */
function send_due_reminders(?DateTimeImmutable $now = null): int
{
    $now ??= new DateTimeImmutable();
    $hour = (int) $now->format('G');
    if ($hour < 10 || $hour >= 21) {
        return 0;
    }
    $tomorrow = $now->modify('+1 day')->format('Y-m-d');
    $rows = db_all(
        "SELECT a.*, p.first_name, p.last_name, p.email, p.email_reminders FROM appointments a JOIN patients p ON p.id = a.patient_id
         WHERE a.status IN ('programat', 'confirmat') AND a.reminder_sent_at IS NULL AND a.starts_at >= ? AND a.starts_at < ?
           AND a.created_at < DATE_SUB(a.starts_at, INTERVAL 18 HOUR)
           AND p.email IS NOT NULL AND p.email <> '' AND p.email_reminders = 1",
        ["{$tomorrow} 00:00:00", $now->modify('+2 days')->format('Y-m-d') . ' 00:00:00'],
    );
    $clinicsById = [];
    foreach (clinics() as $c) {
        $clinicsById[$c['id']] = $c;
    }
    $docs = doctor_short_names();
    $n = 0;
    foreach ($rows as $a) {
        $c = $clinicsById[(int) $a['location_id']] ?? null;
        if ($c === null) {
            continue;
        }
        $text = "Bună ziua,\n\nvă reamintim programarea de mâine la Dental Arena {$c['shortName']}:\n\n"
            . format_date($a['starts_at'], true) . ', ora ' . hm($a['starts_at']) . "\n"
            . ($docs[(int) $a['doctor_id']] ?? '') . "\n"
            . clinic_address($c) . "\n\n"
            . "Dacă nu puteți veni, vă rugăm să ne sunați: " . format_phone($c['phone']) . ".\n\nVă așteptăm,\nDental Arena\n";
        if (send_mail($a['email'], 'Programarea de mâine la Dental Arena', $text)) {
            db_update('appointments', ['reminder_sent_at' => now_sql()], 'id = :id', ['id' => $a['id']]);
            $n++;
        }
    }
    return $n;
}

/** Without a cron job, the reminders go out when someone opens the panel (at most every 15 minutes). */
function maybe_send_reminders(): void
{
    $marker = APP_DIR . '/storage/reminders.txt';
    $last = (int) @file_get_contents($marker);
    if (time() - $last < 900) {
        return;
    }
    @file_put_contents($marker, (string) time());
    try {
        send_due_reminders();
    } catch (Throwable $e) {
        app_log('error', 'reminders: ' . $e->getMessage());
    }
}
