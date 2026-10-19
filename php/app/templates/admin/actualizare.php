<?php
/**
 * /admin/actualizare (administrators): update the whole site from a ZIP. The archive is sent in
 * 1 MB pieces (so the hosting's upload limit does not matter), checked, shown (version, files),
 * and installed after the administrator types the password. A copy of the running version is
 * kept first (a folder in storage/actualizari) and can be put back from the same page.
 */
declare(strict_types=1);

$base = '/admin/actualizare';
$dir = update_dir();

// A piece of the archive (admin.js). JSON in, JSON out; the CSRF token comes in a header.
if (query('op') === 'bucata' && is_post()) {
    session_begin();
    $token = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    header('Content-Type: application/json');
    if ($token === '' || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
        http_response_code(419);
        exit(json_encode(['error' => 'Pagina a expirat. Reîncărcați-o.']));
    }
    try {
        $size = update_receive_chunk((string) ($_SERVER['HTTP_X_UPLOAD_ID'] ?? ''), (int) ($_SERVER['HTTP_X_OFFSET'] ?? -1), (string) file_get_contents('php://input'));
        exit(json_encode(['size' => $size]));
    } catch (DomainException $e) {
        http_response_code(409);
        exit(json_encode(['error' => $e->getMessage()]));
    }
}

$pachet = preg_match('/^[a-f0-9]{16,40}$/', query('pachet')) ? query('pachet') : '';
$pachetFile = $pachet !== '' ? "{$dir}/incarcare-{$pachet}.zip" : '';
$errors = [];
$passwordOk = static function () use ($user): bool {
    $row = db_one('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
    return password_verify((string) ($_POST['parola'] ?? ''), (string) $row['password_hash']);
};

if (is_post()) {
    csrf_check();
    $op = post('op');
    try {
        if ($op === 'incarca') {
            // Without the script: a normal upload (within the hosting's limit).
            $f = $_FILES['arhiva'] ?? [];
            if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                throw new DomainException(($f['error'] ?? 0) === UPLOAD_ERR_INI_SIZE ? 'Arhiva depășește limita de încărcare a găzduirii. Folosiți un browser cu JavaScript pornit.' : 'Alegeți arhiva ZIP.');
            }
            $id = bin2hex(random_bytes(12));
            move_uploaded_file($f['tmp_name'], "{$dir}/incarcare-{$id}.zip");
            redirect("{$base}?pachet={$id}");
        }
        if ($op === 'importa') {
            require_once APP_DIR . '/src/admin/import.php';
            run_pending_imports(true);
            $failed = array_filter(import_status(), static fn ($i) => $i['state'] === 'eroare');
            flash($failed === [] ? 'Datele au fost adăugate.' : 'Nu s-au putut adăuga toate datele; motivul e la „Date aduse din QDental”.', $failed === [] ? 'ok' : 'eroare');
            redirect($base . '#importuri');
        }
        if ($op === 'renunta' && $pachetFile !== '') {
            @unlink($pachetFile);
            redirect($base);
        }
        if ($op === 'instaleaza' && $pachetFile !== '' && is_file($pachetFile)) {
            if (!$passwordOk()) {
                throw new DomainException('Parola nu este corectă.');
            }
            $r = update_install($pachetFile, $user);
            @unlink($pachetFile);
            flash("Site-ul a fost actualizat la versiunea {$r['version']} ({$r['files']} fișiere). Copia versiunii de dinainte e mai jos, la „Copii de siguranță”.");
            redirect($base);
        }
        if ($op === 'revino' && preg_match('/^copie-[0-9-]+$/', post('copie')) && is_dir("{$dir}/" . post('copie'))) {
            if (!$passwordOk()) {
                throw new DomainException('Parola nu este corectă.');
            }
            $r = update_restore("{$dir}/" . post('copie'), $user);
            audit('actualizare-revenire', post('copie'));
            flash('Site-ul a revenit la versiunea din ' . post('copie') . '.');
            redirect($base);
        }
    } catch (DomainException $e) {
        $errors['form'] = $e->getMessage();
    } catch (Throwable $e) {
        app_log('error', 'actualizare: ' . $e->getMessage());
        $errors['form'] = $e->getMessage();
    }
}

$fmtSize = static fn (int $b) => $b >= 1048576 ? number_format($b / 1048576, 1, ',', '.') . ' MB' : max(1, (int) round($b / 1024)) . ' KB';

// The package waiting to be installed.
$waiting = '';
if ($pachetFile !== '' && is_file($pachetFile)) {
    try {
        $info = update_check($pachetFile);
        $waiting = admin_section_open('Pachetul încărcat', 'pachet')
            . '<dl class="mt-4 grid grid-cols-[11rem_1fr] gap-y-2 text-corp">'
            . '<dt class="text-discret">Versiunea de acum</dt><dd class="font-semibold">' . e(app_version()) . '</dd>'
            . '<dt class="text-discret">Versiunea nouă</dt><dd class="font-semibold text-actiune">' . e($info['version']) . '</dd>'
            . '<dt class="text-discret">Fișiere</dt><dd class="cifre">' . $info['files'] . ' (' . e($fmtSize($info['size'])) . ')</dd></dl>'
            . '<p class="mt-4 rounded-panou bg-menta-pal p-3 text-mic">Nu se schimbă: setările (config.php), documentele pacienților, fotografiile încărcate din panou și baza de date (tabelele noi se adaugă singure). Înainte, panoul face o copie a versiunii de acum.</p>'
            . '<form method="post" class="mt-4 flex flex-wrap items-end gap-4">' . csrf_field() . '<input type="hidden" name="op" value="instaleaza">'
            . text_field('parola', 'Parola dumneavoastră, pentru confirmare', ['type' => 'password', 'autocomplete' => 'current-password', 'class' => 'min-w-0 w-72'])
            . '<button type="submit" data-pending="Se instalează, nu închideți pagina" class="' . e(btn('primary')) . '">' . icon('download', 18) . 'Instalați actualizarea</button></form>'
            . '<form method="post" class="mt-3">' . csrf_field() . '<input type="hidden" name="op" value="renunta"><button type="submit" class="' . e(btn('text', 's')) . '">Renunțați</button></form></section>';
    } catch (DomainException $e) {
        @unlink($pachetFile);
        $errors['form'] = $e->getMessage();
    }
}

$upload = admin_section_open('Încărcați actualizarea', 'incarcare', 'Arhiva ZIP primită de la VITIM (dentalarena-php.zip). Se încarcă pe bucăți, deci poate fi oricât de mare.')
    . '<form method="post" enctype="multipart/form-data" action="' . $base . '" data-actualizare="' . $base . '" class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="incarca">'
    . '<input id="arhiva" type="file" name="arhiva" accept=".zip,application/zip" required class="w-full min-w-0 max-w-full text-corp file:mr-3 file:rounded-control file:border file:border-linie-control file:bg-suprafata file:px-3 file:py-2">'
    . '<div data-actualizare-progres hidden class="h-3 overflow-hidden rounded-full bg-adancit"><div class="h-full w-0 rounded-full bg-actiune transition-[width] duration-200"></div></div>'
    . '<p data-actualizare-stare role="status" class="text-mic text-discret"></p>'
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . icon('upload', 18) . 'Încărcați și verificați</button></div></form></section>';

$copies = glob("{$dir}/copie-*", GLOB_ONLYDIR) ?: [];
rsort($copies);
$copyRows = '';
foreach ($copies as $c) {
    $name = basename($c);
    $copyRows .= '<li class="flex flex-wrap items-center gap-4 border-t border-linie py-3 first:border-t-0">'
        . '<div class="min-w-0 flex-1"><p class="font-semibold cifre">' . e(format_datetime(date('Y-m-d H:i:s', filemtime($c)))) . '</p><p class="text-mic text-discret">' . e(trim((string) @file_get_contents("{$c}/versiune.txt")) ?: 'versiune necunoscută') . '</p></div>'
        . '<details class="w-full sm:w-auto"><summary class="' . e(btn('secondary', 's')) . ' cursor-pointer list-none">' . icon('undo-2', 16) . 'Puneți înapoi</summary>'
        . '<form method="post" class="mt-3 flex flex-wrap items-end gap-3">' . csrf_field() . '<input type="hidden" name="op" value="revino"><input type="hidden" name="copie" value="' . e($name) . '">'
        . text_field('parola', 'Parola dumneavoastră', ['type' => 'password', 'id' => 'parola-' . md5($name), 'autocomplete' => 'current-password', 'class' => 'min-w-0 w-60'])
        . '<button type="submit" data-pending="Se pune înapoi" class="' . e(btn('primary', 's')) . '">Puneți înapoi această versiune</button></form></details></li>';
}
$history = json_decode((string) @file_get_contents("{$dir}/istoric.json"), true) ?: [];
$histRows = implode('', array_map(static fn ($h) => '<li class="border-t border-linie py-2 text-corp first:border-t-0"><span class="cifre">' . e(format_datetime($h['at'])) . '</span> · ' . e($h['by']) . '<br><span class="text-mic text-discret">' . e($h['from']) . ' → ' . e($h['to']) . ', ' . (int) $h['files'] . ' fișiere</span></li>', array_slice($history, 0, 10)));

// The lists brought by updates (data/import): added, waiting, or why not.
$imports = '';
if (glob(APP_DIR . '/data/import/*.json')) {
    require_once APP_DIR . '/src/admin/import.php';
    $rows = '';
    $retry = false;
    foreach (import_status() as $i) {
        [$label, $cls] = match ($i['state']) {
            'gata' => ['Adăugat', 'bg-menta-pal text-cerneala'],
            'acum' => ['Se adaugă', 'bg-portocaliu-pal text-portocaliu'],
            'eroare' => ['Nu s-a putut', 'bg-carmin-pal text-carmin'],
            default => ['Așteaptă', 'bg-adancit text-discret'],
        };
        $retry = $retry || in_array($i['state'], ['eroare', 'asteapta'], true);
        $rows .= '<li class="border-t border-linie py-3 first:border-t-0"><p class="flex flex-wrap items-center gap-2"><span class="' . e(cn('rounded-chip px-2.5 py-0.5 text-mic font-medium', $cls)) . '">' . e($label) . '</span><span class="font-semibold">' . e($i['source']) . '</span></p>'
            . '<p class="mt-1 text-mic text-discret">' . e($i['detail']) . ($i['at'] ? ' · ' . e(format_datetime($i['at'])) : '') . '</p></li>';
    }
    $imports = admin_section_open('Date aduse din QDental', 'importuri', 'Listele venite cu actualizările se adaugă o singură dată, la prima pagină de panou.')
        . '<ul class="mt-3">' . $rows . '</ul>'
        . ($retry ? '<form method="post" class="mt-3">' . csrf_field() . '<input type="hidden" name="op" value="importa"><button type="submit" data-pending="Se adaugă" class="' . e(btn('secondary', 's')) . '">Adăugați acum</button></form>' : '')
        . '</section>';
}

$env = '<dl class="mt-4 grid grid-cols-[9rem_1fr] gap-y-2 text-corp">'
    . '<dt class="text-discret">Versiunea</dt><dd class="font-semibold">' . e(app_version()) . '</dd>'
    . '<dt class="text-discret">PHP</dt><dd>' . e(PHP_VERSION) . '</dd>'
    . '<dt class="text-discret">Arhive ZIP</dt><dd>' . (class_exists('ZipArchive') ? 'extensia zip' : (class_exists('PharData') ? 'Phar (fără extensia zip, merge)' : '<span class="text-carmin">indisponibile: cPanel → Select PHP Version → bifați zip</span>')) . '</dd>'
    . '<dt class="text-discret">Spațiu liber</dt><dd>' . e(($free = @disk_free_space(APP_DIR)) ? $fmtSize((int) $free) : 'necunoscut') . '</dd></dl>';

$body = '<p class="mb-4"><a href="/admin/setari" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Setări</a></p>'
    . admin_header('Actualizare', 'Actualizați tot site-ul și panoul dintr-o arhivă ZIP. Datele, setările și documentele rămân neatinse.')
    . '<div class="grid max-w-6xl gap-8 lg:grid-cols-12"><div class="flex min-w-0 flex-col gap-8 lg:col-span-7">' . error_summary($errors, 'Actualizarea nu s-a făcut') . $waiting . $upload
    . admin_section_open('Copii de siguranță', 'copii', 'Versiunile de dinaintea ultimelor actualizări (se păstrează ultimele ' . UPDATE_KEEP_COPIES . '). Conțin doar fișierele site-ului, nu baza de date.')
    . ($copyRows !== '' ? '<ul class="mt-3">' . $copyRows . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio copie încă.</p>') . '</section></div>'
    . '<div class="flex min-w-0 flex-col gap-8 lg:col-span-5">' . admin_section_open('Acum', 'acum') . $env . '</section>' . $imports
    . admin_section_open('Cum se face', 'pasi') . '<ol class="mt-3 list-decimal pl-5 text-corp"><li>Faceți o copie a bazei de date din cPanel → Backup (recomandat).</li><li>Încărcați arhiva și verificați versiunea.</li><li>Scrieți parola și apăsați „Instalați actualizarea”. Durează de obicei sub un minut; site-ul afișează între timp „Actualizăm site-ul”.</li><li>Dacă ceva nu e în regulă, „Puneți înapoi” versiunea de dinainte.</li></ol></section>'
    . ($histRows !== '' ? admin_section_open('Istoric', 'istoric') . '<ul class="mt-3">' . $histRows . '</ul></section>' : '')
    . '</div></div>';
admin_page('Actualizare', $body, $user);
