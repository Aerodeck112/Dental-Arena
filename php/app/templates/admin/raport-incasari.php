<?php
/**
 * /admin/rapoarte/incasari: the payments for procedures of a day, a month or a period, one row per
 * procedure paid (as QDental's „Raport Încasări”): the day, the hour, the patient, the procedure,
 * the doctor, who took the money, how (cash, card, transfer) and the amount, with the totals.
 * Printed (or saved as PDF) with ?pdf=1, downloaded for Excel with ?excel=1. Reception sees the
 * clinic's payments in its ledger; a doctor the payments for their procedures and the ones they
 * took; the administrators everything, or one ledger.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
$today = date('Y-m-d');
$isDate = static fn (string $d) => DateTimeImmutable::createFromFormat('!Y-m-d', $d) !== false;

// The period: a day (default today), a month, or from–to.
$kind = in_array(query('perioada'), ['zi', 'luna', 'interval'], true) ? query('perioada') : 'zi';
$day = $isDate(query('ziua')) ? query('ziua') : $today;
$month = preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', query('luna')) ? query('luna') : date('Y-m');
[$from, $to] = match ($kind) {
    'luna' => ["{$month}-01", date('Y-m-t', strtotime("{$month}-01"))],
    'interval' => [$isDate(query('de')) ? query('de') : date('Y-m-01'), $isDate(query('pana')) ? query('pana') : $today],
    default => [$day, $day],
};
if ($to < $from) {
    [$from, $to] = [$to, $from];
}
$scope = proc_scope($user, query('registru'));
if ($scope['from'] !== null && $from < $scope['from']) {
    $from = $scope['from'];
}

$clinic = admin_int(query('clinica'));
$clinicIds = $clinic !== null && in_array($clinic, $allowed, true) ? [$clinic] : $allowed;
$ownDoctor = $user['role'] === 'medic' ? (int) ($user['doctor_id'] ?? 0) : null;
$doctors = doctor_short_names();
$doctorFilter = admin_int(query('medic'));
$methodFilter = isset(PROC_PAY_METHODS[query('mod')]) ? query('mod') : '';
$byFilter = admin_int(query('incasat'));
$group = in_array(query('grup'), ['medic', 'procedura', 'zi'], true) ? query('grup') : '';

// The payments, then what each paid (procedure_payment_items); what is not on a procedure is an advance.
$rows = [];
if ($clinicIds !== []) {
    [$extra, $params] = proc_scope_sql(['ledger' => $scope['ledger']], 'pp', 'paid_on');
    $sql = 'SELECT pp.id, pp.paid_on, pp.created_at, pp.amount, pp.method, pp.reference, pp.received_by, pp.location_id, pt.last_name, pt.first_name, pt.file_number, pp.patient_id, u.name AS who
        FROM procedure_payments pp JOIN patients pt ON pt.id = pp.patient_id LEFT JOIN users u ON u.id = pp.received_by
        WHERE pp.cancelled_at IS NULL AND pp.paid_on BETWEEN ? AND ? AND pp.location_id IN (' . implode(',', array_map('intval', $clinicIds)) . ')' . $extra;
    $params = array_merge([$from, $to], $params);
    if ($methodFilter !== '') {
        $sql .= ' AND pp.method = ?';
        $params[] = $methodFilter;
    }
    if ($byFilter !== null) {
        $sql .= ' AND pp.received_by = ?';
        $params[] = $byFilter;
    }
    $payments = db_all($sql . ' ORDER BY pp.paid_on, pp.created_at, pp.id', $params);
    $items = [];
    foreach (array_chunk(array_column($payments, 'id'), 800) as $chunk) {
        foreach (db_all('SELECT i.payment_id, i.amount, p.name, p.tooth, p.doctor_id FROM procedure_payment_items i JOIN procedures p ON p.id = i.procedure_id
            WHERE i.payment_id IN (' . implode(',', array_map('intval', $chunk)) . ') ORDER BY p.performed_on, p.id', []) as $i) {
            $items[(int) $i['payment_id']][] = $i;
        }
    }
    foreach ($payments as $pay) {
        $base = [
            'day' => $pay['paid_on'],
            // The hour only when the payment was entered that day (not for older ones or imports).
            'hour' => substr((string) $pay['created_at'], 0, 10) === $pay['paid_on'] && $pay['method'] !== 'qdental' ? substr((string) $pay['created_at'], 11, 5) : '',
            'patient' => patient_name($pay), 'file' => (int) $pay['file_number'], 'patient_id' => (int) $pay['patient_id'],
            'who' => $pay['who'] ?? ($pay['method'] === 'qdental' ? 'QDental' : '—'), 'received_by' => (int) $pay['received_by'],
            'method' => PROC_PAY_METHODS[$pay['method']] ?? $pay['method'], 'method_key' => $pay['method'],
        ];
        $left = (int) $pay['amount'];
        foreach ($items[(int) $pay['id']] ?? [] as $i) {
            $rows[] = $base + ['procedure' => $i['name'] . ($i['tooth'] ? ' · ' . $i['tooth'] : ''), 'doctor_id' => $i['doctor_id'] !== null ? (int) $i['doctor_id'] : 0, 'amount' => (int) $i['amount']];
            $left -= (int) $i['amount'];
        }
        if ($left > 0) {
            $rows[] = $base + ['procedure' => 'Avans (încă pe nicio procedură)', 'doctor_id' => 0, 'amount' => $left];
        }
    }
    $rows = array_values(array_filter($rows, static fn ($r) => ($doctorFilter === null || $r['doctor_id'] === $doctorFilter)
        && ($ownDoctor === null || ($ownDoctor > 0 && $r['doctor_id'] === $ownDoctor) || $r['received_by'] === (int) $user['id'])));
}
$docName = static fn (int $id) => $id > 0 ? ($doctors[$id] ?? '—') : '—';

// Grouped (with a subtotal for each group) or in the order of the day and hour.
$groupKey = static fn (array $r) => match ($group) {
    'medic' => $r['doctor_id'] > 0 ? $docName($r['doctor_id']) : 'Fără medic (avansuri)',
    'procedura' => $r['procedure'],
    'zi' => format_date($r['day']),
    default => '',
};
if ($group !== '') {
    usort($rows, static fn ($a, $b) => [$groupKey($a), $a['day'], $a['hour']] <=> [$groupKey($b), $b['day'], $b['hour']]);
    if ($group === 'zi') {
        usort($rows, static fn ($a, $b) => [$a['day'], $a['hour']] <=> [$b['day'], $b['hour']]);
    }
}
$groups = [];
foreach ($rows as $r) {
    $groups[$groupKey($r)][] = $r;
}

$total = array_sum(array_column($rows, 'amount'));
$byMethod = [];
$byDoctor = [];
foreach ($rows as $r) {
    $byMethod[$r['method']] = ($byMethod[$r['method']] ?? 0) + $r['amount'];
    $d = $r['doctor_id'] > 0 ? $docName($r['doctor_id']) : 'Fără medic (avansuri)';
    $byDoctor[$d] = ($byDoctor[$d] ?? 0) + $r['amount'];
}
arsort($byDoctor);
$periodText = $from === $to ? format_date($from) : format_date($from) . ' – ' . format_date($to);
$filterText = implode(', ', array_filter([
    $clinic !== null && isset($names[$clinic]) ? $names[$clinic] : (count($allowed) > 1 ? 'ambele clinici' : ($names[$allowed[0] ?? 0] ?? '')),
    $doctorFilter !== null ? 'Medic: ' . $docName($doctorFilter) : ($ownDoctor !== null ? 'Medic: ' . $docName($ownDoctor) . ' (și încasările mele)' : 'toți medicii'),
    $methodFilter !== '' ? 'Mod de plată: ' . PROC_PAY_METHODS[$methodFilter] : '',
    $byFilter !== null ? 'Încasat de: ' . (string) db_value('SELECT name FROM users WHERE id = ?', [$byFilter]) : '',
    $scope['ledger'] !== null && is_admin($user) && ledger_users() !== [] ? ledger_label($scope['ledger']) : '',
]));
$head = ['Data', 'Ora', 'Nume și prenume', 'Procedura', 'Medic', 'Încasat de', 'Mod plată', 'Suma (lei)'];

// ── Excel ──
if (query('excel') === '1') {
    audit('export-raport', "Raport încasări, {$periodText}");
    $x = [[['v' => 'Raport încasări', 's' => 'b']], ["Perioada: {$periodText}"], [$filterText], [], array_map(static fn ($h) => ['v' => $h, 's' => 'b'], $head)];
    foreach ($groups as $g => $list) {
        if ($group !== '') {
            $x[] = [['v' => $g, 's' => 'b']];
        }
        foreach ($list as $r) {
            $x[] = [['v' => $r['day'], 's' => 'data'], $r['hour'], $r['patient'], $r['procedure'], $docName($r['doctor_id']), $r['who'], $r['method'], ['v' => $r['amount'], 's' => 'lei']];
        }
        if ($group !== '') {
            $x[] = ['', '', '', '', '', '', ['v' => 'Total ' . $g, 's' => 'b'], ['v' => array_sum(array_column($list, 'amount')), 's' => 'lei-b']];
        }
    }
    $x[] = [];
    $x[] = ['', '', '', '', '', '', ['v' => 'TOTAL', 's' => 'b'], ['v' => $total, 's' => 'lei-b']];
    foreach ($byMethod as $m => $sum) {
        $x[] = ['', '', '', '', '', '', $m, ['v' => $sum, 's' => 'lei']];
    }
    xlsx_download('raport-incasari-' . ($from === $to ? $from : "{$from}-{$to}") . '.xlsx', 'Încasări', $x, [11, 7, 26, 38, 18, 18, 14, 13]);
}

// ── The table (screen and print) ──
$th = 'px-2 py-2 text-left text-mic font-semibold text-discret';
$tableRows = '';
foreach ($groups as $g => $list) {
    if ($group !== '') {
        $tableRows .= '<tr class="bg-menta-pal print:bg-transparent"><th scope="colgroup" colspan="8" class="px-2 py-1.5 text-left font-semibold print:border-b print:border-cerneala">' . e($g) . '</th></tr>';
    }
    foreach ($list as $r) {
        $tableRows .= '<tr class="border-t border-linie align-top">'
            . '<td class="cifre whitespace-nowrap px-2 py-1.5">' . e(date('d.m.Y', strtotime($r['day']))) . '</td>'
            . '<td class="cifre whitespace-nowrap px-2 py-1.5">' . e($r['hour']) . '</td>'
            . '<td class="px-2 py-1.5"><a class="text-link underline-offset-4 hover:underline print:text-cerneala print:no-underline" href="/admin/pacienti/' . $r['patient_id'] . '/proceduri#plati">' . e($r['patient']) . '</a></td>'
            . '<td class="px-2 py-1.5">' . e($r['procedure']) . '</td>'
            . '<td class="px-2 py-1.5">' . e($docName($r['doctor_id'])) . '</td>'
            . '<td class="px-2 py-1.5">' . e($r['who']) . '</td>'
            . '<td class="whitespace-nowrap px-2 py-1.5">' . e($r['method']) . '</td>'
            . '<td class="cifre whitespace-nowrap px-2 py-1.5 text-right">' . e(amount_2d($r['amount'])) . '</td></tr>';
    }
    if ($group !== '') {
        $tableRows .= '<tr class="border-t border-linie"><td colspan="7" class="px-2 py-1.5 text-right font-semibold">Total ' . e($g) . '</td><td class="cifre whitespace-nowrap px-2 py-1.5 text-right font-semibold">' . e(amount_2d(array_sum(array_column($list, 'amount')))) . '</td></tr>';
    }
}
$table = $rows === [] ? '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Nicio încasare în perioada și cu filtrele alese.</p>'
    : '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata print:overflow-visible print:rounded-none print:border-0"><table class="w-full min-w-[56rem] border-collapse text-corp print:min-w-0 print:text-[11px]"><thead class="bg-fundal print:bg-transparent"><tr>'
        . implode('', array_map(static fn ($h, $i) => '<th scope="col" class="' . $th . ($i === 7 ? ' text-right' : '') . ' print:border-b-2 print:border-cerneala print:text-[11px] print:text-cerneala">' . e($h) . '</th>', $head, array_keys($head)))
        . '</tr></thead><tbody>' . $tableRows . '</tbody><tfoot><tr class="border-t-2 border-cerneala"><td colspan="7" class="px-2 py-2 text-right font-semibold">Total (' . count_ro(count($rows), 'o încasare', 'încasări') . ')</td><td class="cifre whitespace-nowrap px-2 py-2 text-right text-h3 font-semibold">' . e(amount_2d($total)) . '</td></tr></tfoot></table></div>';
$summary = $rows === [] ? '' : '<div class="mt-6 grid gap-6 sm:grid-cols-2 print:grid-cols-2 print:text-[11px]">'
    . '<div><h2 class="mb-2 font-semibold">Pe modul de plată</h2><dl class="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1">' . implode('', array_map(static fn ($m, $s) => '<dt>' . e($m) . '</dt><dd class="cifre text-right">' . e(lei($s)) . '</dd>', array_keys($byMethod), $byMethod)) . '</dl></div>'
    . '<div><h2 class="mb-2 font-semibold">Pe medic</h2><dl class="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1">' . implode('', array_map(static fn ($d, $s) => '<dt>' . e($d) . '</dt><dd class="cifre text-right">' . e(lei($s)) . '</dd>', array_keys($byDoctor), $byDoctor)) . '</dl></div></div>';

$filters = ['perioada' => $kind, 'ziua' => $kind === 'zi' ? $day : null, 'luna' => $kind === 'luna' ? $month : null, 'de' => $kind === 'interval' ? $from : null, 'pana' => $kind === 'interval' ? $to : null,
    'clinica' => $clinic, 'medic' => $doctorFilter, 'mod' => $methodFilter, 'incasat' => $byFilter, 'grup' => $group, 'registru' => query('registru')];

// ── PDF: the same report on A4 landscape, for printing or „Salvați ca PDF” ──
if (query('pdf') === '1') {
    audit('export-raport', "Raport încasări (tipar), {$periodText}");
    $seller = count($clinicIds) === 1 ? location_company($clinicIds[0]) : null;
    $place = count($clinicIds) === 1 ? db_one('SELECT * FROM locations WHERE id = ?', [$clinicIds[0]]) : null;
    $pdf = '<div class="flex items-start justify-between gap-6 border-b-2 border-cerneala pb-3">'
        . '<p class="text-mic">Data: <span class="cifre">' . e(date('d.m.Y')) . '</span></p>'
        . '<div class="text-center"><h1 class="font-display text-[1.6rem] leading-tight">Raport încasări</h1>'
        . '<p class="text-mic font-semibold">' . e(implode(', ', array_filter([$seller !== null && $seller['legalName'] !== '' ? $seller['legalName'] : 'Dental Arena', $place ? trim(($place['street'] ?? '') . ' ' . ($place['city'] ?? '')) : '', $place && $place['phone'] ? 'Telefon: ' . $place['phone'] : '']))) . '</p></div>'
        . '<p class="text-mic">' . e(count_ro(count($rows), 'o încasare', 'încasări')) . '</p></div>'
        . '<div class="my-3 flex flex-wrap justify-between gap-3 text-mic"><p>' . e($filterText) . '</p><p class="font-semibold">Perioada: ' . e($periodText) . '</p></div>'
        . $table . $summary;
    print_page('Raport încasări ' . $periodText, $pdf, admin_url('/admin/rapoarte/incasari', $filters), true);
    exit;
}

// ── The page ──
$clinicOptions = ['' => count($allowed) > 1 ? 'Ambele clinici' : ($names[$allowed[0] ?? 0] ?? '')];
foreach ($allowed as $l) {
    $clinicOptions[(string) $l] = $names[$l];
}
$doctorOptions = ['' => 'Toți medicii'];
foreach (db_all('SELECT id FROM doctors ORDER BY sort_order, id') as $d) {
    $doctorOptions[(string) $d['id']] = $docName((int) $d['id']);
}
$userOptions = ['' => 'Oricine'];
foreach (db_all("SELECT id, name FROM users WHERE id IN (SELECT DISTINCT received_by FROM procedure_payments WHERE received_by IS NOT NULL) ORDER BY name") as $u) {
    $userOptions[(string) $u['id']] = $u['name'];
}
$methodOptions = ['' => 'Toate'] + array_filter(PROC_PAY_METHODS, static fn ($k) => $k !== 'qdental' || (int) db_value("SELECT COUNT(*) FROM procedure_payments WHERE method = 'qdental'") > 0, ARRAY_FILTER_USE_KEY);
$ledgers = ledger_users();
$form = '<form method="get" class="mb-3 grid gap-4 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">'
    . select_field('perioada', 'Perioada', ['zi' => 'O zi', 'luna' => 'O lună', 'interval' => 'De la … până la …'], ['value' => $kind])
    . '<div data-perioada="zi"' . ($kind === 'zi' ? '' : ' hidden') . '>' . text_field('ziua', 'Ziua', ['type' => 'date', 'value' => $day, 'max' => $today]) . '</div>'
    . '<div data-perioada="luna"' . ($kind === 'luna' ? '' : ' hidden') . '>' . text_field('luna', 'Luna', ['type' => 'month', 'value' => $month, 'max' => date('Y-m')]) . '</div>'
    . '<div data-perioada="interval" class="grid grid-cols-2 gap-3 lg:col-span-2"' . ($kind === 'interval' ? '' : ' hidden') . '>' . text_field('de', 'De la', ['type' => 'date', 'value' => $from]) . text_field('pana', 'Până la', ['type' => 'date', 'value' => $to]) . '</div>'
    . (count($allowed) > 1 ? select_field('clinica', 'Clinica', $clinicOptions, ['value' => (string) ($clinic ?? '')]) : '')
    . ($ownDoctor === null ? select_field('medic', 'Medic', $doctorOptions, ['value' => (string) ($doctorFilter ?? '')]) : '')
    . select_field('incasat', 'Încasat de', $userOptions, ['value' => (string) ($byFilter ?? '')])
    . select_field('mod', 'Mod de plată', $methodOptions, ['value' => $methodFilter])
    . select_field('grup', 'Grupat', ['' => 'Nu (în ordinea orelor)', 'zi' => 'Pe zile', 'medic' => 'Pe medici', 'procedura' => 'Pe proceduri'], ['value' => $group])
    . (is_admin($user) && $ledgers !== [] ? select_field('registru', 'Registrul', ['' => 'Toate registrele', 'comun' => 'Registrul comun'] + array_combine(array_map('strval', array_keys($ledgers)), array_map(static fn ($id) => ledger_label((int) $id), array_keys($ledgers))), ['value' => query('registru')]) : '')
    . '<button type="submit" class="' . e(btn('primary', 'm', 'w-full')) . '">' . icon('filter', 18) . 'Arătați</button></form>';
$quickLink = static fn (string $label, array $p) => '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/rapoarte/incasari', $p + ['clinica' => $clinic, 'medic' => $doctorFilter, 'grup' => $group])) . '">' . e($label) . '</a>';
$prevMonth = date('Y-m', strtotime(date('Y-m-01') . ' -1 month'));
$quick = '<p class="mb-6 flex flex-wrap gap-2">'
    . $quickLink('Azi', ['perioada' => 'zi', 'ziua' => $today])
    . $quickLink('Ieri', ['perioada' => 'zi', 'ziua' => date('Y-m-d', strtotime('-1 day'))])
    . $quickLink('Luna aceasta', ['perioada' => 'luna', 'luna' => date('Y-m')])
    . $quickLink('Luna trecută', ['perioada' => 'luna', 'luna' => $prevMonth]) . '</p>';
$actions = '<a href="' . e(admin_url('/admin/rapoarte/incasari', $filters + ['pdf' => 1])) . '" class="' . e(btn('primary')) . '">' . icon('printer', 18) . 'PDF / Tipăriți</a>'
    . '<a href="' . e(admin_url('/admin/rapoarte/incasari', $filters + ['excel' => 1])) . '" class="' . e(btn('secondary')) . '">' . icon('download', 18) . 'Excel</a>';
$tile = static fn (string $label, int $value, string $cls = '') => '<div class="' . e(cn('rounded-panou border border-linie bg-suprafata p-4', $cls)) . '"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.6rem] leading-tight cifre">' . e(lei($value)) . '</p></div>';
$tiles = '<div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">' . $tile('Total încasat', $total, 'border-2 border-actiune bg-menta-pal');
foreach (['Numerar', 'Card', 'Transfer (OP)', 'Altă plată'] as $m) {
    $tiles .= $tile($m, $byMethod[$m] ?? 0);
}
$tiles .= '</div>';

$body = admin_header('Raport încasări: ' . $periodText, $filterText . '. Fiecare rând e o procedură plătită: o plată împărțită pe mai multe proceduri apare pe mai multe rânduri.', $actions)
    . '<p class="mb-4"><a href="/admin/rapoarte" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 16) . 'Rapoarte</a></p>'
    . $form . $quick . $tiles . $table . $summary
    . '<p class="mt-6 text-mic text-discret">Încasările se trec în fișa pacientului → Proceduri și plăți → Încasare (recepția și medicii). Plățile anulate nu intră în raport.</p>';
admin_page('Raport încasări', $body, $user);
