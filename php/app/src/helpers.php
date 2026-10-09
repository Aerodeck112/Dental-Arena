<?php
/** Small helpers used everywhere: escaping, URLs, requests, sessions, CSRF, formatting. */
declare(strict_types=1);

/** HTML-escapes a value for text and attributes. */
function e(mixed $v): string
{
    return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Joins class names, skipping empty ones (like cn() in the Next.js version). */
function cn(string|false|null ...$parts): string
{
    return implode(' ', array_filter($parts, static fn ($p) => is_string($p) && $p !== ''));
}

/** The public origin, e.g. https://dentalarena.ro (no trailing slash). */
function site_url(): string
{
    $url = CONFIG['url'] ?? '';
    if ($url === '') {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $url = ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }
    return rtrim($url, '/');
}

function absolute_url(string $path): string
{
    return site_url() . (str_starts_with($path, '/') ? $path : "/{$path}");
}

/** A file under public_html with its modification time, so browsers fetch the new version after an update. */
function asset(string $path): string
{
    $file = PUBLIC_DIR . $path;
    return is_file($file) ? $path . '?v=' . filemtime($file) : $path;
}

function is_test_site(): bool
{
    return (CONFIG['site_mode'] ?? 'live') === 'test';
}

/** Writes a line to dentalarena/storage/logs/app.log. */
function app_log(string $level, string $message): void
{
    $dir = APP_DIR . '/storage/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    @file_put_contents($dir . '/app.log', date('c') . " [{$level}] {$message}\n", FILE_APPEND | LOCK_EX);
}

/** Reads one of the JSON files exported from the Next.js sources (php/app/data). */
function data_file(string $name): array
{
    static $cache = [];
    if (!isset($cache[$name])) {
        $raw = @file_get_contents(APP_DIR . "/data/{$name}.json");
        $cache[$name] = $raw === false ? [] : (json_decode($raw, true) ?: []);
    }
    return $cache[$name];
}

// ── Requests ─────────────────────────────────────────────────────────────────

function request_path(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    return rawurldecode($path);
}

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

/** A trimmed POST value. */
function post(string $key, string $default = ''): string
{
    $v = $_POST[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function query(string $key, string $default = ''): string
{
    $v = $_GET[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function redirect(string $to, int $code = 303): never
{
    header('Location: ' . $to, true, $code);
    exit;
}

function client_ip_hash(): string
{
    return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? '', (string) (CONFIG['secret'] ?? 'dentalarena'));
}

// ── Session, flash messages, CSRF ────────────────────────────────────────────

function session_begin(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = str_starts_with(site_url(), 'https://');
    session_name('da_sesiune');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    $dir = APP_DIR . '/storage/sessions';
    if (is_dir($dir) || @mkdir($dir, 0700, true)) {
        session_save_path($dir);
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_start();
}

function flash(string $message, string $kind = 'ok'): void
{
    session_begin();
    $_SESSION['flash'][] = ['kind' => $kind, 'message' => $message];
}

/** @return list<array{kind:string,message:string}> */
function take_flash(): array
{
    session_begin();
    $all = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $all;
}

function csrf_token(): string
{
    session_begin();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

/** Stops a POST without the form's token (a request forged by another site). */
function csrf_check(): void
{
    session_begin();
    $sent = $_POST['_csrf'] ?? '';
    if (!is_string($sent) || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        http_response_code(419);
        exit('Formularul a expirat. Reîncărcați pagina și încercați din nou.');
    }
}

// ── Formatting (the same rules as src/lib/format.ts) ─────────────────────────

/** „2.200”, „1.234,50” */
function format_amount(int $bani): string
{
    $lei = intdiv($bani, 100);
    $rest = $bani % 100;
    $s = number_format($lei, 0, ',', '.');
    return $rest === 0 ? $s : $s . ',' . str_pad((string) $rest, 2, '0', STR_PAD_LEFT);
}

const UNIT_SUFFIX = ['ORA' => 'oră', 'SEDINTA' => 'ședință', 'DINTE' => 'dinte', 'ARCADA' => 'arcadă'];
const UNIT_LABEL = ['ACT' => 'act', 'DINTE' => 'dinte', 'ARCADA' => 'arcadă', 'ORA' => 'oră', 'SEDINTA' => 'ședință'];

/**
 * „2.200 lei”, „de la 200 lei”, „900 / 1.100 lei”, „150 lei / oră”, or „Prețul îl aflați la telefon”.
 */
function format_lei(?int $bani, bool $from = false, ?int $max = null, ?string $unit = null): string
{
    if ($bani === null) {
        return 'Prețul îl aflați la telefon';
    }
    $amount = ($max !== null && $max !== $bani) ? format_amount($bani) . ' / ' . format_amount($max) : format_amount($bani);
    $suffix = ($unit !== null && isset(UNIT_SUFFIX[$unit])) ? ' / ' . UNIT_SUFFIX[$unit] : '';
    return ($from ? 'de la ' : '') . $amount . NBSP . 'lei' . $suffix;
}

function national_digits(string $phone): ?string
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if (str_starts_with($digits, '0040')) {
        $digits = '0' . substr($digits, 4);
    } elseif (str_starts_with($digits, '40') && strlen($digits) === 11) {
        $digits = '0' . substr($digits, 2);
    }
    return preg_match('/^0\d{9}$/', $digits) ? $digits : null;
}

/** „0265 326 316” with no-break spaces. */
function format_phone(string $phone): string
{
    $n = national_digits($phone);
    return $n === null ? trim($phone) : substr($n, 0, 4) . NBSP . substr($n, 4, 3) . NBSP . substr($n, 7);
}

/** „tel:+40265326316” */
function tel_href(string $phone): string
{
    $n = national_digits($phone);
    return $n !== null ? 'tel:+40' . substr($n, 1) : 'tel:' . (preg_replace('/[^\d+]/', '', $phone) ?? '');
}

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const RO_WEEKDAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];

/** „7 octombrie 2026” */
function format_date(string|DateTimeInterface $d, bool $withWeekday = false): string
{
    $dt = $d instanceof DateTimeInterface ? $d : new DateTimeImmutable($d);
    $s = (int) $dt->format('j') . ' ' . RO_MONTHS[(int) $dt->format('n') - 1] . ' ' . $dt->format('Y');
    return $withWeekday ? RO_WEEKDAYS[(int) $dt->format('N') - 1] . ', ' . $s : $s;
}

/** „7 oct. 2026, 14:05” for the panel. */
function format_datetime(string $d): string
{
    $dt = new DateTimeImmutable($d);
    return (int) $dt->format('j') . ' ' . mb_substr(RO_MONTHS[(int) $dt->format('n') - 1], 0, 3) . '. ' . $dt->format('Y, H:i');
}

/** „implant-neodent” from „Implant Neodent”. */
function slugify(string $s): string
{
    $map = ['ă' => 'a', 'â' => 'a', 'î' => 'i', 'ș' => 's', 'ş' => 's', 'ț' => 't', 'ţ' => 't', 'Ă' => 'a', 'Â' => 'a', 'Î' => 'i', 'Ș' => 's', 'Ş' => 's', 'Ț' => 't', 'Ţ' => 't'];
    $s = mb_strtolower(strtr($s, $map));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
    return trim($s, '-');
}

/** „lei” amount typed in the panel („2.200”, „2200”, „150,50”) → bani; '' → null. */
function parse_lei(string $s): ?int
{
    $s = str_replace([' ', NBSP, 'lei'], '', trim($s));
    if ($s === '') {
        return null;
    }
    if (preg_match('/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/', $s)) {
        $s = str_replace('.', '', $s);
    }
    $s = str_replace(',', '.', $s);
    if (!is_numeric($s) || (float) $s < 0) {
        throw new InvalidArgumentException('Prețul trebuie să fie un număr, de exemplu 2.200 sau 150,50.');
    }
    return (int) round(((float) $s) * 100);
}

/** bani → the panel's input form, „2200” or „150,50”. */
function lei_input(?int $bani): string
{
    if ($bani === null) {
        return '';
    }
    return $bani % 100 === 0 ? (string) intdiv($bani, 100) : number_format($bani / 100, 2, ',', '');
}
