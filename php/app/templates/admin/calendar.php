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
$seg = static fn (string $href, string $label, bool $on, string $onCls = 'bg-menta-pal font-semibold') => '<a href="' . e($href) . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-control', $on ? $onCls : 'hover:bg-adancit')) . '">' . $label . '</a>';
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
$toolbar = '<div class="mb-6 flex flex-wrap items-center gap-3">'
    . (count($allowed) > 1 ? '<nav aria-label="Clinica" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $clinicSwitch . '</nav>' : '')
    . '<nav aria-label="Vizualizare" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">' . $viewSwitch . '</nav>'
    . $colSwitch
    . '<div class="flex items-center gap-1">'
    . '<a href="' . e($url(['data' => $day->modify("-{$step}")->format('Y-m-d')])) . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Înapoi">' . icon('chevron-left', 18) . '</a>'
    . '<a href="' . e($url(['data' => date('Y-m-d')])) . '" class="' . e(btn('secondary', 's')) . '">Azi</a>'
    . '<a href="' . e($url(['data' => $day->modify("+{$step}")->format('Y-m-d')])) . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Înainte">' . icon('chevron-right', 18) . '</a></div>'
    . '<form method="get" class="flex items-center gap-2"><input type="hidden" name="clinica" value="' . $clinicId . '"><input type="hidden" name="vizualizare" value="' . $view . '">'
    . ($byCabinet ? '<input type="hidden" name="coloane" value="cabinete">' : '')
    . '<label class="sr-only" for="cal-data">Mergeți la ziua</label><input id="cal-data" type="date" name="data" value="' . e($date) . '" class="' . e(input_classes('h-control-s w-auto')) . '" data-trimite-la-schimbare>'
    . '<button type="submit" class="' . e(btn('text', 's')) . '">Mergeți</button></form>'
    . '<a href="' . e(admin_url('/admin/programari/noua', ['clinica' => $clinicId, 'data' => $date, 'inapoi' => $url([])])) . '" class="' . e(btn('primary', 's', 'ml-auto')) . '">' . icon('plus', 16) . 'Programare nouă</a>'
    . '</div>';

$movable = static fn (array $a) => in_array($a['status'], ['programat', 'confirmat', 'sosit', 'in-tratament'], true);
$block = static function (array $a) use ($movable): string {
    $cls = match ($a['status']) {
        'confirmat' => 'border-actiune bg-suprafata',
        'sosit', 'in-tratament' => 'border-actiune bg-menta-pal',
        'finalizat' => 'border-linie bg-adancit text-discret',
        'neprezentat' => 'border-carmin bg-carmin-pal',
        'anulat' => 'border-linie bg-adancit text-discret line-through',
        default => 'border-dashed border-linie-control bg-suprafata',
    };
    return '<a href="/admin/programari/' . (int) $a['id'] . '" class="' . e(cn('block h-full overflow-hidden rounded-control border-l-4 border px-2 py-1 text-mic leading-tight shadow-sm hover:shadow-float', $cls, $movable($a) ? 'cursor-grab' : '')) . '" draggable="false">'
        . '<span class="font-semibold cifre" data-ora>' . e(hm($a['starts_at'])) . '</span> <span class="font-semibold">' . e(patient_name($a)) . '</span>'
        . (in_array($a['comfort'], ['emotii', 'frica'], true) ? ' <span aria-label="emoții" class="inline-block size-2 rounded-full bg-mustar"></span>' : '')
        . '<span class="block truncate text-discret">' . e($a['reason'] ?: service_title($a['category_slug'])) . '</span></a>';
};

if ($view === 'zi') {
    $rowsCount = (CAL_END_HOUR - CAL_START_HOUR) * 60 / CAL_SLOT_MIN;
    // The columns: the doctors, or the cabinets.
    $columns = $byCabinet
        ? array_map(static fn ($c) => ['id' => $c, 'label' => "Cabinetul {$c}", 'doctor' => null], range(1, $cabinetCount))
        : array_map(static fn ($d) => ['id' => (int) $d['id'], 'label' => $d['short'], 'doctor' => (int) $d['id']], $doctors);
    $cols = max(1, count($columns));
    $colIndex = array_flip(array_column($columns, 'id'));
    $calStart = strtotime("{$date} " . sprintf('%02d:00:00', CAL_START_HOUR));
    $calEnd = strtotime("{$date} " . sprintf('%02d:00:00', CAL_END_HOUR));
    $cfg = ['url' => '/admin/calendar/muta', 'date' => $date, 'start' => CAL_START_HOUR, 'slot' => CAL_SLOT_MIN, 'rows' => $rowsCount, 'by' => $byCabinet ? 'cabinet' : 'doctor', 'cols' => array_column($columns, 'id'), 'today' => $date === date('Y-m-d'), 'now' => (int) date('G') * 60 + (int) date('i')];
    $grid = '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><div data-cal="' . e((string) json_encode($cfg)) . '" class="relative grid min-w-[44rem] select-none" style="grid-template-columns:4rem repeat(' . $cols . ',minmax(9rem,1fr));grid-template-rows:auto repeat(' . $rowsCount . ',1.6rem)">';
    $grid .= '<div class="sticky top-0 border-b border-linie bg-suprafata" style="grid-row:1;grid-column:1"></div>';
    foreach ($columns as $i => $c) {
        $grid .= '<div data-cal-col class="border-b border-l border-linie bg-suprafata px-2 py-2 text-control font-semibold" style="grid-row:1;grid-column:' . ($i + 2) . '">' . e($c['label']) . '</div>';
    }
    for ($r = 0; $r < $rowsCount; $r++) {
        $min = CAL_START_HOUR * 60 + $r * CAL_SLOT_MIN;
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
        $grid .= '<div' . $data . ' class="relative z-10 p-0.5" style="grid-row:' . ($s + 2) . ' / span ' . $len . ';grid-column:' . ($colIndex[$key] + 2) . '">' . $block($a)
            . ($movable($a) ? '<span data-trage-jos aria-hidden="true" class="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize rounded-full hover:bg-actiune/40"></span>' : '') . '</div>';
    }
    if ($date === date('Y-m-d')) {
        $grid .= '<div data-acum class="pointer-events-none relative z-20" style="grid-row:2;grid-column:2 / -1" hidden><span class="absolute inset-x-0 h-0.5 bg-carmin"></span><span class="absolute -left-1.5 -top-1 size-2.5 rounded-full bg-carmin"></span></div>';
    }
    $grid .= '</div></div>';
    if ($others !== []) {
        $grid .= '<p class="mt-4 text-mic text-discret">Programări la medici care nu mai lucrează la această clinică: ' . e(implode(', ', array_map(static fn ($a) => hm($a['starts_at']) . ' ' . patient_name($a), $others))) . '</p>';
    }
    $hint = '<p class="mt-3 text-mic text-discret">Trageți o programare la altă oră' . ($byCabinet ? ' sau în alt cabinet' : ' sau la alt medic') . '; trageți de marginea de jos ca să schimbați durata. Pacientul primește noua oră după două minute, timp în care puteți apăsa „Anulați”.</p>';
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
                . '<td class="px-3 py-2">' . appt_status_chip($a['status']) . '</td></tr>';
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
$body = admin_header('Calendar', $title . ' · ' . ($names[$clinicId] ?? '') . ' · ' . count_ro(count($active), 'o programare', 'programări'))
    . $toolbar . $notesHtml . $content
    . '<div data-cal-anunt role="status" aria-live="polite" hidden class="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-panou bg-cerneala px-4 py-3 text-corp text-fundal shadow-float"></div>'
    . '<input type="hidden" data-cal-csrf value="' . e(csrf_token()) . '">';
admin_page('Calendar', $body, $user);
