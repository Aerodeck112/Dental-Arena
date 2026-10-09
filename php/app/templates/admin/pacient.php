<?php
/**
 * /admin/pacienti/{id|nou}: the patient's file: personal data (the CNP is checked and stored
 * encrypted), the medical history with its alerts (doctors and administrators), appointments,
 * recalls and notes (clinical notes only for doctors and administrators).
 */
declare(strict_types=1);

$isNew = $param === 'nou';
$p = $isNew ? null : find_patient((int) $param, $user);
if (!$isNew && $p === null) {
    admin_not_found($user);
}
$clinical = can_see_clinical($user);
$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($id) => isset($names[$id])));
$errors = [];
$cnpPlain = $p ? cnp_decrypt($p['cnp_enc']) : null;
$v = [
    'last_name' => $p['last_name'] ?? '',
    'first_name' => $p['first_name'] ?? '',
    'cnp' => '',
    'birth_date' => $p['birth_date'] ?? '',
    'sex' => $p['sex'] ?? '',
    'phone' => $p['phone'] ?? '',
    'email' => $p['email'] ?? '',
    'email_reminders' => (string) ($p['email_reminders'] ?? 1),
    'street' => $p['street'] ?? '',
    'city' => $p['city'] ?? '',
    'county' => $p['county'] ?? 'Mureș',
    'guardian_name' => $p['guardian_name'] ?? '',
    'preferred_location_id' => (string) ($p['preferred_location_id'] ?? (current_clinic_id($user) ?? '')),
    'primary_doctor_id' => (string) ($p['primary_doctor_id'] ?? ''),
    'comfort' => $p['comfort'] ?? '',
    'prefers_sedation' => (string) ($p['prefers_sedation'] ?? 0),
    'notes' => $p['notes'] ?? '',
];

if (is_post()) {
    csrf_check();
    $op = post('op');
    $id = $p ? (int) $p['id'] : null;
    if ($op === 'anamneza' && $id && $clinical) {
        $row = ['allergies' => mb_substr(post('allergies'), 0, 2000) ?: null, 'medications' => mb_substr(post('medications'), 0, 2000) ?: null, 'other_conditions' => mb_substr(post('other_conditions'), 0, 2000) ?: null, 'reviewed_at' => now_sql(), 'reviewed_by' => $user['id']];
        foreach (array_keys(HISTORY_FLAGS) as $k) {
            $row[$k] = post($k) === '1' ? 1 : 0;
        }
        $cols = array_keys($row);
        db_run(
            'INSERT INTO medical_histories (patient_id, ' . implode(', ', $cols) . ') VALUES (?, ' . implode(', ', array_fill(0, count($cols), '?')) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', array_map(static fn ($c) => "{$c} = VALUES({$c})", $cols)),
            array_merge([$id], array_values($row)),
        );
        audit('anamneza', "pacient #{$id}");
        flash('Anamneza a fost salvată.');
        redirect("/admin/pacienti/{$id}#anamneza");
    }
    if ($op === 'nota' && $id) {
        $body = trim(post('body'));
        if ($body !== '') {
            db_insert('patient_notes', ['patient_id' => $id, 'author_id' => $user['id'], 'body' => mb_substr($body, 0, 4000), 'clinical' => $clinical && post('clinical') === '1' ? 1 : 0, 'created_at' => now_sql()]);
            flash('Nota a fost adăugată.');
        }
        redirect("/admin/pacienti/{$id}#note");
    }
    if ($op === 'rechemare' && $id) {
        $due = post('due_date');
        if (DateTimeImmutable::createFromFormat('!Y-m-d', $due) !== false) {
            db_insert('recalls', ['patient_id' => $id, 'location_id' => $p['preferred_location_id'], 'doctor_id' => $p['primary_doctor_id'], 'reason' => mb_substr(post('reason') ?: 'Control', 0, 255), 'due_date' => $due, 'status' => 'de-facut', 'created_by' => $user['id'], 'created_at' => now_sql(), 'updated_at' => now_sql()]);
            flash('Rechemarea a fost adăugată.');
        } else {
            flash('Alegeți data rechemării.', 'eroare');
        }
        redirect("/admin/pacienti/{$id}#rechemari");
    }
    if ($op === 'dezactiveaza' && $id && is_admin($user)) {
        db_update('patients', ['active' => 0, 'updated_at' => now_sql()], 'id = :id', ['id' => $id]);
        audit('pacient-dezactivat', "#{$id}");
        flash('Fișa a fost scoasă din liste. Datele rămân în baza de date.');
        redirect('/admin/pacienti');
    }
    // Personal data (new file or edit).
    foreach (array_keys($v) as $k) {
        $v[$k] = post($k);
    }
    $v['email_reminders'] = post('email_reminders') === '1' ? '1' : '0';
    $v['prefers_sedation'] = post('prefers_sedation') === '1' ? '1' : '0';
    if (mb_strlen($v['last_name']) < 2) {
        $errors['last_name'] = 'Scrieți numele de familie.';
    }
    if (mb_strlen($v['first_name']) < 2) {
        $errors['first_name'] = 'Scrieți prenumele.';
    }
    $cnp = preg_replace('/\s+/', '', $v['cnp']) ?? '';
    if ($cnp !== '') {
        if (!cnp_valid($cnp)) {
            $errors['cnp'] = 'CNP-ul nu este corect: are 13 cifre, iar ultima e cifra de control.';
        } else {
            $dup = db_one('SELECT id, file_number FROM patients WHERE cnp_hash = ? AND id <> ?', [cnp_hash($cnp), $id ?? 0]);
            if ($dup) {
                $errors['cnp'] = 'Există deja o fișă cu acest CNP (nr. ' . $dup['file_number'] . ').';
            }
        }
    }
    if ($v['phone'] !== '' && national_digits($v['phone']) === null && !preg_match('/^\+?[\d\s().-]{8,20}$/', $v['phone'])) {
        $errors['phone'] = 'Telefonul nu este corect.';
    }
    if ($v['email'] !== '' && !filter_var($v['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'E-mailul nu este corect.';
    }
    if ($v['birth_date'] !== '' && DateTimeImmutable::createFromFormat('!Y-m-d', $v['birth_date']) === false) {
        $errors['birth_date'] = 'Data nașterii nu este corectă.';
    }
    $loc = admin_int($v['preferred_location_id']);
    $doc = admin_int($v['primary_doctor_id']);
    if ($errors === []) {
        $facts = $cnp !== '' ? cnp_facts($cnp) : ['birth' => null, 'sex' => null];
        $row = [
            'last_name' => mb_substr($v['last_name'], 0, 80),
            'first_name' => mb_substr($v['first_name'], 0, 80),
            'birth_date' => $v['birth_date'] ?: $facts['birth'],
            'sex' => in_array($v['sex'], ['F', 'M'], true) ? $v['sex'] : $facts['sex'],
            'phone' => $v['phone'] !== '' && national_digits($v['phone']) !== null ? format_phone($v['phone']) : $v['phone'],
            'email' => $v['email'] ?: null,
            'email_reminders' => (int) $v['email_reminders'],
            'street' => mb_substr($v['street'], 0, 190) ?: null,
            'city' => mb_substr($v['city'], 0, 80) ?: null,
            'county' => mb_substr($v['county'], 0, 80) ?: null,
            'guardian_name' => mb_substr($v['guardian_name'], 0, 160) ?: null,
            'preferred_location_id' => $loc !== null && isset($names[$loc]) ? $loc : null,
            'primary_doctor_id' => $doc !== null && isset(doctor_short_names()[$doc]) ? $doc : null,
            'comfort' => isset(COMFORT_LABELS[$v['comfort']]) ? $v['comfort'] : null,
            'prefers_sedation' => (int) $v['prefers_sedation'],
            'notes' => mb_substr($v['notes'], 0, 4000) ?: null,
            'updated_at' => now_sql(),
        ];
        if ($cnp !== '') {
            $row['cnp_enc'] = cnp_encrypt($cnp);
            $row['cnp_hash'] = cnp_hash($cnp);
        }
        $row['search_text'] = patient_search_text($row);
        if ($isNew) {
            $id = db_insert('patients', $row + ['file_number' => next_file_number(), 'created_by' => $user['id'], 'created_at' => now_sql()]);
            audit('pacient-nou', "#{$id}");
            flash('Fișa a fost creată.');
        } else {
            db_update('patients', $row, 'id = :id', ['id' => $id]);
            audit('pacient', "#{$id}");
            flash('Datele au fost salvate.');
        }
        redirect("/admin/pacienti/{$id}");
    }
}

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$clinicOptions = ['' => 'Nespecificată'];
foreach ($names as $id => $n) {
    $clinicOptions[(string) $id] = $n;
}
$doctorOptions = ['' => 'Nespecificat'] + array_map('strval', doctor_short_names());
$personal = '<form method="post" novalidate class="flex flex-col gap-5">' . csrf_field() . '<input type="hidden" name="op" value="date">'
    . error_summary($errors)
    . '<div class="grid gap-5 md:grid-cols-2">'
    . text_field('last_name', 'Numele de familie', ['value' => $v['last_name'], 'required' => true, 'error' => $err('last_name'), 'autocomplete' => 'off'])
    . text_field('first_name', 'Prenumele', ['value' => $v['first_name'], 'required' => true, 'error' => $err('first_name'), 'autocomplete' => 'off'])
    . text_field('cnp', 'CNP', ['value' => $v['cnp'], 'optional' => true, 'inputmode' => 'numeric', 'maxlength' => 13, 'error' => $err('cnp'), 'autocomplete' => 'off',
        'hint' => $cnpPlain ? 'Salvat: ' . cnp_masked($cnpPlain) . '. Scrieți altul doar ca să-l schimbați.' : 'Se păstrează criptat. Din el completăm data nașterii și sexul.'])
    . text_field('birth_date', 'Data nașterii', ['type' => 'date', 'value' => $v['birth_date'], 'optional' => true, 'error' => $err('birth_date')])
    . text_field('phone', 'Telefon', ['type' => 'tel', 'value' => $v['phone'], 'error' => $err('phone')])
    . text_field('email', 'E-mail', ['type' => 'email', 'value' => $v['email'], 'optional' => true, 'error' => $err('email')])
    . '</div>'
    . radio_group('sex', 'Sexul', ['' => 'Nespecificat', 'F' => 'Feminin', 'M' => 'Masculin'], ['inline' => true, 'value' => $v['sex']])
    . checkbox_field('email_reminders', 'Primește reamintirea pe e-mail cu o zi înainte', ['checked' => $v['email_reminders'] === '1'])
    . '<div class="grid gap-5 md:grid-cols-3">'
    . text_field('street', 'Adresa', ['value' => $v['street'], 'optional' => true])
    . text_field('city', 'Localitatea', ['value' => $v['city'], 'optional' => true])
    . text_field('county', 'Județul', ['value' => $v['county'], 'optional' => true])
    . '</div><div class="grid gap-5 md:grid-cols-3">'
    . text_field('guardian_name', 'Părinte / tutore', ['value' => $v['guardian_name'], 'optional' => true, 'hint' => 'Pentru copii.'])
    . select_field('preferred_location_id', 'Clinica', $clinicOptions, ['value' => $v['preferred_location_id']])
    . select_field('primary_doctor_id', 'Medicul curant', $doctorOptions, ['value' => $v['primary_doctor_id']])
    . '</div>'
    . radio_group('comfort', 'Cum se simte la dentist', ['' => 'Nu știm'] + COMFORT_SHORT, ['inline' => true, 'value' => $v['comfort']])
    . checkbox_field('prefers_sedation', 'Preferă inhalosedare', ['checked' => $v['prefers_sedation'] === '1'])
    . text_area('notes', 'Observații administrative', ['value' => $v['notes'], 'rows' => 3, 'optional' => true, 'hint' => 'Nu scrieți aici informații medicale: pentru ele sunt anamneza și notele clinice.'])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . ($isNew ? 'Creați fișa' : 'Salvați datele') . '</button></div></form>';

if ($isNew) {
    $body = '<p class="mb-4"><a href="/admin/pacienti" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Pacienți</a></p>'
        . admin_header('Pacient nou') . '<div class="max-w-4xl">' . admin_section_open('Datele pacientului', 'date') . '<div class="mt-4">' . $personal . '</div></section></div>';
    admin_page('Pacient nou', $body, $user);
    exit;
}

$id = (int) $p['id'];
$alerts = medical_alerts($id);
$docs = doctor_short_names();

// Medical history.
$h = db_one('SELECT * FROM medical_histories WHERE patient_id = ?', [$id]);
if ($clinical) {
    $flags = '';
    foreach (HISTORY_FLAGS as $k => $label) {
        $flags .= checkbox_field($k, e($label), ['checked' => (int) ($h[$k] ?? 0) === 1]);
    }
    $history = '<form method="post" class="mt-4 flex flex-col gap-5">' . csrf_field() . '<input type="hidden" name="op" value="anamneza">'
        . text_area('allergies', 'Alergii', ['value' => (string) ($h['allergies'] ?? ''), 'rows' => 2, 'optional' => true, 'hint' => 'De exemplu: penicilină, latex, anestezice.'])
        . text_area('medications', 'Medicamente luate acum', ['value' => (string) ($h['medications'] ?? ''), 'rows' => 2, 'optional' => true])
        . '<fieldset><legend class="mb-2 text-control font-medium">Afecțiuni</legend><div class="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">' . $flags . '</div></fieldset>'
        . text_area('other_conditions', 'Alte afecțiuni sau observații medicale', ['value' => (string) ($h['other_conditions'] ?? ''), 'rows' => 2, 'optional' => true])
        . '<div class="flex flex-wrap items-center gap-4"><button type="submit" class="' . e(btn('primary')) . '">Salvați anamneza</button>'
        . ($h && $h['reviewed_at'] ? '<span class="text-mic text-discret">Verificată ' . e(format_datetime($h['reviewed_at'])) . '</span>' : '<span class="text-mic text-mustar-text">Nu a fost completată încă.</span>') . '</div></form>';
} else {
    $history = '<div class="mt-3 flex flex-wrap gap-2">' . ($alerts !== [] ? alert_chips($alerts, 'text-corp') : '<p class="text-corp text-discret">Nicio alertă.</p>') . '</div><p class="mt-3 text-mic text-discret">Anamneza completă o văd și o completează medicii.</p>';
}

// Appointments.
$appts = db_all('SELECT * FROM appointments WHERE patient_id = ? ORDER BY starts_at DESC LIMIT 100', [$id]);
$apptRows = '';
foreach ($appts as $a) {
    $apptRows .= '<li class="flex flex-wrap items-center justify-between gap-3 border-t border-linie py-3 first:border-t-0">'
        . '<a href="/admin/programari/' . (int) $a['id'] . '" class="min-w-0"><span class="font-semibold text-link underline-offset-4 hover:underline cifre">' . e(short_day($a['starts_at']) . ' ' . substr($a['starts_at'], 0, 4) . ', ' . hm($a['starts_at'])) . '</span>'
        . '<span class="block text-mic text-discret">' . e(implode(' · ', array_filter([$names[(int) $a['location_id']] ?? '', $docs[(int) $a['doctor_id']] ?? '', $a['reason'] ?: service_title($a['category_slug'])]))) . '</span></a>'
        . appt_status_chip($a['status']) . '</li>';
}

// Recalls.
$recalls = db_all('SELECT * FROM recalls WHERE patient_id = ? ORDER BY due_date DESC', [$id]);
$recallRows = '';
foreach ($recalls as $r) {
    $recallRows .= '<li class="flex flex-wrap items-center justify-between gap-2 border-t border-linie py-2 first:border-t-0"><span><span class="font-semibold cifre">' . e(format_date($r['due_date'])) . '</span> · ' . e($r['reason']) . '</span><span class="text-mic">' . e(RECALL_STATUS[$r['status']] ?? $r['status']) . '</span></li>';
}

// Notes.
$notes = db_all('SELECT n.*, u.name AS author FROM patient_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.patient_id = ?' . ($clinical ? '' : ' AND n.clinical = 0') . ' ORDER BY n.created_at DESC', [$id]);
$noteRows = '';
foreach ($notes as $n) {
    $noteRows .= '<li class="border-t border-linie py-3 first:border-t-0"><p class="text-mic text-discret">' . e(format_datetime($n['created_at']) . ($n['author'] ? ' · ' . $n['author'] : '')) . ((int) $n['clinical'] === 1 ? ' · <span class="font-semibold text-actiune">clinică</span>' : '') . '</p><p class="mt-1 whitespace-pre-line text-corp">' . e($n['body']) . '</p></li>';
}

$age = $p['birth_date'] ? (new DateTimeImmutable($p['birth_date']))->diff(new DateTimeImmutable())->y : null;
$lead = 'Fișa nr. ' . (int) $p['file_number'] . ($age !== null ? " · {$age} ani" : '') . ($p['phone'] !== '' ? ' · ' . format_phone($p['phone']) : '');
$actions = '<a href="/admin/programari/noua?pacient=' . $id . '" class="' . e(btn('primary')) . '">' . icon('calendar-plus', 18) . 'Programare nouă</a>'
    . ($p['phone'] !== '' ? '<a href="' . e(tel_href($p['phone'])) . '" class="' . e(btn('secondary')) . '">' . icon('phone', 18) . 'Sunați</a>' : '');
$body = '<p class="mb-4"><a href="/admin/pacienti" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Pacienți</a></p>'
    . admin_header(patient_name($p), $lead, $actions)
    . (($alerts !== [] || comfort_chip($p['comfort'], (bool) $p['prefers_sedation']) !== '') ? '<div class="-mt-4 mb-8 flex flex-wrap gap-2">' . alert_chips($alerts, 'text-corp') . comfort_chip($p['comfort'], (bool) $p['prefers_sedation']) . '</div>' : '')
    . '<div class="grid gap-8 lg:grid-cols-12">'
    . '<div class="flex flex-col gap-8 lg:col-span-7">'
    . admin_section_open('Anamneza', 'anamneza', $clinical ? 'Bolile, alergiile și medicamentele. Alergiile și afecțiunile bifate apar ca alertă la fiecare programare.' : '') . $history . '</section>'
    . admin_section_open('Datele pacientului', 'date') . '<div class="mt-4">' . $personal . '</div></section>'
    . '</div>'
    . '<div class="flex flex-col gap-8 lg:col-span-5">'
    . admin_section_open('Programări', 'programari') . ($apptRows !== '' ? '<ul class="mt-2">' . $apptRows . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio programare.</p>') . '</section>'
    . admin_section_open('Rechemări', 'rechemari') . ($recallRows !== '' ? '<ul class="mt-2">' . $recallRows . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio rechemare.</p>')
    . '<form method="post" class="mt-4 grid grid-cols-2 gap-3">' . csrf_field() . '<input type="hidden" name="op" value="rechemare">'
    . text_field('due_date', 'Data', ['type' => 'date', 'value' => date('Y-m-d', strtotime('+6 months'))])
    . text_field('reason', 'Motivul', ['value' => 'Control'])
    . '<div class="col-span-2"><button type="submit" class="' . e(btn('secondary')) . '">Adăugați rechemarea</button></div></form></section>'
    . admin_section_open('Note', 'note') . ($noteRows !== '' ? '<ul class="mt-2">' . $noteRows . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio notă.</p>')
    . '<form method="post" class="mt-4 flex flex-col gap-3">' . csrf_field() . '<input type="hidden" name="op" value="nota">'
    . text_area('body', 'Notă nouă', ['rows' => 3])
    . ($clinical ? checkbox_field('clinical', 'Notă clinică (o văd doar medicii și administratorii)', ['checked' => true]) : '')
    . '<div><button type="submit" class="' . e(btn('secondary')) . '">Adăugați nota</button></div></form></section>'
    . (is_admin($user) ? '<form method="post" data-confirma="Scoateți fișa din liste?">' . csrf_field() . '<input type="hidden" name="op" value="dezactiveaza"><button type="submit" class="' . e(btn('text', 's')) . '">' . icon('eye-off', 16) . 'Scoateți fișa din liste</button></form>' : '')
    . '</div></div>';
admin_page(patient_name($p), $body, $user);
