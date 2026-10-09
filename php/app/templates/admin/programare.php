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

// ── Quick status change („Azi”, calendar) ────────────────────────────────────
if (!$isNew && is_post() && post('op') === 'stare') {
    csrf_check();
    $st = post('stare');
    if (isset(APPT_STATUS[$st])) {
        set_appointment_status((int) $appt['id'], $st, $user);
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
    'duration' => (string) ($appt ? (int) ((strtotime($appt['ends_at']) - strtotime($appt['starts_at'])) / 60) : 30),
    'category' => (string) ($appt['category_slug'] ?? ($lead['category_slug'] ?? '')),
    'reason' => (string) ($appt['reason'] ?? ($recall['reason'] ?? '')),
    'comfort' => (string) ($appt['comfort'] ?? ($lead['comfort'] ?? ($patient['comfort'] ?? ''))),
    'sedation' => (string) (int) ($appt['wants_sedation'] ?? ($patient['prefers_sedation'] ?? (($lead['comfort'] ?? '') === 'frica' ? 1 : 0))),
    'notes' => (string) ($appt['notes'] ?? ($lead ? trim(($lead['message'] ?? '') . ($lead['preferred_time'] ? "\nInterval dorit: " . (TIME_WINDOWS[$lead['preferred_time']] ?? '') : '')) : '')),
    'status' => (string) ($appt['status'] ?? 'programat'),
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
        audit('rechemare-noua', "#{$rid} pentru programarea #{$appt['id']}");
        flash("Rechemarea a fost pusă peste {$months} " . ($months === 1 ? 'lună' : 'luni') . '.');
        redirect("/admin/programari/{$appt['id']}");
    }
    foreach (['location', 'doctor', 'date', 'time', 'duration', 'category', 'reason', 'comfort', 'notes', 'status', 'p_last', 'p_first', 'p_phone', 'p_email'] as $k) {
        $v[$k] = post($k);
    }
    $v['sedation'] = post('sedation') === '1' ? '1' : '0';
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
    } elseif ((int) $d->format('H') < 6 || (int) $d->format('H') > 21) {
        $errors['time'] = 'Ora trebuie să fie între 06:00 și 21:00.';
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
        if (in_array($v['status'], APPT_ACTIVE, true) && post('suprapune') !== '1') {
            $conflicts = appointment_conflicts($doc, $startsAt, $endsAt, $appt ? (int) $appt['id'] : null);
            if ($conflicts !== []) {
                $errors['time'] = 'Medicul are deja o programare în acest interval. Alegeți altă oră sau bifați „Programez oricum”.';
            }
        }
    }
    if ($errors === []) {
        $id = db_tx(static function () use ($isNew, $appt, $patient, $v, $loc, $doc, $startsAt, $endsAt, $user, $lead, $recall) {
            $patientId = $patient !== null ? (int) $patient['id'] : null;
            if ($patientId === null) {
                $row = ['first_name' => mb_substr($v['p_first'], 0, 80), 'last_name' => mb_substr($v['p_last'], 0, 80), 'phone' => format_phone($v['p_phone']), 'email' => $v['p_email'] ?: null, 'preferred_location_id' => $loc];
                $existing = null;
                foreach (db_all("SELECT id, phone FROM patients WHERE phone <> ''") as $p) {
                    if (national_digits($p['phone']) === national_digits($v['p_phone'])) {
                        $existing = (int) $p['id'];
                        break;
                    }
                }
                $patientId = $existing ?? db_insert('patients', $row + [
                    'file_number' => next_file_number(),
                    'search_text' => patient_search_text($row),
                    'comfort' => $v['comfort'] ?: null,
                    'prefers_sedation' => (int) $v['sedation'],
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
                'comfort' => $v['comfort'] ?: null,
                'wants_sedation' => (int) $v['sedation'],
                'notes' => mb_substr($v['notes'], 0, 4000) ?: null,
                'updated_by' => $user['id'],
                'updated_at' => now_sql(),
            ];
            if ($isNew) {
                $id = db_insert('appointments', $row + ['status' => 'programat', 'lead_id' => $lead['id'] ?? null, 'created_by' => $user['id'], 'created_at' => now_sql()]);
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
                }
                db_update('appointments', $row, 'id = :id', ['id' => $id]);
                if ($v['status'] !== $appt['status']) {
                    set_appointment_status($id, $v['status'], $user);
                }
            }
            return $id;
        });
        audit($isNew ? 'programare-noua' : 'programare', "#{$id} {$startsAt}");
        flash($isNew ? 'Programarea a fost făcută.' : 'Programarea a fost salvată.');
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
$serviceOptions = ['' => 'Consultație / nespecificat'];
foreach (content('services') as $s) {
    $serviceOptions[$s['slug']] = $s['title'];
}
$times = [];
for ($m = 7 * 60; $m <= 20 * 60; $m += CAL_SLOT_MIN) {
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
        . alert_chips($alerts) . comfort_chip($patient['comfort'], (bool) $patient['prefers_sedation']) . '</div>'
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
            $patientBlock .= '<li><a href="' . e(admin_url('/admin/programari/noua', ['pacient' => $f['id'], 'clinica' => $v['location'], 'data' => $v['date'], 'ora' => $v['time'], 'medic' => $v['doctor'], 'cerere' => $lead['id'] ?? null])) . '" class="flex min-h-control items-center justify-between gap-3 rounded-control border border-linie px-3 hover:border-cerneala hover:bg-menta-pal">'
                . '<span class="font-semibold">' . e(patient_name($f)) . '</span><span class="text-mic text-discret">nr. ' . (int) $f['file_number'] . ($f['phone'] !== '' ? ' · ' . e(format_phone($f['phone'])) : '') . '</span></a></li>';
        }
        $patientBlock .= $found === [] ? '<li class="text-mic text-discret">Niciun pacient găsit. Completați datele pacientului nou.</li>' : '';
        $patientBlock .= '</ul>';
    }
    $patientBlock .= '<fieldset class="mt-5 flex flex-col gap-4 rounded-panou border border-dashed border-linie-control p-4"><legend class="px-1 text-control font-semibold">Pacient nou</legend>'
        . '<div class="grid gap-4 sm:grid-cols-2">'
        . text_field('p_last', 'Numele de familie', ['value' => $v['p_last'], 'error' => $err('p_last')])
        . text_field('p_first', 'Prenumele', ['value' => $v['p_first']])
        . text_field('p_phone', 'Telefon', ['type' => 'tel', 'value' => $v['p_phone'], 'error' => $err('p_phone'), 'hint' => 'Dacă există deja un pacient cu acest telefon, programarea se face pe fișa lui.'])
        . text_field('p_email', 'E-mail', ['type' => 'email', 'value' => $v['p_email'], 'optional' => true, 'error' => $err('p_email'), 'hint' => 'Pentru reamintirea cu o zi înainte.'])
        . '</div></fieldset>';
}

$conflictList = '';
foreach ($conflicts as $c) {
    $conflictList .= '<li>' . e(hm($c['starts_at']) . '–' . hm($c['ends_at']) . ': ' . patient_name($c)) . '</li>';
}
$leadNote = $lead !== null ? '<p class="mb-6 rounded-panou bg-menta-pal p-4 text-corp">Din cererea online a lui <a href="/admin/cereri/' . (int) $lead['id'] . '" class="font-semibold underline">' . e($lead['name']) . '</a>' . ($lead['preferred_date'] ? ', ziua dorită: ' . e(format_date($lead['preferred_date'], true)) : '') . ($lead['preferred_time'] ? ', ' . e(mb_strtolower(TIME_WINDOWS[$lead['preferred_time']] ?? '')) : '') . '.</p>' : '';
$recallNote = $recall !== null ? '<p class="mb-6 rounded-panou bg-menta-pal p-4 text-corp">Din rechemarea „' . e($recall['reason']) . '”.</p>' : '';

$actions = '';
if (!$isNew) {
    $actions = '<a href="' . e(admin_url('/admin/calendar', ['data' => substr($appt['starts_at'], 0, 10), 'clinica' => $appt['location_id']])) . '" class="' . e(btn('secondary')) . '">' . icon('calendar', 18) . 'În calendar</a>';
}
$body = admin_header($isNew ? 'Programare nouă' : 'Programarea din ' . short_day($appt['starts_at']) . ', ' . hm($appt['starts_at']), $isNew ? '' : 'Starea: ' . (APPT_STATUS[$appt['status']] ?? ''), $actions)
    . $leadNote . $recallNote
    . '<form id="cauta-pacient" method="get" action="/admin/programari/noua">'
    . '<input type="hidden" name="clinica" value="' . e($v['location']) . '"><input type="hidden" name="data" value="' . e($v['date']) . '"><input type="hidden" name="ora" value="' . e($v['time']) . '"><input type="hidden" name="medic" value="' . e($v['doctor']) . '">'
    . ($lead ? '<input type="hidden" name="cerere" value="' . (int) $lead['id'] . '">' : '') . '</form>'
    . '<form method="post" novalidate class="flex max-w-4xl flex-col gap-8">' . csrf_field()
    . ($back ? '<input type="hidden" name="inapoi" value="' . e($back) . '">' : '')
    . ($lead ? '<input type="hidden" name="cerere" value="' . (int) $lead['id'] . '">' : '')
    . ($recall ? '<input type="hidden" name="rechemare" value="' . (int) $recall['id'] . '">' : '')
    . error_summary($errors)
    . ($conflictList !== '' ? '<div class="rounded-panou border border-mustar bg-mustar-pal p-4"><p class="font-semibold">Medicul are deja:</p><ul class="mt-1 list-disc pl-5 text-corp">' . $conflictList . '</ul>' . checkbox_field('suprapune', 'Programez oricum (de exemplu, o urgență)', ['class' => 'mt-2']) . '</div>' : '')
    . admin_section_open('Pacientul', 'pacient') . '<div class="mt-4">' . $patientBlock . '</div></section>'
    . admin_section_open('Când și la cine', 'cand')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . select_field('location', 'Clinica', $clinicOptions, ['value' => $v['location'], 'error' => $err('location')])
    . select_field('doctor', 'Medicul', $doctorOptions, ['value' => $v['doctor'], 'error' => $err('doctor')])
    . text_field('date', 'Ziua', ['type' => 'date', 'value' => $v['date'], 'error' => null])
    . '<div class="grid grid-cols-2 gap-4">' . select_field('time', 'Ora', ['' => '—'] + $times, ['value' => $v['time'], 'error' => $err('time')])
    . select_field('duration', 'Durata', array_map('strval', DURATIONS), ['value' => $v['duration']]) . '</div>'
    . '</div></section>'
    . admin_section_open('Pentru ce', 'motiv')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . select_field('category', 'Serviciul', $serviceOptions, ['value' => $v['category']])
    . text_field('reason', 'Motivul', ['value' => $v['reason'], 'optional' => true, 'hint' => 'De exemplu: durere la 36, control după extracție'])
    . '</div><div class="mt-5 flex flex-col gap-5">'
    . radio_group('comfort', 'Cum se simte pacientul', ['' => 'Nu știm'] + COMFORT_SHORT, ['inline' => true, 'value' => $v['comfort']])
    . checkbox_field('sedation', 'Cu inhalosedare', ['checked' => $v['sedation'] === '1', 'description' => 'Se pregătește aparatul.'])
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
