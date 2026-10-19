<?php
/**
 * Data brought over from the clinic's previous program (QDental). An update can carry lists in
 * data/import/*.json, added once, in the order of their names, on the first page of the panel
 * after the update; storage/import-<name>.done keeps the result, .failed why it could not be added
 * (Setări → Actualizare shows both and can try again):
 *  - patients ({source, patients: [{last, first, phones, fisa, note}]}): a patient already in the
 *    panel (same phone and same name) is not added twice;
 *  - procedures ({kind: "procedures", source, location, procedures: [{fise, date, name, price,
 *    payments: [{date, amount}], note, doctor?}], doctors?}): each goes to the patient with that
 *    QDental file number, with its payments (and its doctor, from QDental's report per doctor);
 *  - procedures-assign ({kind: "procedures-assign", doctors, from, to, assign: [{fise, date, name,
 *    price, doctor}]}): the doctor of procedures already added from the report without doctors.
 * A long list is split in files (one per year); one page adds what fits in about 20 seconds, the
 * next page goes on.
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

/**
 * Adds every pending list; one request does it, the others go on as usual. A list that could not be
 * added waits an hour before the next try ($now: try again at once, from Setări → Actualizare).
 */
function run_pending_imports(bool $now = false): void
{
    @mkdir(APP_DIR . '/storage', 0750, true);
    // The hosting can stop a long request (its time limit): the transaction is rolled back, the
    // reason is kept and the lock removed, so the next try can start.
    $running = null;
    register_shutdown_function(static function () use (&$running): void {
        if ($running !== null) {
            $err = error_get_last();
            @file_put_contents(import_marker($running, 'failed'), 'Serverul a oprit importul' . ($err !== null ? ': ' . $err['message'] : '') . '.');
            @unlink(import_marker($running, 'lock'));
        }
    });
    $started = microtime(true);
    foreach (pending_imports() as $file) {
        // Hosting limits: what does not fit in this request is added on the next page.
        if (microtime(true) - $started > 20) {
            break;
        }
        $failed = import_marker($file, 'failed');
        // A list added just now (the patients) can be what the next one was waiting for; a new
        // version (VERSION is newer than the failure) may add what the old one could not.
        if (!$now && is_file($failed) && filemtime($failed) > max(time() - 3600, (int) @filemtime(APP_DIR . '/VERSION'))) {
            continue;
        }
        $lockFile = import_marker($file, 'lock');
        // A lock older than 10 minutes was left by a request the server stopped.
        if (is_file($lockFile) && filemtime($lockFile) < time() - 600) {
            @unlink($lockFile);
        }
        $lock = @fopen($lockFile, 'x');
        if ($lock === false) {
            continue; // another request is adding it
        }
        $running = $file;
        try {
            @set_time_limit(600);
            @ignore_user_abort(true);
            $kind = json_decode((string) file_get_contents($file), true)['kind'] ?? 'patients';
            $r = match ($kind) {
                'procedures' => import_procedures($file),
                'procedures-assign' => import_procedures_assign($file),
                default => import_patients($file),
            };
            file_put_contents(import_marker($file, 'done'), json_encode($r + ['at' => now_sql()], JSON_UNESCAPED_UNICODE));
            @unlink($failed);
            $now = true;
        } catch (Throwable $e) {
            app_log('error', 'import ' . basename($file) . ': ' . $e->getMessage());
            @file_put_contents($failed, $e->getMessage());
        } finally {
            $running = null;
            fclose($lock);
            @unlink($lockFile);
        }
    }
}

/**
 * The lists in data/import and how each went, for Setări → Actualizare.
 *
 * @return list<array{name:string,source:string,state:string,detail:string,at:?string}>
 */
function import_status(): array
{
    $out = [];
    foreach (glob(APP_DIR . '/data/import/*.json') ?: [] as $file) {
        $done = is_file(import_marker($file, 'done')) ? json_decode((string) file_get_contents(import_marker($file, 'done')), true) : null;
        $failed = import_marker($file, 'failed');
        $source = is_array($done) ? (string) ($done['source'] ?? '') : '';
        if ($source === '' && preg_match('/"source"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/', (string) file_get_contents($file, false, null, 0, 2000), $m)) {
            $source = (string) json_decode('"' . $m[1] . '"');
        }
        [$state, $detail, $at] = match (true) {
            is_array($done) => ['gata', match (true) {
                isset($done['assigned']) => "medicul trecut la {$done['assigned']} proceduri" . (($done['missing'] ?? 0) ? ", {$done['missing']} negăsite" : ''),
                isset($done['payments']) => "{$done['added']} proceduri, {$done['payments']} plăți" . (($done['skipped'] ?? 0) ? ", {$done['skipped']} fără pacient" : ''),
                default => "{$done['added']} pacienți adăugați, {$done['existing']} existau deja",
            }, $done['at'] ?? null],
            is_file(import_marker($file, 'lock')) && filemtime(import_marker($file, 'lock')) > time() - 600 => ['acum', 'Se adaugă acum.', null],
            is_file($failed) => ['eroare', trim((string) file_get_contents($failed)) ?: 'Nu s-a putut adăuga.', date('Y-m-d H:i:s', (int) filemtime($failed))],
            default => ['asteapta', 'Se adaugă la prima pagină de panou.', null],
        };
        $out[] = ['name' => basename($file, '.json'), 'source' => $source ?: basename($file), 'state' => $state, 'detail' => $detail, 'at' => $at];
    }
    return $out;
}

/** Inserts many rows, 500 in one statement (fast also when the hosting's database is far). */
function import_insert_many(string $table, array $rows): void
{
    foreach (array_chunk($rows, 500) as $chunk) {
        $cols = array_keys($chunk[0]);
        $one = '(' . implode(', ', array_fill(0, count($cols), '?')) . ')';
        $params = [];
        foreach ($chunk as $r) {
            foreach ($cols as $c) {
                $params[] = $r[$c];
            }
        }
        db_run(sprintf('INSERT INTO `%s` (%s) VALUES %s', $table, implode(', ', array_map(static fn ($c) => "`{$c}`", $cols)), implode(', ', array_fill(0, count($chunk), $one))), $params);
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
        $rows = [];
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
            $rows[] = $p + [
                'file_number' => $next++,
                // The old file number is searchable too („4416” finds the patient).
                'search_text' => mb_substr(patient_search_text($p) . ($fise !== [] ? ' ' . implode(' ', $fise) : ''), 0, 400),
                'notes' => implode("\n", $notes),
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $added++;
            $withoutPhone += (int) ($phone === null);
            if ($key !== null) {
                $byPhone[$key][$name] = true;
            } else {
                $byName[$name] = true;
            }
        }
        if ($rows !== []) {
            import_insert_many('patients', $rows);
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
    $byFile = import_qdental_files();
    $doctors = import_doctor_ids((array) ($data['doctors'] ?? []));
    $added = $payments = $skipped = 0;
    $missing = [];
    db_tx(static function () use ($data, $loc, $byFile, $doctors, &$added, &$payments, &$skipped, &$missing): void {
        $now = now_sql();
        // The procedures go in first; their ids (in the same order) then link the payments.
        $before = (int) db_value('SELECT COALESCE(MAX(id), 0) FROM procedures');
        $procs = [];
        $pays = [];
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
            // Two QDental files that are the same patient here (same name and phone): nothing to check.
            $note = $r['note'] ?? null;
            if (count(array_unique(array_filter(array_map(static fn ($f) => $byFile[$f] ?? null, $fise)))) <= 1) {
                $note = null;
            }
            if ($pid === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($r['date'] ?? ''))) {
                $skipped++;
                $missing[(string) ($r['patient'] ?? '?')] = true;
                continue;
            }
            $procs[] = [
                'patient_id' => $pid, 'location_id' => $loc !== null ? (int) $loc : null, 'doctor_id' => $doctors[(string) ($r['doctor'] ?? '')] ?? null,
                'performed_on' => $r['date'], 'tooth' => null, 'name' => mb_substr(trim((string) $r['name']) ?: 'Procedură', 0, 255),
                'price' => max(0, (int) ($r['price'] ?? 0)), 'discount' => 0, 'lab_cost' => 0, 'done' => 1,
                'notes' => $note !== null ? mb_substr((string) $note, 0, 500) : null,
                'source' => 'qdental', 'created_at' => $now, 'updated_at' => $now,
            ];
            $added++;
            foreach ((array) ($r['payments'] ?? []) as $pay) {
                $amount = (int) ($pay['amount'] ?? 0);
                if ($amount <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($pay['date'] ?? ''))) {
                    continue;
                }
                $pays[] = [
                    'row' => [
                        'patient_id' => $pid, 'location_id' => $loc !== null ? (int) $loc : null, 'amount' => $amount,
                        'paid_on' => $pay['date'], 'method' => 'qdental', 'created_at' => $now,
                    ],
                    'proc' => count($procs) - 1,
                ];
                $payments++;
            }
        }
        if ($procs === []) {
            return;
        }
        import_insert_many('procedures', $procs);
        $procIds = array_map('intval', array_column(db_all("SELECT id FROM procedures WHERE id > ? AND source = 'qdental' ORDER BY id", [$before]), 'id'));
        if (count($procIds) !== count($procs)) {
            throw new RuntimeException('Procedurile nu s-au putut lega de plăți.');
        }
        if ($pays !== []) {
            $beforePay = (int) db_value('SELECT COALESCE(MAX(id), 0) FROM procedure_payments');
            import_insert_many('procedure_payments', array_column($pays, 'row'));
            $payIds = array_map('intval', array_column(db_all("SELECT id FROM procedure_payments WHERE id > ? AND method = 'qdental' ORDER BY id", [$beforePay]), 'id'));
            if (count($payIds) !== count($pays)) {
                throw new RuntimeException('Plățile nu s-au putut lega de proceduri.');
            }
            import_insert_many('procedure_payment_items', array_map(static fn ($pay, $id) => ['payment_id' => $id, 'procedure_id' => $procIds[$pay['proc']], 'amount' => $pay['row']['amount']], $pays, $payIds));
        }
    });
    audit('import-proceduri', "{$source}: {$added} proceduri, {$payments} plăți" . ($skipped ? ", {$skipped} fără pacient (" . implode(', ', array_slice(array_keys($missing), 0, 20)) . ')' : ''));
    return ['source' => $source, 'added' => $added, 'payments' => $payments, 'skipped' => $skipped];
}

/** QDental file number → the patient here (kept in the patient's note at the patient import). */
function import_qdental_files(): array
{
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
    return $byFile;
}

/** The patient of a procedure: the newest of its QDental files that is here. */
function import_patient_for(array $fise, array $byFile): ?int
{
    usort($fise, static fn ($a, $b) => (int) $b <=> (int) $a);
    foreach ($fise as $f) {
        if (isset($byFile[(string) $f])) {
            return $byFile[(string) $f];
        }
    }
    return null;
}

/**
 * The doctors of QDental's reports ({key: {last, first}}) → their ids here, by the family name
 * (and the first name when two share it). A doctor not in the team yet is added hidden from the
 * site and the calendar (no clinic), so the reports can still show their procedures.
 *
 * @return array<string,int>
 */
function import_doctor_ids(array $wanted): array
{
    $out = [];
    $all = db_all('SELECT id, first_name, last_name FROM doctors');
    foreach ($wanted as $key => $w) {
        $last = fold_text((string) ($w['last'] ?? ''));
        $first = fold_text((string) ($w['first'] ?? ''));
        $same = array_values(array_filter($all, static fn ($d) => fold_text($d['last_name']) === $last));
        if (count($same) > 1) {
            $same = array_values(array_filter($same, static fn ($d) => str_contains(fold_text($d['first_name']), explode(' ', $first)[0]))) ?: $same;
        }
        if ($same !== []) {
            $out[(string) $key] = (int) $same[0]['id'];
            continue;
        }
        if ($last === '') {
            continue;
        }
        $base = slugify(trim(($w['first'] ?? '') . ' ' . ($w['last'] ?? ''))) ?: 'medic';
        $slug = $base;
        for ($i = 2; db_value('SELECT 1 FROM doctors WHERE slug = ?', [$slug]); $i++) {
            $slug = "{$base}-{$i}";
        }
        $id = db_insert('doctors', [
            'slug' => $slug, 'first_name' => (string) $w['first'], 'last_name' => (string) $w['last'],
            'public_name' => 'Dr. ' . trim($w['first'] . ' ' . $w['last']), 'role_line' => 'Medic stomatolog',
            'sort_order' => 90, 'public_visible' => 0, 'accepts_online' => 0,
        ]);
        audit('medic-adaugat', 'Dr. ' . trim($w['first'] . ' ' . $w['last']) . ' (din QDental, ascuns pe site)');
        $all[] = ['id' => $id, 'first_name' => $w['first'], 'last_name' => $w['last']];
        $out[(string) $key] = $id;
    }
    return $out;
}

/**
 * The doctor of the procedures already added from QDental's report without doctors: each row of
 * the reports per doctor finds its procedure by patient, day and price (the name decides between
 * two of the same price), once.
 *
 * @return array{source:string,assigned:int,missing:int}
 */
function import_procedures_assign(string $file): array
{
    $data = json_decode((string) file_get_contents($file), true);
    if (!is_array($data) || !is_array($data['assign'] ?? null)) {
        throw new RuntimeException('Lista medicilor procedurilor nu poate fi citită.');
    }
    $source = (string) ($data['source'] ?? basename($file));
    $byFile = import_qdental_files();
    $doctors = import_doctor_ids((array) ($data['doctors'] ?? []));
    $free = [];
    foreach (db_all("SELECT id, patient_id, performed_on, price, name FROM procedures WHERE source = 'qdental' AND doctor_id IS NULL AND performed_on BETWEEN ? AND ? ORDER BY id", [(string) ($data['from'] ?? '2000-01-01'), (string) ($data['to'] ?? '2099-12-31')]) as $p) {
        $free["{$p['patient_id']}|{$p['performed_on']}|{$p['price']}"][] = ['id' => (int) $p['id'], 'name' => fold_text((string) $p['name'])];
    }
    $byDoctor = [];
    $missing = 0;
    foreach ($data['assign'] as $r) {
        $pid = import_patient_for(array_map('strval', (array) ($r['fise'] ?? [])), $byFile);
        $doc = $doctors[(string) ($r['doctor'] ?? '')] ?? null;
        $k = "{$pid}|{$r['date']}|" . (int) ($r['price'] ?? 0);
        if ($pid === null || $doc === null || empty($free[$k])) {
            $missing++;
            continue;
        }
        $name = fold_text((string) ($r['name'] ?? ''));
        $i = 0;
        foreach ($free[$k] as $j => $c) {
            if ($c['name'] === $name) {
                $i = $j;
                break;
            }
        }
        $byDoctor[$doc][] = $free[$k][$i]['id'];
        array_splice($free[$k], $i, 1);
    }
    $assigned = 0;
    db_tx(static function () use ($byDoctor, &$assigned): void {
        foreach ($byDoctor as $doc => $ids) {
            foreach (array_chunk($ids, 500) as $chunk) {
                $assigned += db_run('UPDATE procedures SET doctor_id = ? WHERE id IN (' . implode(',', array_map('intval', $chunk)) . ')', [(int) $doc]);
            }
        }
    });
    audit('import-proceduri', "{$source}: medicul trecut la {$assigned} proceduri" . ($missing ? ", {$missing} negăsite" : ''));
    return ['source' => $source, 'assigned' => $assigned, 'missing' => $missing];
}
