<?php
/**
 * /admin and /admin/*: the panel's addresses. Each page lives in templates/admin/<name>.php and
 * both handles its POST and renders. Access is checked here and again in each page.
 */
declare(strict_types=1);

require __DIR__ . '/lib.php';
require __DIR__ . '/crm.php';
require __DIR__ . '/billing.php';
require __DIR__ . '/clinical.php';
require __DIR__ . '/ai.php';
require __DIR__ . '/kiosk.php';
require APP_DIR . '/src/booking.php';
require __DIR__ . '/update.php';
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
maybe_send_reminders();
send_queue_after_response();

// Path → page and who may open it (null = everyone signed in, 'admin', or a permission).
$routes = [
    '#^/admin$#' => ['acasa', null],
    '#^/admin/calendar$#' => ['calendar', null],
    '#^/admin/programari/(noua|\d+)$#' => ['programare', null],
    '#^/admin/pacienti$#' => ['pacienti', null],
    '#^/admin/pacienti/(nou|\d+)$#' => ['pacient', null],
    '#^/admin/pacienti/(\d+)/odontograma$#' => ['pacient-odontograma', 'medical'],
    '#^/admin/pacienti/(\d+)/planuri$#' => ['pacient-planuri', null],
    '#^/admin/pacienti/(\d+)/planuri/(nou|\d+)$#' => ['plan', null],
    '#^/admin/pacienti/(\d+)/planuri/(\d+)/tipar$#' => ['plan-tipar', null],
    '#^/admin/pacienti/(\d+)/financiar$#' => ['pacient-financiar', 'billing'],
    '#^/admin/pacienti/(\d+)/documente$#' => ['pacient-documente', null],
    '#^/admin/pacienti/(\d+)/acord/([a-z]+)$#' => ['acord-tipar', null],
    '#^/admin/pacienti/(\d+)/gdpr$#' => ['pacient-gdpr', 'gdpr'],
    '#^/admin/pacienti/(\d+)/mesaje$#' => ['pacient-mesaje', null],
    '#^/admin/pacienti/(\d+)/consultatie-ai$#' => ['pacient-ai', 'medical'],
    '#^/admin/mesaje$#' => ['mesaje', null],
    '#^/admin/marketing$#' => ['marketing', 'admin'],
    '#^/admin/marketing/(noua|\d+)$#' => ['campanie', 'admin'],
    '#^/admin/setari/mesaje$#' => ['setari-mesaje', 'admin'],
    '#^/admin/setari/ai$#' => ['setari-ai', 'admin'],
    '#^/admin/tablete$#' => ['tablete', 'admin'],
    '#^/admin/actualizare$#' => ['actualizare', 'admin'],
    '#^/admin/setari/chat$#' => ['setari-chat', 'admin'],
    '#^/admin/chat$#' => ['chat', null],
    '#^/admin/chat/(\d+)$#' => ['chat-conversatie', null],
    '#^/admin/documente/(\d+)$#' => ['document', null],
    '#^/admin/rechemari$#' => ['rechemari', null],
    '#^/admin/absente$#' => ['absente', null],
    '#^/admin/setari/programari$#' => ['setari-programari', 'admin'],
    '#^/admin/cereri$#' => ['cereri', null],
    '#^/admin/cereri/(\d+)$#' => ['cerere', null],
    '#^/admin/facturi$#' => ['facturi', 'billing'],
    '#^/admin/facturi/noua$#' => ['factura-noua', 'billing'],
    '#^/admin/facturi/(\d+)$#' => ['factura', 'billing'],
    '#^/admin/facturi/(\d+)/tipar$#' => ['factura-tipar', 'billing'],
    '#^/admin/incasari$#' => ['incasari', 'billing'],
    '#^/admin/incasari/(\d+)/chitanta$#' => ['chitanta', 'billing'],
    '#^/admin/rapoarte$#' => ['rapoarte', null],
    '#^/admin/gdpr$#' => ['gdpr', 'gdpr'],
    '#^/admin/jurnal$#' => ['jurnal', 'audit'],
    '#^/admin/servicii$#' => ['servicii', 'admin'],
    '#^/admin/servicii/([a-z0-9-]+)$#' => ['servicii-pagina', 'admin'],
    '#^/admin/fotografii$#' => ['fotografii', 'admin'],
    '#^/admin/echipa$#' => ['echipa', 'admin'],
    '#^/admin/echipa/(nou|\d+)$#' => ['medic', 'admin'],
    '#^/admin/utilizatori$#' => ['utilizatori', 'admin'],
    '#^/admin/utilizatori/(nou|\d+)$#' => ['utilizator', 'admin'],
    '#^/admin/setari$#' => ['setari', 'admin'],
    '#^/admin/cont$#' => ['cont', null],
];
foreach ($routes as $re => [$name, $who]) {
    if (preg_match($re, $path, $m)) {
        if ($who === 'admin') {
            $user = require_login(true);
        } elseif (!admin_nav_allowed($who, $user)) {
            admin_not_found($user);
        }
        $page($name, ['user' => $user, 'param' => $m[1] ?? null, 'param2' => $m[2] ?? null]);
    }
}
admin_not_found($user);
