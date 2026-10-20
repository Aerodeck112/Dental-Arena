<?php
/** /admin/echipa/{id|nou}: a doctor's profile on the site, the services they do and the portrait. */
declare(strict_types=1);

$isNew = $param === 'nou';
$doc = $isNew ? null : db_one('SELECT * FROM doctors WHERE id = ?', [(int) $param]);
if (!$isNew && $doc === null) {
    admin_not_found($user);
}
$cats = db_all('SELECT * FROM categories ORDER BY sort_order');
$links = [];
if (!$isNew) {
    foreach (db_all('SELECT category_id, show_on_site FROM doctor_categories WHERE doctor_id = ?', [$doc['id']]) as $l) {
        $links[(int) $l['category_id']] = (int) $l['show_on_site'];
    }
}
$clinicNames = admin_clinic_names();
$workLocs = $isNew ? array_keys($clinicNames) : array_map('intval', array_column(db_all('SELECT location_id FROM doctor_locations WHERE doctor_id = ?', [$doc['id']]), 'location_id'));
// When the doctor works at each clinic (for the free times the site's chat offers).
$schedules = [];
$cabinetsAt = [];
$cabinetCount = array_map('intval', array_column(db_all('SELECT id, cabinets FROM locations'), 'cabinets', 'id'));
if (!$isNew) {
    foreach (db_all('SELECT location_id, schedule, cabinet FROM doctor_locations WHERE doctor_id = ?', [$doc['id']]) as $dl) {
        $schedules[(int) $dl['location_id']] = schedule_decode($dl['schedule']);
        $cabinetsAt[(int) $dl['location_id']] = $dl['cabinet'] !== null ? (int) $dl['cabinet'] : null;
    }
}
$errors = [];
$v = [
    'public_name' => $doc['public_name'] ?? 'Dr. ',
    'first_name' => $doc['first_name'] ?? '',
    'last_name' => $doc['last_name'] ?? '',
    'role_line' => $doc['role_line'] ?? 'Medic dentist',
    'bio' => $doc['bio'] ?? '',
    'sort_order' => (string) ($doc['sort_order'] ?? ((int) db_value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM doctors'))),
    'public_visible' => (string) ($doc['public_visible'] ?? 1),
    'accepts_online' => (string) ($doc['accepts_online'] ?? 1),
    'phone' => (string) ($doc['phone'] ?? ''),
    'email' => (string) ($doc['email'] ?? ''),
    'agenda_channel' => (string) ($doc['agenda_channel'] ?? ''),
    'agenda_time' => (string) ($doc['agenda_time'] ?? '07:00'),
    'agenda_alerts' => (string) ($doc['agenda_alerts'] ?? 0),
];

// „Trimiteți acum”: today's programme (or the next day with appointments) to the doctor, now.
if (!$isNew && is_post() && post('actiune') === 'agenda-proba') {
    csrf_check();
    $day = (string) (db_value("SELECT DATE(starts_at) FROM appointments WHERE doctor_id = ? AND starts_at >= ? AND status IN ('programat', 'confirmat', 'sosit', 'in-tratament') ORDER BY starts_at LIMIT 1", [$doc['id'], date('Y-m-d') . ' 00:00:00']) ?: date('Y-m-d'));
    $n = send_doctor_agenda($doc, $day, true);
    process_message_queue(10);
    flash($n > 0 ? 'Programul din ' . format_date($day, true) . ' a fost trimis' . (messaging_live() ? '.' : ' (modul de probă: mesajul apare doar în Mesaje, nu pleacă).') : 'Nu am unde trimite: alegeți canalul și scrieți telefonul sau e-mailul, apoi salvați.', $n > 0 ? 'ok' : 'eroare');
    redirect("/admin/echipa/{$doc['id']}#agenda");
}

if (is_post()) {
    csrf_check();
    $id = $isNew ? null : (int) $doc['id'];
    if (!$isNew && post('actiune') === 'sterge-foto') {
        delete_media($doc['photo_path']);
        db_update('doctors', ['photo_path' => null], 'id = :id', ['id' => $id]);
        audit('medic-foto-sters', $doc['public_name']);
        flash('Portretul a fost scos. Pe site apar inițialele.');
        redirect("/admin/echipa/{$id}");
    }
    foreach (['public_name', 'first_name', 'last_name', 'role_line', 'bio', 'sort_order'] as $k) {
        $v[$k] = post($k);
    }
    $v['public_visible'] = post('public_visible') === '1' ? '1' : '0';
    $v['accepts_online'] = post('accepts_online') === '1' ? '1' : '0';
    foreach (['phone', 'email', 'agenda_time'] as $k) {
        $v[$k] = trim(post($k));
    }
    $v['agenda_channel'] = isset(AGENDA_CHANNELS[post('agenda_channel')]) ? post('agenda_channel') : '';
    $v['agenda_alerts'] = post('agenda_alerts') === '1' ? '1' : '0';
    if ($v['phone'] !== '' && phone_e164($v['phone']) === null) {
        $errors['phone'] = 'Scrieți numărul ca 0744 123 456.';
    } elseif (in_array($v['agenda_channel'], ['whatsapp', 'sms'], true) && phone_ro_mobile($v['phone']) === null) {
        $errors['phone'] = 'Pentru WhatsApp sau SMS scrieți numărul de mobil al medicului.';
    }
    if ($v['email'] !== '' && !filter_var($v['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Adresa de e-mail nu pare corectă.';
    } elseif ($v['agenda_channel'] === 'email' && $v['email'] === '') {
        $errors['email'] = 'Pentru e-mail scrieți adresa medicului.';
    }
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v['agenda_time'])) {
        $v['agenda_time'] = '07:00';
    }
    $workLocs = array_values(array_filter(array_map('intval', is_array($_POST['locations'] ?? null) ? $_POST['locations'] : []), static fn ($lid) => isset($clinicNames[$lid])));
    $schedules = [];
    $cabinetsAt = [];
    $sentSch = is_array($_POST['sch'] ?? null) ? $_POST['sch'] : [];
    foreach ($workLocs as $lid) {
        $problem = null;
        $schedules[$lid] = week_schedule_parse($sentSch[$lid] ?? [], " la {$clinicNames[$lid]}", $problem);
        if ($problem !== null) {
            $errors['form'] ??= $problem;
        }
        $cab = (int) ($_POST['cabinet'][$lid] ?? 0);
        $cabinetsAt[$lid] = $cab >= 1 && $cab <= (int) ($cabinetCount[$lid] ?? 1) ? $cab : null;
    }
    foreach (['public_name' => 'Scrieți numele afișat pe site.', 'first_name' => 'Scrieți prenumele.', 'last_name' => 'Scrieți numele de familie.', 'role_line' => 'Scrieți specialitatea.'] as $k => $msg) {
        if (mb_strlen($v[$k]) < 2) {
            $errors[$k] = $msg;
        }
    }
    $photo = null;
    if (($_FILES['foto']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        try {
            $photo = save_uploaded_photo($_FILES['foto'], 'medic-' . slugify($v['last_name'] ?: 'nou'));
        } catch (Throwable $e) {
            $errors['foto'] = $e instanceof InvalidArgumentException || $e instanceof RuntimeException ? $e->getMessage() : 'Portretul nu a putut fi salvat.';
        }
    }
    if ($errors === []) {
        $row = [
            'public_name' => mb_substr($v['public_name'], 0, 160),
            'first_name' => mb_substr($v['first_name'], 0, 80),
            'last_name' => mb_substr($v['last_name'], 0, 80),
            'role_line' => mb_substr($v['role_line'], 0, 255),
            'bio' => $v['bio'] !== '' ? mb_substr($v['bio'], 0, 4000) : null,
            'sort_order' => (int) $v['sort_order'],
            'public_visible' => (int) $v['public_visible'],
            'accepts_online' => (int) $v['accepts_online'],
            'phone' => $v['phone'] !== '' ? format_phone($v['phone']) : null,
            'email' => $v['email'] !== '' ? mb_substr($v['email'], 0, 190) : null,
            'agenda_channel' => $v['agenda_channel'] !== '' ? $v['agenda_channel'] : null,
            'agenda_time' => $v['agenda_time'],
            'agenda_alerts' => (int) $v['agenda_alerts'],
        ];
        if ($photo !== null) {
            $row['photo_path'] = $photo['path'];
        }
        $id = db_tx(static function () use ($row, $id, $cats, $doc, $workLocs, $schedules, $cabinetsAt) {
            if ($id === null) {
                $base = slugify(preg_replace('/^dr\.?\s+/i', '', $row['public_name']) ?? $row['public_name']) ?: 'medic';
                $slug = $base;
                for ($n = 2; db_value('SELECT 1 FROM doctors WHERE slug = ?', [$slug]); $n++) {
                    $slug = "{$base}-{$n}";
                }
                $id = db_insert('doctors', $row + ['slug' => $slug]);
            } else {
                db_update('doctors', $row, 'id = :id', ['id' => $id]);
                if (isset($row['photo_path'])) {
                    delete_media($doc['photo_path']);
                }
            }
            db_run('DELETE FROM doctor_locations WHERE doctor_id = ?', [$id]);
            foreach ($workLocs as $lid) {
                db_run('INSERT INTO doctor_locations (doctor_id, location_id, schedule, cabinet) VALUES (?, ?, ?, ?)', [$id, $lid, !empty($schedules[$lid]) ? json_encode($schedules[$lid]) : null, $cabinetsAt[$lid] ?? null]);
            }
            db_run('DELETE FROM doctor_categories WHERE doctor_id = ?', [$id]);
            $sent = is_array($_POST['cat'] ?? null) ? $_POST['cat'] : [];
            foreach ($cats as $c) {
                $cid = (int) $c['id'];
                $state = $sent[$cid] ?? '';
                if ($state === 'face' || $state === 'arata') {
                    db_run('INSERT INTO doctor_categories (doctor_id, category_id, show_on_site) VALUES (?, ?, ?)', [$id, $cid, $state === 'arata' ? 1 : 0]);
                }
            }
            return $id;
        });
        audit($isNew ? 'medic-nou' : 'medic', $row['public_name']);
        flash($isNew ? 'Medicul a fost adăugat.' : 'Profilul a fost salvat. E deja pe site.');
        redirect("/admin/echipa/{$id}");
    }
    $sent = is_array($_POST['cat'] ?? null) ? $_POST['cat'] : [];
    $links = [];
    foreach ($sent as $cid => $state) {
        if ($state === 'face' || $state === 'arata') {
            $links[(int) $cid] = $state === 'arata' ? 1 : 0;
        }
    }
}

$catRows = '';
foreach ($cats as $c) {
    $cid = (int) $c['id'];
    $state = isset($links[$cid]) ? ($links[$cid] === 1 ? 'arata' : 'face') : '';
    $opt = '';
    foreach (['' => 'Nu', 'face' => 'Da', 'arata' => 'Da, și apare la „Cine vă tratează”'] as $k => $l) {
        $opt .= '<option value="' . $k . '"' . ($state === $k ? ' selected' : '') . '>' . e($l) . '</option>';
    }
    $catRows .= '<li class="grid items-center gap-2 border-t border-linie py-2 first:border-t-0 sm:grid-cols-[1fr_18rem]"><label for="cat-' . $cid . '" class="text-corp">' . e($c['name']) . '</label>'
        . '<select id="cat-' . $cid . '" name="cat[' . $cid . ']" class="' . e(input_classes('h-control-s')) . '">' . $opt . '</select></li>';
}
$workBlocks = '';
foreach ($clinicNames as $lid => $n) {
    $cabOptions = ['' => 'Oricare'];
    for ($c = 1; $c <= (int) ($cabinetCount[$lid] ?? 1); $c++) {
        $cabOptions[(string) $c] = "Cabinetul {$c}";
    }
    $workBlocks .= '<fieldset class="min-w-0 rounded-panou border border-linie p-4">'
        . '<legend class="px-1">' . checkbox_field('locations[]', '<strong>' . e($n) . '</strong>', ['id' => "field-locations-{$lid}", 'value' => (string) $lid, 'checked' => in_array($lid, $workLocs, true)]) . '</legend>'
        . week_schedule_fields("sch[{$lid}]", $schedules[$lid] ?? [], ", {$n}")
        . ((int) ($cabinetCount[$lid] ?? 1) > 1 ? '<div class="mt-3 max-w-xs">' . select_field("cabinet[{$lid}]", 'Cabinetul în care lucrează de obicei', $cabOptions, ['id' => "field-cabinet-{$lid}", 'value' => (string) ($cabinetsAt[$lid] ?? '')]) . '</div>' : '')
        . '<p class="mt-2 text-mic text-discret">Lăsați gol în zilele în care nu lucrează aici; pauza e opțională.</p></fieldset>';
}
// What the doctor receives: the next day with appointments, as an example.
$preview = '';
if (!$isNew) {
    $day = (string) (db_value("SELECT DATE(starts_at) FROM appointments WHERE doctor_id = ? AND starts_at >= ? AND status IN ('programat', 'confirmat', 'sosit', 'in-tratament') ORDER BY starts_at LIMIT 1", [$doc['id'], date('Y-m-d') . ' 00:00:00']) ?: '');
    if ($day !== '') {
        $pv = agenda_vars(['agenda_alerts' => (int) $v['agenda_alerts']] + $doc, $day, doctor_agenda((int) $doc['id'], $day));
        $preview = '<div class="min-w-0 rounded-[1.25rem] rounded-tl-md bg-[#dcf8c6] p-4 text-corp text-[#111b21] shadow-sm"><p>Bună dimineața, ' . e($pv['medic']) . '! Azi, ' . e($pv['data']) . ', aveți ' . e($pv['numar']) . ':</p>'
            . '<ul class="mt-2 flex flex-col gap-1">' . implode('', array_map(static fn ($l) => '<li>• ' . e($l) . '</li>', $pv['linii'])) . '</ul>'
            . '<p class="mt-2 text-mic text-[#667781]">Exemplu: programul din ' . e(format_date($day, true)) . '</p></div>';
    } else {
        $preview = '<p class="rounded-panou bg-fundal p-4 text-mic text-discret">Medicul nu are încă programări viitoare; mesajul pleacă doar în zilele cu programări.</p>';
    }
}
$agenda = admin_section_open('Programul zilei, pe telefon', 'agenda', 'În fiecare zi în care are programări, medicul primește dimineața lista lor: ora, pacientul, motivul. Dacă se adaugă, se mută sau se anulează ceva pentru aceeași zi, primește și asta. Nu are nevoie de cont în panou.')
    . '<div class="mt-4 grid gap-6 lg:grid-cols-2"><div class="flex min-w-0 flex-col gap-4">'
    . select_field('agenda_channel', 'Unde primește programul', AGENDA_CHANNELS, ['value' => $v['agenda_channel']])
    . '<div class="grid gap-4 sm:grid-cols-2">' . text_field('phone', 'Mobilul medicului', ['type' => 'tel', 'value' => $v['phone'], 'optional' => true, 'error' => $errors['phone'] ?? null])
    . text_field('agenda_time', 'La ce oră', ['type' => 'time', 'value' => $v['agenda_time'], 'step' => 900, 'hint' => 'Pleacă de la această oră, cel târziu în 3 ore (la prima deschidere a panoului, dacă nu e cron). Dacă prima programare e mai devreme, alegeți o oră înaintea ei. Programările adăugate după aceea îi ajung una câte una.']) . '</div>'
    . text_field('email', 'E-mailul medicului', ['type' => 'email', 'value' => $v['email'], 'optional' => true, 'error' => $errors['email'] ?? null])
    . checkbox_field('agenda_alerts', 'Cu alertele medicale ale pacienților', ['checked' => $v['agenda_alerts'] === '1', 'description' => 'Alergii, anticoagulante, sarcină etc. Sunt date de sănătate: bifați doar dacă telefonul medicului e protejat.'])
    . '<p class="text-mic text-discret">Pe WhatsApp e nevoie de un șablon aprobat de Meta (Setări → Mesaje → „Programul zilei”); până atunci pleacă prin SMS.</p></div>'
    . '<div class="min-w-0"><p class="mb-2 text-mic font-semibold text-discret">Cum arată</p>' . $preview . '</div></div></section>';
$portrait = '';
if (!$isNew) {
    $d = public_doctor($doc);
    $portrait = '<div class="w-48">' . doctor_portrait($d, '192px', 'profile') . '</div>';
}
$body = '<p class="mb-4"><a href="/admin/echipa" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Echipa</a></p>'
    . admin_header($isNew ? 'Medic nou' : $doc['public_name'], '', !$isNew && (int) $doc['public_visible'] === 1 ? '<a href="/echipa/' . e($doc['slug']) . '" target="_blank" rel="noopener" class="' . e(btn('secondary')) . '">' . icon('external-link', 18) . 'Profilul de pe site</a>' : '')
    . '<form method="post" enctype="multipart/form-data" novalidate class="flex flex-col gap-8">' . csrf_field() . error_summary($errors)
    . admin_section_open('Pe site', 'profil')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . text_field('public_name', 'Numele afișat', ['value' => $v['public_name'], 'required' => true, 'error' => $errors['public_name'] ?? null, 'hint' => 'De exemplu: Dr. Andrei Marcoci'])
    . text_field('role_line', 'Specialitatea', ['value' => $v['role_line'], 'required' => true, 'error' => $errors['role_line'] ?? null])
    . text_field('first_name', 'Prenumele', ['value' => $v['first_name'], 'required' => true, 'error' => $errors['first_name'] ?? null, 'hint' => 'Pentru inițiale, când nu are portret.'])
    . text_field('last_name', 'Numele de familie', ['value' => $v['last_name'], 'required' => true, 'error' => $errors['last_name'] ?? null])
    . '</div><div class="mt-5">' . text_area('bio', 'Despre medic', ['value' => $v['bio'], 'rows' => 5, 'optional' => true, 'hint' => 'Câteva fraze despre experiență și ce îi place să facă. Apare pe profilul medicului.']) . '</div>'
    . '<div class="mt-5 grid gap-5 md:grid-cols-2">' . text_field('sort_order', 'Ordinea pe site', ['type' => 'number', 'value' => $v['sort_order'], 'min' => 0, 'inputClass' => 'max-w-32'])
    . checkbox_field('public_visible', 'Apare pe site', ['checked' => $v['public_visible'] === '1', 'class' => 'md:mt-7']) . '</div></section>'
    . admin_section_open('Unde și când lucrează', 'clinici', 'Medicul apare în calendarul clinicilor bifate. Din program, asistentul de pe site propune orele libere (fără zilele de sărbătoare legală și fără orele deja ocupate). Fără program, medicul nu primește programări online.')
    . '<div class="mt-4">' . checkbox_field('accepts_online', 'Primește programări online (pe site și în chat)', ['checked' => $v['accepts_online'] === '1', 'description' => 'Debifat: recepția îl programează normal, dar pe site nu apare.']) . '</div>'
    . '<div class="mt-4 grid gap-6 lg:grid-cols-2">' . $workBlocks . '</div>'
    . '<p class="mt-3 text-mic text-discret">Concediile, cursurile și zilele libere se pun la <a class="text-link underline" href="/admin/absente">Absențe și zile libere</a>.</p></section>'
    . $agenda
    . admin_section_open('Portretul', 'portret', 'O fotografie verticală, cu fața în treimea de sus. Fără portret, pe site apar inițialele.')
    . '<div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">' . $portrait
    . '<div class="flex flex-col gap-2"><label for="foto" class="text-control font-medium">Portret nou (JPG, PNG sau WebP)</label>'
    . '<input id="foto" type="file" name="foto" accept="image/jpeg,image/png,image/webp" class="block text-mic file:mr-3 file:rounded-control file:border-0 file:bg-menta-pal file:px-3 file:py-2 file:font-medium">'
    . (isset($errors['foto']) ? field_error('foto-error', $errors['foto']) : '') . '</div></div></section>'
    . admin_section_open('Serviciile', 'servicii', 'Ce face medicul. Cei marcați „apare” sunt arătați pe pagina serviciului.')
    . '<ul class="mt-3">' . $catRows . '</ul></section>'
    . '<div><button type="submit" class="' . e(btn('primary', 'l')) . '">' . ($isNew ? 'Adăugați medicul' : 'Salvați') . '</button></div></form>'
    . (!$isNew && $doc['photo_path'] && str_starts_with($doc['photo_path'], '/media/') ? '<form method="post" class="mt-6" data-confirma="Scoateți portretul?">' . csrf_field() . '<input type="hidden" name="actiune" value="sterge-foto"><button type="submit" class="' . e(btn('text', 's')) . '">' . icon('trash-2', 16) . 'Scoateți portretul</button></form>' : '')
    . (!$isNew && $doc['agenda_channel'] ? '<form method="post" class="mt-6">' . csrf_field() . '<input type="hidden" name="actiune" value="agenda-proba"><button type="submit" class="' . e(btn('secondary', 'm', 'h-auto min-h-control max-w-full whitespace-normal py-2 text-left')) . '">' . icon('phone', 18) . 'Trimiteți acum programul medicului (probă)</button></form>' : '');
admin_page($isNew ? 'Medic nou' : $doc['public_name'], $body, $user);
