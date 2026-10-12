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

if ($path === '/webhook/whatsapp') {
    whatsapp_webhook();
}
if (preg_match('#^/d/([A-Za-z0-9]{12})$#', $path, $m)) {
    require APP_DIR . '/templates/pages/dezabonare.php';
    exit;
}

if (!str_starts_with($path, '/admin') && is_file(APP_DIR . '/storage/actualizare.lock') && filemtime(APP_DIR . '/storage/actualizare.lock') > time() - 600) {
    http_response_code(503);
    header('Retry-After: 60');
    header('Content-Type: text/html; charset=utf-8');
    exit('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="20"><title>Actualizăm site-ul</title><p style="font-family:sans-serif;padding:2rem;font-size:1.1rem">Actualizăm site-ul Dental Arena. Reveniți în câteva clipe. Pentru programări: Cristești 0265 326 316, Luduș 0365 430 125.</p>');
}

// The patient's link to an appointment (SMS, e-mail, booking confirmation).
if ($path === '/p/anulat') {
    session_begin();
    $c = $_SESSION['link_anulat'] ?? null;
    $body = '<div class="' . CONTAINER . ' py-sectiune"><div class="mx-auto max-w-[40rem]">'
        . success_panel(is_array($c) ? "Programarea din {$c['day']}, ora {$c['time']}, a fost anulată." : 'Programarea a fost anulată.', 'Vă mulțumim că ne-ați anunțat. Pentru o programare nouă, alegeți altă oră pe site sau sunați-ne.')
        . '<p class="mt-8"><a href="/programare" class="' . e(btn('primary', 'l')) . '">Faceți o altă programare</a></p></div></div>';
    header('X-Robots-Tag: noindex');
    render_page($body, page_meta(['title' => 'Programare anulată', 'description' => 'Programarea a fost anulată.', 'path' => '/p/anulat', 'noindex' => true]));
    exit;
}
if (preg_match('#^/p/([A-Za-z0-9_-]+\.\d+\.[0-9a-z]+\.[A-Za-z0-9_-]{22})(/ics)?$#', $path, $m)) {
    require APP_DIR . '/templates/pages/link-programare.php';
    exit;
}

if ($path === '/api/sloturi') {
    require APP_DIR . '/src/admin/lib.php';
    require APP_DIR . '/src/admin/crm.php';
    require APP_DIR . '/src/booking.php';
    booking_slots_endpoint();
}

if ($path === '/api/chat') {
    require APP_DIR . '/src/chat.php';
    chat_endpoint();
}

if ($path === '/tableta' || str_starts_with($path, '/tableta/')) {
    require APP_DIR . '/src/tablet.php';
    exit;
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
