<?php
/**
 * Patients brought over from the clinic's previous program. An update can carry a list in
 * data/import/*.json ({source, patients: [{last, first, phones, fisa, note}]}); it is added once,
 * on the first request after the update (bootstrap.php), and storage/import-<name>.done keeps the
 * result. A patient already in the panel (same phone and same name) is not added twice.
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
        $lock = @fopen(import_marker($file, 'lock'), 'x');
        if ($lock === false) {
            continue; // another request is adding it
        }
        try {
            @set_time_limit(300);
            $r = import_patients($file);
            file_put_contents(import_marker($file, 'done'), json_encode($r + ['at' => now_sql()], JSON_UNESCAPED_UNICODE));
        } catch (Throwable $e) {
            app_log('error', 'import ' . basename($file) . ': ' . $e->getMessage());
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
