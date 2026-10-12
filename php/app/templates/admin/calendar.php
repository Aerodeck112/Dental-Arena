<?php
/**
 * /admin/calendar: a clinic's day (one column per doctor, 15-minute rows from 8 to 20; a click on
 * a free slot opens a new appointment there) or its week (the appointments of each day, in order).
 * Shaded: the hours a doctor does not work there, the break, leave and clinic closures; legal
 * holidays are named above the day.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($id) => isset($names[$id])));
$clinicId = current_clinic_id($user);
if ($clinicId === null) {
    admin_page('Calendar', admin_header('Calendar', 'Contul nu are nicio clinică bifată.'), $user);
    exit;
}
remember_clinic($clinicId);
$date = preg_match('/^\d{4}-\d{2}-\d{2}$/', query('data')) && strtotime(query('data')) ? query('data') : date('Y-m-d');
$view = query('vizualizare') === 'saptamana' ? 'saptamana' : 'zi';
$day = new DateTimeImmutable($date);
$monday = $day->modify('monday this week');
[$from, $to] = $view === 'zi' ? [$day, $day->modify('+1 day')] : [$monday, $monday->modify('+7 days')];
$appts = db_all(
    "SELECT a.*, p.first_name, p.last_name FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE a.location_id = ? AND a.starts_at >= ? AND a.starts_at < ? AND a.status <> 'anulat' ORDER BY a.starts_at",
    [$clinicId, $from->format('Y-m-d 00:00:00'), $to->format('Y-m-d 00:00:00')],
);
$doctors = doctors_at($clinicId);
$docs = doctor_short_names();
$timeOff = array_values(array_filter(
    time_off_between($from->format('Y-m-d 00:00:00'), $to->format('Y-m-d 00:00:00'), array_column($doctors, 'id'), [$clinicId]),
    static fn ($t) => $t['doctor_id'] === null || $t['location_id'] === null || (int) $t['location_id'] === $clinicId,
));
$holidays = array_merge(ro_holidays((int) $from->format('Y')), ro_holidays((int) $to->format('Y')));
$schedules = [];
foreach (db_all('SELECT doctor_id, schedule FROM doctor_locations WHERE location_id = ?', [$clinicId]) as $r) {
    $schedules[(int) $r['doctor_id']] = schedule_decode($r['schedule']);
}
$url = static fn (array $q) => admin_url('/admin/calendar', $q + ['clinica' => $clinicId, 'vizualizare' => $view, 'data' => $date]);
$step = $view === 'zi' ? '1 day' : '7 days';

// Toolbar: clinic, day/week, previous / today / next, a date.
$clinicSwitch = '';
foreach ($allowed as $id) {
    $on = $id === $clinicId;
    $clinicSwitch .= '<a href="' . e($url(['clinica' => $id])) . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-control', $on ? 'bg-actiune font-semibold text-pe-actiune' : 'hover:bg-adancit')) . '">' . e($names[$id]) . '</a>';
}
$viewSwitch = '';
foreach (['zi' => 'Zi', 'saptamana' => 'Săptămână'] as $k => $l) {
    $on = $k === $view;
    $viewSwitch .= '<a href="' . e($url(['vizualizare' => $k])) . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-control', $on ? 'bg-menta-pal font-semibold' : 'hover:bg-adancit')) . '">' . $l . '</a>';
}
$title = $view === 'zi' ? ucfirst(format_date($day, true)) : 'Săptămâna ' . (int) $monday->format('j') . ' ' . RO_MONTHS[(int) $monday->format('n') - 1] . ' – ' . format_date($monday->modify('+6 days'));
$toolbar = '<div class="mb-6 flex flex-wrap items-center gap-3">'
    . (count($allowed) > 1 ? '<nav aria-label="Clinica" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $clinicSwitch . '</nav>' : '')
    . '<nav aria-label="Vizualizare" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $viewSwitch . '</nav>'
    . '<div class="flex items-center gap-1">'
    . '<a href="' . e($url(['data' => $day->modify("-{$step}")->format('Y-m-d')])) . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Înapoi">' . icon('chevron-left', 18) . '</a>'
    . '<a href="' . e($url(['data' => date('Y-m-d')])) . '" class="' . e(btn('secondary', 's')) . '">Azi</a>'
    . '<a href="' . e($url(['data' => $day->modify("+{$step}")->format('Y-m-d')])) . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Înainte">' . icon('chevron-right', 18) . '</a></div>'
    . '<form method="get" class="flex items-center gap-2"><input type="hidden" name="clinica" value="' . $clinicId . '"><input type="hidden" name="vizualizare" value="' . $view . '">'
    . '<label class="sr-only" for="cal-data">Mergeți la ziua</label><input id="cal-data" type="date" name="data" value="' . e($date) . '" class="' . e(input_classes('h-control-s w-auto')) . '" data-trimite-la-schimbare>'
    . '<button type="submit" class="' . e(btn('text', 's')) . '">Mergeți</button></form>'
    . '<a href="' . e(admin_url('/admin/programari/noua', ['clinica' => $clinicId, 'data' => $date, 'inapoi' => $url([])])) . '" class="' . e(btn('primary', 's', 'ml-auto')) . '">' . icon('plus', 16) . 'Programare nouă</a>'
    . '</div>';

$block = static function (array $a) use ($docs): string {
    $cls = match ($a['status']) {
        'confirmat' => 'border-actiune bg-suprafata',
        'sosit', 'in-tratament' => 'border-actiune bg-menta-pal',
        'finalizat' => 'border-linie bg-adancit text-discret',
        'neprezentat' => 'border-carmin bg-carmin-pal',
        default => 'border-dashed border-linie-control bg-suprafata',
    };
    return '<a href="/admin/programari/' . (int) $a['id'] . '" class="' . e(cn('block h-full overflow-hidden rounded-control border-l-4 border px-2 py-1 text-mic leading-tight shadow-sm hover:shadow-float', $cls)) . '">'
        . '<span class="font-semibold cifre">' . e(hm($a['starts_at'])) . '</span> <span class="font-semibold">' . e(patient_name($a)) . '</span>'
        . ((int) $a['wants_sedation'] === 1 || in_array($a['comfort'], ['emotii', 'frica'], true) ? ' <span aria-label="emoții" class="inline-block size-2 rounded-full bg-mustar"></span>' : '')
        . '<span class="block truncate text-discret">' . e($a['reason'] ?: service_title($a['category_slug'])) . '</span></a>';
};

if ($view === 'zi') {
    $rowsCount = (CAL_END_HOUR - CAL_START_HOUR) * 60 / CAL_SLOT_MIN;
    $cols = max(1, count($doctors));
    $grid = '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><div class="grid min-w-[44rem]" style="grid-template-columns:4rem repeat(' . $cols . ',minmax(9rem,1fr));grid-template-rows:auto repeat(' . $rowsCount . ',1.6rem)">';
    $grid .= '<div class="sticky top-0 border-b border-linie bg-suprafata" style="grid-row:1;grid-column:1"></div>';
    foreach ($doctors as $i => $dd) {
        $grid .= '<div class="border-b border-l border-linie bg-suprafata px-2 py-2 text-control font-semibold" style="grid-row:1;grid-column:' . ($i + 2) . '">' . e($dd['short']) . '</div>';
    }
    for ($r = 0; $r < $rowsCount; $r++) {
        $min = CAL_START_HOUR * 60 + $r * CAL_SLOT_MIN;
        $hhmm = sprintf('%02d:%02d', intdiv($min, 60), $min % 60);
        $full = $min % 60 === 0;
        $grid .= '<div class="' . e(cn('pr-2 text-right text-mic text-discret cifre', $full ? 'border-t border-linie' : '')) . '" style="grid-row:' . ($r + 2) . ';grid-column:1">' . ($full ? $hhmm : '') . '</div>';
        foreach ($doctors as $i => $dd) {
            $grid .= '<a href="' . e(admin_url('/admin/programari/noua', ['clinica' => $clinicId, 'medic' => $dd['id'], 'data' => $date, 'ora' => $hhmm, 'inapoi' => $url([])])) . '" class="' . e(cn('border-l border-linie hover:bg-menta-pal', $full ? 'border-t' : 'border-t border-t-linie/40')) . '" style="grid-row:' . ($r + 2) . ';grid-column:' . ($i + 2) . '" aria-label="' . e("Programare la {$dd['short']}, ora {$hhmm}") . '" tabindex="-1"></a>';
        }
    }
    $docIndex = array_flip(array_column($doctors, 'id'));
    // Grey: not working there (outside the hours, the break). Red: leave, clinic closed.
    $calStart = strtotime("{$date} " . sprintf('%02d:00:00', CAL_START_HOUR));
    $calEnd = strtotime("{$date} " . sprintf('%02d:00:00', CAL_END_HOUR));
    $shade = static function (int $col, int $a, int $b, string $cls, string $label = '') use ($calStart, $calEnd, $rowsCount): string {
        $a = max($a, $calStart);
        $b = min($b, $calEnd);
        if ($b <= $a) {
            return '';
        }
        $s = intdiv($a - $calStart, 60 * CAL_SLOT_MIN);
        $len = max(1, (int) ceil(($b - $a) / 60 / CAL_SLOT_MIN));
        return '<div class="' . e(cn('pointer-events-none overflow-hidden px-2 py-1 text-mic', $cls)) . '" style="grid-row:' . ($s + 2) . ' / span ' . min($len, $rowsCount - $s) . ';grid-column:' . ($col + 2) . '">' . ($label !== '' ? '<span class="font-semibold">' . e($label) . '</span>' : '') . '</div>';
    };
    $weekday = (int) $day->format('N');
    foreach ($doctors as $i => $dd) {
        $sch = $schedules[(int) $dd['id']] ?? [];
        if ($sch !== []) {
            $w = $sch[$weekday] ?? null;
            if ($w === null) {
                $grid .= $shade($i, $calStart, $calEnd, 'bg-adancit/70 text-discret', 'Nu lucrează aici azi');
            } else {
                $grid .= $shade($i, $calStart, strtotime("{$date} {$w[0]}"), 'bg-adancit/70');
                $grid .= $shade($i, strtotime("{$date} {$w[1]}"), $calEnd, 'bg-adancit/70');
                if (isset($w[2], $w[3])) {
                    $grid .= $shade($i, strtotime("{$date} {$w[2]}"), strtotime("{$date} {$w[3]}"), 'bg-adancit/70 text-discret', 'Pauză');
                }
            }
        }
        foreach ($timeOff as $t) {
            if (time_off_applies($t, (int) $dd['id'], $clinicId)) {
                $grid .= $shade($i, strtotime($t['starts_at']), strtotime($t['ends_at']), 'bg-carmin-pal/80 text-carmin', TIME_OFF_KINDS[$t['kind']] ?? 'Absent');
            }
        }
    }
    $others = [];
    foreach ($appts as $a) {
        if (!isset($docIndex[(int) $a['doctor_id']])) {
            $others[] = $a;
            continue;
        }
        $s = (int) ((strtotime($a['starts_at']) - strtotime("{$date} " . sprintf('%02d:00:00', CAL_START_HOUR))) / 60 / CAL_SLOT_MIN);
        $len = max(1, (int) ceil((strtotime($a['ends_at']) - strtotime($a['starts_at'])) / 60 / CAL_SLOT_MIN));
        $s = max(0, min($rowsCount - 1, $s));
        $len = min($len, $rowsCount - $s);
        $grid .= '<div class="relative z-10 p-0.5" style="grid-row:' . ($s + 2) . ' / span ' . $len . ';grid-column:' . ($docIndex[(int) $a['doctor_id']] + 2) . '">' . $block($a) . '</div>';
    }
    $grid .= '</div></div>';
    if ($others !== []) {
        $grid .= '<p class="mt-4 text-mic text-discret">Programări la medici care nu mai lucrează la această clinică: ' . e(implode(', ', array_map(static fn ($a) => hm($a['starts_at']) . ' ' . patient_name($a), $others))) . '</p>';
    }
    $content = $doctors === [] ? '<p class="text-corp text-discret">Niciun medic nu e trecut la această clinică. Bifați clinica în Echipa → medicul.</p>' : $grid;
} else {
    $byDay = [];
    foreach ($appts as $a) {
        $byDay[substr($a['starts_at'], 0, 10)][] = $a;
    }
    $content = '<div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">';
    for ($i = 0; $i < 7; $i++) {
        $d = $monday->modify("+{$i} days");
        $key = $d->format('Y-m-d');
        $isToday = $key === date('Y-m-d');
        $items = '';
        foreach ($byDay[$key] ?? [] as $a) {
            $items .= '<li class="min-h-[3.25rem]">' . $block($a) . '<span class="sr-only">, ' . e($docs[(int) $a['doctor_id']] ?? '') . '</span></li>';
        }
        $off = in_array($key, $holidays, true) ? 'Sărbătoare legală' : '';
        foreach ($timeOff as $t) {
            if ($t['doctor_id'] === null && $t['starts_at'] <= "{$key} 00:00:00" && $t['ends_at'] >= $d->modify('+1 day')->format('Y-m-d 00:00:00')) {
                $off = 'Clinica închisă';
            }
        }
        $content .= '<section class="' . e(cn('flex flex-col rounded-panou border p-3', $isToday ? 'border-actiune' : 'border-linie', $off !== '' ? 'bg-adancit' : 'bg-suprafata')) . '" aria-label="' . e(format_date($d, true)) . '">'
            . ($off !== '' ? '<p class="mb-1 text-mic font-semibold text-carmin">' . e($off) . '</p>' : '')
            . '<a href="' . e($url(['vizualizare' => 'zi', 'data' => $key])) . '" class="flex items-baseline justify-between gap-2 hover:text-link"><span class="text-control font-semibold">' . e(ucfirst(RO_WEEKDAYS[$i])) . '</span><span class="text-mic text-discret cifre">' . (int) $d->format('j') . ' ' . e(mb_substr(RO_MONTHS[(int) $d->format('n') - 1], 0, 3)) . '.</span></a>'
            . '<ul class="mt-2 flex flex-col gap-1.5">' . ($items !== '' ? $items : '<li class="text-mic text-discret">Liber</li>') . '</ul>'
            . '<a href="' . e(admin_url('/admin/programari/noua', ['clinica' => $clinicId, 'data' => $key, 'inapoi' => $url([])])) . '" class="mt-auto pt-3 text-mic text-link underline">Adăugați</a></section>';
    }
    $content .= '</div>';
}

$notes = [];
foreach ($view === 'zi' ? [$date] : array_map(static fn ($i) => $monday->modify("+{$i} days")->format('Y-m-d'), range(0, 6)) as $k) {
    if (in_array($k, $holidays, true)) {
        $notes[] = ucfirst(format_date($k, true)) . ': sărbătoare legală (pe site nu se fac programări).';
    }
}
foreach ($timeOff as $t) {
    $notes[] = time_off_label($t) . '.';
}
$notesHtml = $notes !== [] ? '<ul class="mb-4 flex flex-col gap-1 rounded-panou border border-mustar bg-mustar-pal p-3 text-mic">' . implode('', array_map(static fn ($n) => '<li class="flex items-start gap-2">' . icon('user-x', 16, 'mt-0.5') . '<span>' . e($n) . '</span></li>', array_unique($notes))) . '<li><a class="text-link underline" href="/admin/absente">Absențe și zile libere</a></li></ul>' : '';
$body = admin_header('Calendar', $title . ' · ' . ($names[$clinicId] ?? '') . ' · ' . count($appts) . (count($appts) === 1 ? ' programare' : ' programări')) . $toolbar . $notesHtml . $content;
admin_page('Calendar', $body, $user);
