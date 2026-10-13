<?php
/**
 * Online booking: when each doctor works at each clinic (Echipa → medic → „Unde și când lucrează”,
 * with a break), the days off (leave, training, blocked hours, clinic closures, legal holidays),
 * the free times that follow (minus appointments and the gap between them, from the notice the
 * clinic wants up to the days ahead it allows, on a grid of N minutes, as long as the service
 * takes), and booking one of them. Used by /programare on the site and by the AI chat.
 */
declare(strict_types=1);

const WEEKDAYS = [1 => 'Luni', 2 => 'Marți', 3 => 'Miercuri', 4 => 'Joi', 5 => 'Vineri', 6 => 'Sâmbătă', 7 => 'Duminică'];
const MONTHS_RO = [1 => 'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const CHAT_DEFAULTS = [
    'enabled' => false,
    'model' => 'claude-sonnet-5-5',
    'mode' => 'cerere',
    'daily_limit' => 300,
    'retention_days' => 90,
];
const CHAT_MODES = [
    'cerere' => 'Cerere: pacientul alege ora, recepția o confirmă la telefon',
    'direct' => 'Direct în calendar, după un cod primit prin SMS',
];

const BOOKING_DEFAULTS = [
    'enabled' => true,
    'default_minutes' => 30,
    'step_minutes' => 15,
    'notice_minutes' => 120,
    'days_ahead' => 30,
    'buffer_minutes' => 0,
    'cancel_hours' => 2,
    'morning_until' => '13:00',
];
const TIME_OFF_KINDS = ['concediu' => 'Concediu', 'formare' => 'Formare / curs', 'blocaj' => 'Interval blocat', 'sarbatoare' => 'Zi liberă'];
const SERVICE_MINUTES = [10 => '10 min', 15 => '15 min', 20 => '20 min', 30 => '30 min', 45 => '45 min', 60 => '1 oră', 75 => '1 h 15', 90 => '1 h 30', 120 => '2 ore', 150 => '2 h 30', 180 => '3 ore'];

/** Setări → Programări online. */
function booking_settings(): array
{
    $s = setting('programare_online');
    return array_merge(BOOKING_DEFAULTS, is_array($s) ? $s : []);
}

function chat_settings(): array
{
    $s = setting('chat');
    return array_merge(CHAT_DEFAULTS, is_array($s) ? $s : []);
}

/** Booking straight into the calendar needs SMS sending switched on (the code proves the phone). */
function chat_direct_booking(): bool
{
    $m = messaging();
    return chat_settings()['mode'] === 'direct' && messaging_live() && $m['smslink_id'] !== '' && $m['smslink_pass'] !== '';
}

/**
 * A doctor's week at one clinic: weekday (1 = Monday) → [from, to] or [from, to, break from,
 * break to]. Wrong rows are left out.
 *
 * @return array<int,list<string>>
 */
function schedule_decode(?string $json): array
{
    $hm = static fn ($v) => is_string($v) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v) === 1;
    $out = [];
    foreach (json_decode((string) $json, true) ?: [] as $day => $span) {
        if (!isset(WEEKDAYS[(int) $day]) || !is_array($span) || !in_array(count($span), [2, 4], true) || !$hm($span[0]) || !$hm($span[1]) || $span[0] >= $span[1]) {
            continue;
        }
        $row = [(string) $span[0], (string) $span[1]];
        if (count($span) === 4 && $hm($span[2]) && $hm($span[3]) && $span[0] < $span[2] && $span[2] < $span[3] && $span[3] < $span[1]) {
            $row[] = (string) $span[2];
            $row[] = (string) $span[3];
        }
        $out[(int) $day] = $row;
    }
    ksort($out);
    return $out;
}

/** „Luni–Vineri 09:00–17:00 (pauză 13:00–13:30), Sâmbătă 09:00–13:00” */
function schedule_text(array $sch): string
{
    $groups = [];
    foreach ($sch as $day => $span) {
        $last = array_key_last($groups);
        if ($last !== null && $groups[$last]['span'] === $span && $groups[$last]['to'] === $day - 1) {
            $groups[$last]['to'] = $day;
        } else {
            $groups[] = ['from' => $day, 'to' => $day, 'span' => $span];
        }
    }
    return implode(', ', array_map(static fn ($g) => WEEKDAYS[$g['from']] . ($g['to'] !== $g['from'] ? '–' . WEEKDAYS[$g['to']] : '') . ' ' . $g['span'][0] . '–' . $g['span'][1]
        . (isset($g['span'][2]) ? ' (pauză ' . $g['span'][2] . '–' . $g['span'][3] . ')' : ''), $groups));
}

/** The legal holidays in Romania (Codul muncii art. 139), with the Orthodox Easter and Pentecost. */
function ro_holidays(int $year): array
{
    // Orthodox Easter (Meeus, Julian calendar, + 13 days for 1900–2099).
    $a = $year % 4;
    $b = $year % 7;
    $c = $year % 19;
    $d = (19 * $c + 15) % 30;
    $e = (2 * $a + 4 * $b - $d + 34) % 7;
    $month = intdiv($d + $e + 114, 31);
    $day = (($d + $e + 114) % 31) + 1;
    $easter = (new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $month, $day)))->modify('+13 days');
    $days = ['01-01', '01-02', '01-06', '01-07', '01-24', '05-01', '06-01', '08-15', '11-30', '12-01', '12-25', '12-26'];
    $out = array_map(static fn ($md) => "{$year}-{$md}", $days);
    foreach (['-2 days', '+0 days', '+1 day', '+49 days', '+50 days'] as $shift) {
        $out[] = $easter->modify($shift)->format('Y-m-d');
    }
    return $out;
}

/** „miercuri, 14 octombrie” */
function day_label(string $date): string
{
    $t = strtotime($date);
    return mb_strtolower(WEEKDAYS[(int) date('N', $t)]) . ', ' . (int) date('j', $t) . ' ' . MONTHS_RO[(int) date('n', $t)];
}

/**
 * The days off that touch [$from, $to): a doctor's own (everywhere or at a clinic) and the
 * clinics' closures.
 *
 * @return list<array> rows of time_off
 */
function time_off_between(string $from, string $to, ?array $doctorIds = null, ?array $locationIds = null): array
{
    $where = ['starts_at < ?', 'ends_at > ?'];
    $params = [$to, $from];
    $or = [];
    if ($doctorIds !== null && $doctorIds !== []) {
        $or[] = 'doctor_id IN (' . implode(',', array_map('intval', $doctorIds)) . ')';
    }
    if ($locationIds !== null && $locationIds !== []) {
        $or[] = '(doctor_id IS NULL AND location_id IN (' . implode(',', array_map('intval', $locationIds)) . '))';
    }
    if ($or !== []) {
        $where[] = '(' . implode(' OR ', $or) . ')';
    }
    return db_all('SELECT * FROM time_off WHERE ' . implode(' AND ', $where) . ' ORDER BY starts_at', $params);
}

/** Whether a time-off row applies to a doctor at a clinic. */
function time_off_applies(array $t, int $doctorId, int $locationId): bool
{
    if ($t['doctor_id'] === null) {
        return (int) $t['location_id'] === $locationId;
    }
    return (int) $t['doctor_id'] === $doctorId && ($t['location_id'] === null || (int) $t['location_id'] === $locationId);
}

/** „Concediu, Dr. Mașca, 20–24 oct.” — who and what, for lists and conflicts. */
function time_off_label(array $t): string
{
    $who = $t['doctor_id'] !== null ? (doctor_short_names()[(int) $t['doctor_id']] ?? 'Medic') : 'Clinica ' . (db_value('SELECT short_name FROM locations WHERE id = ?', [(int) $t['location_id']]) ?: '');
    $s = new DateTimeImmutable($t['starts_at']);
    $e = (new DateTimeImmutable($t['ends_at']))->modify('-1 second');
    $whole = $s->format('H:i') === '00:00' && $t['ends_at'] === (new DateTimeImmutable($t['ends_at']))->setTime(0, 0)->format('Y-m-d H:i:s');
    $when = $s->format('Y-m-d') === $e->format('Y-m-d')
        ? format_date($s) . ($whole ? '' : ', ' . $s->format('H:i') . '–' . (new DateTimeImmutable($t['ends_at']))->format('H:i'))
        : format_date($s) . ' – ' . format_date($e);
    return (TIME_OFF_KINDS[$t['kind']] ?? $t['kind']) . ', ' . $who . ', ' . $when . ($t['reason'] ? ' (' . $t['reason'] . ')' : '');
}

/** [from, to) minus the given intervals (all as timestamps). @return list<array{0:int,1:int}> */
function intervals_subtract(array $windows, array $cuts): array
{
    foreach ($cuts as [$cs, $ce]) {
        $next = [];
        foreach ($windows as [$ws, $we]) {
            if ($ce <= $ws || $cs >= $we) {
                $next[] = [$ws, $we];
                continue;
            }
            if ($cs > $ws) {
                $next[] = [$ws, $cs];
            }
            if ($ce < $we) {
                $next[] = [$ce, $we];
            }
        }
        $windows = $next;
    }
    return $windows;
}

/** Each clinic's opening hours by weekday (Setări → clinica); [] = not set (the doctors' hours rule). */
function location_hours(): array
{
    static $hours = null;
    if ($hours === null) {
        $hours = [];
        foreach (db_all('SELECT id, hours_json FROM locations') as $l) {
            $hours[(int) $l['id']] = schedule_decode($l['hours_json']);
        }
    }
    return $hours;
}

/**
 * What stands against an appointment at that time. „block”: the doctor is away or the clinic is
 * closed (the absence has to go first). „warn”: in the past, outside the hours, the doctor or the
 * patient already booked, the cabinet taken; reception may go on.
 *
 * @return array{block: ?string, warn: list<string>}
 */
function appointment_checks(int $doc, int $loc, string $start, string $end, ?int $patientId = null, ?int $exceptId = null, ?int $cabinet = null): array
{
    foreach (time_off_between($start, $end, [$doc], [$loc]) as $t) {
        if (time_off_applies($t, $doc, $loc)) {
            return ['block' => 'În acest interval: ' . time_off_label($t) . '. Alegeți altă oră sau ștergeți întâi absența, la Absențe și zile libere.', 'warn' => []];
        }
    }
    $warn = [];
    if (strtotime($start) < time() - 600) {
        $warn[] = 'Ora este în trecut.';
    }
    foreach (appointment_conflicts($doc, $start, $end, $exceptId) as $c) {
        $warn[] = 'Medicul are deja: ' . hm($c['starts_at']) . '–' . hm($c['ends_at']) . ', ' . patient_name($c) . '.';
    }
    if ($patientId !== null) {
        foreach (patient_conflicts($patientId, $start, $end, $exceptId) as $c) {
            $warn[] = 'Pacientul are deja o programare: ' . hm($c['starts_at']) . '–' . hm($c['ends_at']) . ', ' . ($c['doctor'] ?? '') . '.';
        }
    }
    foreach (schedule_warnings($doc, $loc, $start, $end) as $w) {
        $warn[] = $w;
    }
    $active = "'" . implode("','", APPT_ACTIVE) . "'";
    if ($cabinet !== null) {
        foreach (db_all("SELECT a.starts_at, a.ends_at, d.public_name FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.location_id = ? AND a.cabinet = ? AND a.status IN ({$active}) AND a.starts_at < ? AND a.ends_at > ? AND a.id <> ?", [$loc, $cabinet, $end, $start, $exceptId ?? 0]) as $c) {
            $warn[] = "Cabinetul {$cabinet} este ocupat: " . hm($c['starts_at']) . '–' . hm($c['ends_at']) . ', ' . $c['public_name'] . '.';
        }
    }
    return ['block' => null, 'warn' => $warn];
}

/**
 * Why a time picked by reception may be wrong (they can still book it): outside the doctor's
 * hours at that clinic, in the break, or on a legal holiday.
 *
 * @return list<string>
 */
function schedule_warnings(int $doctorId, int $locationId, string $start, string $end): array
{
    $out = [];
    $day = substr($start, 0, 10);
    if (in_array($day, ro_holidays((int) substr($day, 0, 4)), true)) {
        $out[] = 'Este zi de sărbătoare legală.';
    }
    $open = location_hours()[$locationId] ?? [];
    if ($open !== []) {
        $c = $open[(int) date('N', strtotime($start))] ?? null;
        $cTo = substr($end, 0, 10) === $day ? substr($end, 11, 5) : '24:00';
        if ($c === null) {
            $out[] = 'Clinica este închisă în această zi.';
        } elseif (substr($start, 11, 5) < $c[0] || $cTo > $c[1]) {
            $out[] = "Este în afara programului clinicii ({$c[0]}–{$c[1]}).";
        }
    }
    $sch = schedule_decode(db_value('SELECT schedule FROM doctor_locations WHERE doctor_id = ? AND location_id = ?', [$doctorId, $locationId]) ?: null);
    if ($sch === []) {
        return $out;
    }
    $w = $sch[(int) date('N', strtotime($start))] ?? null;
    $from = substr($start, 11, 5);
    $to = substr($end, 0, 10) === $day ? substr($end, 11, 5) : '24:00';
    if ($w === null) {
        $out[] = 'Medicul nu lucrează în această zi la această clinică.';
    } elseif ($from < $w[0] || $to > $w[1]) {
        $out[] = "Este în afara programului medicului ({$w[0]}–{$w[1]}).";
    } elseif (isset($w[2], $w[3]) && $from < $w[3] && $to > $w[2]) {
        $out[] = "Este în pauza medicului ({$w[2]}–{$w[3]}).";
    }
    return $out;
}

/**
 * The free times, soonest first. Options: location_id, category (slug), service_id, doctor_id,
 * from (date), days, part (dimineata | dupa-amiaza | oricand), duration (minutes), limit, per_day
 * (spread over the day; null = all), online (true: holidays, notice, doctors who take online
 * bookings; false: what the panel may use).
 *
 * @return list<array{id:string,start:string,end:string,location_id:int,doctor_id:int,doctor_ids:list<int>}>
 */
function free_slots(array $o = [], ?DateTimeImmutable $now = null): array
{
    $cfg = booking_settings();
    $online = $o['online'] ?? true;
    $now ??= new DateTimeImmutable();
    $service = !empty($o['service_id']) ? db_one('SELECT s.*, c.slug AS category_slug FROM services s JOIN categories c ON c.id = s.category_id WHERE s.id = ?', [(int) $o['service_id']]) : null;
    $len = max(5, (int) ($o['duration'] ?? ($service['duration_minutes'] ?? $cfg['default_minutes'])));
    $step = max(5, (int) $cfg['step_minutes']);
    $buffer = max(0, (int) $cfg['buffer_minutes']) * 60;
    $earliest = $online ? $now->modify('+' . max(0, (int) $cfg['notice_minutes']) . ' minutes') : $now;
    $category = $o['category'] ?? ($service['category_slug'] ?? null);

    $sql = 'SELECT dl.doctor_id, dl.location_id, dl.schedule, d.sort_order FROM doctor_locations dl JOIN doctors d ON d.id = dl.doctor_id WHERE dl.schedule IS NOT NULL';
    $params = [];
    if ($online) {
        $sql .= ' AND d.accepts_online = 1';
    }
    if (!empty($o['location_id'])) {
        $sql .= ' AND dl.location_id = ?';
        $params[] = (int) $o['location_id'];
    }
    if (!empty($o['doctor_id'])) {
        $sql .= ' AND dl.doctor_id = ?';
        $params[] = (int) $o['doctor_id'];
    }
    $rows = db_all($sql . ' ORDER BY d.sort_order, d.id', $params);
    // Only the doctors who do the service (if nobody is marked for it, everyone).
    if ($category) {
        $doers = array_map('intval', array_column(db_all('SELECT dc.doctor_id FROM doctor_categories dc JOIN categories c ON c.id = dc.category_id WHERE c.slug = ?', [$category]), 'doctor_id'));
        if ($doers !== []) {
            $rows = array_values(array_filter($rows, static fn ($r) => in_array((int) $r['doctor_id'], $doers, true)));
        }
    }
    $plans = [];
    foreach ($rows as $r) {
        $sch = schedule_decode($r['schedule']);
        if ($sch !== []) {
            $plans[] = ['doctor_id' => (int) $r['doctor_id'], 'location_id' => (int) $r['location_id'], 'sch' => $sch, 'order' => (int) $r['sort_order']];
        }
    }
    if ($plans === []) {
        return [];
    }
    $from = new DateTimeImmutable(!empty($o['from']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $o['from']) ? $o['from'] : 'today');
    $start = max($from->setTime(0, 0), $now->setTime(0, 0));
    $horizon = $now->setTime(0, 0)->modify('+' . max(1, (int) $cfg['days_ahead']) . ' days');
    $last = !empty($o['days']) ? min($horizon, $start->modify('+' . ((int) $o['days'] - 1) . ' days')) : ($online ? $horizon : $start->modify('+60 days'));
    $limit = max(1, min(2000, (int) ($o['limit'] ?? 12)));
    $perDay = array_key_exists('per_day', $o) && $o['per_day'] === null ? null : max(1, (int) ($o['per_day'] ?? 4));
    $part = $o['part'] ?? 'oricand';
    $split = (string) $cfg['morning_until'];

    $doctorIds = array_values(array_unique(array_column($plans, 'doctor_id')));
    $locationIds = array_values(array_unique(array_column($plans, 'location_id')));
    $in = implode(',', $doctorIds);
    $active = "'" . implode("','", APPT_ACTIVE) . "'";
    $rangeFrom = $start->format('Y-m-d H:i:s');
    $rangeTo = $last->modify('+1 day')->format('Y-m-d H:i:s');
    $busy = [];
    $booked = [];
    foreach (db_all("SELECT doctor_id, starts_at, ends_at FROM appointments WHERE doctor_id IN ({$in}) AND status IN ({$active}) AND ends_at > ? AND starts_at < ?", [$rangeFrom, $rangeTo]) as $a) {
        $s = strtotime($a['starts_at']);
        $e = strtotime($a['ends_at']);
        $busy[(int) $a['doctor_id']][] = [$s - $buffer, $e + $buffer];
        $booked[(int) $a['doctor_id']][substr($a['starts_at'], 0, 10)] = ($booked[(int) $a['doctor_id']][substr($a['starts_at'], 0, 10)] ?? 0) + ($e - $s);
    }
    $offs = time_off_between($rangeFrom, $rangeTo, $doctorIds, $locationIds);
    $clinicHours = location_hours();
    $holidays = $online ? array_merge(ro_holidays((int) $start->format('Y')), ro_holidays((int) $last->format('Y'))) : [];
    $out = [];
    for ($day = $start; $day <= $last && count($out) < $limit; $day = $day->modify('+1 day')) {
        $date = $day->format('Y-m-d');
        if (in_array($date, $holidays, true)) {
            continue;
        }
        $wd = (int) $day->format('N');
        $byTime = [];
        foreach ($plans as $pl) {
            if (!isset($pl['sch'][$wd])) {
                continue;
            }
            $span = $pl['sch'][$wd];
            $windows = [[strtotime("{$date} {$span[0]}"), strtotime("{$date} {$span[1]}")]];
            $cuts = $busy[$pl['doctor_id']] ?? [];
            if (isset($span[2])) {
                $cuts[] = [strtotime("{$date} {$span[2]}"), strtotime("{$date} {$span[3]}")];
            }
            // The clinic's own hours, when set, cut the doctor's.
            $open = $clinicHours[$pl['location_id']] ?? [];
            if ($open !== []) {
                if (!isset($open[$wd])) {
                    continue;
                }
                $windows = [[max($windows[0][0], strtotime("{$date} {$open[$wd][0]}")), min($windows[0][1], strtotime("{$date} {$open[$wd][1]}"))]];
                if (isset($open[$wd][2])) {
                    $cuts[] = [strtotime("{$date} {$open[$wd][2]}"), strtotime("{$date} {$open[$wd][3]}")];
                }
            }
            foreach ($offs as $t) {
                if (time_off_applies($t, $pl['doctor_id'], $pl['location_id'])) {
                    $cuts[] = [strtotime($t['starts_at']), strtotime($t['ends_at'])];
                }
            }
            foreach (intervals_subtract($windows, $cuts) as [$ws, $we]) {
                // The grid: times that are a multiple of the step from midnight.
                $mid = strtotime("{$date} 00:00");
                $t = $mid + (int) ceil(($ws - $mid) / ($step * 60)) * $step * 60;
                for (; $t + $len * 60 <= $we; $t += $step * 60) {
                    $hm = date('H:i', $t);
                    if ($t < $earliest->getTimestamp() || ($part === 'dimineata' && $hm >= $split) || ($part === 'dupa-amiaza' && $hm < $split)) {
                        continue;
                    }
                    $byTime[$hm][] = $pl;
                }
            }
        }
        if ($byTime === []) {
            continue;
        }
        ksort($byTime);
        $list = [];
        foreach ($byTime as $hm => $cands) {
            // „Oricare medic”: the one with the fewest booked minutes that day, then the team's order.
            usort($cands, static fn ($a, $b) => [($booked[$a['doctor_id']][$date] ?? 0), $a['order'], $a['doctor_id']] <=> [($booked[$b['doctor_id']][$date] ?? 0), $b['order'], $b['doctor_id']]);
            $pick = $cands[0];
            $ts = strtotime("{$date} {$hm}");
            $list[] = [
                'id' => date('YmdHi', $ts) . '-' . $pick['location_id'] . '-' . $pick['doctor_id'] . '-' . $len,
                'start' => date('Y-m-d H:i:s', $ts),
                'end' => date('Y-m-d H:i:s', $ts + $len * 60),
                'location_id' => $pick['location_id'],
                'doctor_id' => $pick['doctor_id'],
                'doctor_ids' => array_values(array_unique(array_column($cands, 'doctor_id'))),
            ];
        }
        $picked = $list;
        if ($perDay !== null && count($list) > $perDay) {
            // Spread the offers over the day: the first, the last and evenly between.
            $picked = [];
            for ($i = 0; $i < $perDay; $i++) {
                $picked[] = $list[$perDay === 1 ? 0 : (int) round($i * (count($list) - 1) / ($perDay - 1))];
            }
        }
        foreach ($picked as $sl) {
            if (count($out) < $limit) {
                $out[] = $sl;
            }
        }
    }
    return $out;
}

/** A slot id (YmdHi-clinic-doctor[-minutes]) → its parts, if the doctor is still free then. */
function slot_check(string $id, ?DateTimeImmutable $now = null): ?array
{
    if (!preg_match('/^(\d{12})-(\d+)-(\d+)(?:-(\d{1,3}))?$/', $id, $m)) {
        return null;
    }
    $t = DateTimeImmutable::createFromFormat('YmdHi', $m[1]);
    if ($t === false) {
        return null;
    }
    $o = ['location_id' => (int) $m[2], 'doctor_id' => (int) $m[3], 'from' => $t->format('Y-m-d'), 'days' => 1, 'limit' => 2000, 'per_day' => null];
    if (!empty($m[4])) {
        $o['duration'] = (int) $m[4];
    }
    foreach (free_slots($o, $now) as $s) {
        if ($s['start'] === $t->format('Y-m-d H:i:s')) {
            return $s;
        }
    }
    return null;
}

/** „miercuri, 14 octombrie, ora 10:00, Luduș, Dr. Mașca” */
function slot_label(array $s): string
{
    $clinic = db_value('SELECT short_name FROM locations WHERE id = ?', [$s['location_id']]);
    return day_label($s['start']) . ', ora ' . substr($s['start'], 11, 5) . ', ' . $clinic . ', ' . (doctor_short_names()[$s['doctor_id']] ?? '');
}

/** Counts a hit; false once the key passed $max in the window. */
function rate_hit(string $key, int $max, int $windowSeconds): bool
{
    $row = db_one('SELECT * FROM rate_limits WHERE k = ?', [$key]);
    if ($row === null || strtotime($row['reset_at']) < time()) {
        db_run('REPLACE INTO rate_limits (k, n, reset_at) VALUES (?, 1, ?)', [$key, date('Y-m-d H:i:s', time() + $windowSeconds)]);
        if (random_int(1, 50) === 1) {
            db_run('DELETE FROM rate_limits WHERE reset_at < ?', [now_sql()]);
        }
        return true;
    }
    db_run('UPDATE rate_limits SET n = n + 1 WHERE k = ?', [$key]);
    return (int) $row['n'] + 1 <= $max;
}

/**
 * Makes the appointment (programat) for a free slot: the patient is found by phone or a new file
 * is opened; a request keeps the trace; the patient (with the link) and the staff are told.
 *
 * @param array{name:string,phone:string,email:?string} $person
 * @param array{source?:string,service_id?:?int,category?:?string,comfort?:?string,notes?:string,lead?:array} $o
 * @return array{appointment_id:int,patient_id:int,lead_id:int}
 */
function book_slot(string $slotId, array $person, string $reason, ?string $category, ?int $conversationId, array $o = []): array
{
    $doctor = preg_match('/^\d{12}-\d+-(\d+)/', $slotId, $m) ? (int) $m[1] : 0;
    $source = $o['source'] ?? 'chat';
    // One booking at a time per doctor: two visitors cannot take the same hour.
    $lock = 'da-programare-' . $doctor;
    db_value('SELECT GET_LOCK(?, 10)', [$lock]);
    try {
        $s = slot_check($slotId);
        if ($s === null) {
            throw new DomainException('Ora aleasă nu mai este liberă.');
        }
        $ids = db_tx(static function () use ($s, $person, $reason, $category, $conversationId, $o, $source): array {
            $leadId = db_insert('leads', [
                'kind' => $source === 'online' ? 'programare' : 'chat', 'location_id' => $s['location_id'], 'category_slug' => $category, 'preferred_date' => substr($s['start'], 0, 10), 'preferred_time' => substr($s['start'], 11, 5),
                'comfort' => $o['comfort'] ?? null, 'marketing_ok' => !empty($o['marketing']) ? 1 : 0,
                'name' => mb_substr($person['name'], 0, 120), 'phone' => format_phone($person['phone']), 'email' => $person['email'] ?: null,
                'message' => mb_substr(($source === 'online' ? 'Programat pe site' : 'Programat din chat pe site') . ": {$reason}" . (!empty($o['notes']) ? "\n" . $o['notes'] : ''), 0, 2000),
                'status' => 'programat', 'ip_hash' => client_ip_hash(), 'idempotency_key' => $o['idempotency_key'] ?? null, 'created_at' => now_sql(),
            ]);
            if (!empty($o['child'])) {
                // A child: the file of the child with this parent's phone, else a new one (the parent as guardian).
                $pid = null;
                $nat = national_digits($person['phone']);
                foreach (db_all("SELECT id, phone, first_name FROM patients WHERE phone <> '' AND active = 1") as $row) {
                    if (national_digits($row['phone']) === $nat && fold_text($row['first_name']) === fold_text($o['child']['first'])) {
                        $pid = (int) $row['id'];
                        break;
                    }
                }
                if ($pid === null) {
                    $parts = preg_split('/\s+/', trim($person['name'])) ?: [''];
                    $row = ['first_name' => mb_substr($o['child']['first'], 0, 80), 'last_name' => mb_substr(count($parts) > 1 ? $parts[0] : $person['name'], 0, 80), 'phone' => format_phone($person['phone']), 'email' => $person['email'] ?: null, 'preferred_location_id' => $s['location_id']];
                    // The parent, when they have a file too, is linked as the guardian.
                    $pid = db_insert('patients', $row + ['guardian_name' => mb_substr($person['name'], 0, 160), 'guardian_patient_id' => patient_by_phone_name($person['name'], $person['phone']), 'file_number' => next_file_number(), 'search_text' => patient_search_text($row), 'created_at' => now_sql(), 'updated_at' => now_sql()]);
                }
            } else {
                $pid = find_or_create_patient($person['name'], $person['phone'], $person['email'] ?: null, $s['location_id'], null);
            }
            if (!empty($o['marketing'])) {
                db_run("UPDATE patients SET marketing_sms = 1, marketing_consent_at = COALESCE(marketing_consent_at, ?), marketing_consent_source = COALESCE(marketing_consent_source, 'programare pe site') WHERE id = ?", [now_sql(), $pid]);
            }
            if (!empty($o['comfort'])) {
                db_run('UPDATE patients SET comfort = COALESCE(comfort, ?) WHERE id = ?', [$o['comfort'], $pid]);
            }
            $aid = db_insert('appointments', [
                'location_id' => $s['location_id'], 'doctor_id' => $s['doctor_id'], 'patient_id' => $pid, 'lead_id' => $leadId, 'category_slug' => $category, 'service_id' => $o['service_id'] ?? null,
                'reason' => mb_substr($reason, 0, 255), 'starts_at' => $s['start'], 'ends_at' => $s['end'], 'status' => 'programat', 'source' => $source,
                'cabinet' => db_value('SELECT cabinet FROM doctor_locations WHERE doctor_id = ? AND location_id = ?', [$s['doctor_id'], $s['location_id']]) ?: null,
                'comfort' => $o['comfort'] ?? null,
                'notes' => trim(($source === 'online' ? 'Programare făcută de pacient pe site.' : 'Programare făcută de pacient în chatul de pe site' . ($conversationId ? " (conversația #{$conversationId})" : '') . '.') . (!empty($o['notes']) ? "\n" . $o['notes'] : '')),
                'created_at' => now_sql(), 'updated_at' => now_sql(),
            ]);
            db_update('leads', ['patient_id' => $pid, 'appointment_id' => $aid], 'id = :id', ['id' => $leadId]);
            audit('programare-online', slot_label($s), 0, $pid);
            return ['appointment_id' => $aid, 'patient_id' => $pid, 'lead_id' => $leadId];
        });
    } finally {
        db_value('SELECT RELEASE_LOCK(?)', [$lock]);
    }
    notify_appointment('programare-noua', $ids['appointment_id']);
    try {
        $a = db_one('SELECT * FROM appointments WHERE id = ?', [$ids['appointment_id']]);
        $p = db_one('SELECT * FROM patients WHERE id = ?', [$ids['patient_id']]);
        notify_staff('staff-programare-online', front_desk_users((int) $a['location_id']), appointment_vars($a) + patient_vars($p) + ['telefon' => format_phone((string) $p['phone'])], ['appointment_id' => $ids['appointment_id']]);
    } catch (Throwable $e) {
        app_log('error', 'book_slot notify: ' . $e->getMessage());
    }
    return $ids;
}

// ── The site's booking (/programare) ─────────────────────────────────────────

/** The reasons offered on the site: the services marked online, the urgent one second, then „Nu știu sigur”. */
function booking_reasons(): array
{
    $rows = db_all("SELECT s.id, s.code, s.online_label, s.online_hint, s.urgent, s.duration_minutes, c.slug AS category FROM services s JOIN categories c ON c.id = s.category_id WHERE s.bookable_online = 1 AND s.online_label IS NOT NULL AND s.online_label <> '' ORDER BY c.sort_order, s.sort_order, s.id");
    $urgent = array_values(array_filter($rows, static fn ($r) => (int) $r['urgent'] === 1));
    $rest = array_values(array_filter($rows, static fn ($r) => (int) $r['urgent'] !== 1));
    $list = $rest === [] ? $urgent : array_merge([$rest[0]], $urgent, array_slice($rest, 1));
    $out = array_map(static fn ($r) => ['id' => (int) $r['id'], 'label' => $r['online_label'], 'hint' => (string) $r['online_hint'], 'urgent' => (int) $r['urgent'] === 1, 'minutes' => (int) $r['duration_minutes'], 'category' => $r['category']], $list);
    $consult = db_one("SELECT s.id, s.duration_minutes, c.slug AS category FROM services s JOIN categories c ON c.id = s.category_id WHERE s.code = 'CON-CONSULT'") ?? ($list[0] ?? null);
    if ($consult) {
        $out[] = ['id' => (int) $consult['id'], 'label' => 'Nu știu sigur', 'hint' => 'Medicul vă spune la consultație de ce aveți nevoie.', 'urgent' => false, 'minutes' => (int) ($consult['duration_minutes'] ?? 30), 'category' => $consult['category'], 'unsure' => true];
    }
    return $out;
}

/** The doctors who take online bookings at a clinic (for the „Oricare medic” chips). */
function booking_doctors(int $locationId, ?string $category = null): array
{
    $rows = db_all('SELECT d.id, d.public_name, d.last_name, dl.schedule FROM doctors d JOIN doctor_locations dl ON dl.doctor_id = d.id WHERE dl.location_id = ? AND d.accepts_online = 1 AND dl.schedule IS NOT NULL ORDER BY d.sort_order, d.id', [$locationId]);
    $rows = array_values(array_filter($rows, static fn ($r) => schedule_decode($r['schedule']) !== []));
    if ($category) {
        $doers = array_map('intval', array_column(db_all('SELECT dc.doctor_id FROM doctor_categories dc JOIN categories c ON c.id = dc.category_id WHERE c.slug = ?', [$category]), 'doctor_id'));
        if ($doers !== []) {
            $rows = array_values(array_filter($rows, static fn ($r) => in_array((int) $r['id'], $doers, true)));
        }
    }
    return array_map(static fn ($r) => ['id' => (int) $r['id'], 'name' => $r['public_name'], 'short' => 'Dr. ' . $r['last_name']], $rows);
}

/** GET /api/sloturi?clinica=&serviciu=&medic=&de=AAAA-LL-ZZ&zile=1..14: the free times, by day. */
function booking_slots_endpoint(): never
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex');
    if (!rate_hit('sloturi:' . client_ip_hash(), 60, 60)) {
        http_response_code(429);
        exit(json_encode(['error' => 'Prea multe cereri. Încercați din nou peste un minut.']));
    }
    $cfg = booking_settings();
    $clinic = null;
    foreach (clinics() as $c) {
        if ($c['slug'] === query('clinica') || (string) $c['id'] === query('clinica')) {
            $clinic = $c;
        }
    }
    $service = db_one('SELECT * FROM services WHERE id = ? AND bookable_online = 1', [(int) query('serviciu')]) ?? db_one("SELECT * FROM services WHERE code = 'CON-CONSULT'");
    if (!$cfg['enabled'] || $clinic === null || $clinic['id'] === null || $service === null) {
        http_response_code(404);
        exit(json_encode(['error' => 'Programarea online nu este disponibilă.']));
    }
    $days = max(1, min(14, (int) (query('zile') ?: 7)));
    $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', query('de')) ? query('de') : date('Y-m-d');
    $slots = free_slots(['location_id' => $clinic['id'], 'service_id' => (int) $service['id'], 'doctor_id' => (int) query('medic') ?: null, 'from' => $from, 'days' => $days, 'limit' => 2000, 'per_day' => null]);
    $names = doctor_short_names();
    $out = [];
    for ($i = 0; $i < $days; $i++) {
        $d = date('Y-m-d', strtotime("{$from} +{$i} days"));
        $out[$d] = ['date' => $d, 'label' => day_label($d), 'slots' => []];
    }
    foreach ($slots as $s) {
        $d = substr($s['start'], 0, 10);
        if (isset($out[$d])) {
            $out[$d]['slots'][] = ['id' => $s['id'], 'time' => substr($s['start'], 11, 5), 'doctor' => $names[$s['doctor_id']] ?? '', 'morning' => substr($s['start'], 11, 5) < $cfg['morning_until']];
        }
    }
    $first = free_slots(['location_id' => $clinic['id'], 'service_id' => (int) $service['id'], 'doctor_id' => (int) query('medic') ?: null, 'limit' => 1, 'per_day' => 1]);
    exit(json_encode(['days' => array_values($out), 'first' => $first[0]['start'] ?? null, 'horizon' => date('Y-m-d', strtotime('+' . ((int) $cfg['days_ahead'] - 1) . ' days'))], JSON_UNESCAPED_UNICODE));
}
