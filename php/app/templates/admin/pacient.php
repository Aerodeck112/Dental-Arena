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
    'phone_channel' => (string) ($p['phone_channel'] ?? 'sms'),
    'marketing_sms' => (string) ($p['marketing_sms'] ?? 0),
    'marketing_whatsapp' => (string) ($p['marketing_whatsapp'] ?? 0),
    'marketing_email' => (string) ($p['marketing_email'] ?? 0),
    'street' => $p['street'] ?? '',
    'city' => $p['city'] ?? '',
    'county' => $p['county'] ?? 'Mureș',
    'guardian_name' => $p['guardian_name'] ?? '',
    'guardian_file' => $p && $p['guardian_patient_id'] ? (string) db_value('SELECT file_number FROM patients WHERE id = ?', [(int) $p['guardian_patient_id']]) : '',
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
        audit('anamneza', "pacient #{$id}", null, $id);
        flash('Anamneza a fost salvată.');
        redirect("/admin/pacienti/{$id}#anamneza");
    }
    if (in_array($op, ['chestionar-aplica', 'chestionar-respinge'], true) && $id && $clinical) {
        $f = db_one("SELECT * FROM patient_forms WHERE id = ? AND patient_id = ? AND status = 'nou'", [(int) post('id'), $id]);
        if ($f) {
            if ($op === 'chestionar-aplica') {
                apply_history_form($id, json_decode($f['data'], true) ?: [], $user);
            }
            db_update('patient_forms', ['status' => $op === 'chestionar-aplica' ? 'aplicat' : 'respins', 'reviewed_by' => $user['id'], 'reviewed_at' => now_sql()], 'id = :id', ['id' => $f['id']]);
            audit($op === 'chestionar-aplica' ? 'chestionar-aplicat' : 'chestionar-respins', '', null, $id);
            flash($op === 'chestionar-aplica' ? 'Răspunsurile au fost trecute în anamneză. Verificați-le mai jos.' : 'Chestionarul a fost pus deoparte.');
        }
        redirect("/admin/pacienti/{$id}#anamneza");
    }
    if ($op === 'eticheta' && $id) {
        $name = mb_substr(trim(post('eticheta')), 0, 40);
        if ($name !== '') {
            $tid = (int) (db_value('SELECT id FROM tags WHERE name = ?', [$name]) ?: db_insert('tags', ['name' => $name, 'color' => TAG_COLORS[crc32(fold_text($name)) % count(TAG_COLORS)], 'created_at' => now_sql()]));
            db_run('INSERT IGNORE INTO patient_tags (patient_id, tag_id) VALUES (?, ?)', [$id, $tid]);
            audit('eticheta', "„{$name}” pusă", null, $id);
        }
        redirect("/admin/pacienti/{$id}#etichete");
    }
    if ($op === 'eticheta-scoate' && $id) {
        db_run('DELETE FROM patient_tags WHERE patient_id = ? AND tag_id = ?', [$id, (int) post('tag')]);
        audit('eticheta', 'scoasă', null, $id);
        redirect("/admin/pacienti/{$id}#etichete");
    }
    if (in_array($op, ['nota-fixeaza', 'nota-editeaza', 'nota-sterge'], true) && $id) {
        $n = db_one('SELECT * FROM patient_notes WHERE id = ? AND patient_id = ?', [(int) post('nota'), $id]);
        $mine = $n !== null && ((int) $n['author_id'] === (int) $user['id'] || is_admin($user));
        if ($n !== null && ((int) $n['clinical'] === 0 || $clinical)) {
            if ($op === 'nota-fixeaza') {
                db_update('patient_notes', ['pinned' => (int) $n['pinned'] === 1 ? 0 : 1], 'id = :id', ['id' => $n['id']]);
            } elseif ($op === 'nota-editeaza' && $mine && trim(post('body')) !== '') {
                db_update('patient_notes', ['body' => mb_substr(trim(post('body')), 0, 4000), 'updated_at' => now_sql()], 'id = :id', ['id' => $n['id']]);
                audit('nota-modificata', "#{$n['id']}", null, $id);
                flash('Nota a fost modificată.');
            } elseif ($op === 'nota-sterge' && $mine) {
                db_run('DELETE FROM patient_notes WHERE id = ?', [$n['id']]);
                audit('nota-stearsa', "#{$n['id']}: " . mb_strimwidth($n['body'], 0, 120, '…'), null, $id);
                flash('Nota a fost ștearsă.');
            }
        }
        redirect("/admin/pacienti/{$id}#note");
    }
    if ($op === 'cnp-arata' && $id && $cnpPlain !== null) {
        // Seeing the whole CNP is written in the access log.
        session_begin();
        $_SESSION['cnp_vazut'][$id] = time();
        audit('cnp-vazut', 'CNP afișat întreg', null, $id);
        redirect("/admin/pacienti/{$id}#date");
    }
    if ($op === 'implant-nou' && $id && $clinical) {
        $teeth = mb_substr(trim(post('teeth')), 0, 40);
        if ($teeth !== '') {
            $cid = db_insert('implant_cases', ['patient_id' => $id, 'doctor_id' => admin_int(post('doctor')) ?? $p['primary_doctor_id'], 'teeth' => $teeth, 'system_name' => mb_substr(post('system_name'), 0, 80) ?: null, 'stage' => 'planificat', 'stage_dates' => json_encode(['planificat' => date('Y-m-d')]), 'notes' => mb_substr(post('notes_implant'), 0, 2000) ?: null, 'created_by' => $user['id'], 'created_at' => now_sql(), 'updated_at' => now_sql()]);
            audit('implant-nou', "#{$cid} ({$teeth})", null, $id);
            flash('Cazul de implant a fost adăugat.');
        }
        redirect("/admin/pacienti/{$id}#implanturi");
    }
    if ($op === 'implant-etapa' && $id && $clinical) {
        $case = db_one('SELECT * FROM implant_cases WHERE id = ? AND patient_id = ?', [(int) post('caz'), $id]);
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', post('data')) ? post('data') : date('Y-m-d');
        if ($case && isset(IMPLANT_STAGES[post('stage')])) {
            implant_set_stage($case, post('stage'), $date, $user);
            flash('Etapa a fost notată: ' . mb_strtolower(IMPLANT_STAGES[post('stage')][0]) . '.');
        }
        redirect("/admin/pacienti/{$id}#implanturi");
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
        audit('pacient-dezactivat', "#{$id}", null, $id);
        flash('Fișa a fost scoasă din liste. Datele rămân în baza de date.');
        redirect('/admin/pacienti');
    }
    // Personal data (new file or edit).
    foreach (array_keys($v) as $k) {
        $v[$k] = post($k);
    }
    $v['email_reminders'] = post('email_reminders') === '1' ? '1' : '0';
    $v['phone_channel'] = isset(PHONE_CHANNELS[post('phone_channel')]) ? post('phone_channel') : 'sms';
    foreach (['marketing_sms', 'marketing_whatsapp', 'marketing_email'] as $k) {
        $v[$k] = post($k) === '1' ? '1' : '0';
    }
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
    // The guardian as a patient too: by the number of their file.
    $guardianId = null;
    if ($v['guardian_file'] !== '') {
        $g = ctype_digit($v['guardian_file']) ? db_one('SELECT id, first_name, last_name FROM patients WHERE file_number = ? AND active = 1', [(int) $v['guardian_file']]) : null;
        if ($g === null || (int) $g['id'] === $id) {
            $errors['guardian_file'] = 'Nu există o altă fișă cu acest număr.';
        } else {
            $guardianId = (int) $g['id'];
            if ($v['guardian_name'] === '') {
                $v['guardian_name'] = patient_name($g);
            }
        }
    }
    // A new file: is it someone already in the files? Reception confirms it is another person.
    $dupes = [];
    if ($isNew && $errors === [] && post('altul') !== '1') {
        $dupes = possible_duplicates(['phone' => $v['phone'], 'email' => $v['email'], 'cnp' => $cnp, 'last_name' => $v['last_name'], 'first_name' => $v['first_name'], 'birth_date' => $v['birth_date']]);
        if ($dupes !== []) {
            $errors['dubluri'] = 'Poate că pacientul are deja o fișă. Verificați lista; dacă e altă persoană, bifați „Este altă persoană” și creați fișa.';
        }
    }
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
            'phone_channel' => $v['phone_channel'],
            'marketing_sms' => (int) $v['marketing_sms'],
            'marketing_whatsapp' => (int) $v['marketing_whatsapp'],
            'marketing_email' => (int) $v['marketing_email'],
            'street' => mb_substr($v['street'], 0, 190) ?: null,
            'city' => mb_substr($v['city'], 0, 80) ?: null,
            'county' => mb_substr($v['county'], 0, 80) ?: null,
            'guardian_name' => mb_substr($v['guardian_name'], 0, 160) ?: null,
            'guardian_patient_id' => $guardianId,
            'preferred_location_id' => $loc !== null && isset($names[$loc]) ? $loc : null,
            'primary_doctor_id' => $doc !== null && isset(doctor_short_names()[$doc]) ? $doc : null,
            'comfort' => isset(COMFORT_LABELS[$v['comfort']]) ? $v['comfort'] : null,
            'prefers_sedation' => (int) $v['prefers_sedation'],
            'notes' => mb_substr($v['notes'], 0, 4000) ?: null,
            'updated_at' => now_sql(),
        ];
        // A consent newly given is dated, with who recorded it.
        $hadConsent = $p !== null && ((int) $p['marketing_sms'] + (int) $p['marketing_whatsapp'] + (int) $p['marketing_email']) > 0;
        if (!$hadConsent && ($row['marketing_sms'] + $row['marketing_whatsapp'] + $row['marketing_email']) > 0) {
            $row['marketing_consent_at'] = now_sql();
            $row['marketing_consent_source'] = mb_substr('în clinică, notat de ' . $user['name'], 0, 60);
        }
        if ($cnp !== '') {
            $row['cnp_enc'] = cnp_encrypt($cnp);
            $row['cnp_hash'] = cnp_hash($cnp);
        }
        $row['search_text'] = patient_search_text($row);
        if ($isNew) {
            $id = db_insert('patients', $row + ['file_number' => next_file_number(), 'created_by' => $user['id'], 'created_at' => now_sql()]);
            audit('pacient-nou', "#{$id}", null, $id);
            flash('Fișa a fost creată.');
        } else {
            db_update('patients', $row, 'id = :id', ['id' => $id]);
            audit('pacient', "#{$id}", null, $id);
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
// Others with the same phone (a parent, a child): for the guardian's file number.
$samePhone = '';
if ($v['phone'] !== '' && ($nat = national_digits($v['phone'])) !== null) {
    $same = array_filter(possible_duplicates(['phone' => $v['phone']], $p ? (int) $p['id'] : null), static fn ($d) => $d['why'] === 'același telefon');
    $samePhone = implode(', ', array_map(static fn ($d) => patient_name($d) . ' (fișa ' . (int) $d['file_number'] . ')', $same));
}
$dupePanel = '';
if (!empty($dupes)) {
    $dupePanel = '<div id="field-dubluri" tabindex="-1" class="rounded-panou border-2 border-mustar bg-mustar-pal p-4"><p class="font-semibold">Poate este deja pacient:</p><ul class="mt-2 flex flex-col gap-2">'
        . implode('', array_map(static fn ($d) => '<li class="flex flex-wrap items-center justify-between gap-2"><span><a class="font-semibold text-link underline" href="/admin/pacienti/' . (int) $d['id'] . '">' . e(patient_name($d)) . '</a> <span class="text-mic text-discret">fișa nr. ' . (int) $d['file_number'] . ($d['phone'] !== '' ? ' · ' . e(format_phone($d['phone'])) : '') . ($d['birth_date'] ? ' · ' . e(format_date($d['birth_date'])) : '') . ' · ' . e($d['why']) . '</span></span><a class="' . e(btn('secondary', 's')) . '" href="/admin/pacienti/' . (int) $d['id'] . '">Deschideți fișa</a></li>', $dupes))
        . '</ul>' . checkbox_field('altul', 'Este altă persoană: creați fișa nouă', ['class' => 'mt-3']) . '</div>';
}
$cnpSeen = $p && $cnpPlain !== null && (($_SESSION['cnp_vazut'][(int) $p['id']] ?? 0) > time() - 120);
$personal = '<form method="post" novalidate class="flex flex-col gap-5">' . csrf_field() . '<input type="hidden" name="op" value="date">'
    . error_summary($errors)
    . $dupePanel
    . '<div class="grid gap-5 md:grid-cols-2">'
    . text_field('last_name', 'Numele de familie', ['value' => $v['last_name'], 'required' => true, 'error' => $err('last_name'), 'autocomplete' => 'off'])
    . text_field('first_name', 'Prenumele', ['value' => $v['first_name'], 'required' => true, 'error' => $err('first_name'), 'autocomplete' => 'off'])
    . text_field('cnp', 'CNP', ['value' => $v['cnp'], 'optional' => true, 'inputmode' => 'numeric', 'maxlength' => 13, 'error' => $err('cnp'), 'autocomplete' => 'off',
        'hint' => $cnpPlain ? 'Salvat: ' . ($cnpSeen ? $cnpPlain : cnp_masked($cnpPlain)) . '. Scrieți altul doar ca să-l schimbați.' : 'Se păstrează criptat. Din el completăm data nașterii și sexul.'])
    . text_field('birth_date', 'Data nașterii', ['type' => 'date', 'value' => $v['birth_date'], 'optional' => true, 'error' => $err('birth_date')])
    . text_field('phone', 'Telefon', ['type' => 'tel', 'value' => $v['phone'], 'error' => $err('phone')])
    . text_field('email', 'E-mail', ['type' => 'email', 'value' => $v['email'], 'optional' => true, 'error' => $err('email')])
    . '</div>'
    . radio_group('sex', 'Sexul', ['' => 'Nespecificat', 'F' => 'Feminin', 'M' => 'Masculin'], ['inline' => true, 'value' => $v['sex']])
    . '<fieldset class="flex flex-col gap-2 rounded-panou border border-linie p-4"><legend class="px-1 text-control font-medium">Mesaje</legend>'
    . radio_group('phone_channel', 'Notificările pe telefon (programări, reamintiri)', PHONE_CHANNELS, ['inline' => true, 'value' => $v['phone_channel']])
    . checkbox_field('email_reminders', 'Primește notificările și pe e-mail', ['checked' => $v['email_reminders'] === '1'])
    . '<p class="mt-2 text-control font-medium">Oferte și noutăți (doar cu acordul pacientului)</p>'
    . '<div class="flex flex-wrap gap-x-6">'
    . checkbox_field('marketing_sms', 'SMS', ['checked' => $v['marketing_sms'] === '1'])
    . checkbox_field('marketing_whatsapp', 'WhatsApp', ['checked' => $v['marketing_whatsapp'] === '1'])
    . checkbox_field('marketing_email', 'E-mail', ['checked' => $v['marketing_email'] === '1'])
    . '</div>'
    . (($p['marketing_consent_at'] ?? null) ? '<p class="text-mic text-discret">Acord dat ' . e(format_datetime($p['marketing_consent_at'])) . ($p['marketing_consent_source'] ? ', ' . e($p['marketing_consent_source']) : '') . '.</p>' : '<p class="text-mic text-discret">Bifați doar dacă pacientul a spus că dorește. Se notează data.</p>')
    . '</fieldset>'
    . '<div class="grid gap-5 md:grid-cols-3">'
    . text_field('street', 'Adresa', ['value' => $v['street'], 'optional' => true])
    . text_field('city', 'Localitatea', ['value' => $v['city'], 'optional' => true])
    . text_field('county', 'Județul', ['value' => $v['county'], 'optional' => true])
    . '</div><div class="grid gap-5 md:grid-cols-3">'
    . '<div class="flex flex-col gap-3">' . text_field('guardian_name', 'Părinte / tutore', ['value' => $v['guardian_name'], 'optional' => true, 'hint' => 'Pentru copii.'])
    . text_field('guardian_file', 'Nr. fișei tutorelui', ['value' => $v['guardian_file'], 'optional' => true, 'inputmode' => 'numeric', 'error' => $err('guardian_file'), 'hint' => $samePhone !== '' ? 'Același telefon: ' . $samePhone : 'Dacă tutorele e și el pacient.']) . '</div>'
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

// The questionnaire the patient filled in on the tablet, until a doctor checks it.
$forms = db_all("SELECT * FROM patient_forms WHERE patient_id = ? AND kind = 'anamneza' AND status = 'nou' ORDER BY id DESC", [$id]);
$formNote = '';
foreach ($forms as $f) {
    $lines = $clinical ? '<ul class="mt-2 flex flex-col gap-1 text-corp">' . implode('', array_map(static fn ($l) => '<li>' . e($l) . '</li>', history_form_lines(json_decode($f['data'], true) ?: []))) . '</ul>' : '';
    $buttons = $clinical ? '<div class="mt-3 flex flex-wrap gap-2"><form method="post">' . csrf_field() . '<input type="hidden" name="op" value="chestionar-aplica"><input type="hidden" name="id" value="' . (int) $f['id'] . '"><button type="submit" class="' . e(btn('primary', 's')) . '">' . icon('check', 16) . 'Treceți în anamneză</button></form>'
        . '<form method="post" data-confirma="Puneți deoparte chestionarul, fără să-l treceți în fișă?">' . csrf_field() . '<input type="hidden" name="op" value="chestionar-respinge"><input type="hidden" name="id" value="' . (int) $f['id'] . '"><button type="submit" class="' . e(btn('text', 's')) . '">Puneți deoparte</button></form></div>'
        : '<p class="mt-1 text-mic text-discret">Îl verifică medicul înainte de tratament.</p>';
    $formNote .= '<div class="mt-4 rounded-panou border-2 border-mustar bg-mustar-pal p-4"><p class="flex items-center gap-2 font-semibold">' . admin_icon('tablet', 18) . 'Chestionar completat de pacient pe tabletă, ' . e(format_datetime($f['created_at'])) . '</p>' . $lines . $buttons . '</div>';
}
$history = $formNote . $history;

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

// Notes: the pinned ones first; the author (or an administrator) can change or delete theirs.
$notes = db_all('SELECT n.*, u.name AS author FROM patient_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.patient_id = ?' . ($clinical ? '' : ' AND n.clinical = 0') . ' ORDER BY n.pinned DESC, n.created_at DESC', [$id]);
$noteRows = '';
foreach ($notes as $n) {
    $nid = (int) $n['id'];
    $mine = (int) $n['author_id'] === (int) $user['id'] || is_admin($user);
    $f = static fn (string $op, string $inner, string $extra = '') => '<form method="post"' . $extra . '>' . csrf_field() . '<input type="hidden" name="op" value="' . $op . '"><input type="hidden" name="nota" value="' . $nid . '">' . $inner . '</form>';
    $noteRows .= '<li class="' . e(cn('border-t border-linie py-3 first:border-t-0', (int) $n['pinned'] === 1 ? '-mx-3 rounded-panou border-t-0 bg-mustar-pal px-3' : '')) . '">'
        . '<div class="flex flex-wrap items-start justify-between gap-2"><p class="text-mic text-discret">' . ((int) $n['pinned'] === 1 ? '<span class="font-semibold text-mustar-text">Fixată · </span>' : '') . e(format_datetime($n['created_at']) . ($n['author'] ? ' · ' . $n['author'] : '')) . ($n['updated_at'] ? ' · modificată' : '') . ((int) $n['clinical'] === 1 ? ' · <span class="font-semibold text-actiune">clinică</span>' : '') . '</p>'
        . '<div class="flex items-center gap-1">' . $f('nota-fixeaza', '<button type="submit" class="' . e(btn('text', 's', 'px-2')) . '" aria-label="' . ((int) $n['pinned'] === 1 ? 'Desprindeți nota' : 'Fixați nota sus') . '" title="' . ((int) $n['pinned'] === 1 ? 'Desprindeți' : 'Fixați sus') . '">' . admin_icon('pin', 16) . '</button>')
        . ($mine ? $f('nota-sterge', '<button type="submit" class="' . e(btn('text', 's', 'px-2')) . '" aria-label="Ștergeți nota">' . icon('trash-2', 16) . '</button>', ' data-confirma="Ștergeți nota?"') : '') . '</div></div>'
        . '<p class="mt-1 whitespace-pre-line text-corp">' . e($n['body']) . '</p>'
        . ($mine ? '<details class="mt-1"><summary class="cursor-pointer text-mic text-link underline">Modificați</summary>' . $f('nota-editeaza', text_area('body', 'Textul notei', ['id' => "field-nota-{$nid}", 'value' => $n['body'], 'rows' => 3]) . '<div class="mt-2"><button type="submit" class="' . e(btn('secondary', 's')) . '">Salvați nota</button></div>', ' class="mt-2"') . '</details>' : '')
        . '</li>';
}

// Tags.
$tags = db_all('SELECT t.* FROM tags t JOIN patient_tags pt ON pt.tag_id = t.id WHERE pt.patient_id = ? ORDER BY t.name', [$id]);
$allTags = array_column(db_all('SELECT name FROM tags ORDER BY name'), 'name');
$tagChips = implode('', array_map(static fn ($t) => '<form method="post" class="inline-flex">' . csrf_field() . '<input type="hidden" name="op" value="eticheta-scoate"><input type="hidden" name="tag" value="' . (int) $t['id'] . '">'
    . '<span class="' . e(cn('inline-flex items-center gap-1 rounded-chip py-0.5 pl-2.5 pr-1 text-mic font-medium', TAG_CLASSES[$t['color']] ?? TAG_CLASSES['menta'])) . '">' . e($t['name']) . '<button type="submit" class="rounded-full p-0.5 hover:bg-black/10" aria-label="Scoateți eticheta ' . e($t['name']) . '">' . icon('x', 12) . '</button></span></form>', $tags));
$tagSection = admin_section_open('Etichete', 'etichete', 'De exemplu „VIP”, „Ortodonție în curs”, „Plătește la sfârșit”. În lista de pacienți se poate filtra după ele.')
    . '<div class="mt-3 flex flex-wrap gap-2">' . ($tagChips !== '' ? $tagChips : '<span class="text-mic text-discret">Nicio etichetă.</span>') . '</div>'
    . '<form method="post" class="mt-3 flex gap-2">' . csrf_field() . '<input type="hidden" name="op" value="eticheta">'
    . '<label for="field-eticheta" class="sr-only">Etichetă nouă</label><input id="field-eticheta" name="eticheta" list="etichete-existente" maxlength="40" placeholder="Etichetă" class="' . e(input_classes('h-control-s')) . '">'
    . '<datalist id="etichete-existente">' . implode('', array_map(static fn ($n) => '<option value="' . e($n) . '">', $allTags)) . '</datalist>'
    . '<button type="submit" class="' . e(btn('secondary', 's')) . '">Adăugați</button></form></section>';

// Implant cases, step by step (doctors and administrators).
$implantSection = '';
if ($clinical) {
    $cases = '';
    $stageKeys = array_keys(IMPLANT_STAGES);
    foreach (implant_cases($id) as $c) {
        $dates = json_decode((string) $c['stage_dates'], true) ?: [];
        $pos = (int) array_search($c['stage'], $stageKeys, true);
        $steps = '';
        foreach (IMPLANT_STAGES as $k => [$label]) {
            $i = (int) array_search($k, $stageKeys, true);
            $steps .= '<li class="' . e(cn('rounded-chip px-2 py-0.5 text-mic', $i < $pos ? 'bg-menta-pal text-cerneala' : ($i === $pos ? 'bg-actiune font-semibold text-pe-actiune' : 'border border-linie text-discret'))) . '">' . e($label) . (isset($dates[$k]) ? ' · ' . e(date('d.m.Y', strtotime($dates[$k]))) : '') . '</li>';
        }
        $next = $stageKeys[min($pos + 1, count($stageKeys) - 1)];
        $options = '';
        foreach (IMPLANT_STAGES as $k => [$label]) {
            $options .= '<option value="' . $k . '"' . ($k === $next ? ' selected' : '') . '>' . e($label) . '</option>';
        }
        $overdue = $c['next_due'] && $c['next_due'] < date('Y-m-d') && $c['stage'] !== 'incheiat';
        $cases .= '<li class="border-t border-linie py-4 first:border-t-0"><p class="font-semibold">Dinții ' . e($c['teeth']) . ($c['system_name'] ? ' · ' . e($c['system_name']) : '') . ($c['doctor_id'] ? ' · ' . e(doctor_short_names()[(int) $c['doctor_id']] ?? '') : '') . '</p>'
            . ($c['next_due'] ? '<p class="' . e(cn('text-mic', $overdue ? 'font-semibold text-carmin' : 'text-discret')) . '">Pasul următor: ' . e(format_date($c['next_due'])) . ($overdue ? ' (a trecut)' : '') . '</p>' : '')
            . '<ol class="mt-2 flex flex-wrap gap-1.5">' . $steps . '</ol>'
            . ($c['notes'] ? '<p class="mt-2 whitespace-pre-line text-mic">' . e($c['notes']) . '</p>' : '')
            . ($c['stage'] !== 'incheiat' ? '<form method="post" class="mt-3 flex flex-wrap items-end gap-2">' . csrf_field() . '<input type="hidden" name="op" value="implant-etapa"><input type="hidden" name="caz" value="' . (int) $c['id'] . '">'
                . '<label class="flex flex-col gap-1 text-mic">Etapa<select name="stage" class="' . e(input_classes('h-control-s w-auto')) . '">' . $options . '</select></label>'
                . '<label class="flex flex-col gap-1 text-mic">Data<input type="date" name="data" value="' . date('Y-m-d') . '" class="' . e(input_classes('h-control-s w-auto')) . '"></label>'
                . '<button type="submit" class="' . e(btn('secondary', 's')) . '">Notați etapa</button></form>' : '')
            . '</li>';
    }
    $implantSection = admin_section_open('Implanturi', 'implanturi', 'Etapele fiecărui caz, de la plan la lucrarea finală și controalele anuale. Toate cazurile în curs sunt la Implanturi, în meniu.')
        . ($cases !== '' ? '<ul class="mt-2">' . $cases . '</ul>' : '<p class="mt-3 text-corp text-discret">Niciun caz de implant.</p>')
        . '<details class="mt-4"><summary class="cursor-pointer font-medium text-link underline">Caz nou</summary><form method="post" class="mt-3 grid gap-4 sm:grid-cols-2">' . csrf_field() . '<input type="hidden" name="op" value="implant-nou">'
        . text_field('teeth', 'Dinții (FDI)', ['id' => 'field-implant-teeth', 'required' => true, 'maxlength' => 40, 'hint' => 'De exemplu 36 sau 36, 46'])
        . text_field('system_name', 'Sistemul de implant', ['optional' => true, 'maxlength' => 80, 'hint' => 'De exemplu Neodent'])
        . select_field('doctor', 'Medicul', ['' => 'Medicul curant'] + array_map('strval', doctor_short_names()), ['id' => 'field-implant-doctor'])
        . text_area('notes_implant', 'Observații', ['optional' => true, 'rows' => 2])
        . '<div class="sm:col-span-2"><button type="submit" class="' . e(btn('secondary')) . '">Adăugați cazul</button></div></form></details></section>';
}

// The guardian and the people in the patient's care.
$family = '';
if ($p['guardian_patient_id']) {
    $g = db_one('SELECT id, first_name, last_name, file_number FROM patients WHERE id = ?', [(int) $p['guardian_patient_id']]);
    if ($g) {
        $family .= '<p>Tutore: <a class="font-semibold text-link underline" href="/admin/pacienti/' . (int) $g['id'] . '">' . e(patient_name($g)) . '</a> <span class="text-mic text-discret">fișa ' . (int) $g['file_number'] . '</span></p>';
    }
}
$wards = db_all('SELECT id, first_name, last_name, file_number, birth_date FROM patients WHERE guardian_patient_id = ? AND active = 1 ORDER BY birth_date DESC', [$id]);
if ($wards !== []) {
    $family .= '<p>În grija sa: ' . implode(', ', array_map(static fn ($w) => '<a class="font-semibold text-link underline" href="/admin/pacienti/' . (int) $w['id'] . '">' . e(patient_name($w)) . '</a>', $wards)) . '</p>';
}
$familyNote = $family !== '' ? '<div class="mb-6 flex flex-col gap-1 rounded-panou border border-linie bg-suprafata p-4 text-corp">' . $family . '</div>' : '';

log_file_view($id);
$balance = can('billing', $user) ? patient_balance($id) : null;
$balanceNote = $balance !== null && $balance['balance'] !== 0
    ? '<a href="/admin/pacienti/' . $id . '/financiar" class="' . e(cn('mb-6 flex items-center gap-3 rounded-panou p-4 text-corp', $balance['balance'] > 0 ? 'border border-carmin bg-carmin-pal' : 'bg-menta-pal')) . '">' . icon('wallet', 20)
        . ($balance['balance'] > 0 ? 'Rest de plată: <strong class="cifre">' . e(lei($balance['balance'])) . '</strong>' : 'Avans în cont: <strong class="cifre">' . e(lei(-$balance['balance'])) . '</strong>') . '<span class="ml-auto text-link underline">Facturi și plăți</span></a>'
    : '';
$body = patient_header($p, $user, '', can('medical', $user) && $p['anonymized_at'] === null ? '<a href="/admin/pacienti/' . $id . '/consultatie-ai" class="' . e(btn('secondary')) . '">' . admin_icon('sparkles', 18) . 'Consultație cu AI</a>' : '')
    . $balanceNote . $familyNote
    . '<div class="grid gap-8 lg:grid-cols-12">'
    . '<div class="flex flex-col gap-8 lg:col-span-7">'
    . admin_section_open('Anamneza', 'anamneza', $clinical ? 'Bolile, alergiile și medicamentele. Alergiile și afecțiunile bifate apar ca alertă la fiecare programare.' : '') . $history . '</section>'
    . admin_section_open('Datele pacientului', 'date') . '<div class="mt-4">' . $personal . '</div>'
    . ($cnpPlain !== null && !$cnpSeen ? '<form method="post" class="mt-3">' . csrf_field() . '<input type="hidden" name="op" value="cnp-arata"><button type="submit" class="' . e(btn('text', 's')) . '">' . icon('eye', 16) . 'Arătați CNP-ul întreg</button><span class="text-mic text-discret"> Se trece în jurnal.</span></form>' : '')
    . '</section>'
    . $implantSection
    . '</div>'
    . '<div class="flex flex-col gap-8 lg:col-span-5">'
    . $tagSection
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
