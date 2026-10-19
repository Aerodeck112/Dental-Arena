<?php
/**
 * Data brought over from the clinic's previous program (QDental). An update can carry lists in
 * data/import/*.json, added once, in the order of their names, on the first page of the panel
 * after the update; storage/import-<name>.done keeps the result:
 *  - patients ({source, patients: [{last, first, phones, fisa, note}]}): a patient already in the
 *    panel (same phone and same name) is not added twice;
 *  - procedures ({kind: "procedures", source, location, procedures: [{fise, date, name, price,
 *    payments: [{date, amount}], note}]}): each goes to the patient with that QDental file number,
 *    with its payments.
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/lib.php';
require_once APP_DIR . '/src/admin/crm.php';

/** The lists in data/import that were not added yet. */
function pending_imports(): array
{
    return array_values(array_filter(glob(APP_DIR . '/data/import/*.json') ?: [], static fn ($f) => !is_file(import_marker($f, 'done'))));
}

function import_marker(string $file, string $kind): string
{
    return APP_DIR . '/storage/import-' . basename($file, '.json') . ".{$kind}";
}

/** Adds every pending list; one request does it, the others go on as usual. */
function run_pending_imports(): void
{
    @mkdir(APP_DIR . '/storage', 0750, true);
    foreach (pending_imports() as $file) {
        // A list that could not be added waits an hour before the next try.
        if (is_file(import_marker($file, 'failed')) && filemtime(import_marker($file, 'failed')) > time() - 3600) {
            continue;
        }
        $lock = @fopen(import_marker($file, 'lock'), 'x');
        if ($lock === false) {
            continue; // another request is adding it
        }
        try {
            @set_time_limit(300);
            $kind = json_decode((string) file_get_contents($file), true)['kind'] ?? 'patients';
            $r = $kind === 'procedures' ? import_procedures($file) : import_patients($file);
            file_put_contents(import_marker($file, 'done'), json_encode($r + ['at' => now_sql()], JSON_UNESCAPED_UNICODE));
        } catch (Throwable $e) {
            app_log('error', 'import ' . basename($file) . ': ' . $e->getMessage());
            @touch(import_marker($file, 'failed'));
        } finally {
            fclose($lock);
            @unlink(import_marker($file, 'lock'));
        }
    }
}

/** How a phone from the old program is kept: Romanian numbers as 0745 123 456, foreign ones with +. */
function import_phone(string $raw): ?string
{
    $raw = trim($raw);
    if (national_digits($raw) !== null) {
        return format_phone($raw);
    }
    $digits = preg_replace('/\D+/', '', $raw) ?? '';
    if (preg_match('/^(\+|00)\d{8,15}$/', str_replace(' ', '', $raw)) || (str_starts_with($digits, '00') && strlen($digits) >= 10)) {
        return '+' . ltrim($digits, '0');
    }
    return strlen($digits) >= 6 ? $digits : null;
}

/**
 * @return array{source:string,added:int,existing:int,without_phone:int}
 */
function import_patients(string $file): array
{
    $data = json_decode((string) file_get_contents($file), true);
    if (!is_array($data) || !is_array($data['patients'] ?? null)) {
        throw new RuntimeException('Lista nu poate fi citită.');
    }
    $source = (string) ($data['source'] ?? basename($file));
    // What is already in the panel: national phone digits → folded names.
    $byPhone = [];
    $byName = [];
    foreach (db_all('SELECT last_name, first_name, phone FROM patients') as $p) {
        $name = fold_text(trim($p['last_name'] . ' ' . $p['first_name']));
        $digits = preg_replace('/\D+/', '', (string) $p['phone']) ?? '';
        if ($digits !== '') {
            $byPhone[substr($digits, -9)][$name] = true;
        } else {
            $byName[$name] = true;
        }
    }
    $added = $existing = $withoutPhone = 0;
    db_tx(static function () use ($data, $source, &$byPhone, &$byName, &$added, &$existing, &$withoutPhone): void {
        $next = next_file_number();
        $now = now_sql();
        foreach ($data['patients'] as $row) {
            $last = mb_substr(trim((string) ($row['last'] ?? '')), 0, 80);
            $first = mb_substr(trim((string) ($row['first'] ?? '')), 0, 80);
            if ($last === '' && $first === '') {
                continue;
            }
            $phones = array_values(array_filter(array_map(static fn ($x) => is_string($x) ? $x : '', (array) ($row['phones'] ?? []))));
            $phone = $phones !== [] ? import_phone($phones[0]) : null;
            $name = fold_text(trim("{$last} {$first}"));
            $key = $phone !== null ? substr(preg_replace('/\D+/', '', $phone) ?? '', -9) : null;
            if ($key !== null ? isset($byPhone[$key][$name]) : isset($byName[$name])) {
                $existing++;
                continue;
            }
            $notes = [];
            $fise = array_values(array_filter(array_map('strval', (array) ($row['fisa'] ?? []))));
            $notes[] = 'Din programul vechi (QDental)' . ($fise !== [] ? ', fișa nr. ' . implode(', ', $fise) : '') . '.';
            if ($phones !== [] && $phone === null) {
                $notes[] = 'Telefon de verificat: ' . $phones[0] . '.';
            }
            if (isset($phones[1])) {
                $notes[] = 'Alt telefon: ' . (import_phone($phones[1]) ?? $phones[1]) . '.';
            }
            if (trim((string) ($row['note'] ?? '')) !== '') {
                $notes[] = 'Notă din QDental: ' . trim((string) $row['note']) . '.';
            }
            $p = ['last_name' => $last, 'first_name' => $first, 'phone' => $phone ?? '', 'email' => null];
            db_insert('patients', $p + [
                'file_number' => $next++,
                // The old file number is searchable too („4416” finds the patient).
                'search_text' => mb_substr(patient_search_text($p) . ($fise !== [] ? ' ' . implode(' ', $fise) : ''), 0, 400),
                'notes' => implode("\n", $notes),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $added++;
            $withoutPhone += (int) ($phone === null);
            if ($key !== null) {
                $byPhone[$key][$name] = true;
            } else {
                $byName[$name] = true;
            }
        }
    });
    audit('import-pacienti', "{$source}: {$added} pacienți adăugați, {$existing} existau deja" . ($withoutPhone ? ", {$withoutPhone} fără telefon" : ''));
    return ['source' => $source, 'added' => $added, 'existing' => $existing, 'without_phone' => $withoutPhone];
}

/**
 * The procedures of the old program, with what was paid for each, on the patients by their QDental
 * file number (kept in the patient's note at the patient import). Two files with the same name in
 * QDental: the newer one, and the procedure says so.
 *
 * @return array{source:string,added:int,payments:int,skipped:int}
 */
function import_procedures(string $file): array
{
    require_once APP_DIR . '/src/admin/procedures.php';
    $data = json_decode((string) file_get_contents($file), true);
    if (!is_array($data) || !is_array($data['procedures'] ?? null)) {
        throw new RuntimeException('Lista procedurilor nu poate fi citită.');
    }
    $source = (string) ($data['source'] ?? basename($file));
    $loc = db_value('SELECT id FROM locations WHERE slug = ?', [(string) ($data['location'] ?? 'cristesti')]);
    $byFile = [];
    foreach (db_all("SELECT id, notes FROM patients WHERE notes LIKE '%QDental%'") as $p) {
        if (preg_match('/fișa nr\. ([\d, ]+)/u', (string) $p['notes'], $m)) {
            foreach (preg_split('/\D+/', $m[1]) ?: [] as $n) {
                if ($n !== '') {
                    $byFile[$n] = (int) $p['id'];
                }
            }
        }
    }
    if ($byFile === []) {
        throw new RuntimeException('Pacienții din QDental nu sunt încă în panou.');
    }
    $added = $payments = $skipped = 0;
    $missing = [];
    db_tx(static function () use ($data, $loc, $byFile, &$added, &$payments, &$skipped, &$missing): void {
        $now = now_sql();
        foreach ($data['procedures'] as $r) {
            $fise = array_values(array_filter(array_map('strval', (array) ($r['fise'] ?? []))));
            usort($fise, static fn ($a, $b) => (int) $b <=> (int) $a);
            $pid = null;
            foreach ($fise as $f) {
                if (isset($byFile[$f])) {
                    $pid = $byFile[$f];
                    break;
                }
            }
            if ($pid === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($r['date'] ?? ''))) {
                $skipped++;
                $missing[(string) ($r['patient'] ?? '?')] = true;
                continue;
            }
            $procId = db_insert('procedures', [
                'patient_id' => $pid, 'location_id' => $loc !== null ? (int) $loc : null, 'doctor_id' => null,
                'performed_on' => $r['date'], 'tooth' => null, 'name' => mb_substr(trim((string) $r['name']) ?: 'Procedură', 0, 255),
                'price' => max(0, (int) ($r['price'] ?? 0)), 'discount' => 0, 'lab_cost' => 0, 'done' => 1,
                'notes' => isset($r['note']) && $r['note'] !== null ? mb_substr((string) $r['note'], 0, 500) : null,
                'source' => 'qdental', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $added++;
            foreach ((array) ($r['payments'] ?? []) as $pay) {
                $amount = (int) ($pay['amount'] ?? 0);
                if ($amount <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($pay['date'] ?? ''))) {
                    continue;
                }
                $payId = db_insert('procedure_payments', [
                    'patient_id' => $pid, 'location_id' => $loc !== null ? (int) $loc : null, 'amount' => $amount,
                    'paid_on' => $pay['date'], 'method' => 'qdental', 'created_at' => $now,
                ]);
                db_insert('procedure_payment_items', ['payment_id' => $payId, 'procedure_id' => $procId, 'amount' => $amount]);
                $payments++;
            }
        }
    });
    audit('import-proceduri', "{$source}: {$added} proceduri, {$payments} plăți" . ($skipped ? ", {$skipped} fără pacient (" . implode(', ', array_slice(array_keys($missing), 0, 20)) . ')' : ''));
    return ['source' => $source, 'added' => $added, 'payments' => $payments, 'skipped' => $skipped];
}

