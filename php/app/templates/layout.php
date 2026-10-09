<?php
/**
 * The HTML document of a public page: head (title, description, canonical, Open Graph, structured
 * data, the stylesheet and the two fonts), the skip link, header, main, footer, the phone's bar and
 * the cookie banner. $chrome = false gives the booking page its own short header.
 */
declare(strict_types=1);

function render_page(string $body, array $meta, string $jsonLd = '', bool $chrome = true): void
{
    $path = request_path();
    header('Content-Type: text/html; charset=utf-8');
    ?>
<!DOCTYPE html>
<html lang="ro" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<?= render_head_meta($meta) ?>
<link rel="preload" href="/assets/fonts/red-hat-text-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/forum-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= e(asset('/assets/site.css')) ?>">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" type="image/png">
<meta name="theme-color" content="#F4F7F5">
<?= $jsonLd ?>
<script src="<?= e(asset(is_file(PUBLIC_DIR . '/assets/site.min.js') ? '/assets/site.min.js' : '/assets/site.js')) ?>" defer></script>
</head>
<body class="min-h-dvh bg-fundal font-sans text-cerneala">
<a href="#continut" class="sr-only z-[60] rounded-control bg-suprafata px-4 py-3 font-medium text-cerneala shadow-float focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Salt la conținut</a>
<?php if ($chrome) { ?>
<div class="flex min-h-dvh flex-col">
<?php site_header($path); ?>
<main id="continut" tabindex="-1" class="flex-1 outline-none">
<?= $body ?>
</main>
<?php site_footer(); ?>
<?php sticky_call_bar(); ?>
</div>
<?php } else { ?>
<?= $body ?>
<?php } ?>
<?php cookie_banner(); ?>
</body>
</html>
    <?php
}

/** Captures the HTML a page template echoes. */
function capture(callable $fn): string
{
    ob_start();
    try {
        $fn();
    } catch (Throwable $e) {
        ob_end_clean();
        throw $e;
    }
    return (string) ob_get_clean();
}
