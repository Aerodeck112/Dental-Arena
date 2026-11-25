<?php
/** /sitemap.xml: every public page, the 10 services and the doctors' profiles (src/app/sitemap.ts). */
declare(strict_types=1);

$pages = [
    '/' => 1, '/programare' => 0.9, '/servicii' => 0.8, '/preturi' => 0.8, '/echipa' => 0.7, '/contact' => 0.7,
    '/despre-noi' => 0.6, '/dentist-targu-mures' => 0.6, '/cabinet-stomatologic-targu-mures' => 0.6, '/15ani' => 0.3,
    '/termeni-si-conditii' => 0.2, '/politica-de-confidentialitate' => 0.2, '/politica-cookies' => 0.2,
];
foreach (service_slugs() as $slug) {
    $pages["/{$slug}"] = 0.8;
}
try {
    foreach (public_doctors() as $d) {
        $pages["/echipa/{$d['slug']}"] = 0.5;
    }
} catch (Throwable $e) {
    app_log('warning', 'sitemap: ' . $e->getMessage());
}

header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($pages as $path => $priority) {
    $loc = $path === '/' ? site_url() : absolute_url($path);
    echo '<url><loc>' . e($loc) . '</loc><priority>' . $priority . "</priority></url>\n";
}
echo "</urlset>\n";
