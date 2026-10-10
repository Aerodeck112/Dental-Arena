<?php
/**
 * /admin/rapoarte: the numbers of a period (this month by default), per clinic. Administrators
 * see revenue (per doctor, per service category, per payment method, per month); everyone sees
 * the appointments (per doctor, no-shows) and the site requests; a doctor sees their own rows.
 * Every table exports to CSV.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
[$from, $to, $toEx] = admin_period(date('Y-m-01'), date('Y-m-d'));
$clinic = admin_int(query('clinica'));
$clinicIds = $clinic !== null && in_array($clinic, $allowed, true) ? [$clinic] : $allowed;
$finance = can('reports.finance', $user);
$ownDoctor = $user['role'] === 'medic' && $user['doctor_id'] ? (int) $user['doctor_id'] : null;
$docs = doctor_short_names();
$in = $clinicIds === [] ? '0' : implode(',', array_map('intval', $clinicIds));
$period = ["{$from} 00:00:00", "{$toEx} 00:00:00"];
$csvKey = query('csv');
$pct = static fn (int $a, int $b) => $b > 0 ? number_format($a / $b * 100, 1, ',', '') . '%' : '—';

// ── Appointments per doctor ──
$apptSql = "SELECT doctor_id, COUNT(*) AS total,
    SUM(status IN ('programat', 'confirmat')) AS viitoare, SUM(status = 'finalizat') AS efectuate,
    SUM(status = 'anulat') AS anulate, SUM(status = 'neprezentat') AS neprezentari,
    SUM(lead_id IS NOT NULL) AS online, SUM(starts_at < NOW() AND status <> 'anulat') AS trecute
    FROM appointments WHERE location_id IN ({$in}) AND starts_at >= ? AND starts_at < ?" . ($ownDoctor ? ' AND doctor_id = ' . $ownDoctor : '') . ' GROUP BY doctor_id ORDER BY total DESC';
$apptRows = db_all($apptSql, $period);
$apptTable = array_map(static fn ($r) => [
    $docs[(int) $r['doctor_id']] ?? '—', (int) $r['total'], (int) $r['viitoare'], (int) $r['efectuate'], (int) $r['anulate'], (int) $r['neprezentari'], $pct((int) $r['neprezentari'], (int) $r['trecute']), (int) $r['online'],
], $apptRows);
$apptHead = ['Medic', 'Total', 'Programat / confirmat', 'Efectuate', 'Anulate', 'Neprezentări', 'Rata neprezentărilor', 'Din site'];

// ── Site requests ──
$leadRows = db_all("SELECT category_slug, COUNT(*) AS total, SUM(status = 'programat' OR appointment_id IS NOT NULL) AS programate FROM leads
    WHERE kind = 'programare' AND (location_id IN ({$in}) OR location_id IS NULL) AND created_at >= ? AND created_at < ? GROUP BY category_slug ORDER BY total DESC", $period);
$leadTable = array_map(static fn ($r) => [$r['category_slug'] ? service_title($r['category_slug']) : 'Nespecificat', (int) $r['total'], (int) $r['programate'], $pct((int) $r['programate'], (int) $r['total'])], $leadRows);
$leadHead = ['Serviciul dorit', 'Cereri', 'Programate', 'Conversie'];

$newPatients = (int) db_value('SELECT COUNT(*) FROM patients WHERE created_at >= ? AND created_at < ?' . (is_admin($user) && $clinic === null ? '' : " AND (preferred_location_id IN ({$in}) OR preferred_location_id IS NULL)"), $period);

// ── Revenue (administrators; a doctor sees their own production) ──
$docTable = [];
$catTable = [];
$methodTable = [];
$monthTable = [];
$sums = ['invoiced' => 0, 'paid' => 0];
if ($finance || $ownDoctor) {
    $docRows = db_all("SELECT ii.doctor_id, COUNT(DISTINCT v.id) AS facturi, COUNT(*) AS linii, SUM(ii.total) AS venit FROM invoice_items ii JOIN invoices v ON v.id = ii.invoice_id
        WHERE v.status = 'emisa' AND v.location_id IN ({$in}) AND v.issued_at >= ? AND v.issued_at < ?" . ($ownDoctor && !$finance ? ' AND ii.doctor_id = ' . $ownDoctor : '') . ' GROUP BY ii.doctor_id ORDER BY venit DESC', $period);
    $docTable = array_map(static fn ($r) => [$docs[(int) $r['doctor_id']] ?? 'Fără medic', (int) $r['facturi'], (int) $r['linii'], (int) $r['venit']], $docRows);
}
if ($finance) {
    $catRows = db_all("SELECT COALESCE(c.name, 'Alte servicii') AS categorie, SUM(ii.quantity) AS cantitate, SUM(ii.total) AS venit FROM invoice_items ii JOIN invoices v ON v.id = ii.invoice_id
        LEFT JOIN services s ON s.id = ii.service_id LEFT JOIN categories c ON c.id = s.category_id
        WHERE v.status = 'emisa' AND v.location_id IN ({$in}) AND v.issued_at >= ? AND v.issued_at < ? GROUP BY categorie ORDER BY venit DESC", $period);
    $catTable = array_map(static fn ($r) => [$r['categorie'], (int) $r['cantitate'], (int) $r['venit']], $catRows);
    $payRows = db_all("SELECT method, COUNT(*) AS n, SUM(amount) AS suma FROM payments WHERE cancelled_at IS NULL AND location_id IN ({$in}) AND paid_at >= ? AND paid_at < ? GROUP BY method", $period);
    $paidTotal = array_sum(array_map(static fn ($r) => (int) $r['suma'], $payRows));
    foreach (PAYMENT_METHODS as $k => $label) {
        $r = current(array_filter($payRows, static fn ($x) => $x['method'] === $k)) ?: ['n' => 0, 'suma' => 0];
        $methodTable[] = [$label, (int) $r['n'], (int) $r['suma'], $pct((int) $r['suma'], $paidTotal)];
    }
    $sums['invoiced'] = (int) db_value("SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'emisa' AND location_id IN ({$in}) AND issued_at >= ? AND issued_at < ?", $period);
    $sums['paid'] = $paidTotal;
    // The last 12 months, regardless of the period.
    $start = date('Y-m-01', strtotime(date('Y-m-01') . ' -11 months'));
    $inv = array_column(db_all("SELECT DATE_FORMAT(issued_at, '%Y-%m') AS m, SUM(total) AS s, COUNT(*) AS n FROM invoices WHERE status = 'emisa' AND location_id IN ({$in}) AND issued_at >= ? GROUP BY m", [$start]), null, 'm');
    $pay = array_column(db_all("SELECT DATE_FORMAT(paid_at, '%Y-%m') AS m, SUM(amount) AS s FROM payments WHERE cancelled_at IS NULL AND location_id IN ({$in}) AND paid_at >= ? GROUP BY m", [$start]), null, 'm');
    for ($i = 0; $i < 12; $i++) {
        $m = date('Y-m', strtotime("{$start} +{$i} months"));
        $monthTable[] = [$m, (int) ($inv[$m]['n'] ?? 0), (int) ($inv[$m]['s'] ?? 0), (int) ($pay[$m]['s'] ?? 0)];
    }
}

// ── CSV ──
$csv = [
    'programari' => ['Programări pe medic', $apptHead, $apptTable, []],
    'cereri' => ['Cereri de pe site', $leadHead, $leadTable, []],
    'medici' => ['Venit pe medic', ['Medic', 'Facturi', 'Servicii facturate', 'Venit facturat'], $docTable, [3]],
    'categorii' => ['Venit pe categorie', ['Categoria', 'Cantitate', 'Venit facturat'], $catTable, [2]],
    'metode' => ['Încasări pe metodă', ['Metoda', 'Încasări', 'Suma', 'Pondere'], $methodTable, [2]],
    'lunar' => ['Pe luni', ['Luna', 'Facturi', 'Facturat', 'Încasat'], $monthTable, [2, 3]],
];
if (isset($csv[$csvKey]) && ($csv[$csvKey][2] !== [] || in_array($csvKey, ['programari', 'cereri'], true))) {
    [$title, $head, $rows, $money] = $csv[$csvKey];
    audit('export-raport', "{$title}, {$from} – {$to}");
    csv_download("raport-{$csvKey}-{$from}-{$to}.csv", $head, array_map(static function ($r) use ($money) {
        foreach ($money as $i) {
            $r[$i] = csv_lei((int) $r[$i]);
        }
        return $r;
    }, $rows));
}

// ── Rendering ──
$filters = ['de' => $from, 'pana' => $to, 'clinica' => $clinic];
$table = static function (string $key, array $head, array $rows, array $money, string $empty) use ($csv, $filters): string {
    if ($rows === []) {
        return '<p class="mt-3 text-corp text-discret">' . e($empty) . '</p>';
    }
    $th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
    $h = '';
    foreach ($head as $i => $label) {
        $h .= '<th scope="col" class="' . $th . ($i > 0 ? ' text-right' : '') . '">' . e($label) . '</th>';
    }
    $b = '';
    foreach ($rows as $r) {
        $b .= '<tr class="border-t border-linie">';
        foreach ($r as $i => $v) {
            $b .= $i === 0 ? '<th scope="row" class="px-3 py-2 text-left font-medium">' . e((string) $v) . '</th>' : '<td class="cifre whitespace-nowrap px-3 py-2 text-right">' . e(in_array($i, $money, true) ? lei((int) $v) : (string) $v) . '</td>';
        }
        $b .= '</tr>';
    }
    return '<div class="mt-3 relative overflow-x-auto"><table class="w-full min-w-[32rem] border-collapse text-corp"><thead><tr>' . $h . '</tr></thead><tbody>' . $b . '</tbody></table></div>'
        . '<p class="mt-3"><a class="inline-flex min-h-control-s items-center gap-1 text-mic text-link underline" href="' . e(admin_url('/admin/rapoarte', $filters + ['csv' => $key])) . '">' . icon('download', 14) . 'CSV</a></p>';
};

// Monthly invoiced revenue: one series, bars from a zero baseline, value on hover and in the table below.
$chart = '';
if ($monthTable !== []) {
    $max = max(1, ...array_map(static fn ($r) => $r[2], $monthTable));
    $bars = '';
    $w = 600 / 12;
    foreach ($monthTable as $i => [$m, $n, $sum]) {
        $h = $sum > 0 ? max(2, $sum / $max * 150) : 0;
        $x = $i * $w + 8;
        $label = RO_MONTHS[(int) substr($m, 5, 2) - 1] . ' ' . substr($m, 0, 4) . ': ' . lei($sum);
        $bars .= '<g class="group"><title>' . e($label) . '</title>'
            . '<rect x="' . ($x - 6) . '" y="0" width="' . ($w - 4) . '" height="190" class="fill-transparent"/>'
            . ($h >= 8 ? '<path d="M' . $x . ' 170 V' . round(174 - $h, 1) . ' q0 -4 4 -4 h' . ($w - 24) . ' q4 0 4 4 V170 Z" class="fill-actiune group-hover:fill-cerneala"/>'
                : ($h > 0 ? '<rect x="' . $x . '" y="' . round(170 - $h, 1) . '" width="' . ($w - 16) . '" height="' . round($h, 1) . '" class="fill-actiune group-hover:fill-cerneala"/>' : ''))
            . '<text x="' . ($x + ($w - 16) / 2) . '" y="186" text-anchor="middle" class="fill-discret text-[11px]">' . e(mb_substr(RO_MONTHS[(int) substr($m, 5, 2) - 1], 0, 3)) . '</text></g>';
    }
    $chart = '<svg viewBox="0 0 608 192" role="img" aria-label="Facturat pe ultimele 12 luni; valorile sunt în tabelul de dedesubt" class="mt-4 block h-auto w-full max-w-3xl font-sans">'
        . '<line x1="0" y1="170.5" x2="608" y2="170.5" class="stroke-linie"/>' . $bars . '</svg>';
}

$clinicOptions = ['' => count($allowed) > 1 ? 'Toate clinicile' : ($names[$allowed[0] ?? 0] ?? '')];
foreach ($allowed as $l) {
    $clinicOptions[(string) $l] = $names[$l];
}
$form = '<form method="get" class="mb-3 grid gap-3 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">'
    . text_field('de', 'De la', ['type' => 'date', 'value' => $from])
    . text_field('pana', 'Până la', ['type' => 'date', 'value' => $to])
    . (count($allowed) > 1 ? select_field('clinica', 'Clinica', $clinicOptions, ['value' => (string) ($clinic ?? '')]) : '')
    . '<button type="submit" class="' . e(btn('primary', 'm', 'w-full')) . '">' . icon('filter', 18) . 'Arătați</button></form>';
$prevStart = date('Y-m-01', strtotime(date('Y-m-01') . ' -1 month'));
$quick = '<p class="mb-6 flex flex-wrap gap-2">'
    . '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/rapoarte', ['clinica' => $clinic])) . '">Luna aceasta</a>'
    . '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/rapoarte', ['de' => $prevStart, 'pana' => date('Y-m-t', strtotime($prevStart)), 'clinica' => $clinic])) . '">Luna trecută</a>'
    . '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/rapoarte', ['de' => date('Y-01-01'), 'pana' => date('Y-m-d'), 'clinica' => $clinic])) . '">Anul acesta</a></p>';

$apptTotals = array_reduce($apptRows, static fn ($c, $r) => [$c[0] + (int) $r['efectuate'], $c[1] + (int) $r['neprezentari'], $c[2] + (int) $r['trecute']], [0, 0, 0]);
$tile = static fn (string $label, string $value, string $note = '') => '<div class="rounded-panou border border-linie bg-suprafata p-4"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.6rem] leading-tight cifre">' . e($value) . '</p>' . ($note !== '' ? '<p class="text-mic text-discret">' . e($note) . '</p>' : '') . '</div>';
$tiles = '<div class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">'
    . ($finance ? $tile('Facturat', lei($sums['invoiced'])) . $tile('Încasat', lei($sums['paid'])) : '')
    . $tile('Programări efectuate', (string) $apptTotals[0]) . $tile('Neprezentări', (string) $apptTotals[1], 'din programările trecute: ' . $pct($apptTotals[1], $apptTotals[2]))
    . (!$finance ? $tile('Pacienți noi', (string) $newPatients) . $tile('Cereri de pe site', (string) array_sum(array_column($leadTable, 1))) : '')
    . '</div>';

$sections = [];
if ($finance) {
    $sections[] = admin_section_open('Facturat pe luni', 'lunar', 'Ultimele 12 luni, indiferent de perioada aleasă.') . $chart . $table('lunar', ['Luna', 'Facturi', 'Facturat', 'Încasat'], array_map(static fn ($r) => [RO_MONTHS[(int) substr($r[0], 5, 2) - 1] . ' ' . substr($r[0], 0, 4), $r[1], $r[2], $r[3]], $monthTable), [2, 3], '') . '</section>';
}
if ($finance || $ownDoctor) {
    $sections[] = admin_section_open($finance ? 'Venit facturat pe medic' : 'Producția mea', 'medici', 'Din liniile facturilor emise în perioadă (fără cele anulate).') . $table('medici', ['Medic', 'Facturi', 'Servicii facturate', 'Venit facturat'], $docTable, [3], 'Nicio factură în perioadă.') . '</section>';
}
if ($finance) {
    $sections[] = admin_section_open('Venit pe categorie de servicii', 'categorii') . $table('categorii', ['Categoria', 'Cantitate', 'Venit facturat'], $catTable, [2], 'Nicio factură în perioadă.') . '</section>';
    $sections[] = admin_section_open('Încasări pe metodă de plată', 'metode') . $table('metode', ['Metoda', 'Încasări', 'Suma', 'Pondere'], $methodTable, [2], '') . '</section>';
}
$sections[] = admin_section_open('Programări pe medic', 'programari', 'Rata neprezentărilor se calculează din programările deja trecute.') . $table('programari', $apptHead, $apptTable, [], 'Nicio programare în perioadă.') . '</section>';
$sections[] = admin_section_open('Cereri de programare de pe site', 'cereri', "Pacienți noi în perioadă: {$newPatients}.") . $table('cereri', $leadHead, $leadTable, [], 'Nicio cerere în perioadă.') . '</section>';

$body = admin_header('Rapoarte', format_date($from) . ' – ' . format_date($to) . ($clinic !== null && isset($names[$clinic]) ? ' · ' . $names[$clinic] : (count($allowed) > 1 ? ' · ambele clinici' : '')) . '.')
    . $form . $quick . $tiles
    . '<div class="flex flex-col gap-8">' . implode('', $sections) . '</div>';
admin_page('Rapoarte', $body, $user);
