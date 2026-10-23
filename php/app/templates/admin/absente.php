<?php
/**
 * /admin/absente: the doctors' leave, training and blocked hours, and the days a clinic is closed.
 * They take the hours off online booking and the chat at once, are shaded in the calendar and
 * stop an appointment from being made over them. Administrators and reception manage everyone;
 * a doctor manages only their own (and never a clinic closure). Legal holidays are known already.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$isDoctor = $user['role'] === 'medic';
$myDoctor = $user['doctor_id'] ? (int) $user['doctor_id'] : null;
if ($isDoctor && $myDoctor === null) {
    admin_page('Absențe și zile libere', admin_header('Absențe și zile libere') . '<p class="text-corp">Contul nu e legat de un medic din echipă; administratorul îl leagă din Utilizatori.</p>', $user);
    exit;
}
$doctorOptions = ['' => 'Alegeți medicul'];
foreach (db_all('SELECT id, public_name FROM doctors ORDER BY sort_order, last_name') as $d) {
    if (!$isDoctor || (int) $d['id'] === $myDoctor) {
        $doctorOptions[(string) $d['id']] = $d['public_name'];
    }
}
$errors = [];
$affected = [];
$v = ['cine' => $isDoctor ? 'medic' : (post('cine') ?: 'medic'), 'doctor' => $isDoctor ? (string) $myDoctor : post('doctor'), 'location' => post('location'), 'kind' => post('kind') ?: 'concediu', 'from' => post('from') ?: date('Y-m-d'), 'to' => post('to'), 'start' => post('start'), 'end' => post('end'), 'reason' => post('reason')];

if (is_post()) {
    csrf_check();
    if (post('op') === 'sterge') {
        $t = db_one('SELECT * FROM time_off WHERE id = ?', [(int) post('id')]);
        if ($t && (!$isDoctor || (int) $t['doctor_id'] === $myDoctor)) {
            db_run('DELETE FROM time_off WHERE id = ?', [$t['id']]);
            audit('absenta-stearsa', time_off_label($t));
            flash('Absența a fost ștearsă. Orele sunt din nou libere pentru programări.');
        }
        redirect('/admin/absente');
    }
    if ($v['cine'] === 'clinica' && $isDoctor) {
        $v['cine'] = 'medic';
    }
    $doctor = $v['cine'] === 'medic' ? admin_int($v['doctor']) : null;
    if ($v['cine'] === 'medic' && ($doctor === null || !isset($doctorOptions[(string) $doctor]))) {
        $errors['doctor'] = 'Alegeți medicul.';
    }
    $loc = admin_int($v['location']);
    if ($loc !== null && !isset($names[$loc])) {
        $loc = null;
    }
    if ($v['cine'] === 'clinica' && $loc === null) {
        $errors['location'] = 'Alegeți clinica închisă.';
    }
    if (!isset(TIME_OFF_KINDS[$v['kind']])) {
        $v['kind'] = 'concediu';
    }
    $from = DateTimeImmutable::createFromFormat('!Y-m-d', $v['from']);
    $to = $v['to'] !== '' ? DateTimeImmutable::createFromFormat('!Y-m-d', $v['to']) : $from;
    if ($from === false || $to === false || $to < $from) {
        $errors['from'] = 'Alegeți ziua de început și, dacă e mai mult de o zi, ziua de sfârșit (după prima).';
    }
    $partial = $v['start'] !== '' || $v['end'] !== '';
    if ($partial && (!preg_match('/^\d{2}:\d{2}$/', $v['start']) || !preg_match('/^\d{2}:\d{2}$/', $v['end']) || $v['start'] >= $v['end'])) {
        $errors['start'] = 'Pentru o parte din zi, scrieți ora de început și de sfârșit; altfel lăsați-le goale (toată ziua).';
    }
    if ($errors === []) {
        $startsAt = $from->format('Y-m-d') . ' ' . ($partial ? $v['start'] : '00:00') . ':00';
        $endsAt = $partial ? $to->format('Y-m-d') . ' ' . $v['end'] . ':00' : $to->modify('+1 day')->format('Y-m-d') . ' 00:00:00';
        $id = db_insert('time_off', ['doctor_id' => $doctor, 'location_id' => $loc, 'kind' => $v['cine'] === 'clinica' && $v['kind'] === 'concediu' ? 'sarbatoare' : $v['kind'], 'starts_at' => $startsAt, 'ends_at' => $endsAt, 'reason' => mb_substr(trim($v['reason']), 0, 200) ?: null, 'created_by' => $user['id'], 'created_at' => now_sql()]);
        $t = db_one('SELECT * FROM time_off WHERE id = ?', [$id]);
        audit('absenta', time_off_label($t));
        // The appointments already booked in this time: the clinic moves them.
        $in = "'" . implode("','", APPT_ACTIVE) . "'";
        $sql = "SELECT a.*, p.first_name, p.last_name, p.phone FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.status IN ({$in}) AND a.starts_at < ? AND a.ends_at > ?";
        $params = [$endsAt, $startsAt];
        if ($doctor !== null) {
            $sql .= ' AND a.doctor_id = ?';
            $params[] = $doctor;
        }
        if ($loc !== null) {
            $sql .= ' AND a.location_id = ?';
            $params[] = $loc;
        }
        $n = count(db_all($sql, $params));
        flash($n > 0 ? "Absența a fost salvată. Atenție: {$n} " . ($n === 1 ? 'programare este în acest interval; mutați-o' : 'programări sunt în acest interval; mutați-le') . ' din lista de mai jos.' : 'Absența a fost salvată. Orele nu mai apar la programările online.', $n > 0 ? 'info' : 'ok');
        redirect('/admin/absente?verifica=' . $id);
    }
}

// The appointments hit by the time off just saved.
if (($check = admin_int(query('verifica'))) !== null && ($t = db_one('SELECT * FROM time_off WHERE id = ?', [$check])) !== null) {
    $in = "'" . implode("','", APPT_ACTIVE) . "'";
    $sql = "SELECT a.*, p.first_name, p.last_name, p.phone FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.status IN ({$in}) AND a.starts_at < ? AND a.ends_at > ?";
    $params = [$t['ends_at'], $t['starts_at']];
    if ($t['doctor_id'] !== null) {
        $sql .= ' AND a.doctor_id = ?';
        $params[] = (int) $t['doctor_id'];
    }
    if ($t['location_id'] !== null) {
        $sql .= ' AND a.location_id = ?';
        $params[] = (int) $t['location_id'];
    }
    $affected = db_all($sql . ' ORDER BY a.starts_at', $params);
}

$where = $isDoctor ? ' AND t.doctor_id = ' . $myDoctor : '';
$rows = db_all("SELECT t.* FROM time_off t WHERE t.ends_at > ?{$where} ORDER BY t.starts_at", [date('Y-m-d 00:00:00')]);
$list = '';
foreach ($rows as $t) {
    $canDelete = !$isDoctor || (int) $t['doctor_id'] === $myDoctor;
    $list .= '<li class="flex flex-wrap items-center gap-3 border-t border-linie py-3 first:border-t-0">'
        . '<span class="' . e(cn('rounded-full px-2.5 py-0.5 text-mic font-semibold', $t['doctor_id'] === null ? 'bg-carmin-pal text-carmin' : 'bg-mustar-pal text-mustar-text')) . '">' . e(TIME_OFF_KINDS[$t['kind']] ?? $t['kind']) . '</span>'
        . '<span class="min-w-0 flex-1 text-corp">' . e(preg_replace('/^[^,]+, /', '', time_off_label($t))) . '</span>'
        . ($canDelete ? '<form method="post" data-confirma="Ștergeți această absență? Orele redevin libere.">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><input type="hidden" name="id" value="' . (int) $t['id'] . '"><button type="submit" class="' . e(btn('text', 's')) . '" aria-label="Ștergeți">' . icon('trash-2', 16) . '</button></form>' : '')
        . '</li>';
}
// The next legal holidays, for reference (they are already off for online booking).
$hol = [];
foreach (array_merge(ro_holidays((int) date('Y')), ro_holidays((int) date('Y') + 1)) as $d) {
    if ($d >= date('Y-m-d') && count($hol) < 6) {
        $hol[] = $d;
    }
}
sort($hol);

$who = $isDoctor ? '<input type="hidden" name="cine" value="medic"><input type="hidden" name="doctor" value="' . $myDoctor . '">'
    : radio_group('cine', 'Pentru cine', ['medic' => 'Un medic', 'clinica' => 'Clinica întreagă (închisă)'], ['inline' => true, 'value' => $v['cine']])
        . '<div data-cine-medic>' . select_field('doctor', 'Medicul', $doctorOptions, ['value' => $v['doctor'], 'error' => $errors['doctor'] ?? null]) . '</div>';
$form = '<form method="post" novalidate class="flex flex-col gap-5">' . csrf_field() . error_summary($errors)
    . $who
    . '<div class="grid gap-5 sm:grid-cols-2">' . select_field('location', 'Clinica', ['' => $isDoctor ? 'La toate clinicile' : 'La toate clinicile (doar pentru un medic)'] + $names, ['value' => $v['location'], 'error' => $errors['location'] ?? null])
    . select_field('kind', 'Tipul', TIME_OFF_KINDS, ['value' => $v['kind']]) . '</div>'
    . '<div class="grid gap-5 sm:grid-cols-2">' . text_field('from', 'De la', ['type' => 'date', 'value' => $v['from'], 'error' => $errors['from'] ?? null])
    . text_field('to', 'Până la (inclusiv)', ['type' => 'date', 'value' => $v['to'], 'optional' => true, 'hint' => 'Gol = o singură zi.']) . '</div>'
    . '<div class="grid gap-5 sm:grid-cols-2">' . text_field('start', 'De la ora', ['type' => 'time', 'value' => $v['start'], 'optional' => true, 'step' => 900, 'error' => $errors['start'] ?? null, 'hint' => 'Doar pentru o parte din zi.'])
    . text_field('end', 'Până la ora', ['type' => 'time', 'value' => $v['end'], 'optional' => true, 'step' => 900]) . '</div>'
    . text_field('reason', 'Motivul', ['value' => $v['reason'], 'optional' => true, 'maxlength' => 200, 'hint' => 'De exemplu „congres”, „inventar”, „renovare”. Îl văd doar colegii.'])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">Salvați absența</button></div></form>';

$affectedHtml = '';
if ($affected !== []) {
    $docs = doctor_short_names();
    $affectedHtml = '<div class="mb-8 rounded-panou border-2 border-mustar bg-mustar-pal p-5"><h2 class="text-h3 font-semibold">' . count($affected) . (count($affected) === 1 ? ' programare' : ' programări') . ' în intervalul absenței</h2><p class="mt-1 text-mic">Sunați pacienții și mutați programările (din programare: altă zi sau alt medic). Pacientul primește singur noua oră.</p><ul class="mt-3">'
        . implode('', array_map(static fn ($a) => '<li class="flex flex-wrap items-center gap-3 border-t border-mustar/40 py-2 first:border-t-0"><a class="font-semibold text-link underline" href="/admin/programari/' . (int) $a['id'] . '">' . e(day_label($a['starts_at']) . ', ' . substr($a['starts_at'], 11, 5)) . '</a><span>' . e(trim($a['last_name'] . ' ' . $a['first_name'])) . ' · ' . e(format_phone((string) $a['phone'])) . '</span><span class="text-mic text-discret">' . e($docs[(int) $a['doctor_id']] ?? '') . '</span></li>', $affected))
        . '</ul></div>';
}

$body = admin_header('Absențe și zile libere', 'Concediile și cursurile medicilor, orele blocate și zilele în care o clinică e închisă. Dispar imediat din programările online și apar în calendar.')
    . $affectedHtml
    . '<div class="grid max-w-6xl gap-8 lg:grid-cols-12"><div class="min-w-0 lg:col-span-7">' . admin_section_open('Absențe și zile libere de acum încolo', 'lista') . ($list !== '' ? '<ul class="mt-3">' . $list . '</ul>' : '<p class="mt-3 text-corp text-discret">Nimic programat.</p>') . '</section></div>'
    . '<div class="flex min-w-0 flex-col gap-8 lg:col-span-5">' . admin_section_open('Adăugați', 'adauga') . '<div class="mt-4">' . $form . '</div></section>'
    . admin_section_open('Sărbători legale', 'sarbatori', 'Sunt libere automat la programările online; nu trebuie adăugate.') . '<ul class="mt-3 text-corp">' . implode('', array_map(static fn ($d) => '<li class="first-letter:uppercase">' . e(day_label($d)) . ' ' . substr($d, 0, 4) . '</li>', $hol)) . '</ul></section></div></div>';
admin_page('Absențe și zile libere', $body, $user);
