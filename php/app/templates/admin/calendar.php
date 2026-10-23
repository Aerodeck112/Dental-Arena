<?php
/**
 * /admin/calendar: a clinic's day (one column per doctor, or per cabinet; 15-minute rows from 8 to
 * 20; a click on a free slot opens a new appointment there; an appointment is dragged to another
 * time or column, or stretched from its bottom edge, with „Anulați” for a few seconds), its week
 * (the appointments of each day, in order) or a list of seven days. Shaded: the hours a doctor
 * does not work there, the break, the clinic's closed hours, leave and closures; a line marks
 * the time now; legal holidays are named above the day.
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
$view = in_array(query('vizualizare'), ['saptamana', 'lista'], true) ? query('vizualizare') : 'zi';
$location = db_one('SELECT * FROM locations WHERE id = ?', [$clinicId]);
$cabinetCount = max(1, (int) ($location['cabinets'] ?? 1));
$byCabinet = $view === 'zi' && $cabinetCount > 1 && query('coloane') === 'cabinete';
$day = new DateTimeImmutable($date);
$monday = $day->modify('monday this week');
[$from, $to] = match ($view) {
    'zi' => [$day, $day->modify('+1 day')],
    'lista' => [$day, $day->modify('+7 days')],
    default => [$monday, $monday->modify('+7 days')],
};
$appts = db_all(
    "SELECT a.*, p.first_name, p.last_name, p.phone FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE a.location_id = ? AND a.starts_at >= ? AND a.starts_at < ?" . ($view === 'lista' && query('anulate') === '1' ? '' : " AND a.status <> 'anulat'") . ' ORDER BY a.starts_at',
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
$usualCabinet = [];
foreach (db_all('SELECT doctor_id, schedule, cabinet FROM doctor_locations WHERE location_id = ?', [$clinicId]) as $r) {
    $schedules[(int) $r['doctor_id']] = schedule_decode($r['schedule']);
    $usualCabinet[(int) $r['doctor_id']] = $r['cabinet'] !== null ? (int) $r['cabinet'] : null;
}
$open = location_hours()[$clinicId] ?? [];
$url = static fn (array $q) => admin_url('/admin/calendar', $q + ['clinica' => $clinicId, 'vizualizare' => $view, 'data' => $date, 'coloane' => $byCabinet ? 'cabinete' : null]);
$step = $view === 'saptamana' || $view === 'lista' ? '7 days' : '1 day';

// Toolbar: clinic, day / week / list, doctors / cabinets, previous / today / next, a date.
$seg = static fn (string $href, string $label, bool $on, string $onCls = 'bg-menta-pal font-semibold') => '<a href="' . e($href) . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center rounded-[calc(var(--radius-control)-2px)] px-2.5 text-control', $on ? $onCls : 'hover:bg-adancit')) . '">' . $label . '</a>';
$clinicSwitch = implode('', array_map(static fn ($id) => $seg($url(['clinica' => $id]), e($names[$id]), $id === $clinicId, 'bg-actiune font-semibold text-pe-actiune'), $allowed));
$viewSwitch = '';
foreach (['zi' => 'Zi', 'saptamana' => 'Săptămână', 'lista' => 'Listă'] as $k => $l) {
    $viewSwitch .= $seg($url(['vizualizare' => $k]), $l, $k === $view);
}
$colSwitch = $view === 'zi' && $cabinetCount > 1
    ? '<nav aria-label="Coloanele" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $seg($url(['coloane' => null]), 'Pe medici', !$byCabinet) . $seg($url(['coloane' => 'cabinete']), 'Pe cabinete', $byCabinet) . '</nav>'
    : '';
$title = match ($view) {
    'zi' => ucfirst(format_date($day, true)),
    'lista' => format_date($day) . ' – ' . format_date($day->modify('+6 days')),
    default => 'Săptămâna ' . (int) $monday->format('j') . ' ' . RO_MONTHS[(int) $monday->format('n') - 1] . ' – ' . format_date($monday->modify('+6 days')),
};
$toolbar = '<div class="mb-3 flex flex-wrap items-center gap-2">'
    . (count($allowed) > 1 ? '<nav aria-label="Clinica" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $clinicSwitch . '</nav>' : '')
    . '<nav aria-label="Vizualizare" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $viewSwitch . '</nav>'
    . $colSwitch
    . '<div class="flex items-center gap-1">'
    . '<a href="' . e($url(['data' => $day->modify("-{$step}")->format('Y-m-d')])) . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Înapoi">' . icon('chevron-left', 18) . '</a>'
    . '<a href="' . e($url(['data' => date('Y-m-d')])) . '" class="' . e(btn('secondary', 's')) . '">Azi</a>'
    . '<a href="' . e($url(['data' => $day->modify("+{$step}")->format('Y-m-d')])) . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Înainte">' . icon('chevron-right', 18) . '</a></div>'
    . '<form method="get" class="flex items-center gap-2"><input type="hidden" name="clinica" value="' . $clinicId . '"><input type="hidden" name="vizualizare" value="' . $view . '">'
    . ($byCabinet ? '<input type="hidden" name="coloane" value="cabinete">' : '')
    . '<label class="sr-only" for="cal-data">Mergeți la ziua</label><input id="cal-data" type="date" name="data" value="' . e($date) . '" class="' . e(input_classes('h-control-s w-[9.5rem]')) . '" data-trimite-la-schimbare>'
    . '<button type="submit" class="sr-only focus:not-sr-only">Mergeți</button></form>'
    . '</div>';

$movable = static fn (array $a) => in_array($a['status'], ['programat', 'confirmat', 'sosit', 'in-tratament'], true);
// The colour says the state at a glance: white not confirmed yet, orange confirmed, green arrived
// (darker in treatment), red did not come, grey done or cancelled. A click opens the quick menu.
$canProcedures = can('procedures', $user);
$block = static function (array $a, bool $compact = false) use ($movable, $url, $canProcedures): string {
    $cls = match ($a['status']) {
        'confirmat' => 'border-portocaliu bg-portocaliu-pal',
        'sosit' => 'border-actiune bg-menta-pal',
        'in-tratament' => 'border-actiune bg-menta/45',
        'finalizat' => 'border-linie bg-adancit text-discret',
        'neprezentat' => 'border-carmin bg-carmin-pal',
        'anulat' => 'border-linie bg-adancit text-discret line-through',
        default => 'border-dashed border-linie-control bg-suprafata',
    };
    // „Sunat, nu răspunde”: the appointment blinks red until the patient confirms.
    $noAnswer = appt_no_answer($a);
    $menu = ['id' => (int) $a['id'], 'stare' => APPT_STATUS[$a['status']] ?? $a['status'], 'nume' => patient_name($a), 'ora' => hm($a['starts_at']) . '–' . hm($a['ends_at']), 'actiuni' => appt_quick_actions($a['status']), 'inapoi' => $url([])]
        + (in_array($a['status'], ['programat', 'confirmat'], true) ? ['nuRaspunde' => $noAnswer ? hm($a['no_answer_at']) : ''] : [])
        // „Trimiteți SMS acum”: the appointment's SMS (tomorrow: the reminder), at once.
        + (in_array($a['status'], ['programat', 'confirmat'], true) && strtotime($a['ends_at']) > time() && phone_ro_mobile((string) $a['phone']) !== null ? ['sms' => format_phone((string) $a['phone'])] : [])
        // The doctors see two patients in the same half hour: a second appointment at the same time.
        + (in_array($a['status'], ['programat', 'confirmat', 'sosit', 'in-tratament'], true) ? ['alDoilea' => admin_url('/admin/programari/noua', ['clinica' => $a['location_id'], 'medic' => $a['doctor_id'], 'data' => substr($a['starts_at'], 0, 10), 'ora' => hm($a['starts_at']), 'durata' => (int) ((strtotime($a['ends_at']) - strtotime($a['starts_at'])) / 60), 'dublu' => 1, 'inapoi' => $url([])])] : [])
        + ($canProcedures && in_array($a['status'], ['sosit', 'in-tratament', 'finalizat'], true) ? ['proceduri' => admin_url('/admin/pacienti/' . (int) $a['patient_id'] . '/proceduri', ['programare' => $a['id'], 'medic' => $a['doctor_id'], 'data' => substr($a['starts_at'], 0, 10), 'clinica' => $a['location_id']]) . '#adauga'] : []);
    return '<a href="/admin/programari/' . (int) $a['id'] . '" data-meniu-stare="' . e((string) json_encode($menu, JSON_UNESCAPED_UNICODE)) . '" title="' . e(hm($a['starts_at']) . ' ' . patient_name($a) . ' · ' . (APPT_STATUS[$a['status']] ?? '') . ($noAnswer ? ' · sunat la ' . hm($a['no_answer_at']) . ', nu răspunde' : '')) . '" class="' . e(cn('block h-full overflow-hidden rounded-control border-l-4 border px-1.5 text-mic shadow-sm hover:shadow-float', $compact ? 'flex items-center gap-1 whitespace-nowrap py-0 text-[0.6875rem] leading-none' : 'py-0.5 leading-tight', $cls, $noAnswer ? 'da-alarma' : '', $movable($a) ? 'cursor-grab' : '')) . '" draggable="false">'
        . ($noAnswer ? admin_icon('phone-missed', 12, 'mr-0.5 inline-block shrink-0 align-[-1px] text-carmin', 'Nu răspunde') : '')
        . '<span class="shrink-0 font-semibold cifre" data-ora>' . e(hm($a['starts_at'])) . '</span> <span class="' . ($compact ? 'min-w-0 truncate font-semibold' : 'font-semibold') . '">' . e(patient_name($a)) . '</span>'
        . (in_array($a['comfort'], ['emotii', 'frica'], true) ? ' <span aria-label="emoții" class="inline-block size-2 shrink-0 rounded-full bg-mustar"></span>' : '')
        // A 15-minute appointment has room for one line: the time and the name; the rest is in the title and the menu.
        . ($compact ? '' : '<span class="block truncate text-discret">' . e($a['reason'] ?: service_title($a['category_slug'])) . '</span>') . '</a>';
};

if ($view === 'zi') {
    // 9:00–21:00, wider only when an appointment or the clinic's hours need it.
    $startHour = CAL_START_HOUR;
    $endHour = CAL_END_HOUR;
    foreach ($appts as $a) {
        $startHour = min($startHour, (int) substr($a['starts_at'], 11, 2));
        $endHour = max($endHour, (int) ceil(((int) substr($a['ends_at'], 11, 2) * 60 + (int) substr($a['ends_at'], 14, 2)) / 60));
    }
    if (isset($open[(int) $day->format('N')])) {
        $startHour = min($startHour, (int) substr($open[(int) $day->format('N')][0], 0, 2));
        $endHour = max($endHour, (int) ceil(((int) substr($open[(int) $day->format('N')][1], 0, 2) * 60 + (int) substr($open[(int) $day->format('N')][1], 3, 2)) / 60));
    }
    $endHour = min(24, $endHour);
    $rowsCount = ($endHour - $startHour) * 60 / CAL_SLOT_MIN;
    // The columns: the doctors, or the cabinets.
    $columns = $byCabinet
        ? array_map(static fn ($c) => ['id' => $c, 'label' => "Cabinetul {$c}", 'doctor' => null], range(1, $cabinetCount))
        : array_map(static fn ($d) => ['id' => (int) $d['id'], 'label' => $d['short'], 'doctor' => (int) $d['id']], $doctors);
    $cols = max(1, count($columns));
    $colIndex = array_flip(array_column($columns, 'id'));
    $calStart = strtotime("{$date} " . sprintf('%02d:00:00', $startHour));
    $calEnd = $calStart + ($endHour - $startHour) * 3600;
    $cfg = ['url' => '/admin/calendar/muta', 'date' => $date, 'start' => $startHour, 'slot' => CAL_SLOT_MIN, 'rows' => $rowsCount, 'by' => $byCabinet ? 'cabinet' : 'doctor', 'cols' => array_column($columns, 'id'), 'today' => $date === date('Y-m-d'), 'now' => (int) date('G') * 60 + (int) date('i')];
    $grid = '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><div data-cal="' . e((string) json_encode($cfg)) . '" class="relative grid min-w-[44rem] select-none" style="grid-template-columns:4rem repeat(' . $cols . ',minmax(9rem,1fr));grid-template-rows:auto repeat(' . $rowsCount . ',minmax(0.625rem,1fr));height:' . ($rowsCount * 1.6 + 3) . 'rem">';
    $grid .= '<div class="sticky top-0 border-b border-linie bg-suprafata" style="grid-row:1;grid-column:1"></div>';
    foreach ($columns as $i => $c) {
        $grid .= '<div data-cal-col class="border-b border-l border-linie bg-suprafata px-2 py-2 text-control font-semibold" style="grid-row:1;grid-column:' . ($i + 2) . '">' . e($c['label']) . '</div>';
    }
    for ($r = 0; $r < $rowsCount; $r++) {
        $min = $startHour * 60 + $r * CAL_SLOT_MIN;
        $hhmm = sprintf('%02d:%02d', intdiv($min, 60), $min % 60);
        $full = $min % 60 === 0;
        $grid .= '<div' . ($r === 0 ? ' data-cal-row' : '') . ' class="' . e(cn('pr-2 text-right text-mic text-discret cifre', $full ? 'border-t border-linie' : '')) . '" style="grid-row:' . ($r + 2) . ';grid-column:1">' . ($full ? $hhmm : '') . '</div>';
        foreach ($columns as $i => $c) {
            $q = ['clinica' => $clinicId, 'data' => $date, 'ora' => $hhmm, 'inapoi' => $url([])] + ($c['doctor'] !== null ? ['medic' => $c['doctor']] : []);
            $grid .= '<a href="' . e(admin_url('/admin/programari/noua', $q)) . '" class="' . e(cn('border-l border-linie hover:bg-menta-pal', $full ? 'border-t' : 'border-t border-t-linie/40')) . '" style="grid-row:' . ($r + 2) . ';grid-column:' . ($i + 2) . '" aria-label="' . e("Programare nouă, {$c['label']}, ora {$hhmm}") . '" tabindex="-1"></a>';
        }
    }
    // Grey: closed or not working (outside the hours, the break). Red: leave, clinic closed.
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
    $closedSpans = static function (array $span) use ($date, $calStart, $calEnd): array {
        $out = [[$calStart, strtotime("{$date} {$span[0]}")], [strtotime("{$date} {$span[1]}"), $calEnd]];
        if (isset($span[2])) {
            $out[] = [strtotime("{$date} {$span[2]}"), strtotime("{$date} {$span[3]}")];
        }
        return $out;
    };
    foreach ($columns as $i => $c) {
        if ($open !== []) {
            if (!isset($open[$weekday])) {
                $grid .= $shade($i, $calStart, $calEnd, 'bg-adancit/70 text-discret', 'Clinica e închisă');
                continue;
            }
            foreach ($closedSpans($open[$weekday]) as [$x, $y]) {
                $grid .= $shade($i, $x, $y, 'bg-adancit/70');
            }
        }
        if ($c['doctor'] !== null) {
            $sch = $schedules[$c['doctor']] ?? [];
            if ($sch !== []) {
                if (!isset($sch[$weekday])) {
                    $grid .= $shade($i, $calStart, $calEnd, 'bg-adancit/70 text-discret', 'Nu lucrează aici azi');
                } else {
                    foreach ($closedSpans($sch[$weekday]) as $k => [$x, $y]) {
                        $grid .= $shade($i, $x, $y, 'bg-adancit/70 text-discret', $k === 2 ? 'Pauză' : '');
                    }
                }
            }
        }
        foreach ($timeOff as $t) {
            $applies = $c['doctor'] !== null ? time_off_applies($t, $c['doctor'], $clinicId) : $t['doctor_id'] === null;
            if ($applies) {
                $grid .= $shade($i, strtotime($t['starts_at']), strtotime($t['ends_at']), 'bg-carmin-pal/80 text-carmin', TIME_OFF_KINDS[$t['kind']] ?? 'Absent');
            }
        }
    }
    // Appointments that overlap in one column share it side by side, each in its own lane.
    $lane = [];
    $byColumn = [];
    foreach ($appts as $a) {
        $key = $byCabinet ? ($a['cabinet'] !== null ? (int) $a['cabinet'] : ($usualCabinet[(int) $a['doctor_id']] ?? 1)) : (int) $a['doctor_id'];
        $byColumn[$key][] = $a;
    }
    foreach ($byColumn as $list) {
        usort($list, static fn ($x, $y) => [$x['starts_at'], $y['ends_at']] <=> [$y['starts_at'], $x['ends_at']]);
        $group = [];
        $groupEnd = '';
        $laneEnds = [];
        $close = static function () use (&$group, &$laneEnds, &$lane): void {
            foreach ($group as $id) {
                $lane[$id][1] = count($laneEnds);
            }
            $group = [];
            $laneEnds = [];
        };
        foreach ($list as $a) {
            if ($group !== [] && $a['starts_at'] >= $groupEnd) {
                $close();
                $groupEnd = '';
            }
            $free = null;
            foreach ($laneEnds as $i => $end) {
                if ($end <= $a['starts_at']) {
                    $free = $i;
                    break;
                }
            }
            $free ??= count($laneEnds);
            $laneEnds[$free] = $a['ends_at'];
            $lane[(int) $a['id']] = [$free, 1];
            $group[] = (int) $a['id'];
            $groupEnd = max($groupEnd, $a['ends_at']);
        }
        $close();
    }
    $others = [];
    foreach ($appts as $a) {
        $key = $byCabinet ? ($a['cabinet'] !== null ? (int) $a['cabinet'] : ($usualCabinet[(int) $a['doctor_id']] ?? 1)) : (int) $a['doctor_id'];
        if (!isset($colIndex[$key])) {
            $others[] = $a;
            continue;
        }
        $s = (int) floor((strtotime($a['starts_at']) - $calStart) / 60 / CAL_SLOT_MIN);
        $len = max(1, (int) ceil((strtotime($a['ends_at']) - strtotime($a['starts_at'])) / 60 / CAL_SLOT_MIN));
        $s = max(0, min($rowsCount - 1, $s));
        $len = min($len, $rowsCount - $s);
        $data = $movable($a) ? ' data-appt="' . (int) $a['id'] . '" data-rand="' . $s . '" data-lungime="' . $len . '" data-col="' . $colIndex[$key] . '" data-medic="' . (int) $a['doctor_id'] . '" data-cabinet="' . ($a['cabinet'] ?? '') . '"' : '';
        [$li, $ln] = $lane[(int) $a['id']] ?? [0, 1];
        $side = $ln > 1 ? ';width:calc(100% / ' . $ln . ');margin-left:calc(100% * ' . $li . ' / ' . $ln . ')' : '';
        $grid .= '<div' . $data . ' class="relative z-10 min-h-0 p-px" style="grid-row:' . ($s + 2) . ' / span ' . $len . ';grid-column:' . ($colIndex[$key] + 2) . $side . '">' . $block($a, $len <= 2 || $ln > 2)
            . ($movable($a) ? '<span data-trage-jos aria-hidden="true" class="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize rounded-full hover:bg-actiune/40"></span>' : '') . '</div>';
    }
    if ($date === date('Y-m-d')) {
        $grid .= '<div data-acum class="pointer-events-none relative z-20" style="grid-row:2;grid-column:2 / -1" hidden><span class="absolute inset-x-0 h-0.5 bg-carmin"></span><span class="absolute -left-1.5 -top-1 size-2.5 rounded-full bg-carmin"></span></div>';
    }
    $grid .= '</div></div>';
    if ($others !== []) {
        $grid .= '<p class="mt-4 text-mic text-discret">Programări la medici care nu mai lucrează la această clinică: ' . e(implode(', ', array_map(static fn ($a) => hm($a['starts_at']) . ' ' . patient_name($a), $others))) . '</p>';
    }
    $hint = '<p class="mt-3 text-mic text-discret">Apăsați pe o programare ca s-o marcați: confirmat, a sosit, nu a venit. Trageți o programare la altă oră' . ($byCabinet ? ' sau în alt cabinet' : ' sau la alt medic') . '; trageți de marginea de jos ca să schimbați durata. Pacientul primește noua oră după două minute, timp în care puteți apăsa „Anulați”.</p>';
    $content = $columns === [] ? '<p class="text-corp text-discret">Niciun medic nu e trecut la această clinică. Bifați clinica în Echipa → medicul.</p>' : $grid . $hint;
} elseif ($view === 'lista') {
    $byDay = [];
    foreach ($appts as $a) {
        $byDay[substr($a['starts_at'], 0, 10)][] = $a;
    }
    $th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
    $content = '<p class="mb-4"><a class="text-link underline underline-offset-4" href="' . e($url(['anulate' => query('anulate') === '1' ? null : '1'])) . '">' . (query('anulate') === '1' ? 'Ascundeți programările anulate' : 'Arătați și programările anulate') . '</a></p><div class="flex flex-col gap-6">';
    for ($i = 0; $i < 7; $i++) {
        $d = $day->modify("+{$i} days");
        $key = $d->format('Y-m-d');
        $rows = '';
        foreach ($byDay[$key] ?? [] as $a) {
            $rows .= '<tr class="border-t border-linie">'
                . '<td class="cifre px-3 py-2 font-semibold"><a class="text-link underline-offset-4 hover:underline" href="/admin/programari/' . (int) $a['id'] . '">' . e(hm($a['starts_at']) . '–' . hm($a['ends_at'])) . '</a></td>'
                . '<td class="px-3 py-2"><a class="font-semibold underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $a['patient_id'] . '">' . e(patient_name($a)) . '</a><span class="block text-mic text-discret">' . e(format_phone((string) $a['phone'])) . '</span></td>'
                . '<td class="px-3 py-2">' . e($docs[(int) $a['doctor_id']] ?? '') . ($a['cabinet'] ? '<span class="block text-mic text-discret">Cabinetul ' . (int) $a['cabinet'] . '</span>' : '') . '</td>'
                . '<td class="px-3 py-2">' . e($a['reason'] ?: service_title($a['category_slug'])) . '</td>'
                . '<td class="px-3 py-2"><span class="flex flex-wrap gap-1">' . appt_status_chip($a['status']) . (appt_no_answer($a) ? appt_no_answer_chip($a) : '') . '</span></td></tr>';
        }
        $off = in_array($key, $holidays, true) ? ' · sărbătoare legală' : '';
        $content .= '<section aria-label="' . e(format_date($d, true)) . '"><h2 class="mb-2 text-h3 font-semibold first-letter:uppercase">' . e(format_date($d, true)) . '<span class="text-corp font-normal text-discret">' . e($off) . ' · ' . (isset($byDay[$key]) ? count_ro(count($byDay[$key]), 'o programare', 'programări') : 'nicio programare') . '</span></h2>'
            . ($rows !== '' ? '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[44rem] table-fixed border-collapse text-corp"><thead class="bg-fundal"><tr><th scope="col" class="' . $th . ' w-36">Ora</th><th scope="col" class="' . $th . ' w-[26%]">Pacientul</th><th scope="col" class="' . $th . ' w-[18%]">Medicul</th><th scope="col" class="' . $th . '">Motivul</th><th scope="col" class="' . $th . ' w-40">Starea</th></tr></thead><tbody>' . $rows . '</tbody></table></div>'
                : '<p class="text-corp text-discret">Nicio programare.</p>')
            . '</section>';
    }
    $content .= '</div>';
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
        $off = in_array($key, $holidays, true) ? 'Sărbătoare legală' : ($open !== [] && !isset($open[(int) $d->format('N')]) ? 'Clinica e închisă' : '');
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
foreach ($view === 'zi' ? [$date] : array_map(static fn ($i) => $from->modify("+{$i} days")->format('Y-m-d'), range(0, 6)) as $k) {
    if (in_array($k, $holidays, true)) {
        $notes[] = ucfirst(format_date($k, true)) . ': sărbătoare legală (pe site nu se fac programări).';
    }
}
foreach ($timeOff as $t) {
    $notes[] = time_off_label($t) . '.';
}
$notesHtml = $notes !== [] ? '<ul class="mb-4 flex flex-col gap-1 rounded-panou border border-mustar bg-mustar-pal p-3 text-mic">' . implode('', array_map(static fn ($n) => '<li class="flex items-start gap-2">' . icon('user-x', 16, 'mt-0.5') . '<span>' . e($n) . '</span></li>', array_unique($notes))) . '<li><a class="text-link underline" href="/admin/absente">Absențe și zile libere</a></li></ul>' : '';
$active = array_filter($appts, static fn ($a) => $a['status'] !== 'anulat');
$legendItem = static fn (string $cls, string $label) => '<li class="flex items-center gap-1.5"><span aria-hidden="true" class="' . e(cn('inline-block size-3.5 rounded-sm border border-l-4', $cls)) . '"></span>' . e($label) . '</li>';
$legendList = $view !== 'lista' ? '<ul class="flex flex-wrap gap-x-4 gap-y-1 text-mic text-discret" aria-label="Culorile programărilor">'
    . $legendItem('border-dashed border-linie-control bg-suprafata', 'Programat') . $legendItem('border-portocaliu bg-portocaliu-pal', 'Confirmat')
    . $legendItem('border-actiune bg-menta-pal', 'A sosit') . $legendItem('border-actiune bg-menta/45', 'În tratament')
    . $legendItem('border-carmin bg-carmin-pal', 'Nu a venit') . $legendItem('border-linie bg-adancit', 'Finalizat / anulat')
    . $legendItem('da-alarma border-carmin bg-suprafata', 'Sunat, nu răspunde (clipește)') . '</ul>' : '';
// Beside the title on a wide screen; under the calendar on a tablet, so the day keeps its height.
$legend = $legendList !== '' ? '<div class="hidden 2xl:block">' . $legendList . '</div>' : '';
$legendBelow = $legendList !== '' ? '<div class="mt-3 2xl:hidden">' . $legendList . '</div>' : '';
// A short header: the day view should show 9:00–21:00 without scrolling.
$body = '<div class="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1"><div class="flex flex-wrap items-baseline gap-x-4">'
    . '<h1 class="font-display text-[1.875rem] leading-tight text-cerneala">Calendar</h1>'
    . '<p class="text-corp text-discret first-letter:uppercase">' . e($title . ' · ' . ($names[$clinicId] ?? '') . ' · ' . count_ro(count($active), 'o programare', 'programări')) . '</p></div>' . '<div class="flex flex-wrap items-center gap-x-5 gap-y-2">' . $legend
    . '<a href="' . e(admin_url('/admin/programari/noua', ['clinica' => $clinicId, 'data' => $date, 'inapoi' => $url([])])) . '" class="' . e(btn('primary', 's')) . '">' . icon('plus', 16) . 'Programare nouă</a></div></div>'
    . $toolbar . $notesHtml . $content . $legendBelow
    . '<div data-cal-anunt role="status" aria-live="polite" hidden class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-panou bg-cerneala px-4 py-3 text-corp text-fundal shadow-float"></div>'
    . '<input type="hidden" data-cal-csrf value="' . e(csrf_token()) . '">'
    . '<div data-meniu-programare role="dialog" aria-label="Starea programării" hidden class="fixed z-50 w-64 rounded-panou border border-linie bg-suprafata p-3 text-corp shadow-float"></div>';
admin_page('Calendar', $body, $user);
