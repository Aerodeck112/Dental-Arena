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
/** What a click on an appointment in the calendar offers, by status (colours: orange confirmed, green arrived, red did not come). */
function appt_quick_actions(string $status): array
{
    $next = APPT_NEXT[$status] ?? [];
    if (in_array($status, ['programat', 'confirmat'], true)) {
        $next['neprezentat'] = 'Nu a venit';
    }
    return $next + (APPT_BACK[$status] ?? []);
}

/** Going back a step, by status (a cancelled appointment kept after all, a visit reopened). */
const APPT_BACK = [
    'confirmat' => ['programat' => 'Înapoi la Programat'],
    'sosit' => ['confirmat' => 'Înapoi la Confirmat'],
    'in-tratament' => ['sosit' => 'Înapoi la „A sosit”'],
    'finalizat' => ['in-tratament' => 'Redeschideți (În tratament)'],
    'neprezentat' => ['programat' => 'Readuceți la Programat', 'sosit' => 'A venit totuși'],
    'anulat' => ['programat' => 'Readuceți la Programat'],
];
/** Why a request ended without an appointment. */
const LEAD_LOST_REASONS = ['nu-raspunde' => 'Nu răspunde la telefon', 'pret' => 'Prețul', 'distanta' => 'Distanța', 'alta-clinica' => 'A ales altă clinică', 'nu-mai-vrea' => 'Nu mai dorește', 'doar-info' => 'Voia doar informații', 'dublura' => 'Cerere dublă', 'altul' => 'Alt motiv'];
/** What was done for a request. */
const LEAD_ACTIVITY = ['apel' => 'Apel', 'sms' => 'SMS', 'email' => 'E-mail', 'nota' => 'Notă', 'stare' => 'Starea', 'atribuire' => 'Preluată'];
const CALL_OUTCOMES = ['raspuns' => 'A răspuns', 'nu-raspunde' => 'Nu răspunde', 'ocupat' => 'Ocupat', 'revine' => 'Sună el înapoi'];
/** Patient tag colours (the next one by name, so a tag keeps its colour). */
const TAG_COLORS = ['menta', 'mustar', 'carmin', 'gri', 'cerneala'];
const TAG_CLASSES = ['menta' => 'bg-menta-pal text-cerneala', 'mustar' => 'bg-mustar-pal text-mustar-text', 'carmin' => 'bg-carmin-pal text-carmin', 'gri' => 'bg-adancit text-cerneala', 'cerneala' => 'bg-cerneala text-fundal'];
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
const RECALL_MONTHS = ['consultatie-profilaxie' => 6, 'odontologie' => 6, 'endodontie' => 6, 'parodontologie' => 3, 'pedodontie' => 6, 'implantologie' => 6, 'ortodontie' => 1, 'protetica-dentara' => 6];
/** The day view shows the whole working day on one screen: 9:00–21:00 (wider when an appointment or the clinic's hours fall outside). */
const CAL_START_HOUR = 9;
const CAL_END_HOUR = 21;
const CAL_SLOT_MIN = 15;
const DURATIONS = [15 => '15 minute', 30 => '30 de minute', 45 => '45 de minute', 60 => 'o oră', 90 => 'o oră și jumătate', 120 => 'două ore'];

function can_see_clinical(?array $u = null): bool
{
    return can('medical', $u);
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
    if (all_clinics($user)) {
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

/**
 * The patient with this phone and the same first name. A family often shares one phone (and the
 * surname), so the same phone with another first name is another person.
 */
function patient_by_phone_name(string $name, string $phone): ?int
{
    $nat = national_digits($phone);
    if ($nat === null) {
        return null;
    }
    $words = array_filter(preg_split('/[\s-]+/', fold_text($name)) ?: [], static fn ($w) => mb_strlen($w) > 1);
    foreach (db_all("SELECT id, phone, first_name, last_name FROM patients WHERE phone <> '' AND active = 1 ORDER BY id") as $p) {
        if (national_digits($p['phone']) !== $nat) {
            continue;
        }
        // A family shares the phone and often the surname: the first name has to match.
        $known = preg_split('/[\s-]+/', fold_text(trim((string) $p['first_name']) !== '' ? $p['first_name'] : $p['last_name'])) ?: [];
        if ($words === [] || array_intersect($words, $known) !== []) {
            return (int) $p['id'];
        }
    }
    return null;
}

/** A patient by phone and name, else a new file (a site request or booking becomes an appointment). */
function find_or_create_patient(string $name, string $phone, ?string $email, ?int $locationId, ?int $userId): int
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    $found = patient_by_phone_name($name, $phone);
    if ($found !== null) {
        return $found;
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

function comfort_chip(?string $comfort): string
{
    if ($comfort === null || $comfort === '' || $comfort === 'fara-emotii') {
        return '';
    }
    $label = $comfort === 'frica' ? 'Mi-e frică' : 'Emoții';
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

/** The patient's other active appointments in that interval (with any doctor). */
function patient_conflicts(int $patientId, string $start, string $end, ?int $exceptId = null): array
{
    $in = "'" . implode("','", APPT_ACTIVE) . "'";
    return db_all(
        "SELECT a.*, d.public_name AS doctor FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         WHERE a.patient_id = ? AND a.status IN ({$in}) AND a.starts_at < ? AND a.ends_at > ? AND a.id <> ?",
        [$patientId, $end, $start, $exceptId ?? 0],
    );
}

function can_see_appointment(array $a, array $user): bool
{
    return all_clinics($user) || in_array((int) $a['location_id'], allowed_location_ids($user), true);
}

/** Moves an appointment to a status, stamping when it happened. */
/**
 * Changes an appointment's status, with its time stamp. Going back (APPT_BACK) clears the stamps
 * of the later steps. Finishing a visit puts the patient on the recall list (RECALL_MONTHS), unless
 * they already have a recall or a next appointment. Returns a note for the user, if any.
 */
function set_appointment_status(int $id, string $status, array $user, ?string $reason = null, string $by = 'clinica'): ?string
{
    if (!isset(APPT_STATUS[$status])) {
        return null;
    }
    $before = db_one('SELECT * FROM appointments WHERE id = ?', [$id]);
    if ($before === null) {
        return null;
    }
    $back = isset(APPT_BACK[$before['status']][$status]);
    $stamp = [
        'confirmat' => 'confirmed_at',
        'sosit' => 'arrived_at',
        'in-tratament' => 'started_at',
        'finalizat' => 'completed_at',
        'anulat' => 'cancelled_at',
        'neprezentat' => 'no_show_at',
    ][$status] ?? null;
    $row = ['status' => $status, 'updated_by' => $user['id'] ?? null, 'updated_at' => now_sql()];
    if ($status !== 'programat') {
        // Confirmed, arrived, cancelled…: the „no answer” alarm has done its job.
        $row += ['no_answer_at' => null, 'no_answer_by' => null];
    }
    if ($stamp !== null) {
        $row[$stamp] = now_sql();
    }
    if ($status === 'anulat') {
        $row['cancel_reason'] = $reason !== null ? mb_substr($reason, 0, 255) : null;
        $row['cancelled_by'] = $by;
    }
    if ($back) {
        $order = ['programat', 'confirmat', 'sosit', 'in-tratament', 'finalizat'];
        $later = array_slice($order, (int) array_search($status, $order, true) + 1);
        foreach (['confirmat' => 'confirmed_at', 'sosit' => 'arrived_at', 'in-tratament' => 'started_at', 'finalizat' => 'completed_at'] as $st => $col) {
            if (in_array($st, $later, true)) {
                $row[$col] = null;
            }
        }
        $row += ['cancelled_at' => null, 'cancel_reason' => null, 'cancelled_by' => null, 'no_show_at' => null];
    }
    db_update('appointments', $row, 'id = :id', ['id' => $id]);
    if ($status === 'anulat') {
        // The patient's old link stops working.
        db_run('UPDATE appointments SET token_version = token_version + 1, reminder_sent_at = NULL WHERE id = ?', [$id]);
    }
    if ($status === 'anulat' || $status === 'neprezentat') {
        drop_pending_reminder($id);
    }
    if ($status === 'anulat' || $status === 'sosit') {
        notify_appointment($status === 'anulat' ? 'programare-anulata' : 'sosit', $id);
    }
    audit($back ? 'programare-revenire' : 'programare-' . $status, "#{$id}" . ($back ? ': ' . (APPT_STATUS[$before['status']] ?? '') . ' → ' . APPT_STATUS[$status] : '') . ($by === 'pacient' ? ' (de pacient, din link)' : ''), $user['id'] ?? 0, (int) $before['patient_id']);
    if ($status === 'finalizat' && $before['status'] !== 'finalizat') {
        return auto_recall($before, $user);
    }
    return null;
}

/** After a finished visit: a recall for the check-up, if the patient has none and no next appointment. */
function auto_recall(array $a, array $user): ?string
{
    $pid = (int) $a['patient_id'];
    $active = "'" . implode("','", ['programat', 'confirmat']) . "'";
    if (db_value("SELECT 1 FROM recalls WHERE patient_id = ? AND status IN ('de-facut', 'contactat') LIMIT 1", [$pid])
        || db_value("SELECT 1 FROM appointments WHERE patient_id = ? AND status IN ({$active}) AND starts_at > ? LIMIT 1", [$pid, $a['ends_at']])) {
        return null;
    }
    $months = RECALL_MONTHS[$a['category_slug'] ?? ''] ?? 6;
    $rid = db_insert('recalls', [
        'patient_id' => $pid,
        'location_id' => $a['location_id'],
        'doctor_id' => $a['doctor_id'],
        'reason' => 'Control' . ($a['category_slug'] ? ' după ' . mb_strtolower(service_title($a['category_slug'])) : ' periodic'),
        'due_date' => date('Y-m-d', strtotime("+{$months} months", strtotime($a['starts_at']))),
        'status' => 'de-facut',
        'source_appointment_id' => $a['id'],
        'created_by' => $user['id'] ?? null,
        'created_at' => now_sql(),
        'updated_at' => now_sql(),
    ]);
    audit('rechemare-noua', "#{$rid} automată, peste {$months} " . ($months === 1 ? 'lună' : 'luni'), $user['id'] ?? 0, $pid);
    return 'Pacientul a fost trecut pe lista de rechemări, pentru control peste ' . ($months === 1 ? 'o lună' : "{$months} luni") . '.';
}

/** „Sunat, nu răspunde”: checked on an appointment not confirmed yet, it blinks until it is. */
function appt_no_answer(array $a): bool
{
    return ($a['no_answer_at'] ?? null) !== null && in_array($a['status'], ['programat', 'confirmat'], true);
}

function set_appointment_no_answer(array $a, bool $on, array $user): void
{
    db_update('appointments', ['no_answer_at' => $on ? now_sql() : null, 'no_answer_by' => $on ? $user['id'] : null, 'updated_by' => $user['id'], 'updated_at' => now_sql()], 'id = :id', ['id' => $a['id']]);
    audit($on ? 'programare-nu-raspunde' : 'programare-nu-raspunde-scos', "#{$a['id']}", null, (int) $a['patient_id']);
}

/** The blinking chip „Nu răspunde (14:20)”. */
function appt_no_answer_chip(array $a): string
{
    return '<span class="da-alarma inline-flex items-center gap-1 whitespace-nowrap rounded-chip border border-carmin px-2.5 py-0.5 text-mic font-semibold text-carmin">' . admin_icon('phone-missed', 14) . 'Nu răspunde · ' . e(hm($a['no_answer_at'])) . '</span>';
}

/** The checkbox „Sunat, nu răspunde”: it is sent as soon as it is ticked or unticked. */
function appt_no_answer_form(array $a, ?string $back): string
{
    return '<form method="post" action="/admin/programari/' . (int) $a['id'] . '" class="inline-flex">' . csrf_field() . '<input type="hidden" name="op" value="nu-raspunde">'
        . ($back !== null ? '<input type="hidden" name="inapoi" value="' . e($back) . '">' : '') . '<input type="hidden" name="valoare" value="0">'
        . '<label class="inline-flex min-h-control cursor-pointer items-center gap-2 rounded-control border border-linie-control px-3 text-control font-medium hover:bg-adancit">'
        . '<input type="checkbox" name="valoare" value="1" data-trimite-la-schimbare class="size-5 accent-carmin"' . (appt_no_answer($a) ? ' checked' : '') . '>Sunat, nu răspunde</label>'
        . '<noscript><button type="submit" class="' . e(btn('text', 's')) . '">Salvați</button></noscript></form>';
}

/**
 * „Trimiteți SMS acum”: the appointment's SMS (tomorrow: the reminder) leaves at once; the text
 * is shown before sending, and when one went last. Empty when the patient has no mobile number.
 */
function appt_sms_form(array $a, ?string $back): string
{
    $p = db_one('SELECT * FROM patients WHERE id = ?', [(int) $a['patient_id']]);
    if ($p === null || phone_ro_mobile((string) $p['phone']) === null || strtotime($a['ends_at']) <= time()) {
        return '';
    }
    [, $text] = appointment_sms($a, $p);
    $last = appointment_last_sms((int) $a['id']);
    return '<form method="post" action="/admin/programari/' . (int) $a['id'] . '" class="inline-flex flex-wrap items-center gap-2" data-confirma="' . e('Trimiteți acum SMS-ul la ' . format_phone($p['phone']) . "?\n\n" . $text) . '">' . csrf_field() . '<input type="hidden" name="op" value="sms">'
        . ($back !== null ? '<input type="hidden" name="inapoi" value="' . e($back) . '">' : '')
        . '<button type="submit" class="' . e(btn('secondary')) . '">' . icon('message-square', 18) . 'Trimiteți SMS acum</button>'
        . ($last !== null ? '<span class="text-mic text-discret">Ultimul SMS: ' . e(date('d.m H:i', strtotime($last['sent_at'] ?? $last['created_at']))) . ' ' . msg_status_chip($last['status']) . '</span>' : '')
        . '</form>';
}

function appt_status_chip(string $status): string
{
    $cls = match ($status) {
        'programat' => 'border border-dashed border-linie-control text-discret',
        'confirmat' => 'border border-portocaliu bg-portocaliu-pal text-portocaliu',
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
        "SELECT a.* FROM appointments a WHERE a.status IN ('programat', 'confirmat') AND a.reminder_sent_at IS NULL AND a.starts_at >= ? AND a.starts_at < ?
           AND a.created_at < DATE_SUB(a.starts_at, INTERVAL 18 HOUR)",
        ["{$tomorrow} 00:00:00", $now->modify('+2 days')->format('Y-m-d') . ' 00:00:00'],
    );
    $n = 0;
    foreach ($rows as $a) {
        $p = db_one('SELECT * FROM patients WHERE id = ?', [(int) $a['patient_id']]);
        if ($p !== null) {
            $n += notify_patient('reamintire', $p, appointment_vars($a), ['appointment_id' => (int) $a['id']]);
        }
        // Marked even without a channel, so the appointment is not looked at again.
        db_update('appointments', ['reminder_sent_at' => now_sql()], 'id = :id', ['id' => $a['id']]);
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
        run_daily_jobs();
    } catch (Throwable $e) {
        app_log('error', 'reminders: ' . $e->getMessage());
    }
}

// ── Requests as a small pipeline ─────────────────────────────────────────────

/** One line in a request's history. */
function lead_log(int $leadId, string $kind, ?string $outcome, ?string $body, ?array $user): void
{
    db_insert('lead_activities', ['lead_id' => $leadId, 'user_id' => $user['id'] ?? null, 'kind' => $kind, 'outcome' => $outcome, 'body' => $body !== null && $body !== '' ? mb_substr($body, 0, 4000) : null, 'created_at' => now_sql()]);
}

/** The accounts that can take care of requests (reception and administrators, not VITIM). */
function lead_handlers(): array
{
    return array_column(db_all("SELECT id, name FROM users WHERE active = 1 AND role IN ('admin', 'admin-medic', 'receptie') ORDER BY name"), 'name', 'id');
}

/**
 * Patients who may be the person who sent a request (or a new file): the same phone, CNP or
 * e-mail, or the same name and birth date. Newest first, at most eight.
 */
function possible_duplicates(array $q, ?int $exceptId = null): array
{
    $found = [];
    $nat = !empty($q['phone']) ? national_digits((string) $q['phone']) : null;
    if ($nat !== null) {
        $tail = substr($nat, -6);
        foreach (db_all("SELECT * FROM patients WHERE active = 1 AND phone LIKE ? AND id <> ?", ['%' . substr($tail, 0, 3) . '%' . substr($tail, 3) . '%', $exceptId ?? 0]) as $p) {
            if (national_digits((string) $p['phone']) === $nat) {
                $found[(int) $p['id']] = $p + ['why' => 'același telefon'];
            }
        }
    }
    if (!empty($q['cnp']) && cnp_valid((string) $q['cnp'])) {
        foreach (db_all('SELECT * FROM patients WHERE cnp_hash = ? AND id <> ?', [cnp_hash((string) $q['cnp']), $exceptId ?? 0]) as $p) {
            $found[(int) $p['id']] = $p + ['why' => 'același CNP'];
        }
    }
    if (!empty($q['email'])) {
        foreach (db_all('SELECT * FROM patients WHERE active = 1 AND email = ? AND id <> ?', [mb_strtolower((string) $q['email']), $exceptId ?? 0]) as $p) {
            $found[(int) $p['id']] ??= $p + ['why' => 'același e-mail'];
        }
    }
    if (!empty($q['last_name']) && !empty($q['first_name'])) {
        $sql = 'SELECT * FROM patients WHERE active = 1 AND id <> ? AND search_text LIKE ? AND search_text LIKE ?';
        $params = [$exceptId ?? 0, '%' . fold_text((string) $q['last_name']) . '%', '%' . fold_text((string) $q['first_name']) . '%'];
        if (!empty($q['birth_date'])) {
            $sql .= ' AND (birth_date = ? OR birth_date IS NULL)';
            $params[] = $q['birth_date'];
        }
        foreach (db_all($sql . ' LIMIT 8', $params) as $p) {
            $found[(int) $p['id']] ??= $p + ['why' => !empty($q['birth_date']) && $p['birth_date'] === $q['birth_date'] ? 'același nume și aceeași dată a nașterii' : 'același nume'];
        }
    }
    krsort($found);
    return array_slice(array_values($found), 0, 8);
}
