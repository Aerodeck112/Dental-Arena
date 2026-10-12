<?php
/**
 * Online booking: when each doctor works at each clinic (Echipa → medic → „Unde lucrează”), the
 * free times that follow from it (minus appointments, legal holidays and the notice the clinic
 * wants), and making an appointment for one of them. Used by the AI chat on the site.
 */
declare(strict_types=1);

const WEEKDAYS = [1 => 'Luni', 2 => 'Marți', 3 => 'Miercuri', 4 => 'Joi', 5 => 'Vineri', 6 => 'Sâmbătă', 7 => 'Duminică'];
const MONTHS_RO = [1 => 'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const CHAT_DEFAULTS = [
    'enabled' => false,
    'model' => 'claude-sonnet-5-5',
    'mode' => 'cerere',
    'slot_minutes' => 30,
    'notice_hours' => 3,
    'days_ahead' => 21,
    'daily_limit' => 300,
    'retention_days' => 90,
];
const CHAT_MODES = [
    'cerere' => 'Cerere: pacientul alege ora, recepția o confirmă la telefon',
    'direct' => 'Direct în calendar, după un cod primit prin SMS',
];

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

/** @return array<int,array{0:string,1:string}> weekday (1 = Monday) → [from, to] */
function schedule_decode(?string $json): array
{
    $out = [];
    foreach (json_decode((string) $json, true) ?: [] as $day => $span) {
        if (isset(WEEKDAYS[(int) $day]) && is_array($span) && count($span) === 2 && preg_match('/^\d{2}:\d{2}$/', (string) $span[0]) && preg_match('/^\d{2}:\d{2}$/', (string) $span[1]) && $span[0] < $span[1]) {
            $out[(int) $day] = [(string) $span[0], (string) $span[1]];
        }
    }
    ksort($out);
    return $out;
}

/** „Luni–Vineri 09:00–17:00, Sâmbătă 09:00–13:00” */
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
    return implode(', ', array_map(static fn ($g) => WEEKDAYS[$g['from']] . ($g['to'] !== $g['from'] ? '–' . WEEKDAYS[$g['to']] : '') . ' ' . $g['span'][0] . '–' . $g['span'][1], $groups));
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
 * The free times, soonest first: at most $per_day a day, spread over the day.
 *
 * @param array{location_id?:?int,category?:?string,doctor_id?:?int,from?:?string,part?:string,limit?:int,per_day?:int} $o
 * @return list<array{id:string,start:string,end:string,location_id:int,doctor_id:int}>
 */
function free_slots(array $o = [], ?DateTimeImmutable $now = null): array
{
    $cfg = chat_settings();
    $now ??= new DateTimeImmutable();
    $len = max(15, (int) $cfg['slot_minutes']);
    $earliest = $now->modify('+' . max(0, (int) $cfg['notice_hours']) . ' hours');
    $sql = 'SELECT dl.doctor_id, dl.location_id, dl.schedule FROM doctor_locations dl JOIN doctors d ON d.id = dl.doctor_id WHERE dl.schedule IS NOT NULL';
    $params = [];
    if (!empty($o['location_id'])) {
        $sql .= ' AND dl.location_id = ?';
        $params[] = (int) $o['location_id'];
    }
    if (!empty($o['doctor_id'])) {
        $sql .= ' AND dl.doctor_id = ?';
        $params[] = (int) $o['doctor_id'];
    }
    $rows = db_all($sql . ' ORDER BY d.sort_order', $params);
    // Only the doctors who do the service (if nobody is marked for it, everyone).
    if (!empty($o['category'])) {
        $doers = array_map('intval', array_column(db_all('SELECT dc.doctor_id FROM doctor_categories dc JOIN categories c ON c.id = dc.category_id WHERE c.slug = ?', [$o['category']]), 'doctor_id'));
        if ($doers !== []) {
            $rows = array_values(array_filter($rows, static fn ($r) => in_array((int) $r['doctor_id'], $doers, true)));
        }
    }
    $plans = [];
    foreach ($rows as $r) {
        $sch = schedule_decode($r['schedule']);
        if ($sch !== []) {
            $plans[] = ['doctor_id' => (int) $r['doctor_id'], 'location_id' => (int) $r['location_id'], 'sch' => $sch];
        }
    }
    if ($plans === []) {
        return [];
    }
    $from = new DateTimeImmutable(!empty($o['from']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $o['from']) ? $o['from'] : 'today');
    $start = max($from, $now->setTime(0, 0));
    $last = $now->setTime(0, 0)->modify('+' . max(1, (int) $cfg['days_ahead']) . ' days');
    $limit = max(1, min(40, (int) ($o['limit'] ?? 12)));
    $perDay = max(1, (int) ($o['per_day'] ?? 4));
    $part = $o['part'] ?? 'oricand';
    $doctorIds = array_values(array_unique(array_column($plans, 'doctor_id')));
    $in = implode(',', array_fill(0, count($doctorIds), '?'));
    $active = "'" . implode("','", APPT_ACTIVE) . "'";
    $busy = [];
    foreach (db_all("SELECT doctor_id, starts_at, ends_at FROM appointments WHERE doctor_id IN ({$in}) AND status IN ({$active}) AND ends_at > ? AND starts_at < ?", array_merge($doctorIds, [$start->format('Y-m-d H:i:s'), $last->modify('+1 day')->format('Y-m-d H:i:s')])) as $a) {
        $busy[(int) $a['doctor_id']][] = [strtotime($a['starts_at']), strtotime($a['ends_at'])];
    }
    $holidays = array_merge(ro_holidays((int) $start->format('Y')), ro_holidays((int) $last->format('Y')));
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
            [$a, $b] = $pl['sch'][$wd];
            $t = new DateTimeImmutable("{$date} {$a}");
            $endDay = new DateTimeImmutable("{$date} {$b}");
            for (; $t->modify("+{$len} minutes") <= $endDay; $t = $t->modify("+{$len} minutes")) {
                $h = (int) $t->format('G');
                if ($t < $earliest || ($part === 'dimineata' && $h >= 12) || ($part === 'dupa-amiaza' && $h < 12)) {
                    continue;
                }
                $s = $t->getTimestamp();
                $e = $s + $len * 60;
                foreach ($busy[$pl['doctor_id']] ?? [] as [$bs, $be]) {
                    if ($bs < $e && $be > $s) {
                        continue 2;
                    }
                }
                $key = $t->format('H:i');
                // The same hour with two doctors: one offer is enough (the first in the team's order).
                $byTime[$key] ??= ['id' => $t->format('YmdHi') . '-' . $pl['location_id'] . '-' . $pl['doctor_id'], 'start' => $t->format('Y-m-d H:i:s'), 'end' => date('Y-m-d H:i:s', $e), 'location_id' => $pl['location_id'], 'doctor_id' => $pl['doctor_id']];
            }
        }
        if ($byTime === []) {
            continue;
        }
        ksort($byTime);
        $list = array_values($byTime);
        // Spread the offers over the day: the first, the last and evenly between.
        $n = min($perDay, count($list));
        $picked = [];
        for ($i = 0; $i < $n; $i++) {
            $picked[] = $list[$n === 1 ? 0 : (int) round($i * (count($list) - 1) / ($n - 1))];
        }
        foreach ($picked as $s) {
            if (count($out) < $limit) {
                $out[] = $s;
            }
        }
    }
    return $out;
}

/** A slot id from free_slots → its parts, if it is still a time the doctor works and is free. */
function slot_check(string $id, ?DateTimeImmutable $now = null): ?array
{
    if (!preg_match('/^(\d{12})-(\d+)-(\d+)$/', $id, $m)) {
        return null;
    }
    $t = DateTimeImmutable::createFromFormat('YmdHi', $m[1]);
    if ($t === false) {
        return null;
    }
    foreach (free_slots(['location_id' => (int) $m[2], 'doctor_id' => (int) $m[3], 'from' => $t->format('Y-m-d'), 'limit' => 40, 'per_day' => 200], $now) as $s) {
        if ($s['start'] === $t->format('Y-m-d H:i:s')) {
            return $s;
        }
        if ($s['start'] > $t->format('Y-m-d H:i:s')) {
            break;
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

/**
 * Makes the appointment (programat) for a free slot: the patient is found by phone or a new file
 * is opened; a request (kind „chat”) keeps the trace; the patient and the staff are told.
 *
 * @param array{name:string,phone:string,email:?string} $person
 * @return array{appointment_id:int,patient_id:int,lead_id:int}
 */
function book_slot(string $slotId, array $person, string $reason, ?string $category, ?int $conversationId): array
{
    $doctor = preg_match('/-(\d+)$/', $slotId, $m) ? (int) $m[1] : 0;
    // One booking at a time per doctor: two visitors cannot take the same hour.
    $lock = 'da-programare-' . $doctor;
    db_value('SELECT GET_LOCK(?, 10)', [$lock]);
    try {
        $s = slot_check($slotId);
        if ($s === null) {
            throw new DomainException('Ora aleasă nu mai este liberă.');
        }
        $ids = db_tx(static function () use ($s, $person, $reason, $category, $conversationId): array {
            $leadId = db_insert('leads', [
                'kind' => 'chat', 'location_id' => $s['location_id'], 'category_slug' => $category, 'preferred_date' => substr($s['start'], 0, 10), 'preferred_time' => substr($s['start'], 11, 5),
                'name' => mb_substr($person['name'], 0, 120), 'phone' => $person['phone'], 'email' => $person['email'] ?: null,
                'message' => mb_substr("Programat din chat pe site: {$reason}", 0, 2000), 'status' => 'programat', 'ip_hash' => client_ip_hash(), 'created_at' => now_sql(),
            ]);
            $pid = find_or_create_patient($person['name'], $person['phone'], $person['email'] ?: null, $s['location_id'], null);
            $aid = db_insert('appointments', [
                'location_id' => $s['location_id'], 'doctor_id' => $s['doctor_id'], 'patient_id' => $pid, 'lead_id' => $leadId, 'category_slug' => $category,
                'reason' => mb_substr($reason, 0, 255), 'starts_at' => $s['start'], 'ends_at' => $s['end'], 'status' => 'programat',
                'notes' => 'Programare făcută de pacient în chatul de pe site' . ($conversationId ? " (conversația #{$conversationId})" : '') . '.',
                'created_at' => now_sql(), 'updated_at' => now_sql(),
            ]);
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
