<?php
/**
 * The one-time installer (/admin/instalare): checks the server, connects to the MySQL database
 * created in cPanel, writes config.php, creates the tables and fills them with the clinics, the
 * services and prices of the current site and the team, then creates the administrator account.
 */
declare(strict_types=1);

/** @return list<array{label:string,ok:bool,fix:string}> */
function install_checks(): array
{
    $writable = is_writable(APP_DIR);
    return [
        ['label' => 'PHP 8.1 sau mai nou (acum ' . PHP_VERSION . ')', 'ok' => version_compare(PHP_VERSION, '8.1.0', '>='), 'fix' => 'cPanel → MultiPHP Manager (sau Select PHP Version): alegeți 8.1, 8.2 sau 8.3.'],
        ['label' => 'Extensia pdo_mysql (baza de date)', 'ok' => extension_loaded('pdo_mysql'), 'fix' => 'cPanel → Select PHP Version → Extensions: bifați pdo_mysql.'],
        ['label' => 'Extensia mbstring (diacritice)', 'ok' => extension_loaded('mbstring'), 'fix' => 'cPanel → Select PHP Version → Extensions: bifați mbstring.'],
        ['label' => 'Extensia GD cu WebP (fotografiile din panou)', 'ok' => function_exists('imagewebp'), 'fix' => 'cPanel → Select PHP Version → Extensions: bifați gd. Fără ea, fotografiile se pot schimba doar prin File Manager.'],
        ['label' => 'Folderul dentalarena poate fi scris (config.php)', 'ok' => $writable, 'fix' => 'File Manager → dentalarena → Change Permissions: 755.'],
        ['label' => 'Folderul public_html poate fi scris (fotografiile încărcate)', 'ok' => is_writable(PUBLIC_DIR), 'fix' => 'File Manager → public_html → Change Permissions: 755.'],
    ];
}

/**
 * @return array{ok:bool,errors:array<string,string>}
 */
function run_install(array $in): array
{
    $errors = [];
    foreach (['db_name' => 'Scrieți numele bazei de date.', 'db_user' => 'Scrieți utilizatorul bazei de date.', 'admin_name' => 'Scrieți numele dumneavoastră.'] as $k => $msg) {
        if (trim($in[$k] ?? '') === '') {
            $errors[$k] = $msg;
        }
    }
    $email = mb_strtolower(trim($in['admin_email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['admin_email'] = 'Scrieți o adresă de e-mail corectă.';
    }
    if (($p = password_problem($in['admin_password'] ?? '')) !== null) {
        $errors['admin_password'] = $p;
    } elseif (($in['admin_password'] ?? '') !== ($in['admin_password2'] ?? '')) {
        $errors['admin_password2'] = 'Cele două parole nu sunt la fel.';
    }
    $url = rtrim(trim($in['url'] ?? ''), '/');
    if (!preg_match('#^https?://[^/\s]+$#', $url)) {
        $errors['url'] = 'Scrieți adresa site-ului, de exemplu https://dentalarena.ro';
    }
    if ($errors !== []) {
        return ['ok' => false, 'errors' => $errors];
    }

    $db = ['host' => trim($in['db_host'] ?? '') ?: 'localhost', 'name' => trim($in['db_name']), 'user' => trim($in['db_user']), 'pass' => (string) ($in['db_pass'] ?? ''), 'port' => 3306];
    try {
        $pdo = db_connect($db['host'], $db['name'], $db['user'], $db['pass']);
    } catch (PDOException $e) {
        app_log('install', $e->getMessage());
        return ['ok' => false, 'errors' => ['db_name' => 'Nu mă pot conecta la baza de date. Verificați numele bazei, utilizatorul și parola, și că utilizatorul are toate drepturile pe bază (cPanel → MySQL Databases → Add User To Database → ALL PRIVILEGES).']];
    }
    if ((int) $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'")->fetchColumn() > 0
        && (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
        return ['ok' => false, 'errors' => ['db_name' => 'Baza de date conține deja un site instalat. Folosiți o bază goală, sau puneți înapoi fișierul config.php vechi.']];
    }

    migrate($pdo);
    seed_database($pdo);
    $pdo->prepare('INSERT INTO users (email, name, role, password_hash, active, must_change_password, created_at) VALUES (?, ?, ?, ?, 1, 0, ?)')
        ->execute([$email, trim($in['admin_name']), 'admin', password_hash($in['admin_password'], PASSWORD_DEFAULT), now_sql()]);
    $adminId = (int) $pdo->lastInsertId();
    $pdo->exec("INSERT INTO user_locations (user_id, location_id) SELECT {$adminId}, id FROM locations");

    $config = [
        'db' => $db,
        'url' => $url,
        'secret' => bin2hex(random_bytes(32)),
        'mail_from' => content('site.email'),
        'smtp' => null,
        'site_mode' => ($in['site_mode'] ?? '') === 'test' ? 'test' : 'live',
        'debug' => false,
    ];
    $php = "<?php\n// Setările site-ului, scrise la instalare. Păstrați o copie: conține parola bazei de date.\nreturn " . var_export($config, true) . ";\n";
    if (@file_put_contents(APP_DIR . '/config.php', $php, LOCK_EX) === false) {
        return ['ok' => false, 'errors' => ['db_name' => 'Nu pot scrie fișierul dentalarena/config.php. Verificați permisiunile folderului dentalarena (755).']];
    }
    @chmod(APP_DIR . '/config.php', 0640);
    return ['ok' => true, 'errors' => []];
}

/** The data of the current site: clinics, the 10 services with their prices, the team. */
function seed_database(PDO $pdo): void
{
    $seed = data_file('seed');
    $now = now_sql();
    $ins = static function (string $sql, array $params) use ($pdo): int {
        $pdo->prepare($sql)->execute($params);
        return (int) $pdo->lastInsertId();
    };
    foreach (SETTING_DEFAULTS as $k => $v) {
        $pdo->prepare('INSERT IGNORE INTO settings (k, v) VALUES (?, ?)')->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE)]);
    }
    $order = 1;
    foreach (content('clinicOrder') as $slug) {
        $c = content("clinics.{$slug}");
        $ins(
            'INSERT INTO locations (slug, name, short_name, street, city, county, postal_code, phone, email, hours_text, publish_hours, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [$slug, $c['name'], $c['shortName'], $c['street'], $c['city'], $c['county'], $c['postalCode'], $c['phone'], content('site.email'), "Luni–Vineri: 09:00–19:00", 0, $order++],
        );
    }
    $catIds = [];
    foreach ($seed['categories'] as $c) {
        $catIds[$c['slug']] = $ins('INSERT INTO categories (slug, name, summary, sort_order) VALUES (?,?,?,?)', [$c['slug'], $c['name'], $c['summary'], $c['sortOrder']]);
    }
    $sort = [];
    foreach ($seed['services'] as $s) {
        $sort[$s['category']] = ($sort[$s['category']] ?? 0) + 1;
        $ins(
            'INSERT INTO services (category_id, code, name, price_min, price_max, price_from, unit, representative, public_visible, sort_order, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [
                $catIds[$s['category']],
                $s['code'],
                $s['name'],
                $s['price'] === null ? null : (int) round($s['price'] * 100),
                $s['priceMax'] === null ? null : (int) round($s['priceMax'] * 100),
                $s['priceFrom'] ? 1 : 0,
                $s['unit'] === 'ACT' ? null : $s['unit'],
                $s['representative'] ? 1 : 0,
                $s['publicVisible'] ? 1 : 0,
                $sort[$s['category']],
                $now,
            ],
        );
    }
    foreach ($seed['doctors'] as $d) {
        $id = $ins(
            'INSERT INTO doctors (slug, first_name, last_name, public_name, role_line, bio, photo_path, monogram, sort_order, public_visible) VALUES (?,?,?,?,?,NULL,?,?,?,1)',
            [$d['slug'], $d['firstName'], $d['lastName'], $d['publicName'], $d['roleLine'], $d['photoPath'], $d['monogram'], $d['sortOrder']],
        );
        foreach ($d['categories'] as $c) {
            if (isset($catIds[$c['slug']])) {
                $pdo->prepare('INSERT INTO doctor_categories (doctor_id, category_id, show_on_site) VALUES (?,?,?)')->execute([$id, $catIds[$c['slug']], $c['showOnSite'] ? 1 : 0]);
            }
        }
    }
}
