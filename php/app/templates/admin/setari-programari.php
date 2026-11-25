<?php
/**
 * /admin/setari/programari (administrators): online booking on the site (and in the chat): on or
 * off, the grid of the times shown, how long before a booking must be made, how far ahead, the gap
 * kept between appointments, until when the patient may cancel from the link, where the morning
 * ends. Beside it: the reasons offered on the site, who takes online bookings, the first free times.
 */
declare(strict_types=1);

$s = booking_settings();
$before = $s;
$errors = [];
$steps = [5 => '5 minute', 10 => '10 minute', 15 => '15 minute', 20 => '20 de minute', 30 => '30 de minute'];
$notices = [0 => 'oricând, chiar și imediat', 30 => 'cu 30 de minute', 60 => 'cu o oră', 120 => 'cu 2 ore', 180 => 'cu 3 ore', 240 => 'cu 4 ore', 720 => 'cu 12 ore', 1440 => 'cu o zi'];
$buffers = [0 => 'fără pauză', 5 => '5 minute', 10 => '10 minute', 15 => '15 minute', 20 => '20 de minute', 30 => '30 de minute'];
$durations = [15 => '15 minute', 20 => '20 de minute', 30 => '30 de minute', 45 => '45 de minute', 60 => 'o oră'];
if (is_post()) {
    csrf_check();
    $s['enabled'] = post('enabled') === '1';
    $s['step_minutes'] = isset($steps[(int) post('step_minutes')]) ? (int) post('step_minutes') : 15;
    $s['notice_minutes'] = isset($notices[(int) post('notice_minutes')]) ? (int) post('notice_minutes') : 120;
    $s['buffer_minutes'] = isset($buffers[(int) post('buffer_minutes')]) ? (int) post('buffer_minutes') : 0;
    $s['default_minutes'] = isset($durations[(int) post('default_minutes')]) ? (int) post('default_minutes') : 30;
    $days = post('days_ahead');
    if (!ctype_digit($days) || (int) $days < 3 || (int) $days > 120) {
        $errors['days_ahead'] = 'Alegeți între 3 și 120 de zile.';
    }
    $s['days_ahead'] = (int) $days;
    $cancel = post('cancel_hours');
    if (!ctype_digit($cancel) || (int) $cancel > 72) {
        $errors['cancel_hours'] = 'Alegeți între 0 și 72 de ore.';
    }
    $s['cancel_hours'] = (int) $cancel;
    $s['morning_until'] = post('morning_until');
    if (!preg_match('/^(1[0-6]):(00|30)$/', $s['morning_until'])) {
        $errors['morning_until'] = 'Scrieți o oră între 10:00 și 16:30, la fix sau și jumătate, de exemplu 13:00.';
    }
    if ($errors === []) {
        setting_save('programare_online', $s);
        audit('setari-programari', changes_text($before, $s, ['enabled' => 'programare online pe site', 'step_minutes' => 'orele din (minute)', 'notice_minutes' => 'cel mai devreme (minute)', 'days_ahead' => 'zile înainte', 'buffer_minutes' => 'pauză între programări (minute)', 'default_minutes' => 'durata implicită', 'cancel_hours' => 'anulare din link (ore înainte)', 'morning_until' => 'dimineața până la']));
        flash('Setările programărilor online au fost salvate.');
        redirect('/admin/setari/programari');
    }
}

$names = admin_clinic_names();
$docs = db_all('SELECT d.id, d.public_name, d.accepts_online, dl.location_id, dl.schedule FROM doctors d JOIN doctor_locations dl ON dl.doctor_id = d.id ORDER BY d.sort_order, d.id');
$byDoc = [];
foreach ($docs as $r) {
    $id = (int) $r['id'];
    $byDoc[$id] ??= ['name' => $r['public_name'], 'online' => (int) $r['accepts_online'] === 1, 'rows' => []];
    $sch = schedule_decode($r['schedule']);
    $byDoc[$id]['rows'][] = e($names[(int) $r['location_id']] ?? '') . ': ' . ($sch !== [] ? e(schedule_text($sch)) : '<span class="text-mustar-text">fără program</span>');
}
$docRows = '';
foreach ($byDoc as $id => $d) {
    $docRows .= '<li class="border-t border-linie py-2 first:border-t-0"><a class="font-semibold text-link underline underline-offset-4" href="/admin/echipa/' . $id . '">' . e($d['name']) . '</a>'
        . ($d['online'] ? '' : ' <span class="rounded-full bg-mustar-pal px-2 py-0.5 text-mic text-mustar-text">nu primește online</span>')
        . '<br><span class="text-mic text-discret">' . implode('<br>', $d['rows']) . '</span></li>';
}
$reasons = '';
foreach (booking_reasons() as $r) {
    $reasons .= '<li class="border-t border-linie py-2 first:border-t-0"><span class="font-semibold">' . e($r['label']) . '</span>'
        . (!empty($r['urgent']) ? ' <span class="rounded-full bg-carmin-pal px-2 py-0.5 text-mic text-carmin">urgență</span>' : '')
        . '<br><span class="text-mic text-discret">' . (!empty($r['unsure']) ? 'Se programează ca o consultație' : e($r['hint'] !== '' ? $r['hint'] : service_title($r['category']))) . ' · ' . (int) $r['minutes'] . ' min</span></li>';
}
$next = $s['enabled'] ? free_slots(['limit' => 6, 'per_day' => 1]) : [];
$short = doctor_short_names();
$nextList = implode('', array_map(static fn ($x) => '<li class="cifre">' . e(day_label($x['start']) . ', ' . substr($x['start'], 11, 5) . ' · ' . ($names[$x['location_id']] ?? '') . ' · ' . ($short[$x['doctor_id']] ?? '')) . '</li>', $next));

$form = '<form method="post" novalidate class="flex flex-col gap-5 rounded-panou border border-linie bg-suprafata p-6">' . csrf_field() . error_summary($errors)
    . checkbox_field('enabled', 'Pacienții își aleg singuri ora pe site', ['checked' => (bool) $s['enabled'], 'description' => 'Pe pagina Programare apar orele libere reale din calendar. Oprit: pacientul lasă o cerere și îl sunați.'])
    . '<div class="grid gap-5 sm:grid-cols-2">'
    . select_field('step_minutes', 'Orele se arată din … în …', $steps, ['value' => (string) $s['step_minutes'], 'hint' => 'La 15 minute: 9:00, 9:15, 9:30…'])
    . select_field('notice_minutes', 'Cel mai devreme, față de acum', $notices, ['value' => (string) $s['notice_minutes'], 'hint' => 'Ca recepția și medicul să afle din timp.'])
    . text_field('days_ahead', 'Cu câte zile înainte se poate programa', ['type' => 'number', 'value' => (string) $s['days_ahead'], 'min' => 3, 'max' => 120, 'error' => $errors['days_ahead'] ?? null])
    . select_field('buffer_minutes', 'Pauză între programări', $buffers, ['value' => (string) $s['buffer_minutes'], 'hint' => 'Timp de curățenie și sterilizare după fiecare pacient.'])
    . select_field('default_minutes', 'Durata, când serviciul nu are una', $durations, ['value' => (string) $s['default_minutes'], 'hint' => 'Durata fiecărui serviciu se schimbă la Prețuri.'])
    . text_field('cancel_hours', 'Pacientul poate anula din link cu cel puțin … ore înainte', ['type' => 'number', 'value' => (string) $s['cancel_hours'], 'min' => 0, 'max' => 72, 'error' => $errors['cancel_hours'] ?? null, 'hint' => 'După aceea, doar la telefon.'])
    . text_field('morning_until', 'Dimineața se termină la', ['value' => (string) $s['morning_until'], 'inputmode' => 'numeric', 'maxlength' => 5, 'error' => $errors['morning_until'] ?? null, 'hint' => 'Pentru filtrul „Dimineața / După-amiaza”.'])
    . '</div><div><button type="submit" class="' . e(btn('primary')) . '">Salvați</button></div></form>';

$body = '<p class="mb-4"><a href="/admin/setari" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Setări</a></p>'
    . admin_header('Programări online', 'Cum își aleg pacienții ora pe site și în chat. Orele libere vin din programul medicilor, minus programările, absențele, zilele în care clinica e închisă și sărbătorile legale.', '<a href="/admin/absente" class="' . e(btn('secondary')) . '">' . icon('user-x', 18) . 'Absențe și zile libere</a><a href="/programare" target="_blank" rel="noopener" class="' . e(btn('secondary')) . '">' . icon('external-link', 18) . 'Pagina de pe site</a>')
    . '<div class="grid max-w-6xl gap-8 lg:grid-cols-12"><div class="flex min-w-0 flex-col gap-8 lg:col-span-7">' . $form
    . admin_section_open('Motivele de pe site', 'motive', 'Pacientul alege unul; de el depind durata și medicii care îl pot primi. Se aleg la Prețuri → serviciu → „Programare online”.')
    . ($reasons !== '' ? '<ul class="mt-3 text-corp">' . $reasons . '</ul>' : '<p class="mt-3 text-corp text-mustar-text">Niciun serviciu nu este bifat pentru programare online.</p>')
    . '<p class="mt-4"><a class="text-link underline underline-offset-4" href="/admin/servicii">Prețuri și servicii</a></p></section></div>'
    . '<div class="flex min-w-0 flex-col gap-8 lg:col-span-5">'
    . admin_section_open('Primele ore libere acum', 'libere')
    . ($nextList !== '' ? '<ul class="mt-3 text-corp">' . $nextList . '</ul>' : '<p class="mt-3 text-corp text-mustar-text">' . ($s['enabled'] ? 'Nicio oră liberă: verificați programul medicilor.' : 'Programarea online este oprită.') . '</p>')
    . '</section>'
    . admin_section_open('Medicii și programul lor', 'program', 'Se schimbă la Echipa → medic → „Unde și când lucrează”.')
    . ($docRows !== '' ? '<ul class="mt-3 text-corp">' . $docRows . '</ul>' : '<p class="mt-3 text-corp">Niciun medic.</p>') . '</section>'
    . '</div></div>';
admin_page('Programări online', $body, $user);
