<?php
/** Icons, line drawings, the logo, buttons and the page container. */
declare(strict_types=1);

const CONTAINER = 'mx-auto w-full max-w-[calc(var(--container-continut)+2*var(--spacing-margine))] px-margine';

/** A Lucide outline icon (data/icons.json), decorative unless it has a label. */
function icon(string $name, int $size = 20, string $class = '', ?string $label = null): string
{
    $body = data_file('icons')[$name] ?? '';
    $a11y = $label !== null ? ' role="img" aria-label="' . e($label) . '"' : ' aria-hidden="true"';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'
        . $a11y . ' focusable="false" class="' . e(cn('shrink-0', $class)) . '">' . $body . '</svg>';
}

/** A line drawing of teeth or instruments (design-system §9.6), decorative. */
function art(string $name, string $class = ''): string
{
    $a = data_file('art')[$name] ?? null;
    if ($a === null) {
        return '';
    }
    return '<svg viewBox="' . e($a['viewBox']) . '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="'
        . e(cn('desen', $class)) . '">' . $a['body'] . '</svg>';
}

/** The original logo of dentalarena.ro, at the width it is shown. */
function logo(string $class = 'h-12 w-auto', bool $priority = false, string $sizes = '160px', string $alt = ''): string
{
    return '<img src="/brand/logo-dental-arena-480.webp" srcset="/brand/logo-dental-arena-320.webp 320w, /brand/logo-dental-arena-480.webp 480w, /brand/logo-dental-arena.webp 640w" sizes="'
        . e($sizes) . '" width="640" height="241" alt="' . e($alt) . '"' . ($alt === '' ? ' aria-hidden="true"' : '')
        . ($priority ? ' fetchpriority="high"' : ' loading="lazy"') . ' decoding="async" draggable="false" class="' . e(cn('shrink-0 select-none', $class)) . '">';
}

/** The classes of Button / ButtonLink (src/components/ui/button-styles.ts). */
function btn(string $variant = 'primary', string $size = 'm', string $class = ''): string
{
    $height = match ($size) { 's' => 'h-control-s', 'l' => 'h-control-l', default => 'h-control' };
    $width = $variant === 'text' ? 'px-1' : match ($size) { 's' => 'px-3', 'l' => 'px-7', default => 'px-5' };
    return cn(
        'apasat relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control',
        'text-control font-medium select-none',
        'transition-colors duration-150 ease-filet',
        'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
        $height,
        $width,
        $variant === 'primary' ? 'bg-actiune text-pe-actiune hover:bg-actiune-apasat active:bg-actiune-apasat disabled:bg-adancit disabled:text-discret' : '',
        $variant === 'secondary' ? 'border-[1.5px] border-cerneala bg-transparent text-cerneala hover:bg-adancit disabled:border-linie-control disabled:text-discret' : '',
        $variant === 'text' ? 'bg-transparent text-link underline decoration-1 underline-offset-4 hover:decoration-2 disabled:text-discret disabled:no-underline' : '',
        $variant === 'danger' ? 'border-[1.5px] border-carmin bg-transparent text-carmin hover:bg-carmin-pal disabled:border-linie-control disabled:text-discret' : '',
        $class,
    );
}

/** „Sunați la Cristești, 0265 326 316” link. */
function phone_link(array $clinic, string $class, string $inner = ''): string
{
    $n = format_phone($clinic['phone']);
    return '<a href="' . e(tel_href($clinic['phone'])) . '" aria-label="' . e("Sunați la {$clinic['shortName']}, {$n}") . '" class="' . e($class) . '">'
        . ($inner !== '' ? $inner : e($n)) . '</a>';
}

/** Booking URL with prefilled values (/programare?serviciu=…&clinica=…). */
function booking_href(array $p = []): string
{
    $q = array_filter(['serviciu' => $p['serviciu'] ?? null, 'clinica' => $p['clinica'] ?? null, 'confort' => $p['confort'] ?? null]);
    return $q === [] ? '/programare' : '/programare?' . http_build_query($q);
}
