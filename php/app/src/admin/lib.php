<?php
/**
 * Small helpers shared by the panel's pages: icons the site does not use, the „?inapoi=” check,
 * which requests a user may see, the requests table and a few form utilities.
 */
declare(strict_types=1);

const ADMIN_PER_PAGE = 50;

/** Lucide icons only the panel needs (the site's set is data/icons.json). */
const ADMIN_ICONS = [
    'inbox' => '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    'tag' => '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    'image' => '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    'shield' => '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'chart' => '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'history' => '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    'user-round' => '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
];

function admin_icon(string $name, int $size = 18, string $class = '', ?string $label = null): string
{
    if (!isset(ADMIN_ICONS[$name])) {
        return icon($name, $size, $class, $label);
    }
    $a11y = $label !== null ? ' role="img" aria-label="' . e($label) . '"' : ' aria-hidden="true"';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'
        . $a11y . ' focusable="false" class="' . e(cn('shrink-0', $class)) . '">' . ADMIN_ICONS[$name] . '</svg>';
}

/** The page to return to after logging in: only a path inside the panel, never another site. */
function admin_safe_return(string $to): ?string
{
    if ($to === '' || !str_starts_with($to, '/admin') || str_starts_with($to, '//')) {
        return null;
    }
    // „/adminx”, backslashes (read as „/” by some browsers) and control characters are refused.
    if (strlen($to) > 6 && !in_array($to[6], ['/', '?', '#'], true)) {
        return null;
    }
    if (preg_match('/[\\\\\x00-\x20\x7f]/', $to) || str_starts_with($to, '/admin/intrare') || str_starts_with($to, '/admin/iesire')) {
        return null;
    }
    return $to;
}

/** The clinics by id → short name, in the clinic's order. */
function admin_clinic_names(): array
{
    static $names = null;
    return $names ??= array_column(db_all('SELECT id, short_name FROM locations ORDER BY sort_order, id'), 'short_name', 'id');
}

/**
 * The SQL condition for the requests a user may see: an administrator sees all; the others see
 * their clinics' requests plus those without a clinic (contact messages), when they have a clinic.
 *
 * @return array{0:string,1:list<int>}
 */
function lead_scope_sql(array $user, string $col = 'location_id'): array
{
    if (is_admin($user)) {
        return ['1 = 1', []];
    }
    $ids = allowed_location_ids($user);
    if ($ids === []) {
        return ['1 = 0', []];
    }
    return ["({$col} IN (" . implode(',', array_fill(0, count($ids), '?')) . ") OR {$col} IS NULL)", array_values($ids)];
}

function can_see_lead(array $lead, array $user): bool
{
    if (is_admin($user)) {
        return true;
    }
    $ids = allowed_location_ids($user);
    if ($ids === []) {
        return false;
    }
    return $lead['location_id'] === null || in_array((int) $lead['location_id'], $ids, true);
}

function new_leads_count(array $user): int
{
    [$scope, $params] = lead_scope_sql($user);
    return (int) db_value("SELECT COUNT(*) FROM leads WHERE status = 'nou' AND {$scope}", $params);
}

/** A request's status as a chip; „Nouă” stands out, „Închisă” recedes. */
function lead_status_chip(string $status): string
{
    $class = match ($status) {
        'nou' => 'bg-mustar-pal text-mustar-text',
        'in-lucru' => 'bg-menta-pal text-cerneala',
        'programat' => 'bg-menta-pal text-cerneala',
        default => 'bg-adancit text-discret',
    };
    $iconName = match ($status) {
        'nou' => 'bell',
        'in-lucru' => 'clock',
        'programat' => 'check',
        default => 'check-check',
    };
    return '<span class="' . e(cn('inline-flex items-center gap-1 whitespace-nowrap rounded-chip px-2.5 py-0.5 text-mic font-medium', $class)) . '">'
        . icon($iconName, 14) . e(LEAD_STATUS[$status] ?? $status) . '</span>';
}

function lead_kind_label(string $kind): string
{
    return $kind === 'programare' ? 'Programare' : 'Mesaj';
}

/** The requests as a table on wide screens and as a list on phones. */
function leads_table(array $leads): string
{
    if ($leads === []) {
        return '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Nu există cereri care să se potrivească.</p>';
    }
    $clinics = admin_clinic_names();
    $titles = array_column(content('services'), 'title', 'slug');
    $th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
    $rows = '';
    $cards = '';
    foreach ($leads as $l) {
        $href = '/admin/cereri/' . (int) $l['id'];
        $clinic = $l['location_id'] !== null ? ($clinics[(int) $l['location_id']] ?? '') : '—';
        $service = $l['category_slug'] ? ($titles[$l['category_slug']] ?? $l['category_slug']) : '';
        $what = lead_kind_label($l['kind']) . ($service !== '' ? ' · ' . $service : '');
        $rows .= '<tr class="border-t border-linie hover:bg-fundal">'
            . '<td class="cifre px-3 py-2 whitespace-nowrap text-discret">' . e(format_datetime($l['created_at'])) . '</td>'
            . '<td class="px-3 py-2"><a href="' . e($href) . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e($l['name']) . '</a></td>'
            . '<td class="telefon px-3 py-2">' . ($l['phone'] !== '' ? e(format_phone($l['phone'])) : '<span class="text-discret">—</span>') . '</td>'
            . '<td class="px-3 py-2">' . e($what) . '</td>'
            . '<td class="px-3 py-2">' . e($clinic) . '</td>'
            . '<td class="px-3 py-2">' . lead_status_chip($l['status']) . '</td></tr>';
        $cards .= '<li class="border-t border-linie first:border-t-0"><a href="' . e($href) . '" class="flex flex-col gap-1 px-1 py-3 hover:bg-fundal">'
            . '<span class="flex items-center justify-between gap-3"><span class="font-semibold text-link">' . e($l['name']) . '</span>' . lead_status_chip($l['status']) . '</span>'
            . '<span class="text-mic text-cerneala">' . e($what) . ($clinic !== '—' ? ' · ' . e($clinic) : '') . '</span>'
            . '<span class="cifre text-mic text-discret">' . e(format_datetime($l['created_at'])) . ($l['phone'] !== '' ? ' · <span class="telefon">' . e(format_phone($l['phone'])) . '</span>' : '') . '</span>'
            . '</a></li>';
    }
    return '<div class="hidden overflow-hidden rounded-panou border border-linie md:block"><table class="w-full border-collapse text-corp">'
        . '<thead class="bg-fundal"><tr><th scope="col" class="' . $th . '">Primită</th><th scope="col" class="' . $th . '">Nume</th><th scope="col" class="' . $th . '">Telefon</th>'
        . '<th scope="col" class="' . $th . '">Ce dorește</th><th scope="col" class="' . $th . '">Clinica</th><th scope="col" class="' . $th . '">Stare</th></tr></thead>'
        . '<tbody>' . $rows . '</tbody></table></div>'
        . '<ul class="flex flex-col md:hidden">' . $cards . '</ul>';
}

/** A positive integer from a query or form value, or null. */
function admin_int(string $v): ?int
{
    return preg_match('/^[1-9]\d{0,9}$/', $v) ? (int) $v : null;
}

/** The current URL with some query values changed (filters, pagination). */
function admin_url(string $path, array $params): string
{
    $q = http_build_query(array_filter($params, static fn ($v) => $v !== null && $v !== ''));
    return $path . ($q !== '' ? "?{$q}" : '');
}

/** A panel section: a white panel with a heading. */
function admin_section_open(string $title, string $id = '', string $lead = ''): string
{
    $hid = $id !== '' ? $id : 'sectiune-' . substr(md5($title), 0, 6);
    return '<section aria-labelledby="' . e($hid) . '" class="rounded-panou border border-linie bg-suprafata p-4 md:p-6">'
        . '<h2 id="' . e($hid) . '" class="text-h3 font-semibold text-cerneala">' . e($title) . '</h2>'
        . ($lead !== '' ? '<p class="mt-1 text-mic text-discret">' . e($lead) . '</p>' : '');
}

/** A „mailto:” href only for a plausible address (no header injection through the link). */
function admin_mailto(string $email): ?string
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) ? 'mailto:' . rawurlencode($email) : null;
}

/**
 * Sends a table as CSV for Excel (UTF-8 with BOM, „;” between columns, as Excel expects in
 * Romania) and stops. Amounts should already be formatted („1250,00”).
 */
function csv_download(string $filename, array $headers, array $rows): never
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-z0-9._-]+/i', '-', $filename) . '"');
    header('Cache-Control: no-store');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, $headers, ';');
    foreach ($rows as $r) {
        // A cell starting with = + - @ would run as a formula in Excel.
        fputcsv($out, array_map(static fn ($v) => is_string($v) && preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v, $r), ';');
    }
    fclose($out);
    exit;
}

/** „1250,50” for CSV cells (no thousands separator, comma decimals). */
function csv_lei(int $bani): string
{
    return number_format($bani / 100, 2, ',', '');
}

/** A period from ?de=YYYY-MM-DD&pana=YYYY-MM-DD (inclusive), with defaults; returns [from, to, toExclusive]. */
function admin_period(string $defaultFrom, string $defaultTo): array
{
    $ok = static fn (string $d) => DateTimeImmutable::createFromFormat('!Y-m-d', $d) !== false ? $d : null;
    $from = $ok(query('de')) ?? $defaultFrom;
    $to = $ok(query('pana')) ?? $defaultTo;
    if ($to < $from) {
        [$from, $to] = [$to, $from];
    }
    return [$from, $to, date('Y-m-d', strtotime($to . ' +1 day'))];
}
