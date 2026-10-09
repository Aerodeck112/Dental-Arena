<?php
/**
 * /admin and /admin/*: the panel's addresses. Each page lives in templates/admin/<name>.php and
 * both handles its POST and renders. Access is checked here and again in each page.
 */
declare(strict_types=1);

require __DIR__ . '/lib.php';
require APP_DIR . '/templates/admin/layout.php';

$path = request_path();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$page = static function (string $name, array $vars = []): never {
    extract($vars, EXTR_SKIP);
    require APP_DIR . "/templates/admin/{$name}.php";
    exit;
};

if ($path === '/admin/intrare') {
    $page('intrare');
}
if ($path === '/admin/iesire') {
    if ($method === 'POST') {
        csrf_check();
        audit('iesire');
        logout();
        flash('Ați ieșit din panou.', 'info');
    }
    redirect('/admin/intrare');
}

$user = require_login();

$routes = [
    '#^/admin$#' => ['acasa', false],
    '#^/admin/cereri$#' => ['cereri', false],
    '#^/admin/cereri/(\d+)$#' => ['cerere', false],
    '#^/admin/servicii$#' => ['servicii', true],
    '#^/admin/servicii/([a-z0-9-]+)$#' => ['servicii-pagina', true],
    '#^/admin/fotografii$#' => ['fotografii', true],
    '#^/admin/echipa$#' => ['echipa', true],
    '#^/admin/echipa/(nou|\d+)$#' => ['medic', true],
    '#^/admin/utilizatori$#' => ['utilizatori', true],
    '#^/admin/utilizatori/(nou|\d+)$#' => ['utilizator', true],
    '#^/admin/setari$#' => ['setari', true],
    '#^/admin/cont$#' => ['cont', false],
];
foreach ($routes as $re => [$name, $adminOnly]) {
    if (preg_match($re, $path, $m)) {
        if ($adminOnly) {
            $user = require_login(true);
        }
        $page($name, ['user' => $user, 'param' => $m[1] ?? null]);
    }
}
admin_not_found($user);
