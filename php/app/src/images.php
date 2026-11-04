<?php
/**
 * Photos: the site's own photos come in several WebP widths (made by the build, data/images.json);
 * photos uploaded from the panel are resized here with GD into public_html/media.
 */
declare(strict_types=1);

const MEDIA_WIDTHS = [800, 1600];

/**
 * <img> filling its frame (the parent sets the size and `relative`), like next/image `fill`.
 *
 * @param array{src:string,alt:string,width?:int,height?:int} $image
 */
function photo(array $image, string $sizes, bool $priority = false, string $class = '', ?string $position = null): string
{
    [$src, $srcset] = photo_sources($image['src']);
    $attrs = [
        'src' => $src,
        'alt' => $image['alt'] ?? '',
        'sizes' => $srcset !== '' ? $sizes : null,
        'srcset' => $srcset !== '' ? $srcset : null,
        'decoding' => 'async',
        'loading' => $priority ? null : 'lazy',
        'fetchpriority' => $priority ? 'high' : null,
        'class' => cn('absolute inset-0 h-full w-full object-cover', $class),
        'style' => $position ? "object-position:{$position}" : null,
    ];
    return picture($image['src'], $sizes, '<img' . html_attrs($attrs) . '>');
}

/** <img> at its natural ratio (width and height set, so nothing jumps while it loads). */
function photo_static(array $image, string $sizes, string $class = '', bool $priority = false): string
{
    [$src, $srcset] = photo_sources($image['src']);
    $attrs = [
        'src' => $src,
        'alt' => $image['alt'] ?? '',
        'width' => $image['width'] ?? null,
        'height' => $image['height'] ?? null,
        'sizes' => $srcset !== '' ? $sizes : null,
        'srcset' => $srcset !== '' ? $srcset : null,
        'decoding' => 'async',
        'loading' => $priority ? null : 'lazy',
        'fetchpriority' => $priority ? 'high' : null,
        'class' => $class !== '' ? $class : null,
    ];
    return picture($image['src'], $sizes, '<img' . html_attrs($attrs) . '>');
}

/** The AVIF srcset of a site photo (smaller than WebP), or '' for uploads. */
function photo_avif_srcset(string $src): string
{
    $variants = data_file('images')[$src]['variants'] ?? [];
    return implode(', ', array_map(static fn ($v) => "{$v['avif']} {$v['w']}w", array_filter($variants, static fn ($v) => isset($v['avif']))));
}

/** <picture> with the AVIF source when there is one, around the given <img>. */
function picture(string $src, string $sizes, string $img): string
{
    $avif = photo_avif_srcset($src);
    return $avif === '' ? $img : '<picture><source type="image/avif" srcset="' . e($avif) . '" sizes="' . e($sizes) . '">' . $img . '</picture>';
}

/** @return array{0:string,1:string} the default src and the srcset. */
function photo_sources(string $src): array
{
    $manifest = data_file('images');
    if (isset($manifest[$src])) {
        $variants = $manifest[$src]['variants'];
        $parts = array_map(static fn ($v) => "{$v['src']} {$v['w']}w", $variants);
        $default = $variants[0]['src'];
        foreach ($variants as $v) {
            if ($v['w'] <= 1200) {
                $default = $v['src'];
            }
        }
        return [$default, implode(', ', $parts)];
    }
    // An upload: /media/name-1600.webp, with name-800.webp beside it.
    if (preg_match('#^(/media/.+)-1600\.webp$#', $src, $m)) {
        $small = $m[1] . '-800.webp';
        if (is_file(PUBLIC_DIR . $small)) {
            return [$src, "{$small} 800w, {$src} 1600w"];
        }
    }
    return [$src, ''];
}

function html_attrs(array $attrs): string
{
    $out = '';
    foreach ($attrs as $k => $v) {
        if ($v === null || $v === false) {
            continue;
        }
        $out .= $v === true ? " {$k}" : " {$k}=\"" . e($v) . '"';
    }
    return $out;
}

function media_dir(): string
{
    $dir = PUBLIC_DIR . '/media';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    // Uploaded files are only ever images: never run anything from this folder.
    if (!is_file($dir . '/.htaccess')) {
        file_put_contents($dir . '/.htaccess', "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar\n<FilesMatch \"\\.(?i:php|phtml|phar|pl|py|cgi|sh)$\">\n  Require all denied\n</FilesMatch>\n");
    }
    return $dir;
}

/**
 * Turns an uploaded photo into WebP (or JPEG where GD has no WebP) at 800 and 1600 px wide.
 *
 * @return array{path:string,width:int,height:int} the path of the large file
 */
function save_uploaded_photo(array $file, string $prefix): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException(match ($file['error'] ?? null) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Fotografia este prea mare. Încărcați una de cel mult ' . upload_limit_mb() . ' MB.',
            UPLOAD_ERR_NO_FILE => 'Alegeți o fotografie.',
            default => 'Fotografia nu s-a încărcat. Încercați din nou.',
        });
    }
    if (!function_exists('imagecreatefromstring')) {
        throw new RuntimeException('Serverul nu are extensia PHP „GD”. Activați-o din cPanel → Select PHP Version → Extensions.');
    }
    $info = @getimagesize($file['tmp_name']);
    if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        throw new InvalidArgumentException('Fișierul nu este o fotografie JPG, PNG sau WebP.');
    }
    if ($info[0] < 400 || $info[1] < 300) {
        throw new InvalidArgumentException('Fotografia este prea mică. Folosiți una de cel puțin 800 × 600 pixeli.');
    }
    $img = @imagecreatefromstring((string) file_get_contents($file['tmp_name']));
    if ($img === false) {
        throw new InvalidArgumentException('Fotografia nu poate fi citită. Încercați alt fișier.');
    }
    $img = apply_exif_rotation($img, $file['tmp_name'], $info[2]);
    $w = imagesx($img);
    $h = imagesy($img);
    $dir = media_dir();
    $base = slugify($prefix) . '-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3));
    $webp = function_exists('imagewebp');
    $result = null;
    foreach (MEDIA_WIDTHS as $target) {
        $tw = min($target, $w);
        $th = (int) round($h * $tw / $w);
        $resized = imagecreatetruecolor($tw, $th);
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        imagecopyresampled($resized, $img, 0, 0, 0, 0, $tw, $th, $w, $h);
        $name = "{$base}-{$target}." . ($webp ? 'webp' : 'jpg');
        $ok = $webp ? imagewebp($resized, "{$dir}/{$name}", 80) : imagejpeg($resized, "{$dir}/{$name}", 82);
        imagedestroy($resized);
        if (!$ok) {
            throw new RuntimeException('Fotografia nu a putut fi salvată pe server (verificați spațiul liber).');
        }
        if ($target === 1600) {
            $result = ['path' => "/media/{$name}", 'width' => $tw, 'height' => $th];
        }
    }
    imagedestroy($img);
    return $result;
}

/** Phone photos are often stored sideways with an EXIF orientation; turn them upright. */
function apply_exif_rotation(GdImage $img, string $path, int $type): GdImage
{
    if ($type !== IMAGETYPE_JPEG || !function_exists('exif_read_data')) {
        return $img;
    }
    $exif = @exif_read_data($path);
    $angle = match ((int) ($exif['Orientation'] ?? 1)) {
        3 => 180,
        6 => -90,
        8 => 90,
        default => 0,
    };
    if ($angle === 0) {
        return $img;
    }
    $rotated = imagerotate($img, $angle, 0);
    return $rotated === false ? $img : $rotated;
}

/** Deletes an uploaded photo and its small copy (never the site's own photos). */
function delete_media(?string $path): void
{
    if ($path === null || !preg_match('#^/media/([a-z0-9-]+)-1600\.(webp|jpg)$#', $path, $m)) {
        return;
    }
    foreach (MEDIA_WIDTHS as $w) {
        @unlink(PUBLIC_DIR . "/media/{$m[1]}-{$w}.{$m[2]}");
    }
}

function upload_limit_mb(): int
{
    $toBytes = static function (string $v): int {
        $v = trim($v);
        $n = (int) $v;
        return match (strtolower(substr($v, -1))) {
            'g' => $n * 1024 ** 3,
            'm' => $n * 1024 ** 2,
            'k' => $n * 1024,
            default => $n,
        };
    };
    $limit = min($toBytes((string) ini_get('upload_max_filesize')), $toBytes((string) ini_get('post_max_size')));
    return max(1, (int) floor($limit / 1024 / 1024));
}
