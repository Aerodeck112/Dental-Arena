<?php
/**
 * /admin/programari/{id|noua}: create or change an appointment. A new one can start from a
 * site request (?cerere=), a recall (?rechemare=), a patient's file (?pacient=) or a free slot
 * in the calendar (?clinica=&medic=&data=&ora=). The same doctor cannot be booked twice at
 * once unless the user says so. POST op=stare is the quick status change from „Azi”.
 */
declare(strict_types=1);

$isNew = $param === 'noua';
$appt = $isNew ? null : db_one('SELECT * FROM appointments WHERE id = ?', [(int) $param]);
if (!$isNew && ($appt === null || !can_see_appointment($appt, $user))) {
    admin_not_found($user);
}
$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($id) => isset($names[$id])));
$back = admin_safe_return(post('inapoi') ?: query('inapoi')) ?? null;
// „Încă un pacient la aceeași oră” (calendar menu): the doctor may have two patients in the same
// interval; that is then no problem to confirm.
$double = $appt === null && (query('dublu') === '1' || post('dublu') === '1');
$askDuration = admin_int(query('durata'));

// ── Quick status change („Azi”, calendar) ────────────────────────────────────
if (!$isNew && is_post() && post('op') === 'stare') {
    csrf_check();
    $st = post('stare');
    $allowedNext = (APPT_NEXT[$appt['status']] ?? []) + (APPT_BACK[$appt['status']] ?? []) + ['neprezentat' => '', 'anulat' => ''];
    if (isset(APPT_STATUS[$st], $allowedNext[$st]) && $st !== $appt['status']) {
        if (in_array($appt['status'], ['anulat', 'neprezentat'], true) && in_array($st, APPT_ACTIVE, true)) {
            // Back in the calendar: the time may have been given to someone else meanwhile.
            $check = appointment_checks((int) $appt['doctor_id'], (int) $appt['location_id'], $appt['starts_at'], $appt['ends_at'], (int) $appt['patient_id'], (int) $appt['id'], $appt['cabinet'] !== null ? (int) $appt['cabinet'] : null);
            if ($check['block'] !== null) {
                flash($check['block'], 'eroare');
                redirect($back ?? "/admin/programari/{$appt['id']}");
            }
            $warn = array_values(array_filter($check['warn'], static fn ($w) => !str_starts_with($w, 'Ora este în trecut')));
            if ($warn !== []) {
                flash('Atenție: ' . implode(' ', $warn), 'info');
            }
        }
        $note = set_appointment_status((int) $appt['id'], $st, $user);
        if ($note !== null) {
            flash($note);
        }
    }
    redirect($back ?? "/admin/programari/{$appt['id']}");
}

// ── „Sunat, nu răspunde” (calendar menu, „Azi”, this page) ──────────────────────
if (!$isNew && is_post() && post('op') === 'nu-raspunde') {
    csrf_check();
    $on = post('valoare') === '1';
    if ($on === false || in_array($appt['status'], ['programat', 'confirmat'], true)) {
        set_appointment_no_answer($appt, $on, $user);
        flash($on ? 'Sunat, nu răspunde: programarea clipește până confirmă pacientul.' : 'Bifa „Sunat, nu răspunde” a fost scoasă.', 'info');
    }
    redirect($back ?? "/admin/programari/{$appt['id']}");
}

// ── „Trimiteți SMS acum” (calendar menu, this page) ─────────────────────────────
if (!$isNew && is_post() && post('op') === 'sms') {
    csrf_check();
    $pat = db_one('SELECT * FROM patients WHERE id = ?', [(int) $appt['patient_id']]);
    if ($pat !== null && in_array($appt['status'], ['programat', 'confirmat'], true) && strtotime($appt['ends_at']) > time()) {
        [$sent, $note] = send_appointment_sms($appt, $pat);
        audit('sms-programare', $note, null, (int) $pat['id']);
        flash($note, $sent ? 'succes' : 'eroare');
    }
    redirect($back ?? "/admin/programari/{$appt['id']}");
}

// ── Where a new appointment starts from ──────────────────────────────────────
$lead = null;
$recall = null;
$patient = null;
if ($isNew) {
    if (($lid = admin_int(query('cerere') ?: post('cerere'))) !== null) {
        $lead = db_one('SELECT * FROM leads WHERE id = ?', [$lid]);
        if ($lead !== null && !can_see_lead($lead, $user)) {
            $lead = null;
        }
    }
    if (($rid = admin_int(query('rechemare') ?: post('rechemare'))) !== null) {
        $recall = db_one('SELECT * FROM recalls WHERE id = ?', [$rid]);
    }
    $pid = admin_int(query('pacient') ?: post('pacient')) ?? ($recall ? (int) $recall['patient_id'] : null);
    if ($pid !== null) {
        $patient = find_patient($pid, $user);
    }
} else {
    $patient = db_one('SELECT * FROM patients WHERE id = ?', [$appt['patient_id']]);
}

$defaultClinic = $appt ? (int) $appt['location_id'] : (admin_int(query('clinica')) ?? ($lead['location_id'] ?? null) ?? ($recall['location_id'] ?? null) ?? ($patient['preferred_location_id'] ?? null) ?? current_clinic_id($user));
$defaultClinic = in_array((int) $defaultClinic, $allowed, true) ? (int) $defaultClinic : ($allowed[0] ?? null);
$start = $appt ? new DateTimeImmutable($appt['starts_at']) : null;
$v = [
    'location' => (string) $defaultClinic,
    'doctor' => (string) ($appt['doctor_id'] ?? (admin_int(query('medic')) ?? ($recall['doctor_id'] ?? ($patient['primary_doctor_id'] ?? ($user['doctor_id'] ?? ''))))),
    'date' => $start ? $start->format('Y-m-d') : (preg_match('/^\d{4}-\d{2}-\d{2}$/', query('data')) ? query('data') : ($lead['preferred_date'] ?? date('Y-m-d'))),
    'time' => $start ? $start->format('H:i') : (preg_match('/^\d{2}:\d{2}$/', query('ora')) ? query('ora') : ''),
    'duration' => (string) ($appt ? (int) ((strtotime($appt['ends_at']) - strtotime($appt['starts_at'])) / 60) : ($askDuration !== null && isset(DURATIONS[$askDuration]) ? $askDuration : 30)),
    'category' => (string) ($appt['category_slug'] ?? ($lead['category_slug'] ?? '')),
    'reason' => (string) ($appt['reason'] ?? ($recall['reason'] ?? '')),
    'comfort' => (string) ($appt['comfort'] ?? ($lead['comfort'] ?? ($patient['comfort'] ?? ''))),
    'notes' => (string) ($appt['notes'] ?? ($lead ? trim(($lead['message'] ?? '') . ($lead['preferred_time'] ? "\nInterval dorit: " . (TIME_WINDOWS[$lead['preferred_time']] ?? '') : '')) : '')),
    'status' => (string) ($appt['status'] ?? 'programat'),
    'cabinet' => (string) ($appt['cabinet'] ?? ''),
    'p_last' => '',
    'p_first' => '',
    'p_phone' => (string) ($lead['phone'] ?? ''),
    'p_email' => (string) ($lead['email'] ?? ''),
];
if ($lead !== null && $patient === null) {
    $parts = preg_split('/\s+/', trim($lead['name'])) ?: [];
    $v['p_last'] = count($parts) > 1 ? array_shift($parts) : '';
    $v['p_first'] = implode(' ', $parts);
}
$errors = [];
$conflicts = [];

if (is_post()) {
    csrf_check();
    $op = post('op');
    if (!$isNew && $op === 'anuleaza') {
        set_appointment_status((int) $appt['id'], 'anulat', $user, post('cancel_reason'));
        flash('Programarea a fost anulată.');
        redirect($back ?? '/admin/calendar?data=' . substr($appt['starts_at'], 0, 10) . '&clinica=' . $appt['location_id']);
    }
    if (!$isNew && $op === 'rechemare') {
        $months = max(1, min(36, (int) post('luni')));
        $rid = db_insert('recalls', [
            'patient_id' => $appt['patient_id'],
            'location_id' => $appt['location_id'],
            'doctor_id' => $appt['doctor_id'],
            'reason' => mb_substr(post('motiv') ?: 'Control', 0, 255),
            'due_date' => date('Y-m-d', strtotime("+{$months} months", strtotime($appt['starts_at']))),
            'status' => 'de-facut',
            'source_appointment_id' => $appt['id'],
            'created_by' => $user['id'],
            'created_at' => now_sql(),
            'updated_at' => now_sql(),
        ]);
        audit('rechemare-noua', "#{$rid} pentru programarea #{$appt['id']}", null, (int) $appt['patient_id']);
        flash("Rechemarea a fost pusă peste {$months} " . ($months === 1 ? 'lună' : 'luni') . '.');
        redirect("/admin/programari/{$appt['id']}");
    }
    foreach (['location', 'doctor', 'date', 'time', 'duration', 'cabinet', 'category', 'reason', 'comfort', 'notes', 'status', 'p_last', 'p_first', 'p_phone', 'p_email'] as $k) {
        $v[$k] = post($k);
    }
    $loc = admin_int($v['location']);
    if ($loc === null || !in_array($loc, $allowed, true)) {
        $errors['location'] = 'Alegeți clinica.';
    }
    $doc = admin_int($v['doctor']);
    if ($doc === null || ($loc !== null && !in_array($doc, array_column(doctors_at($loc), 'id'), true))) {
        $errors['doctor'] = 'Alegeți un medic care lucrează la această clinică.';
    }
    $d = DateTimeImmutable::createFromFormat('!Y-m-d H:i', "{$v['date']} {$v['time']}");
    if ($d === false) {
        $errors['time'] = 'Alegeți ziua și ora.';
    } elseif ($d->format('H:i') < '06:00' || $d->format('H:i') > '21:00') {
        $errors['time'] = 'Ora trebuie să fie între 06:00 și 21:00.';
    }
    $cabinetMax = $loc !== null ? (int) db_value('SELECT cabinets FROM locations WHERE id = ?', [$loc]) : 1;
    $cabinet = admin_int($v['cabinet']);
    if ($cabinet === null && $cabinetMax > 1 && $doc !== null && $loc !== null) {
        $cabinet = admin_int((string) db_value('SELECT cabinet FROM doctor_locations WHERE doctor_id = ? AND location_id = ?', [$doc, $loc]));
    }
    if ($cabinet !== null && ($cabinet < 1 || $cabinet > $cabinetMax)) {
        $cabinet = null;
    }
    $dur = (int) $v['duration'];
    if (!isset(DURATIONS[$dur])) {
        $dur = 30;
    }
    if ($v['category'] !== '' && !in_array($v['category'], service_slugs(), true)) {
        $v['category'] = '';
    }
    if (!isset(COMFORT_LABELS[$v['comfort']])) {
        $v['comfort'] = '';
    }
    if (!isset(APPT_STATUS[$v['status']])) {
        $v['status'] = 'programat';
    }
    if ($isNew && $patient === null) {
        if (mb_strlen($v['p_last']) < 2) {
            $errors['p_last'] = 'Scrieți numele de familie al pacientului.';
        }
        if ($v['p_phone'] === '' || national_digits($v['p_phone']) === null) {
            $errors['p_phone'] = 'Scrieți telefonul pacientului, de exemplu 0744 123 456.';
        }
        if ($v['p_email'] !== '' && !filter_var($v['p_email'], FILTER_VALIDATE_EMAIL)) {
            $errors['p_email'] = 'E-mailul nu este corect.';
        }
    }
    if ($errors === [] && $d !== false) {
        $startsAt = $d->format('Y-m-d H:i:s');
        $endsAt = $d->modify("+{$dur} minutes")->format('Y-m-d H:i:s');
        $moved = $isNew || $appt['starts_at'] !== $startsAt || $appt['ends_at'] !== $endsAt || (int) $appt['doctor_id'] !== $doc || (int) $appt['location_id'] !== $loc
            || (string) ($appt['cabinet'] ?? '') !== (string) ($cabinet ?? '');
        if (in_array($v['status'], APPT_ACTIVE, true) && $moved) {
            // A doctor away or a clinic closed: the absence has to go first. The rest only warns.
            $check = appointment_checks($doc, $loc, $startsAt, $endsAt, $patient !== null ? (int) $patient['id'] : ($appt !== null ? (int) $appt['patient_id'] : null), $appt ? (int) $appt['id'] : null, $cabinet);
            if ($check['block'] !== null) {
                $errors['time'] = $check['block'];
            } elseif (($double ? array_filter($check['warn'], static fn ($w) => !str_starts_with($w, 'Medicul are deja')) : $check['warn']) !== [] && post('suprapune') !== '1') {
                $conflicts = $check['warn'];
                $errors['time'] = 'Ora aleasă are o problemă (vedeți lista de mai jos). Alegeți alta sau bifați „Programez oricum”.';
            }
        }
    }
    if ($errors === []) {
        $statusNote = null;
        $id = db_tx(static function () use ($isNew, $appt, $patient, $v, $loc, $doc, $startsAt, $endsAt, $user, $lead, $recall, $cabinet, &$statusNote) {
            $patientId = $patient !== null ? (int) $patient['id'] : null;
            if ($patientId === null) {
                $row = ['first_name' => mb_substr($v['p_first'], 0, 80), 'last_name' => mb_substr($v['p_last'], 0, 80), 'phone' => format_phone($v['p_phone']), 'email' => $v['p_email'] ?: null, 'preferred_location_id' => $loc];
                $existing = patient_by_phone_name($v['p_last'] . ' ' . $v['p_first'], $v['p_phone']);
                $patientId = $existing ?? db_insert('patients', $row + [
                    'file_number' => next_file_number(),
                    'search_text' => patient_search_text($row),
                    'comfort' => $v['comfort'] ?: null,
                    'created_by' => $user['id'],
                    'created_at' => now_sql(),
                    'updated_at' => now_sql(),
                ]);
            }
            $row = [
                'location_id' => $loc,
                'doctor_id' => $doc,
                'patient_id' => $patientId,
                'category_slug' => $v['category'] ?: null,
                'reason' => mb_substr($v['reason'], 0, 255) ?: null,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'cabinet' => $cabinet,
                'comfort' => $v['comfort'] ?: null,
                'notes' => mb_substr($v['notes'], 0, 4000) ?: null,
                'updated_by' => $user['id'],
                'updated_at' => now_sql(),
            ];
            if ($isNew) {
                $id = db_insert('appointments', $row + ['status' => 'programat', 'source' => $recall !== null ? 'rechemare' : ($lead !== null ? 'cerere' : 'receptie'), 'lead_id' => $lead['id'] ?? null, 'created_by' => $user['id'], 'created_at' => now_sql()]);
                if ($lead !== null && (int) ($lead['marketing_ok'] ?? 0) === 1) {
                    // The consent ticked on the site's form goes to the patient's file.
                    db_run("UPDATE patients SET marketing_sms = 1, marketing_email = 1, marketing_consent_at = COALESCE(marketing_consent_at, ?), marketing_consent_source = COALESCE(marketing_consent_source, 'formularul de pe site') WHERE id = ?", [$lead['created_at'], $patientId]);
                }
                if ($lead !== null) {
                    db_update('leads', ['status' => 'programat', 'patient_id' => $patientId, 'appointment_id' => $id, 'updated_at' => now_sql(), 'updated_by' => $user['id']], 'id = :id', ['id' => $lead['id']]);
                }
                if ($recall !== null) {
                    db_update('recalls', ['status' => 'programat', 'booked_appointment_id' => $id, 'updated_at' => now_sql()], 'id = :id', ['id' => $recall['id']]);
                }
            } else {
                $id = (int) $appt['id'];
                // A moved appointment gets a new reminder.
                if ($appt['starts_at'] !== $startsAt) {
                    $row['reminder_sent_at'] = null;
                    drop_pending_reminder($id);
                }
                // A new time, doctor or clinic: the patient's old link stops working.
                if ($appt['starts_at'] !== $startsAt || (int) $appt['doctor_id'] !== $doc || (int) $appt['location_id'] !== $loc) {
                    $row['token_version'] = (int) $appt['token_version'] + 1;
                }
                db_update('appointments', $row, 'id = :id', ['id' => $id]);
                if ($v['status'] !== $appt['status']) {
                    $statusNote = set_appointment_status($id, $v['status'], $user);
                }
            }
            return $id;
        });
        if ($isNew) {
            notify_appointment('programare-noua', $id);
            // „Alegeți ora în calendar”: done, the patient is no longer waiting for a time.
            if ((int) ($_SESSION['de_programat'] ?? 0) === (int) db_value('SELECT patient_id FROM appointments WHERE id = ?', [$id])) {
                unset($_SESSION['de_programat']);
            }
        } elseif ($appt['starts_at'] !== $startsAt && in_array($v['status'], ['programat', 'confirmat'], true)) {
            notify_appointment('programare-mutata', $id);
        }
        audit($isNew ? 'programare-noua' : 'programare', "#{$id} {$startsAt}", null, (int) db_value('SELECT patient_id FROM appointments WHERE id = ?', [$id]));
        flash($isNew ? 'Programarea a fost făcută.' : 'Programarea a fost salvată.' . (isset($statusNote) && $statusNote !== null ? ' ' . $statusNote : ''));
        redirect($back ?? "/admin/programari/{$id}");
    }
}

// ── The form ──────────────────────────────────────────────────────────────────
$clinicOptions = [];
foreach ($allowed as $id) {
    $clinicOptions[(string) $id] = $names[$id];
}
$doctorOptions = ['' => 'Alegeți medicul'];
foreach ($allowed as $lid) {
    foreach (doctors_at($lid) as $dd) {
        $doctorOptions[(string) $dd['id']] = $dd['name'];
    }
}
// The cabinet, where the clinic has more than one (empty = the doctor's usual one).
$cabinetSelect = '';
$maxCab = (int) db_value('SELECT MAX(cabinets) FROM locations WHERE id IN (' . implode(',', array_map('intval', $allowed ?: [0])) . ')');
if ($maxCab > 1) {
    $cabOptions = ['' => 'Cabinetul obișnuit al medicului'];
    for ($c = 1; $c <= $maxCab; $c++) {
        $cabOptions[(string) $c] = "Cabinetul {$c}";
    }
    $cabinetSelect = select_field('cabinet', 'Cabinetul', $cabOptions, ['value' => $v['cabinet']]);
}
$serviceOptions = ['' => 'Consultație / nespecificat'];
foreach (site_services() as $s) {
    $serviceOptions[$s['slug']] = $s['title'];
}
$times = [];
for ($m = 7 * 60; $m <= 21 * 60; $m += CAL_SLOT_MIN) {
    $t = sprintf('%02d:%02d', intdiv($m, 60), $m % 60);
    $times[$t] = $t;
}
if ($v['time'] !== '' && !isset($times[$v['time']])) {
    $times[$v['time']] = $v['time'];
    ksort($times);
}
$err = static fn (string $k): ?string => $errors[$k] ?? null;

$patientBlock = '';
if ($patient !== null) {
    $alerts = medical_alerts((int) $patient['id']);
    $patientBlock = '<input type="hidden" name="pacient" value="' . (int) $patient['id'] . '">'
        . '<div class="flex flex-wrap items-center gap-3"><p><a href="/admin/pacienti/' . (int) $patient['id'] . '" class="text-h3 font-semibold text-link underline-offset-4 hover:underline">' . e(patient_name($patient)) . '</a>'
        . '<span class="block text-mic text-discret">Fișa nr. ' . (int) $patient['file_number'] . ($patient['phone'] !== '' ? ' · <span class="telefon">' . e(format_phone($patient['phone'])) . '</span>' : '') . '</span></p>'
        . alert_chips($alerts) . comfort_chip($patient['comfort']) . '</div>'
        . ($isNew ? '<p class="mt-2"><a href="' . e(admin_url('/admin/programari/noua', ['clinica' => $v['location'], 'data' => $v['date'], 'ora' => $v['time'], 'cerere' => $lead['id'] ?? null])) . '" class="text-mic text-link underline">Alt pacient</a></p>' : '');
} else {
    $patientBlock = '<p class="text-mic text-discret">Căutați pacientul după nume, telefon sau numărul fișei' . ($lead ? '' : '') . ', sau completați datele unui pacient nou mai jos.</p>'
        . '<div class="mt-3 flex gap-2"><input type="search" name="q" form="cauta-pacient" value="' . e(query('q')) . '" placeholder="Nume, telefon sau nr. fișă" aria-label="Căutați pacientul" class="' . e(input_classes('h-control')) . '"><button type="submit" form="cauta-pacient" class="' . e(btn('secondary')) . '">' . icon('search', 18) . 'Căutați</button></div>';
    if (query('q') !== '') {
        $q = '%' . fold_text(query('q')) . '%';
        [$scope, $params] = patient_scope_sql($user);
        $found = db_all("SELECT p.* FROM patients p WHERE p.active = 1 AND (p.search_text LIKE ? OR p.file_number = ?) AND {$scope} ORDER BY p.last_name, p.first_name LIMIT 10", array_merge([$q, (int) query('q')], $params));
        $patientBlock .= '<ul class="mt-3 flex flex-col gap-1">';
        foreach ($found as $f) {
            $patientBlock .= '<li><a href="' . e(admin_url('/admin/programari/noua', ['pacient' => $f['id'], 'clinica' => $v['location'], 'data' => $v['date'], 'ora' => $v['time'], 'medic' => $v['doctor'], 'cerere' => $lead['id'] ?? null, 'dublu' => $double ? '1' : null, 'durata' => $double ? $v['duration'] : null, 'inapoi' => $back])) . '" class="flex min-h-control items-center justify-between gap-3 rounded-control border border-linie px-3 hover:border-cerneala hover:bg-menta-pal">'
                . '<span class="font-semibold">' . e(patient_name($f)) . '</span><span class="text-mic text-discret">nr. ' . (int) $f['file_number'] . ($f['phone'] !== '' ? ' · ' . e(format_phone($f['phone'])) : '') . '</span></a></li>';
        }
        $patientBlock .= $found === [] ? '<li class="text-mic text-discret">Niciun pacient găsit. Completați datele pacientului nou.</li>' : '';
        $patientBlock .= '</ul>';
    }
    $patientBlock .= '<fieldset class="mt-5 flex flex-col gap-4 rounded-panou border border-dashed border-linie-control p-4"><legend class="px-1 text-control font-semibold">Pacient nou</legend>'
        . '<div class="grid gap-4 sm:grid-cols-2">'
        . text_field('p_last', 'Numele de familie', ['value' => $v['p_last'], 'error' => $err('p_last')])
        . text_field('p_first', 'Prenumele', ['value' => $v['p_first']])
        . text_field('p_phone', 'Telefon', ['type' => 'tel', 'value' => $v['p_phone'], 'error' => $err('p_phone'), 'hint' => 'Dacă există deja un pacient cu acest telefon și același nume, programarea se face pe fișa lui.'])
        . text_field('p_email', 'E-mail', ['type' => 'email', 'value' => $v['p_email'], 'optional' => true, 'error' => $err('p_email'), 'hint' => 'Pentru reamintirea cu o zi înainte.'])
        . '</div></fieldset>';
}

$conflictList = implode('', array_map(static fn ($c) => '<li>' . e($c) . '</li>', $conflicts));
$leadNote = $lead !== null ? '<p class="mb-6 rounded-panou bg-menta-pal p-4 text-corp">Din cererea online a lui <a href="/admin/cereri/' . (int) $lead['id'] . '" class="font-semibold underline">' . e($lead['name']) . '</a>' . ($lead['preferred_date'] ? ', ziua dorită: ' . e(format_date($lead['preferred_date'], true)) : '') . ($lead['preferred_time'] ? ', ' . e(mb_strtolower(TIME_WINDOWS[$lead['preferred_time']] ?? '')) : '') . '.</p>' : '';
$recallNote = $recall !== null ? '<p class="mb-6 rounded-panou bg-menta-pal p-4 text-corp">Din rechemarea „' . e($recall['reason']) . '”.</p>' : '';

// The status, one click away: the next step, „Nu a venit”, and going back a step.
$statusBar = '';
if (!$isNew) {
    $steps = APPT_NEXT[$appt['status']] ?? [];
    if (in_array($appt['status'], ['programat', 'confirmat'], true)) {
        $steps['neprezentat'] = 'Nu a venit';
    }
    $btns = '';
    foreach ($steps as $st => $label) {
        $btns .= '<button type="submit" name="stare" value="' . e($st) . '" class="' . e(btn($st === 'neprezentat' ? 'text' : 'primary', 's')) . '">' . e($label) . '</button>';
    }
    foreach (APPT_BACK[$appt['status']] ?? [] as $st => $label) {
        $btns .= '<button type="submit" name="stare" value="' . e($st) . '" class="' . e(btn('secondary', 's')) . '">' . icon('undo-2', 16) . e($label) . '</button>';
    }
    $statusBar = '<form method="post" class="mb-6 flex flex-wrap items-center gap-3 rounded-panou border border-linie bg-suprafata p-4">' . csrf_field() . '<input type="hidden" name="op" value="stare">'
        . ($back ? '<input type="hidden" name="inapoi" value="' . e($back) . '">' : '')
        . '<span class="text-corp">Starea:</span> ' . appt_status_chip($appt['status'])
        . ($appt['status'] === 'anulat' && $appt['cancel_reason'] ? '<span class="text-mic text-discret">(' . e($appt['cancel_reason']) . ')</span>' : '')
        . '<span class="flex flex-wrap gap-2 sm:ml-auto">' . $btns . '</span></form>';
    if (in_array($appt['status'], ['programat', 'confirmat'], true)) {
        $statusBar .= '<div class="-mt-3 mb-6 flex flex-wrap items-center gap-3">' . appt_no_answer_form($appt, $back) . (appt_no_answer($appt) ? appt_no_answer_chip($appt) : '') . appt_sms_form($appt, $back) . '</div>';
    }
}
$actions = '';
if (!$isNew) {
    $actions = '<a href="' . e(admin_url('/admin/calendar', ['data' => substr($appt['starts_at'], 0, 10), 'clinica' => $appt['location_id']])) . '" class="' . e(btn('secondary')) . '">' . icon('calendar', 18) . 'În calendar</a>';
}
if (!$isNew && can('procedures', $user) && in_array($appt['status'], ['sosit', 'in-tratament', 'finalizat'], true)) {
    // After the visit, the doctor adds what was done, with the day, the doctor and the clinic filled in.
    $actions = '<a href="' . e(admin_url('/admin/pacienti/' . (int) $appt['patient_id'] . '/proceduri', ['programare' => $appt['id'], 'medic' => $appt['doctor_id'], 'data' => substr($appt['starts_at'], 0, 10), 'clinica' => $appt['location_id']])) . '#adauga" class="' . e(btn('primary')) . '">' . icon('clipboard-list', 18) . 'Proceduri efectuate</a>' . $actions;
}
$body = admin_header($isNew ? 'Programare nouă' : 'Programarea din ' . short_day($appt['starts_at']) . ', ' . hm($appt['starts_at']), $isNew ? '' : 'Starea: ' . (APPT_STATUS[$appt['status']] ?? ''), $actions)
    . $leadNote . $recallNote . $statusBar
    . '<form id="cauta-pacient" method="get" action="/admin/programari/noua">'
    . '<input type="hidden" name="clinica" value="' . e($v['location']) . '"><input type="hidden" name="data" value="' . e($v['date']) . '"><input type="hidden" name="ora" value="' . e($v['time']) . '"><input type="hidden" name="medic" value="' . e($v['doctor']) . '">'
    . ($double ? '<input type="hidden" name="dublu" value="1"><input type="hidden" name="durata" value="' . e($v['duration']) . '">' : '')
    . ($back ? '<input type="hidden" name="inapoi" value="' . e($back) . '">' : '')
    . ($lead ? '<input type="hidden" name="cerere" value="' . (int) $lead['id'] . '">' : '') . '</form>'
    . ($double ? '<p class="mb-6 flex max-w-4xl items-start gap-2 rounded-panou border border-actiune bg-menta-pal p-4 text-corp">' . icon('users', 20, 'mt-0.5 shrink-0') . '<span><strong>Încă un pacient la aceeași oră.</strong> Medicul poate avea doi pacienți în același interval; în calendar apar unul lângă altul. Alegeți pacientul și salvați.</span></p>' : '')
    . '<form method="post" novalidate class="flex max-w-4xl flex-col gap-8">' . csrf_field()
    . ($double ? '<input type="hidden" name="dublu" value="1">' : '')
    . ($back ? '<input type="hidden" name="inapoi" value="' . e($back) . '">' : '')
    . ($lead ? '<input type="hidden" name="cerere" value="' . (int) $lead['id'] . '">' : '')
    . ($recall ? '<input type="hidden" name="rechemare" value="' . (int) $recall['id'] . '">' : '')
    . error_summary($errors)
    . ($conflictList !== '' ? '<div class="rounded-panou border border-mustar bg-mustar-pal p-4"><p class="font-semibold">Atenție la ora aleasă:</p><ul class="mt-1 list-disc pl-5 text-corp">' . $conflictList . '</ul>' . checkbox_field('suprapune', 'Programez oricum (doi pacienți în același interval, o urgență)', ['class' => 'mt-2']) . '</div>' : '')
    . admin_section_open('Pacientul', 'pacient') . '<div class="mt-4">' . $patientBlock . '</div></section>'
    . admin_section_open('Când și la cine', 'cand')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . select_field('location', 'Clinica', $clinicOptions, ['value' => $v['location'], 'error' => $err('location')])
    . select_field('doctor', 'Medicul', $doctorOptions, ['value' => $v['doctor'], 'error' => $err('doctor')])
    . text_field('date', 'Ziua', ['type' => 'date', 'value' => $v['date'], 'error' => null])
    . '<div class="grid grid-cols-2 gap-4">' . select_field('time', 'Ora', ['' => '—'] + $times, ['value' => $v['time'], 'error' => $err('time')])
    . select_field('duration', 'Durata', array_map('strval', DURATIONS), ['value' => $v['duration']]) . '</div>'
    . ($cabinetSelect !== '' ? $cabinetSelect : '')
    . '</div></section>'
    . admin_section_open('Pentru ce', 'motiv')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . select_field('category', 'Serviciul', $serviceOptions, ['value' => $v['category']])
    . text_field('reason', 'Motivul', ['value' => $v['reason'], 'optional' => true, 'hint' => 'De exemplu: durere la 36, control după extracție'])
    . '</div><div class="mt-5 flex flex-col gap-5">'
    . radio_group('comfort', 'Cum se simte pacientul', ['' => 'Nu știm'] + COMFORT_SHORT, ['inline' => true, 'value' => $v['comfort']])
    . text_area('notes', 'Observații de recepție', ['value' => $v['notes'], 'rows' => 3, 'optional' => true])
    . (!$isNew ? select_field('status', 'Starea', APPT_STATUS, ['value' => $v['status']]) : '')
    . '</div></section>'
    . '<div class="flex flex-wrap gap-3"><button type="submit" class="' . e(btn('primary', 'l')) . '">' . ($isNew ? 'Faceți programarea' : 'Salvați') . '</button></div>'
    . '</form>';

if (!$isNew) {
    $suggest = RECALL_MONTHS[$appt['category_slug'] ?? ''] ?? 6;
    $months = [];
    foreach ([1, 3, 6, 12] as $m) {
        $months[(string) $m] = $m === 1 ? 'o lună' : "{$m} luni";
    }
    $body .= '<div class="mt-10 grid max-w-4xl gap-6 md:grid-cols-2">'
        . admin_section_open('Rechemare la control', 'rechemare', 'Pacientul apare pe lista de sunat când se apropie data.')
        . '<form method="post" class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="rechemare">'
        . select_field('luni', 'Peste', $months, ['value' => (string) $suggest])
        . text_field('motiv', 'Motivul', ['value' => 'Control' . ($appt['category_slug'] ? ' după ' . mb_strtolower(service_title($appt['category_slug'])) : ''), 'id' => 'field-motiv'])
        . '<div><button type="submit" class="' . e(btn('secondary')) . '">' . icon('calendar-plus', 18) . 'Puneți rechemarea</button></div></form></section>'
        . ($appt['status'] !== 'anulat' ? admin_section_open('Anulare', 'anulare')
        . '<form method="post" class="mt-4 flex flex-col gap-4" data-confirma="Anulați programarea?">' . csrf_field() . '<input type="hidden" name="op" value="anuleaza">'
        . text_field('cancel_reason', 'Motivul anulării', ['optional' => true])
        . '<div><button type="submit" class="' . e(btn('danger')) . '">' . icon('x', 18) . 'Anulați programarea</button></div></form></section>' : '')
        . '</div>';
}
admin_page($isNew ? 'Programare nouă' : 'Programare', $body, $user);
