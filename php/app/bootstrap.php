<?php
/**
 * Start of every request (public_html/index.php). Loads the settings written by the installer
 * (config.php), the helpers and the templates' components. Without config.php only the installer
 * (/admin/instalare) answers.
 */
declare(strict_types=1);

const APP_VERSION = '1.0.0';
const NBSP = "\u{00A0}";

date_default_timezone_set('Europe/Bucharest');
mb_internal_encoding('UTF-8');

$configFile = APP_DIR . '/config.php';
define('CONFIG', is_file($configFile) ? (require $configFile) : []);
define('INSTALLED', CONFIG !== []);

ini_set('display_errors', !empty(CONFIG['debug']) ? '1' : '0');
error_reporting(E_ALL);

foreach (['helpers', 'db', 'content', 'images', 'seo', 'mail', 'auth', 'repo', 'forms'] as $file) {
    require APP_DIR . "/src/{$file}.php";
}
require APP_DIR . '/templates/components.php';

set_exception_handler(static function (Throwable $e): void {
    app_log('error', $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . "\n" . $e->getTraceAsString());
    if (!headers_sent()) {
        http_response_code(500);
    }
    if (!empty(CONFIG['debug'])) {
        echo '<pre>' . e((string) $e) . '</pre>';
        return;
    }
    echo '<!doctype html><meta charset="utf-8"><title>Eroare</title><p style="font-family:sans-serif;padding:2rem">'
        . 'Pagina nu a putut fi afișată. Încercați din nou peste câteva minute sau sunați-ne: Cristești 0265 326 316, Luduș 0365 430 125.</p>';
});

// After an update (new files in migrations/), the tables are brought up to date on the first request.
if (INSTALLED) {
    $marker = APP_DIR . '/storage/migrations.txt';
    $files = glob(APP_DIR . '/migrations/*.sql') ?: [];
    if ((string) count($files) !== (string) @file_get_contents($marker)) {
        migrate();
        @mkdir(APP_DIR . '/storage', 0750, true);
        @file_put_contents($marker, (string) count($files));
    }
}
