<?php
/**
 * The signing tablet at reception. A tablet is paired once from the panel (it keeps a random
 * token in a cookie); only paired tablets open /tableta. Reception makes a signing session in the
 * patient's file: what to sign, and a 6-digit code valid for 30 minutes and for one signature.
 * On the tablet the patient types the code, reads and ticks each consent, optionally fills in the
 * medical questionnaire and the marketing choices, and signs with a finger. What is stored: the
 * exact text signed, the signature (an image in the patient's documents), the time, the tablet,
 * and a fingerprint (SHA-256) of all of these.
 */
declare(strict_types=1);

const KIOSK_COOKIE = 'da_tableta';
const KIOSK_CODE_MINUTES = 30;

function kiosk_device(): ?array
{
    $token = (string) ($_COOKIE[KIOSK_COOKIE] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return null;
    }
    $d = db_one('SELECT * FROM kiosk_devices WHERE token_hash = ? AND revoked_at IS NULL', [hash('sha256', $token)]);
    if ($d !== null && (!$d['last_seen_at'] || strtotime($d['last_seen_at']) < time() - 300)) {
        db_update('kiosk_devices', ['last_seen_at' => now_sql()], 'id = :id', ['id' => $d['id']]);
    }
    return $d;
}

/** Makes this browser a signing tablet (a cookie for 2 years). */
function kiosk_pair(string $name, ?int $locationId, array $user): int
{
    $token = bin2hex(random_bytes(32));
    $id = db_insert('kiosk_devices', ['name' => mb_substr($name, 0, 80), 'token_hash' => hash('sha256', $token), 'location_id' => $locationId, 'created_by' => $user['id'], 'created_at' => now_sql()]);
    setcookie(KIOSK_COOKIE, $token, ['expires' => time() + 2 * 365 * 86400, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'httponly' => true, 'samesite' => 'Strict']);
    audit('tableta-asociata', $name);
    return $id;
}

/** A new 6-digit code, unused among the codes still valid. */
/** @param array{medic?:string,interventie?:string} $details the doctor and the intervention, for the consents that name them */
function consent_session_create(array $p, array $types, bool $history, bool $marketing, array $user, array $details = []): array
{
    $types = array_values(array_intersect(array_keys(CONSENT_TYPES), $types));
    $details = array_intersect_key(array_filter(array_map(static fn ($v) => mb_substr(trim((string) $v), 0, 250), $details)), ['medic' => 1, 'interventie' => 1]);
    // Older open sessions of the patient are closed: one code at a time.
    db_run("UPDATE consent_sessions SET status = 'anulat' WHERE patient_id = ? AND status = 'asteptare'", [(int) $p['id']]);
    do {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    } while (db_value("SELECT 1 FROM consent_sessions WHERE code = ? AND status = 'asteptare' AND expires_at > ?", [$code, now_sql()]));
    $id = db_insert('consent_sessions', [
        'patient_id' => (int) $p['id'], 'code' => $code, 'types' => implode(',', $types), 'with_history' => (int) $history, 'with_marketing' => (int) $marketing,
        'details' => $details !== [] ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        'status' => 'asteptare', 'created_by' => $user['id'], 'created_at' => now_sql(), 'expires_at' => date('Y-m-d H:i:s', time() + KIOSK_CODE_MINUTES * 60),
    ]);
    audit('cod-tableta', implode(', ', array_map(static fn ($t) => CONSENT_TYPES[$t], $types)) . ($history ? ' + chestionar' : ''), null, (int) $p['id']);
    return db_one('SELECT * FROM consent_sessions WHERE id = ?', [$id]);
}

/** The doctor and the intervention chosen with the code. */
function consent_session_details(array $s): array
{
    $d = json_decode((string) ($s['details'] ?? ''), true);
    return is_array($d) ? $d : [];
}

function consent_session_open(string $code): ?array
{
    return preg_match('/^\d{6}$/', $code) ? db_one("SELECT * FROM consent_sessions WHERE code = ? AND status = 'asteptare' AND expires_at > ?", [$code, now_sql()]) : null;
}

/** Wrong codes on a tablet: at most 6 in 10 minutes. */
function kiosk_too_many_tries(int $deviceId): bool
{
    $file = APP_DIR . '/storage/tableta-' . $deviceId . '.json';
    $tries = array_filter(json_decode((string) @file_get_contents($file), true) ?: [], static fn ($t) => $t > time() - 600);
    return count($tries) >= 6;
}

function kiosk_wrong_code(int $deviceId): void
{
    $file = APP_DIR . '/storage/tableta-' . $deviceId . '.json';
    $tries = array_filter(json_decode((string) @file_get_contents($file), true) ?: [], static fn ($t) => $t > time() - 600);
    $tries[] = time();
    @file_put_contents($file, json_encode(array_values($tries)));
}

/**
 * Saves what the patient signed. $png is the signature as a PNG data URL from the canvas.
 *
 * @param list<string> $accepted the consent types ticked
 * @param array{sms:bool,whatsapp:bool,email:bool}|null $marketing
 * @param array|null $history the questionnaire answers
 */
function consent_session_sign(array $s, array $device, array $accepted, string $png, ?array $marketing, ?array $history): void
{
    if (!preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', $png, $m)) {
        throw new DomainException('Semnați în chenar, apoi apăsați din nou.');
    }
    $raw = base64_decode($m[1], true);
    if ($raw === false || strlen($raw) < 200 || strlen($raw) > 1500000 || !str_starts_with($raw, "\x89PNG")) {
        throw new DomainException('Semnătura nu a putut fi citită. Semnați din nou.');
    }
    if (!signature_has_ink($raw)) {
        throw new DomainException('Chenarul e gol: semnați cu degetul, apoi apăsați din nou.');
    }
    $p = db_one('SELECT * FROM patients WHERE id = ?', [(int) $s['patient_id']]);
    $allowed = explode(',', (string) $s['types']);
    $accepted = array_values(array_intersect($allowed, $accepted));
    db_tx(static function () use ($s, $device, $accepted, $raw, $marketing, $history, $p): void {
        // The signature goes to the patient's documents.
        $stored = bin2hex(random_bytes(16)) . '.png';
        if (file_put_contents(documents_dir() . '/' . $stored, $raw) === false) {
            throw new DomainException('Semnătura nu a putut fi salvată. Chemați recepția.');
        }
        $docId = db_insert('patient_documents', [
            'patient_id' => $p['id'], 'kind' => 'consimtamant', 'title' => 'Semnătura pe tabletă, ' . date('d.m.Y H:i'),
            'original_name' => 'semnatura-' . date('Y-m-d-His') . '.png', 'stored_name' => $stored, 'mime' => 'image/png', 'size' => strlen($raw),
            'created_by' => null, 'created_at' => now_sql(),
        ]);
        $signedAt = now_sql();
        $sigHash = hash('sha256', $raw);
        foreach ($accepted as $type) {
            $text = consent_text_for($type, $p, $device['location_id'] ? (int) $device['location_id'] : null, consent_session_details($s));
            db_insert('consents', [
                'patient_id' => $p['id'], 'type' => $type, 'method' => 'tableta', 'signed_on' => date('Y-m-d'), 'signed_at' => $signedAt,
                'text_version' => consent_version(), 'text_snapshot' => $text, 'document_id' => $docId, 'session_id' => $s['id'],
                'integrity_hash' => hash('sha256', implode('|', [$p['id'], $type, $text, $sigHash, $signedAt, $device['id']])),
                'recorded_by' => null, 'created_at' => $signedAt,
            ]);
        }
        if ($marketing !== null) {
            $row = ['marketing_sms' => (int) $marketing['sms'], 'marketing_whatsapp' => (int) $marketing['whatsapp'], 'marketing_email' => (int) $marketing['email'], 'updated_at' => now_sql()];
            if (array_sum(array_slice($row, 0, 3)) > 0) {
                $row += ['marketing_consent_at' => $signedAt, 'marketing_consent_source' => 'semnat pe tabletă'];
            }
            db_update('patients', $row, 'id = :id', ['id' => $p['id']]);
        }
        if ($history !== null) {
            db_insert('patient_forms', ['patient_id' => $p['id'], 'kind' => 'anamneza', 'data' => json_encode($history, JSON_UNESCAPED_UNICODE), 'status' => 'nou', 'session_id' => $s['id'], 'created_at' => $signedAt]);
        }
        db_update('consent_sessions', ['status' => 'semnat', 'signed_at' => $signedAt, 'device_id' => $device['id']], 'id = :id', ['id' => $s['id']]);
        audit('semnat-tableta', (implode(', ', array_map(static fn ($t) => CONSENT_TYPES[$t], $accepted)) ?: 'niciun acord') . ' · ' . $device['name'], 0, (int) $p['id']);
    });
}

/** True when the signature has strokes (at least a few dark pixels); without GD it is not checked. */
function signature_has_ink(string $png): bool
{
    if (!function_exists('imagecreatefromstring')) {
        return true;
    }
    $img = @imagecreatefromstring($png);
    if ($img === false) {
        return false;
    }
    $small = imagescale($img, 160, -1);
    $ink = 0;
    for ($x = 0, $w = imagesx($small); $x < $w; $x++) {
        for ($y = 0, $h = imagesy($small); $y < $h; $y++) {
            $c = imagecolorsforindex($small, imagecolorat($small, $x, $y));
            if ($c['alpha'] < 100 && $c['red'] + $c['green'] + $c['blue'] < 500) {
                $ink++;
            }
        }
    }
    return $ink >= 25;
}

/** The questionnaire's answers in words, for the doctor. */
function history_form_lines(array $d): array
{
    $out = [];
    foreach (['allergies' => 'Alergii', 'medications' => 'Medicamente', 'other_conditions' => 'Alte boli'] as $k => $label) {
        if (trim((string) ($d[$k] ?? '')) !== '') {
            $out[] = "{$label}: " . trim((string) $d[$k]);
        }
    }
    $flags = array_values(array_filter(array_keys(HISTORY_FLAGS), static fn ($k) => !empty($d['flags'][$k])));
    if ($flags !== []) {
        $out[] = 'Afecțiuni: ' . implode(', ', array_map(static fn ($k) => HISTORY_FLAGS[$k], $flags));
    }
    return $out ?: ['Nu a declarat nimic.'];
}

/**
 * Adds the patient's answers to the medical history: ticked conditions are added (never
 * unticked), texts are added after what is already written.
 */
function apply_history_form(int $patientId, array $d, array $user): void
{
    $h = db_one('SELECT * FROM medical_histories WHERE patient_id = ?', [$patientId]) ?? [];
    $row = [];
    foreach (['allergies', 'medications', 'other_conditions'] as $k) {
        $old = trim((string) ($h[$k] ?? ''));
        $new = trim((string) ($d[$k] ?? ''));
        $row[$k] = $new === '' || mb_stripos($old, $new) !== false ? ($old !== '' ? $old : null) : mb_substr(($old !== '' ? $old . "\n" : '') . $new, 0, 2000);
    }
    foreach (array_keys(HISTORY_FLAGS) as $k) {
        $row[$k] = (int) ($h[$k] ?? 0) === 1 || !empty($d['flags'][$k]) ? 1 : 0;
    }
    $row += ['reviewed_at' => now_sql(), 'reviewed_by' => $user['id']];
    $cols = array_keys($row);
    db_run(
        'INSERT INTO medical_histories (patient_id, ' . implode(', ', $cols) . ') VALUES (?, ' . implode(', ', array_fill(0, count($cols), '?')) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', array_map(static fn ($c) => "{$c} = VALUES({$c})", $cols)),
        array_merge([$patientId], array_values($row)),
    );
}
