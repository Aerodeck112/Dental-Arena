<?php
/**
 * Every URL of the site and the panel. The public addresses are the same as on the current site
 * (and on the Next.js version), so Google's links keep working; old addresses redirect.
 */
declare(strict_types=1);

$path = request_path();

// One address per page: no trailing slash (WordPress used one), no double slashes.
if ($path !== '/' && (str_ends_with($path, '/') || str_contains($path, '//'))) {
    $clean = '/' . trim(preg_replace('#/+#', '/', $path) ?? $path, '/');
    $qs = $_SERVER['QUERY_STRING'] ?? '';
    redirect($clean . ($qs !== '' ? "?{$qs}" : ''), 301);
}

const OLD_ADDRESSES = [
    '/medici' => '/echipa',
    '/confidentialitate' => '/politica-de-confidentialitate',
    '/gdpr' => '/politica-de-confidentialitate',
    '/privacy-policy' => '/politica-de-confidentialitate',
    '/cookie-uri' => '/politica-cookies',
    '/cookies' => '/politica-cookies',
    '/termeni-conditii' => '/termeni-si-conditii',
    '/programari' => '/programare',
    '/cabinet' => '/admin',
    '/crm' => '/admin',
    '/wp-admin' => '/admin',
    '/wp-login.php' => '/admin',
];
if (isset(OLD_ADDRESSES[$path])) {
    redirect(OLD_ADDRESSES[$path], 301);
}
if (preg_match('#^/medici/([a-z0-9-]+)$#', $path, $m)) {
    redirect("/echipa/{$m[1]}", 301);
}

if (!INSTALLED) {
    if ($path === '/admin/instalare') {
        require APP_DIR . '/src/install.php';
        require APP_DIR . '/src/admin/install_page.php';
        exit;
    }
    redirect('/admin/instalare', 302);
}

if ($path === '/admin/instalare') {
    redirect('/admin', 302);
}

if ($path === '/admin' || str_starts_with($path, '/admin/')) {
    require APP_DIR . '/src/admin/routes.php';
    exit;
}

// ── Public site ──────────────────────────────────────────────────────────────

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: DENY');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
if (is_test_site()) {
    header('X-Robots-Tag: noindex, nofollow');
}

$static = [
    '/' => 'home',
    '/servicii' => 'servicii',
    '/preturi' => 'preturi',
    '/echipa' => 'echipa',
    '/despre-noi' => 'despre',
    '/15ani' => 'aniversare',
    '/contact' => 'contact',
    '/programare' => 'programare',
    '/dentist-targu-mures' => 'landing',
    '/cabinet-stomatologic-targu-mures' => 'landing',
    '/termeni-si-conditii' => 'legal',
    '/politica-de-confidentialitate' => 'legal',
    '/politica-cookies' => 'legal',
];

if ($path === '/robots.txt') {
    header('Content-Type: text/plain; charset=utf-8');
    if (is_test_site()) {
        echo "User-Agent: *\nDisallow: /\n";
    } else {
        echo "User-Agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: " . absolute_url('/sitemap.xml') . "\n";
    }
    exit;
}

if ($path === '/sitemap.xml') {
    require APP_DIR . '/src/sitemap.php';
    exit;
}

if (isset($static[$path])) {
    require APP_DIR . "/templates/pages/{$static[$path]}.php";
    exit;
}

$slug = ltrim($path, '/');
if (in_array($slug, service_slugs(), true)) {
    require APP_DIR . '/templates/pages/serviciu.php';
    exit;
}

if (preg_match('#^/echipa/([a-z0-9-]+)$#', $path, $m) && ($doctor = public_doctor_by_slug($m[1])) !== null) {
    require APP_DIR . '/templates/pages/medic.php';
    exit;
}

http_response_code(404);
require APP_DIR . '/templates/pages/404.php';
