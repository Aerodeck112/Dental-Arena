<?php
/**
 * Sterilization labels (as in iStoma): a cycle of the autoclave makes a 62 mm label for each
 * pouch (clinic, content, sterilized and expiry day, cycle, autoclave, program, who ran it, a QR
 * code); a pouch opened for a patient is noted in the patient's „Sterilizare” tab by its code
 * (typed, read by a barcode reader, or the QR scanned with the phone).
 */
declare(strict_types=1);

const STERIL_DEFAULTS = [
    'autoclaves' => "Autoclav 1",
    'programs' => "134 °C, 4 min\n121 °C, 20 min",
    'contents' => "Set consultație\nSet extracție\nSet chirurgie\nSet endodonție\nSet detartraj\nSet implant\nFreze\nInstrument individual",
    'days' => 180,
    'label_height' => 40,
];

function steril_settings(): array
{
    $s = setting('sterilizare');
    $s = array_merge(STERIL_DEFAULTS, is_array($s) ? $s : []);
    $s['days'] = max(1, min(730, (int) $s['days']));
    $s['label_height'] = in_array((int) $s['label_height'], [29, 40, 50, 62], true) ? (int) $s['label_height'] : 40;
    return $s;
}

/** The lines of a setting („Autoclav 1”, „Autoclav 2”…). @return list<string> */
function steril_lines(string $text): array
{
    return array_values(array_unique(array_filter(array_map('trim', preg_split('/\R/', $text) ?: []), static fn ($l) => $l !== '')));
}

/** The code on a pouch: the clinic's letter, the year, the cycle and the pouch, e.g. C26-0034-03. */
function steril_code(string $clinicSlug, string $day, int $cycleNo, int $packNo): string
{
    return strtoupper(substr($clinicSlug, 0, 1)) . substr($day, 2, 2) . '-' . sprintf('%04d', $cycleNo) . '-' . sprintf('%02d', $packNo);
}

/** The code inside what a reader or the phone gives (the code, or the link of the QR). */
function steril_code_from(string $input): ?string
{
    return preg_match('/([A-Z]\d{2}-\d{4}-\d{2})/', strtoupper(trim($input)), $m) ? $m[1] : null;
}

/** A pouch with its cycle, by code. */
function steril_pack(string $code): ?array
{
    return db_one('SELECT k.*, c.sterilized_on, c.expires_on, c.cycle_no, c.autoclave, c.program, c.location_id, u.name AS operator FROM sterilization_packs k JOIN sterilization_cycles c ON c.id = k.cycle_id LEFT JOIN users u ON u.id = c.operator_id WHERE k.code = ?', [$code]);
}

/**
 * Makes a cycle and its pouches. $packs: [content => how many]. Returns the cycle's id.
 */
function steril_new_cycle(int $locationId, string $day, string $autoclave, string $program, array $packs, int $operatorId, ?string $notes): int
{
    $s = steril_settings();
    $slug = (string) db_value('SELECT slug FROM locations WHERE id = ?', [$locationId]);
    return db_tx(static function () use ($locationId, $day, $autoclave, $program, $packs, $operatorId, $notes, $s, $slug): int {
        $no = 1 + (int) db_value('SELECT COALESCE(MAX(cycle_no), 0) FROM sterilization_cycles WHERE location_id = ? AND YEAR(sterilized_on) = ? FOR UPDATE', [$locationId, (int) substr($day, 0, 4)]);
        $id = db_insert('sterilization_cycles', [
            'location_id' => $locationId, 'cycle_no' => $no, 'sterilized_on' => $day,
            'expires_on' => (new DateTimeImmutable($day))->modify('+' . $s['days'] . ' days')->format('Y-m-d'),
            'autoclave' => mb_substr($autoclave, 0, 80), 'program' => mb_substr($program, 0, 80), 'operator_id' => $operatorId,
            'notes' => $notes, 'created_at' => now_sql(),
        ]);
        $n = 0;
        foreach ($packs as $content => $qty) {
            for ($i = 0; $i < $qty; $i++) {
                $n++;
                db_insert('sterilization_packs', ['cycle_id' => $id, 'pack_no' => $n, 'code' => steril_code($slug, $day, $no, $n), 'content' => mb_substr((string) $content, 0, 120)]);
            }
        }
        return $id;
    });
}

/**
 * A pouch opened for a patient: noted on the patient, once. An expired pouch, or one used for
 * someone else already, is refused. @return array{0:bool,1:string}
 */
function steril_use(string $input, array $patient, array $user): array
{
    $code = steril_code_from($input);
    $k = $code !== null ? steril_pack($code) : null;
    if ($k === null || !in_array((int) $k['location_id'], allowed_location_ids($user), true)) {
        return [false, 'Nu există un plic cu acest cod' . ($code !== null ? " ({$code})" : '') . '.'];
    }
    if ($k['patient_id'] !== null) {
        return (int) $k['patient_id'] === (int) $patient['id']
            ? [true, "Plicul {$code} era deja trecut la acest pacient."]
            : [false, "Plicul {$code} a fost folosit deja, la alt pacient, pe " . format_datetime((string) $k['used_at']) . '.'];
    }
    if ($k['expires_on'] < date('Y-m-d')) {
        return [false, "Plicul {$code} a expirat pe " . format_date($k['expires_on']) . ': nu se folosește, se resterilizează.'];
    }
    db_run('UPDATE sterilization_packs SET patient_id = ?, used_at = ?, used_by = ? WHERE id = ? AND patient_id IS NULL', [(int) $patient['id'], now_sql(), (int) $user['id'], (int) $k['id']]);
    audit('sterilizare-plic', "{$code} · {$k['content']}", null, (int) $patient['id']);
    return [true, "Plicul {$code} ({$k['content']}, sterilizat " . format_date($k['sterilized_on']) . ') a fost trecut la pacient.'];
}

/** The pouches used for a patient, newest first. */
function steril_patient_packs(int $patientId): array
{
    return db_all('SELECT k.*, c.sterilized_on, c.expires_on, c.cycle_no, c.autoclave, c.program, u.name AS who FROM sterilization_packs k JOIN sterilization_cycles c ON c.id = k.cycle_id LEFT JOIN users u ON u.id = k.used_by WHERE k.patient_id = ? ORDER BY k.used_at DESC', [$patientId]);
}
