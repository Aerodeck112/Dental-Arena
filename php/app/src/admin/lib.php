<?php
/**
 * Small helpers shared by the panel's pages: icons the site does not use, the „?inapoi=” check,
 * which requests a user may see, the requests table and a few form utilities.
 */
declare(strict_types=1);

const ADMIN_PER_PAGE = 50;

/** Lucide icons only the panel needs (the site's set is data/icons.json). */
const ADMIN_ICONS = [
    'qr' => '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    'phone-missed' => '<path d="m16 2 6 6"/><path d="m22 2-6 6"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'send' => '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    'package' => '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
    'camera' => '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    'implant' => '<path d="M8 3h8l-1 4H9z"/><path d="M10 7v11l2 3 2-3V7"/><path d="M9.5 10.5h5M9.5 13.5h5M9.5 16.5h5"/>',
    'pin' => '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    'coloane' => '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    'nota' => '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
    'inbox' => '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    'tag' => '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    'image' => '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    'shield' => '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    'megaphone' => '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    'mic' => '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    'sparkles' => '<path d="M9.94 14.06 8 20l-1.94-5.94L0 12l6.06-1.94L8 4l1.94 6.06L16 12z" transform="translate(3 -1) scale(.85)"/><path d="M20 3v4M22 5h-4"/>',
    'chart' => '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'history' => '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    'user-round' => '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    'tablet' => '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>',
    'signature' => '<path d="m21 17-2.156-1.868A.5.5 0 0 0 18 15.5v.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1c0-2.545-3.991-3.97-8.5-4a1 1 0 0 0 0 5c4.153 0 4.745-11.295 5.708-13.5a2.5 2.5 0 1 1 3.31 3.284"/><path d="M3 21h18"/>',
    'bot' => '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
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
    if (all_clinics($user)) {
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
    if (all_clinics($user)) {
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
    return match ($kind) { 'programare' => 'Programare', 'chat' => 'Din chat', default => 'Mesaj' };
}

/** The requests as a table on wide screens and as a list on phones. */
/** The requests as a table (a list on a phone); $select: a box on each, for „Ștergeți cererile bifate”. */
function leads_table(array $leads, bool $select = false): string
{
    if ($leads === []) {
        return '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Nu există cereri care să se potrivească.</p>';
    }
    $clinics = admin_clinic_names();
    $titles = array_column(site_services(), 'title', 'slug');
    $th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
    $rows = '';
    $cards = '';
    foreach ($leads as $l) {
        $href = '/admin/cereri/' . (int) $l['id'];
        $clinic = $l['location_id'] !== null ? ($clinics[(int) $l['location_id']] ?? '') : '—';
        $service = $l['category_slug'] ? ($titles[$l['category_slug']] ?? $l['category_slug']) : '';
        $what = lead_kind_label($l['kind']) . ($service !== '' ? ' · ' . $service : '');
        $box = $select ? '<input type="checkbox" name="ids[]" value="' . (int) $l['id'] . '" form="sterge-cereri" aria-label="' . e('Alegeți cererea: ' . $l['name']) . '" class="size-5 accent-carmin">' : '';
        $rows .= '<tr class="border-t border-linie hover:bg-fundal">'
            . ($select ? '<td class="w-10 px-3 py-2">' . $box . '</td>' : '')
            . '<td class="cifre px-3 py-2 whitespace-nowrap text-discret">' . e(format_datetime($l['created_at'])) . '</td>'
            . '<td class="px-3 py-2"><a href="' . e($href) . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e($l['name']) . '</a></td>'
            . '<td class="telefon px-3 py-2">' . ($l['phone'] !== '' ? e(format_phone($l['phone'])) : '<span class="text-discret">—</span>') . '</td>'
            . '<td class="px-3 py-2">' . e($what) . '</td>'
            . '<td class="px-3 py-2">' . e($clinic) . '</td>'
            . '<td class="px-3 py-2">' . lead_status_chip($l['status']) . '</td></tr>';
        $cards .= '<li class="flex items-start gap-3 border-t border-linie first:border-t-0">' . ($select ? '<span class="pt-4">' . str_replace('form="sterge-cereri"', 'form="sterge-cereri" data-mobil', $box) . '</span>' : '') . '<a href="' . e($href) . '" class="flex min-w-0 flex-1 flex-col gap-1 px-1 py-3 hover:bg-fundal">'
            . '<span class="flex items-center justify-between gap-3"><span class="font-semibold text-link">' . e($l['name']) . '</span>' . lead_status_chip($l['status']) . '</span>'
            . '<span class="text-mic text-cerneala">' . e($what) . ($clinic !== '—' ? ' · ' . e($clinic) : '') . '</span>'
            . '<span class="cifre text-mic text-discret">' . e(format_datetime($l['created_at'])) . ($l['phone'] !== '' ? ' · <span class="telefon">' . e(format_phone($l['phone'])) . '</span>' : '') . '</span>'
            . '</a></li>';
    }
    return '<div class="hidden overflow-hidden rounded-panou border border-linie md:block"><table class="w-full border-collapse text-corp">'
        . '<thead class="bg-fundal"><tr>' . ($select ? '<th scope="col" class="w-10 px-3 py-2"><input type="checkbox" data-bifeaza-tot="ids[]" aria-label="Alegeți toate cererile de pe pagină" class="size-5 accent-carmin"></th>' : '') . '<th scope="col" class="' . $th . '">Primită</th><th scope="col" class="' . $th . '">Nume</th><th scope="col" class="' . $th . '">Telefon</th>'
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

/**
 * The command for cPanel → Cron Jobs: the PHP of this site's version (cPanel's own, when it is
 * there), this install's cron.php, and no e-mail for every run.
 */
function cron_command(): string
{
    $php = 'php';
    foreach (['/opt/cpanel/ea-php' . PHP_MAJOR_VERSION . PHP_MINOR_VERSION . '/root/usr/bin/php', '/usr/local/bin/php', '/usr/bin/php'] as $bin) {
        if (@is_file($bin)) {
            $php = $bin;
            break;
        }
    }
    return $php . ' ' . (realpath(APP_DIR . '/cron.php') ?: APP_DIR . '/cron.php') . ' >/dev/null 2>&1';
}

/** When cron.php last ran (a Unix time), or null when it never did. */
function cron_last_run(): ?int
{
    $t = (int) @file_get_contents(APP_DIR . '/storage/cron.txt');
    return $t > 0 ? $t : null;
}

/**
 * The server's time and the last run of the cron job, under the menu (administrators): green while
 * it ran in the last 20 minutes, so the timely messages are sure to go; red with the way to Setări.
 */
function cron_status_line(): string
{
    $last = cron_last_run();
    $ok = $last !== null && time() - $last < 20 * 60;
    $ago = $last === null ? '' : (time() - $last < 90 ? 'acum un minut' : 'acum ' . (int) round((time() - $last) / 60) . ' min');
    return '<p class="text-mic text-discret">Ora serverului: <span class="cifre font-semibold text-cerneala">' . e(date('H:i')) . '</span></p>'
        . '<a href="/admin/setari#cron" class="' . e(cn('mt-1 inline-flex items-center gap-1.5 text-mic underline-offset-4 hover:underline', $ok ? 'text-actiune' : 'font-semibold text-carmin')) . '">'
        . '<span aria-hidden="true" class="' . e(cn('inline-block size-2 rounded-full', $ok ? 'bg-actiune' : 'bg-carmin')) . '"></span>'
        . ($ok ? 'Cron: ' . e(date('H:i', $last)) . ' (' . $ago . ')' : ($last === null ? 'Cron: nu rulează' : 'Cron: oprit din ' . e(date('d.m H:i', $last)))) . '</a>';
}

/**
 * Setări → „Cron Job”: whether it runs, the command to copy and where to put it in cPanel.
 * The messages (reminders, the doctors' programme) leave on time only with it.
 */
function cron_box(): string
{
    $last = cron_last_run();
    $ok = $last !== null && time() - $last < 20 * 60;
    $state = $ok
        ? '<p class="mt-4 flex items-center gap-2 rounded-panou bg-menta-pal p-3 text-corp">' . icon('check', 18) . '<span><strong>Rulează.</strong> Ultima dată: ' . e(date('d.m.Y H:i', $last)) . '.</span></p>'
        : '<p class="mt-4 flex items-start gap-2 rounded-panou border border-mustar bg-mustar-pal p-3 text-corp">' . icon('alert-triangle', 18, 'mt-0.5 shrink-0') . '<span><strong>' . ($last === null ? 'Nu rulează încă.' : 'Nu a mai rulat din ' . e(date('d.m.Y H:i', $last)) . '.') . '</strong> Fără el, mesajele (reamintirile, programul zilei al medicilor) pleacă doar când cineva deschide panoul, deci uneori cu întârziere. Puneți-l o singură dată, ca mai jos.</span></p>';
    $cmd = cron_command();
    return admin_section_open('Cron Job (mesajele la oră)', 'cron', 'Un program al serverului care pornește panoul la fiecare 5 minute: trimite mesajele, reamintirile de mâine, programul zilei al medicilor, urările și rechemările la ora lor.')
        . $state
        . '<ol class="mt-4 flex list-decimal flex-col gap-2 pl-5 text-corp">'
        . '<li>Intrați în <strong>cPanel</strong> → secțiunea <strong>Advanced</strong> (Avansat) → <strong>Cron Jobs</strong>.</li>'
        . '<li>La <strong>Add New Cron Job</strong> → <strong>Common Settings</strong>, alegeți <strong>Once Per Five Minutes (*/5 * * * *)</strong>. Câmpurile se completează singure: Minute <span class="cifre">*/5</span>, restul <span class="cifre">*</span>.</li>'
        . '<li>La <strong>Command</strong>, lipiți comanda de mai jos (butonul <strong>Copiați</strong>), apoi <strong>Add New Cron Job</strong>.</li>'
        . '<li>Peste 5 minute, reîncărcați această pagină: aici trebuie să scrie „Rulează”.</li></ol>'
        . '<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">'
        . '<code id="comanda-cron" class="block min-w-0 flex-1 select-all break-all rounded-control border border-linie-control bg-fundal px-3 py-2.5 font-mono text-mic">' . e($cmd) . '</code>'
        . '<button type="button" data-copiaza="#comanda-cron" class="' . e(btn('primary')) . '">' . icon('copy', 18) . 'Copiați</button></div>'
        . '<p class="mt-3 text-mic text-discret">„&gt;/dev/null 2&gt;&amp;1” de la sfârșit oprește e-mailul pe care cPanel l-ar trimite la fiecare rulare. Dacă la „Rulează” nu apare nimic după 10 minute, verificați în cPanel → MultiPHP Manager versiunea PHP a site-ului (' . e(PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION) . ') și scrieți-ne.</p>'
        . '</section>';
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

/** WhatsApp replies from patients nobody has opened yet (for the menu badge). */
function unread_messages_count(array $user): int
{
    try {
        [$scope, $params] = patient_scope_sql($user);
        return (int) db_value("SELECT COUNT(*) FROM messages m LEFT JOIN patients p ON p.id = m.patient_id WHERE m.direction = 'in' AND m.status = 'primit' AND (m.patient_id IS NULL OR {$scope})", $params);
    } catch (Throwable $e) {
        return 0;
    }
}

/**
 * A week of hours from a form (weekday → [from, to, break from, break to]): empty days are left
 * out, the break is optional. $error gets the first problem, in words.
 *
 * @return array<int,list<string>>
 */
function week_schedule_parse(mixed $sent, string $where, ?string &$error): array
{
    $sent = is_array($sent) ? $sent : [];
    $hm = static fn (string $v) => preg_match('/^\d{2}:\d{2}$/', $v) === 1;
    $out = [];
    foreach (WEEKDAYS as $day => $dayName) {
        $f = array_map(static fn ($i) => is_string($sent[$day][$i] ?? null) ? trim($sent[$day][$i]) : '', [0, 1, 2, 3]);
        if ($f[0] === '' && $f[1] === '') {
            continue;
        }
        if (!$hm($f[0]) || !$hm($f[1]) || $f[0] >= $f[1]) {
            $error ??= "Programul de {$dayName}{$where}: scrieți ora de început și de sfârșit (de exemplu 09:00 și 17:00).";
            continue;
        }
        $out[$day] = [$f[0], $f[1]];
        if ($f[2] !== '' || $f[3] !== '') {
            if (!$hm($f[2]) || !$hm($f[3]) || !($f[0] < $f[2] && $f[2] < $f[3] && $f[3] < $f[1])) {
                $error ??= "Pauza de {$dayName}{$where} trebuie să fie în program (de exemplu 13:00–13:30).";
                continue;
            }
            $out[$day] = [$f[0], $f[1], $f[2], $f[3]];
        }
    }
    return $out;
}

/** The seven rows of a week of hours (from, to, an optional break), named {$name}[day][0..3]. */
function week_schedule_fields(string $name, array $sch, string $where): string
{
    $rows = '';
    foreach (WEEKDAYS as $day => $dayName) {
        $span = ($sch[$day] ?? []) + ['', '', '', ''];
        $t = static fn (int $i, string $label) => '<input type="time" step="300" name="' . e($name) . '[' . $day . '][' . $i . ']" value="' . e($span[$i]) . '" aria-label="' . e("{$dayName}{$where}: {$label}") . '" class="' . e(input_classes('h-control-s min-w-0')) . '">';
        $rows .= '<div class="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2"><span class="text-corp">' . e($dayName) . '</span>' . $t(0, 'de la') . $t(1, 'până la')
            . '<span class="text-mic text-discret">pauză</span>' . $t(2, 'pauză de la') . $t(3, 'pauză până la') . '</div>';
    }
    return '<div class="mt-1 grid grid-cols-[6.5rem_1fr_1fr] gap-2 text-mic text-discret"><span></span><span>De la</span><span>Până la</span></div>'
        . '<div class="mt-1 flex flex-col gap-2">' . $rows . '</div>';
}

/**
 * What a settings form changed, for the audit (and so for the administrator's summary of what
 * VITIM did): „pauză între programări: 0 → 5”. Only the labelled keys; never secrets.
 */
function changes_text(array $old, array $new, array $labels): string
{
    $show = static fn ($v) => is_bool($v) ? ($v ? 'da' : 'nu') : (is_array($v) ? implode(', ', $v) : ((string) $v === '' ? '(gol)' : mb_strimwidth((string) $v, 0, 60, '…')));
    $out = [];
    foreach ($labels as $k => $label) {
        $a = $old[$k] ?? null;
        $b = $new[$k] ?? null;
        if ($show($a) !== $show($b)) {
            $out[] = "{$label}: {$show($a)} → {$show($b)}";
        }
    }
    return $out === [] ? 'nicio schimbare' : implode('; ', $out);
}

function message_event_label(string $event): string
{
    return PATIENT_EVENTS[$event]['label'] ?? STAFF_EVENTS[$event]['label'] ?? match ($event) {
        'manual' => 'Mesaj din panou',
        'raspuns' => 'Mesaj de la pacient',
        'campanie' => 'Campanie',
        'staff-configurare' => 'Ce a configurat VITIM',
        default => $event,
    };
}

function msg_status_chip(string $status): string
{
    $cls = match ($status) {
        'livrat', 'citit', 'trimis' => 'bg-menta-pal text-cerneala',
        'esuat' => 'bg-carmin-pal text-carmin',
        'in-asteptare', 'se-trimite' => 'border border-dashed border-linie-control text-discret',
        'primit' => 'bg-mustar-pal text-mustar-text',
        default => 'bg-adancit text-discret',
    };
    return '<span class="' . e(cn('inline-flex items-center whitespace-nowrap rounded-chip px-2 py-0.5 text-mic font-medium', $cls)) . '">' . e(MSG_STATUS[$status] ?? $status) . '</span>';
}

/** One message as a chat bubble: the patient's on the left, the clinic's on the right. */
function message_bubble(array $m, bool $withPatient = false): string
{
    $in = $m['direction'] === 'in';
    $who = $withPatient && !empty($m['last_name']) ? '<a class="font-semibold text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $m['patient_id'] . '/mesaje">' . e(trim($m['last_name'] . ' ' . $m['first_name'])) . '</a> · ' : '';
    return '<li class="' . e(cn('flex', $in ? 'justify-start' : 'justify-end')) . '"><div class="' . e(cn('max-w-[36rem] rounded-panou border p-3', $in ? 'border-mustar bg-mustar-pal/50' : 'border-linie bg-suprafata')) . '">'
        . '<p class="flex flex-wrap items-center gap-2 text-mic text-discret">' . $who . '<span class="font-medium text-cerneala">' . e(MSG_CHANNELS[$m['channel']] ?? $m['channel']) . '</span> · ' . e(message_event_label($m['event']))
        . ' · <span class="cifre">' . e(date('d.m.Y H:i', strtotime($m['sent_at'] ?? $m['created_at']))) . '</span> ' . msg_status_chip($m['status']) . '</p>'
        . ($m['subject'] ? '<p class="mt-1 font-semibold">' . e($m['subject']) . '</p>' : '')
        . '<p class="mt-1 whitespace-pre-line break-words text-corp">' . e($m['body']) . '</p>'
        . ($m['error'] ? '<p class="mt-1 text-mic text-carmin">' . e($m['error']) . '</p>' : '')
        . ($m['status'] === 'in-asteptare' && strtotime($m['send_after']) > time() + 60 ? '<p class="mt-1 text-mic text-discret">Pleacă ' . e(format_datetime($m['send_after'])) . '</p>' : '')
        . '</div></li>';
}

// ── Marketing campaigns ──────────────────────────────────────────────────────

const CAMPAIGN_STATUS = ['ciorna' => 'Ciornă', 'programata' => 'Programată', 'trimisa' => 'Trimisă'];

/**
 * The patients a campaign goes to: active, with marketing consent for the channel and a usable
 * address, filtered by the segment (clinic, no visit for N months, an open treatment plan,
 * birthday this month, a service received).
 */
function campaign_recipients(array $seg, string $channel): array
{
    $where = ['p.active = 1', 'p.anonymized_at IS NULL'];
    $params = [];
    $where[] = match ($channel) {
        'sms' => "p.marketing_sms = 1 AND p.phone <> ''",
        'whatsapp' => "p.marketing_whatsapp = 1 AND p.phone <> ''",
        default => "p.marketing_email = 1 AND p.email IS NOT NULL AND p.email <> ''",
    };
    if (!empty($seg['clinica'])) {
        $where[] = 'p.preferred_location_id = ?';
        $params[] = (int) $seg['clinica'];
    }
    if (!empty($seg['inactiv_luni'])) {
        $where[] = "NOT EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.status = 'finalizat' AND a.starts_at > ?)";
        $params[] = date('Y-m-d H:i:s', strtotime('-' . (int) $seg['inactiv_luni'] . ' months'));
    }
    if (!empty($seg['plan_deschis'])) {
        $where[] = "EXISTS (SELECT 1 FROM treatment_plans t JOIN treatment_plan_items i ON i.plan_id = t.id WHERE t.patient_id = p.id AND t.status IN ('prezentat', 'acceptat', 'in-curs') AND i.status IN ('propus', 'acceptat'))";
    }
    if (!empty($seg['luna_nasterii'])) {
        $where[] = 'MONTH(p.birth_date) = ?';
        $params[] = (int) date('n');
    }
    if (!empty($seg['serviciu'])) {
        $where[] = "EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.status = 'finalizat' AND a.category_slug = ?)";
        $params[] = (string) $seg['serviciu'];
    }
    $rows = db_all('SELECT p.* FROM patients p WHERE ' . implode(' AND ', $where) . ' ORDER BY p.last_name, p.first_name', $params);
    return array_values(array_filter($rows, static fn ($p) => $channel === 'email' ? (bool) filter_var($p['email'], FILTER_VALIDATE_EMAIL) : ($channel === 'sms' ? phone_ro_mobile($p['phone']) !== null : phone_e164($p['phone']) !== null)));
}

/** Queues a campaign to its recipients; returns how many messages were queued. */
function queue_campaign(array $c, string $when): int
{
    $seg = json_decode((string) $c['segment'], true) ?: [];
    $n = 0;
    $after = within_hours(new DateTimeImmutable($when), true)->format('Y-m-d H:i:s');
    foreach (campaign_recipients($seg, $c['channel']) as $p) {
        $vars = patient_vars($p);
        $text = fill_template($c['body'], $vars);
        $row = ['event' => 'campanie', 'patient_id' => (int) $p['id'], 'campaign_id' => (int) $c['id'], 'send_after' => $after];
        if ($c['channel'] === 'sms') {
            $row += ['channel' => 'sms', 'to_address' => (string) phone_ro_mobile($p['phone']), 'body' => $text . ' Dezabonare: ' . unsubscribe_url($p)];
        } elseif ($c['channel'] === 'whatsapp') {
            $row += ['channel' => 'whatsapp', 'to_address' => (string) phone_e164($p['phone']), 'body' => $text, 'template' => $c['template'], 'template_params' => json_encode([$vars['prenume']], JSON_UNESCAPED_UNICODE)];
        } else {
            $row += ['channel' => 'email', 'to_address' => (string) $p['email'], 'subject' => fill_template((string) $c['subject'], $vars), 'body' => $text . "\n\nNu mai doriți astfel de mesaje? " . unsubscribe_url($p)];
        }
        queue_message($row);
        $n++;
    }
    return $n;
}
