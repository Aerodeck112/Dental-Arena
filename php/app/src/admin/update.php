<?php
/**
 * Updating the site from the panel (Setări → Actualizare): the administrator uploads the ZIP
 * made by `npm run build:php:zip` (public_html/ + dentalarena/), the panel checks it, keeps a
 * copy of the current version, and copies the new files over. config.php, storage/ (documents,
 * sessions, logs) and public_html/media (uploaded photos) are never touched; the database is
 * brought up to date on the next request (migrations). A copy can be put back the same way.
 *
 * Works with the zip extension (ZipArchive) or, without it, with Phar (part of PHP).
 */
declare(strict_types=1);

const UPDATE_MAX_BYTES = 300 * 1024 * 1024;
const UPDATE_KEEP_COPIES = 3;
const UPDATE_LOCK_MINUTES = 10;

function update_dir(): string
{
    $dir = APP_DIR . '/storage/actualizari';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    return $dir;
}

/** The version written by the build into dentalarena/VERSION. */
function app_version(): string
{
    $v = trim((string) @file_get_contents(APP_DIR . '/VERSION'));
    return $v !== '' ? $v : 'versiune de dezvoltare';
}

function update_lock_file(): string
{
    return APP_DIR . '/storage/actualizare.lock';
}

/** True while an update copies files (the public site then shows „Actualizăm site-ul”). */
function update_in_progress(): bool
{
    $f = update_lock_file();
    return is_file($f) && filemtime($f) > time() - UPDATE_LOCK_MINUTES * 60;
}

// ── ZIP, with or without the zip extension ───────────────────────────────────────────────

/**
 * The entry names exactly as stored in the ZIP's central directory (Phar would quietly drop a
 * „../” entry, so the checks read the names themselves). Null when the directory is not found.
 *
 * @return list<string>|null
 */
function zip_raw_names(string $file): ?array
{
    $size = (int) filesize($file);
    $fh = fopen($file, 'rb');
    if ($fh === false || $size < 22) {
        return null;
    }
    $tailLen = min($size, 65557);
    fseek($fh, $size - $tailLen);
    $tail = (string) fread($fh, $tailLen);
    $pos = strrpos($tail, "PK\x05\x06");
    if ($pos === false) {
        fclose($fh);
        return null;
    }
    $eocd = unpack('vdisk/vcddisk/ventries/vtotal/Vsize/Voffset', substr($tail, $pos + 4, 16));
    fseek($fh, $eocd['offset']);
    $cd = (string) fread($fh, $eocd['size']);
    fclose($fh);
    $names = [];
    for ($i = 0, $p = 0; $i < $eocd['total'] && substr($cd, $p, 4) === "PK\x01\x02"; $i++) {
        $h = unpack('vnameLen/vextraLen/vcommentLen', substr($cd, $p + 28, 6));
        $names[] = substr($cd, $p + 46, $h['nameLen']);
        $p += 46 + $h['nameLen'] + $h['extraLen'] + $h['commentLen'];
    }
    return count($names) === $eocd['total'] ? $names : null;
}

/** @return array<string,int> entry name → uncompressed size (directories end with „/”) */
function zip_entries(string $file): array
{
    $out = [];
    if (class_exists('ZipArchive')) {
        $z = new ZipArchive();
        if ($z->open($file) !== true) {
            throw new DomainException('Fișierul nu este o arhivă ZIP validă.');
        }
        for ($i = 0; $i < $z->numFiles; $i++) {
            $s = $z->statIndex($i);
            $out[(string) $s['name']] = (int) $s['size'];
        }
        $z->close();
        return $out;
    }
    try {
        $p = new PharData($file);
    } catch (Throwable $e) {
        throw new DomainException('Fișierul nu este o arhivă ZIP validă.');
    }
    $prefix = 'phar://' . str_replace('\\', '/', (string) realpath($file)) . '/';
    foreach (new RecursiveIteratorIterator($p, RecursiveIteratorIterator::SELF_FIRST) as $f) {
        $name = substr(str_replace('\\', '/', $f->getPathname()), strlen($prefix));
        $out[$name . ($f->isDir() ? '/' : '')] = $f->isDir() ? 0 : (int) $f->getSize();
    }
    return $out;
}

function zip_extract(string $file, string $dir): void
{
    if (class_exists('ZipArchive')) {
        $z = new ZipArchive();
        if ($z->open($file) !== true || !$z->extractTo($dir)) {
            throw new RuntimeException('Arhiva nu a putut fi despachetată.');
        }
        $z->close();
        return;
    }
    (new PharData($file))->extractTo($dir, null, true);
}

// ── Checking a package ───────────────────────────────────────────────────────────────────

/** What must never be overwritten: the settings, the stored files, the photos uploaded in the panel. */
function update_protected(string $target, string $rel): bool
{
    if ($target === 'dentalarena') {
        return $rel === 'config.php' || $rel === 'storage' || str_starts_with($rel, 'storage/');
    }
    return $rel === 'media' || str_starts_with($rel, 'media/');
}

/**
 * Checks an uploaded package: the two folders, no path outside them, a sensible size.
 *
 * @return array{version:string,files:int,size:int,root:string}
 */
function update_check(string $file): array
{
    $entries = zip_entries($file);
    $raw = zip_raw_names($file);
    if ($raw === null) {
        throw new DomainException('Fișierul nu este o arhivă ZIP validă.');
    }
    foreach ($raw as $n) {
        if (str_contains($n, '\\') || str_contains($n, "\0") || str_starts_with($n, '/') || preg_match('#(^|/)\.\.(/|$)#', $n) || preg_match('#^[A-Za-z]:#', $n)) {
            throw new DomainException('Arhiva conține căi nepermise. Folosiți doar arhivele primite pentru acest site.');
        }
    }
    $names = array_values(array_filter($raw, static fn ($n) => !str_starts_with($n, '__MACOSX/') && basename($n) !== '.DS_Store'));
    // A package re-zipped together with its folder („dentalarena-php/public_html/…”) is accepted too.
    $root = '';
    if (!in_array('dentalarena/bootstrap.php', $names, true)) {
        foreach ($names as $n) {
            if (preg_match('#^([^/]+/)dentalarena/bootstrap\.php$#', $n, $m)) {
                $root = $m[1];
                break;
            }
        }
    }
    $size = 0;
    $files = 0;
    foreach ($names as $n) {
        if ($root !== '' && !str_starts_with($n, $root)) {
            continue;
        }
        $rel = substr($n, strlen($root));
        if ($rel === '' || $rel === 'CITESTE-MA.md') {
            continue;
        }
        if (str_contains($rel, '\\') || str_contains($rel, "\0") || str_starts_with($rel, '/') || preg_match('#(^|/)\.\.(/|$)#', $rel) || preg_match('#^[A-Za-z]:#', $rel)) {
            throw new DomainException('Arhiva conține căi nepermise. Folosiți doar arhivele primite pentru acest site.');
        }
        if (!preg_match('#^(public_html|dentalarena)/#', $rel)) {
            throw new DomainException('Arhiva trebuie să conțină doar folderele public_html și dentalarena (cum o primiți de la VITIM).');
        }
        $size += $entries[$n] ?? 0;
        $files += str_ends_with($rel, '/') ? 0 : 1;
    }
    // A whole package, not a few files: the build always writes these (and VERSION).
    foreach (['dentalarena/VERSION', 'dentalarena/bootstrap.php', 'dentalarena/cron.php', 'dentalarena/src/routes.php', 'dentalarena/src/db.php', 'dentalarena/src/helpers.php', 'dentalarena/templates/layout.php', 'dentalarena/migrations/001_init.sql', 'public_html/index.php', 'public_html/assets/site.css'] as $must) {
        if (!in_array($root . $must, $names, true)) {
            throw new DomainException("Arhiva nu este un pachet al site-ului (lipsește {$must}).");
        }
    }
    if ($size > UPDATE_MAX_BYTES) {
        throw new DomainException('Arhiva este prea mare după despachetare.');
    }
    $version = 'fără număr de versiune';
    if (in_array($root . 'dentalarena/VERSION', $names, true)) {
        if (class_exists('ZipArchive')) {
            $z = new ZipArchive();
            $z->open($file);
            $version = trim((string) $z->getFromName($root . 'dentalarena/VERSION')) ?: $version;
            $z->close();
        } else {
            $version = trim((string) file_get_contents('phar://' . realpath($file) . '/' . $root . 'dentalarena/VERSION')) ?: $version;
        }
    }
    return ['version' => mb_substr($version, 0, 80), 'files' => $files, 'size' => $size, 'root' => $root];
}

// ── Installing ───────────────────────────────────────────────────────────────────────────

/** Keeps the lines cPanel writes into .htaccess (the PHP version handler) when ours replaces it. */
function update_htaccess_merge(string $old, string $new): string
{
    if (preg_match_all('/# php -- BEGIN cPanel-generated handler.*?# php -- END cPanel-generated handler[^\n]*\n?/s', $old, $m) && $m[0] !== []) {
        foreach ($m[0] as $block) {
            if (!str_contains($new, $block)) {
                $new = rtrim($new) . "\n\n" . rtrim($block) . "\n";
            }
        }
    }
    return $new;
}

function rm_tree(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) {
        $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
    }
    @rmdir($dir);
}

/** @return list<array{0:string,1:string,2:string}> [source, target, target kind] of every file to copy */
function update_plan(string $unpacked): array
{
    $plan = [];
    foreach (['dentalarena' => APP_DIR, 'public_html' => PUBLIC_DIR] as $name => $targetDir) {
        $src = "{$unpacked}/{$name}";
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::LEAVES_ONLY);
        foreach ($it as $f) {
            $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($src) + 1));
            if ($f->isFile() && !update_protected($name, $rel)) {
                $plan[] = [$f->getPathname(), "{$targetDir}/{$rel}", $name];
            }
        }
    }
    return $plan;
}

/** Copies a tree, leaving out what update_protected() keeps. */
function update_copy_tree(string $from, string $to, string $kind): int
{
    $n = 0;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($from, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::LEAVES_ONLY);
    foreach ($it as $f) {
        $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($from) + 1));
        if (!$f->isFile() || update_protected($kind, $rel)) {
            continue;
        }
        if (!is_dir(dirname("{$to}/{$rel}"))) {
            @mkdir(dirname("{$to}/{$rel}"), 0750, true);
        }
        if (!copy($f->getPathname(), "{$to}/{$rel}")) {
            throw new RuntimeException("Copia de siguranță nu a putut fi făcută ({$rel}).");
        }
        $n++;
    }
    return $n;
}

/** A copy of the running version (a folder shaped like a package, so it can be put back). */
function update_backup(): string
{
    $dir = update_dir() . '/copie-' . date('Y-m-d-His');
    @mkdir($dir, 0750, true);
    update_copy_tree(APP_DIR, "{$dir}/dentalarena", 'dentalarena');
    update_copy_tree(PUBLIC_DIR, "{$dir}/public_html", 'public_html');
    file_put_contents("{$dir}/versiune.txt", app_version());
    // Only the last few copies stay.
    $copies = glob(update_dir() . '/copie-*', GLOB_ONLYDIR) ?: [];
    rsort($copies);
    foreach (array_slice($copies, UPDATE_KEEP_COPIES) as $old) {
        rm_tree($old);
    }
    return $dir;
}

/**
 * Puts the files of an unpacked package (or of a copy) in place: first a copy of the running
 * version, then the new files. Nothing is copied unless every target is writable.
 *
 * @return array{files:int,version:string,backup:string}
 */
function update_apply(string $unpacked, string $version, array $user): array
{
    @set_time_limit(600);
    ignore_user_abort(true);
    $plan = update_plan($unpacked);
    $blocked = [];
    foreach ($plan as [, $target]) {
        $probe = $target;
        while (!file_exists($probe) && dirname($probe) !== $probe) {
            $probe = dirname($probe);
        }
        if (!is_writable($probe)) {
            $blocked[] = $target;
        }
    }
    if ($blocked !== []) {
        throw new DomainException('Serverul nu poate scrie ' . count($blocked) . ' fișiere (de exemplu ' . str_replace([APP_DIR, PUBLIC_DIR], ['dentalarena', 'public_html'], $blocked[0]) . '). În cPanel → File Manager, dați permisiuni 755 folderelor și 644 fișierelor.');
    }
    $from = app_version();
    $copy = update_backup();
    @file_put_contents(update_lock_file(), (string) time());
    try {
        $n = 0;
        foreach ($plan as [$source, $target]) {
            if (!is_dir(dirname($target))) {
                @mkdir(dirname($target), 0755, true);
            }
            if (basename($target) === '.htaccess' && is_file($target)) {
                $ok = file_put_contents($target, update_htaccess_merge((string) file_get_contents($target), (string) file_get_contents($source))) !== false;
            } else {
                $ok = copy($source, $target);
            }
            if (!$ok) {
                throw new RuntimeException('Copierea s-a oprit la ' . basename($target) . '. Puneți înapoi copia de siguranță din această pagină.');
            }
            $n++;
        }
    } finally {
        @unlink(update_lock_file());
    }
    // The new code and the new tables: the next request loads both.
    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
    @unlink(APP_DIR . '/storage/migrations.txt');
    // The new code may add what the old one could not: the lists in data/import are tried again at once.
    array_map('unlink', glob(APP_DIR . '/storage/import-*.failed') ?: []);
    $history = json_decode((string) @file_get_contents(update_dir() . '/istoric.json'), true) ?: [];
    array_unshift($history, ['at' => now_sql(), 'by' => $user['name'], 'from' => $from, 'to' => $version, 'files' => $n]);
    @file_put_contents(update_dir() . '/istoric.json', json_encode(array_slice($history, 0, 50), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    audit('actualizare', "{$from} → {$version}, {$n} fișiere");
    return ['files' => $n, 'version' => $version, 'backup' => basename($copy)];
}

/** Installs an uploaded package. */
function update_install(string $zip, array $user): array
{
    $info = update_check($zip);
    @set_time_limit(600);
    $work = update_dir() . '/lucru-' . bin2hex(random_bytes(6));
    @mkdir($work, 0750, true);
    try {
        zip_extract($zip, $work);
        return update_apply(rtrim($work . '/' . $info['root'], '/'), $info['version'], $user);
    } finally {
        rm_tree($work);
    }
}

/** Puts back a copy made before an update (the version of now is copied first, too). */
function update_restore(string $copyDir, array $user): array
{
    if (!is_file("{$copyDir}/dentalarena/bootstrap.php") || !is_file("{$copyDir}/public_html/index.php")) {
        throw new DomainException('Copia nu este completă.');
    }
    return update_apply($copyDir, trim((string) @file_get_contents("{$copyDir}/versiune.txt")) ?: 'copia din ' . basename($copyDir), $user);
}

/** Appends one piece of an upload sent in parts (big archives pass the hosting's upload limit). */
function update_receive_chunk(string $id, int $offset, string $data): int
{
    if (!preg_match('/^[a-f0-9]{16,40}$/', $id)) {
        throw new DomainException('Încărcare nevalidă.');
    }
    $file = update_dir() . "/incarcare-{$id}.zip";
    clearstatcache(true, $file);
    $have = is_file($file) ? (int) filesize($file) : 0;
    if ($offset === 0) {
        $have = 0;
        @unlink($file);
        // Unfinished uploads of other days are thrown away.
        foreach (glob(update_dir() . '/incarcare-*.zip') ?: [] as $old) {
            if (filemtime($old) < time() - 86400) {
                @unlink($old);
            }
        }
    }
    if ($offset !== $have) {
        throw new DomainException('Încărcarea s-a întrerupt. Încercați din nou.');
    }
    if ($have + strlen($data) > UPDATE_MAX_BYTES) {
        throw new DomainException('Arhiva este prea mare.');
    }
    if (file_put_contents($file, $data, FILE_APPEND | LOCK_EX) !== strlen($data)) {
        throw new DomainException('Serverul nu a putut salva arhiva (spațiu plin?).');
    }
    return $have + strlen($data);
}
