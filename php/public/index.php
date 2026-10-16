<?php
/**
 * Dental Arena: every page of the site and of the panel starts here (see .htaccess).
 * The application lives outside public_html, in the folder „dentalarena” next to it.
 */
declare(strict_types=1);

foreach ([__DIR__ . '/../dentalarena', __DIR__ . '/../app'] as $dir) {
    if (is_file($dir . '/bootstrap.php')) {
        define('APP_DIR', (string) realpath($dir));
        break;
    }
}
if (!defined('APP_DIR')) {
    http_response_code(500);
    exit('Lipsește folderul „dentalarena”. Încărcați-l lângă public_html (vezi CITESTE-MA.md).');
}
define('PUBLIC_DIR', __DIR__);

require APP_DIR . '/bootstrap.php';
require APP_DIR . '/src/routes.php';
