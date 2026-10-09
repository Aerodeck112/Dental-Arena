<?php
/**
 * The blocks the pages share, with the markup of their Next.js counterparts: ServiceHero,
 * BookingBand, ServiceGrid, ClinicCards, PriceTable, DoctorPortrait / DoctorFigure, ComfortNote,
 * PhoneLink. Each function echoes its HTML.
 */
declare(strict_types=1);

/** A clinic phone with the clinic's name for screen readers (PhoneLink). */
function phone_link_full(array $clinic, bool $showClinic = true, bool $withIcon = false, string $class = '', string $numberClass = ''): string
{
    $inner = ($withIcon ? icon('phone', 20, 'shrink-0 text-discret group-hover:text-current') : '')
        . ($showClinic ? '<span>' . e($clinic['shortName']) . '</span>' : '')
        . '<span class="' . e(cn('telefon', $numberClass)) . '">' . e(format_phone($clinic['phone'])) . '</span>';
    return phone_link($clinic, cn('group inline-flex min-h-control items-center gap-2 text-cerneala underline decoration-linie-control decoration-1 underline-offset-[0.25em] hover:decoration-2 hover:decoration-current', $class), $inner);
}

/**
 * The top of a page in the forest-green panel (ServiceHero).
 *
 * @param array{breadcrumbs:list<array{label:string,href?:string}>,title:string,lead:string,bookingHref?:?string,bookingLabel?:string,image?:?array,priceHint?:?array,secondary?:?array,art?:?string} $p
 */
function service_hero(array $p, string $children = ''): void
{
    $image = $p['image'] ?? null;
    $art = $p['art'] ?? null;
    $secondary = array_key_exists('secondary', $p) ? $p['secondary'] : ['href' => '#preturi', 'label' => 'Vedeți prețurile'];
    $bookingHref = $p['bookingHref'] ?? null;
    ?>
<section class="px-3 pt-1 sm:px-4">
  <div class="<?= e(cn('relative grid overflow-hidden rounded-mare bg-padure text-white', $image ? 'lg:grid-cols-12' : '')) ?>">
    <?php if ($art && !$image) { ?><?= art($art, 'pointer-events-none absolute inset-y-0 right-[6%] my-auto hidden h-[68%] w-auto text-menta lg:block') ?><?php } ?>
    <div class="<?= e(cn('relative flex flex-col px-6 pt-8 pb-12 sm:px-10 lg:px-16 lg:pt-12 lg:pb-20', $image ? 'lg:col-span-7' : '')) ?>">
      <?php if ($art && $image) { ?><?= art($art, 'pointer-events-none absolute top-10 right-10 hidden w-24 text-menta lg:block xl:w-28') ?><?php } ?>
      <nav aria-label="Pesmet">
        <ol class="flex flex-wrap items-center gap-x-2 text-mic text-padure-text">
          <?php foreach ($p['breadcrumbs'] as $i => $b) { ?>
          <li class="flex items-center gap-2">
            <?php if ($i > 0) { ?><span aria-hidden="true">/</span><?php } ?>
            <?php if (!empty($b['href'])) { ?>
            <a href="<?= e($b['href']) ?>" class="underline decoration-transparent underline-offset-[0.2em] hover:decoration-current focus-visible:outline-white"><?= e($b['label']) ?></a>
            <?php } else { ?>
            <span aria-current="page" class="text-white"><?= e($b['label']) ?></span>
            <?php } ?>
          </li>
          <?php } ?>
        </ol>
      </nav>
      <h1 class="mt-10 font-display text-[clamp(2.75rem,1.4rem+4.4vw,5.75rem)] leading-[1] lg:mt-20"><?= e($p['title']) ?></h1>
      <p class="mt-6 max-w-[46ch] text-lead text-padure-text"><?= e($p['lead']) ?></p>
      <?php if (!empty($p['priceHint'])) { ?>
      <p class="mt-6 text-corp text-padure-text"><?= e($p['priceHint']['name']) ?>: <span class="font-semibold whitespace-nowrap text-white cifre"><?= e($p['priceHint']['price']) ?></span></p>
      <?php } ?>
      <?php if ($bookingHref) { ?>
      <div class="mt-10 flex flex-wrap items-center gap-3">
        <a href="<?= e($bookingHref) ?>" class="inline-flex h-14 items-center rounded-chip bg-menta px-8 text-control font-semibold text-pe-menta transition-colors duration-150 hover:bg-white focus-visible:outline-white"><?= e($p['bookingLabel'] ?? 'Programați o consultație') ?></a>
        <?php if ($secondary) { ?>
        <a href="<?= e($secondary['href']) ?>" class="inline-flex h-14 items-center rounded-chip border-[1.5px] border-white/60 px-8 text-control font-medium text-white transition-colors duration-150 hover:border-white hover:bg-white/10 focus-visible:outline-white"><?= e($secondary['label']) ?></a>
        <?php } ?>
      </div>
      <?php } ?>
      <?= $children ?>
    </div>
    <?php if ($image) { ?>
    <div class="relative min-h-[18rem] sm:min-h-[24rem] lg:col-span-5 lg:min-h-0">
      <?= photo($image, '(min-width: 1024px) 42vw, 100vw', true, '', $image['focus'] ?? null) ?>
    </div>
    <?php } ?>
  </div>
</section>
    <?php
}

/** The closing forest-green band: one sentence, online booking, both phones, the instrument tray. */
function booking_band(string $title = 'Programați o consultație', string $lead = 'Alegeți online ora care vă convine sau sunați la clinica la care veniți. Vă răspundem noi.', string $href = '/programare'): void
{
    ?>
<section aria-labelledby="programare-banda" class="px-3 pb-3 sm:px-4 sm:pb-4">
  <div class="rounded-mare bg-padure py-16 text-white md:py-24">
    <div class="<?= CONTAINER ?> grid gap-10 lg:grid-cols-12 lg:items-end">
      <div class="lg:col-span-7">
        <h2 id="programare-banda" class="font-display text-[clamp(2.5rem,1.4rem+3.6vw,4.75rem)] leading-[1.02]"><?= e($title) ?></h2>
        <p class="mt-6 max-w-[48ch] text-lead text-padure-text"><?= e($lead) ?></p>
        <a href="<?= e($href) ?>" class="mt-10 inline-flex h-14 items-center rounded-chip bg-menta px-8 text-control font-semibold text-pe-menta transition-colors duration-150 hover:bg-white focus-visible:outline-white">Programați-vă online</a>
      </div>
      <div class="flex flex-col gap-10 lg:col-span-4 lg:col-start-9">
        <?= art('tava', 'w-full max-w-[300px] text-menta') ?>
        <ul class="flex flex-col gap-6">
          <?php foreach (clinics() as $c) { ?>
          <li class="border-t border-white/25 pt-5">
            <p class="text-mic text-padure-text"><?= e($c['shortName']) ?></p>
            <?= phone_link($c, 'telefon mt-1 inline-flex min-h-control items-center text-[1.75rem] font-semibold underline decoration-transparent underline-offset-[0.2em] hover:decoration-current focus-visible:outline-white') ?>
          </li>
          <?php } ?>
        </ul>
      </div>
    </div>
  </div>
</section>
    <?php
}

/**
 * „Ce tratăm”: the featured services as large photo panels, the others as tiles with their drawing.
 *
 * @param list<array{slug:string,image:array}> $featured
 */
function service_grid(array $featured, string $class = ''): void
{
    $cat = catalog();
    $featuredSlugs = array_column($featured, 'slug');
    $artMap = content('serviceArt');
    ?>
<div class="<?= e(cn('grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12', $class)) ?>">
  <?php foreach ($featured as $f) {
      $r = $cat[$f['slug']] ?? null;
      if ($r === null) {
          continue;
      } ?>
  <a href="/<?= e($r['slug']) ?>" class="group relative isolate flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-mare bg-padure p-6 text-white md:min-h-[26rem] lg:col-span-6 lg:p-8">
    <?= photo($f['image'], '(min-width: 1024px) 640px, (min-width: 768px) 50vw, 100vw', false, '-z-10 transition-transform duration-700 ease-filet group-hover:scale-[1.03] motion-reduce:transition-none') ?>
    <span aria-hidden="true" class="absolute inset-0 -z-10 bg-gradient-to-t from-padure via-padure/55 to-transparent"></span>
    <h3 class="font-display text-[clamp(2rem,1.4rem+1.6vw,2.75rem)] leading-[1.05]"><?= e($r['name']) ?></h3>
    <p class="mt-3 max-w-[46ch] text-corp text-padure-text"><?= e($r['summary']) ?></p>
    <?php if ($r['representative']) { ?>
    <p class="mt-4 text-mic text-padure-text"><?= e($r['representative']['name']) ?>: <span class="font-semibold whitespace-nowrap text-white cifre"><?= e($r['representative']['price']) ?></span></p>
    <?php } ?>
  </a>
  <?php } ?>
  <?php foreach ($cat as $r) {
      if (in_array($r['slug'], $featuredSlugs, true)) {
          continue;
      } ?>
  <a href="/<?= e($r['slug']) ?>" class="group flex min-h-[13rem] flex-col rounded-mediu border border-linie bg-suprafata p-6 transition-colors duration-200 hover:border-actiune hover:bg-menta-pal lg:col-span-3">
    <?php if (isset($artMap[$r['slug']])) { ?><?= art($artMap[$r['slug']], 'mb-5 size-20 text-actiune') ?><?php } ?>
    <h3 class="font-display text-[1.75rem] leading-[1.1] text-cerneala"><?= e($r['name']) ?></h3>
    <p class="mt-3 line-clamp-4 text-mic text-discret"><?= e($r['summary']) ?></p>
    <?php if ($r['representative']) { ?>
    <p class="mt-auto pt-5 text-mic text-discret"><span class="sr-only">Exemplu de preț: </span><?= e($r['representative']['name']) ?> <span class="font-semibold whitespace-nowrap text-cerneala cifre"><?= e($r['representative']['price']) ?></span></p>
    <?php } ?>
  </a>
  <?php } ?>
</div>
    <?php
}

/** Cristești and Luduș as two photo panels with address, phone, hours and the next steps. */
function clinic_cards(string $headingLevel = 'h3', string $class = ''): void
{
    $h = $headingLevel === 'h2' ? 'h2' : 'h3';
    ?>
<div class="<?= e(cn('grid grid-cols-1 gap-4 md:grid-cols-2', $class)) ?>">
  <?php foreach (clinics() as $slug => $c) { ?>
  <article id="<?= e($slug) ?>" aria-labelledby="clinica-<?= e($slug) ?>" class="flex scroll-mt-28 flex-col overflow-hidden rounded-mare border border-linie bg-suprafata">
    <div class="relative aspect-[16/11] w-full bg-adancit">
      <?= photo(site_image("clinica.{$slug}"), '(min-width: 1280px) 620px, (min-width: 768px) 48vw, 100vw') ?>
    </div>
    <div class="flex flex-1 flex-col p-6 md:p-8">
      <<?= $h ?> id="clinica-<?= e($slug) ?>" class="font-display text-[clamp(2rem,1.5rem+1.4vw,2.75rem)] leading-[1.05] text-cerneala"><?= e($c['shortName']) ?></<?= $h ?>>
      <p class="mt-3 text-corp text-cerneala"><?= e(clinic_address($c)) ?><?= $c['area'] ? '<span class="block text-discret">' . e($c['area']) . '</span>' : '' ?></p>
      <?= phone_link_full($c, false, true, 'mt-3 self-start text-h3', 'font-semibold') ?>
      <?php if ($c['hoursText']) { ?>
      <ul class="mt-4 text-mic text-discret cifre">
        <?php foreach (preg_split('/\R/', $c['hoursText']) ?: [] as $line) {
            if (trim($line) !== '') { ?><li><?= e(trim($line)) ?></li><?php }
        } ?>
      </ul>
      <?php } ?>
      <div class="mt-auto flex flex-wrap gap-3 pt-8">
        <a href="/programare?clinica=<?= e($slug) ?>" class="inline-flex h-12 items-center rounded-chip bg-actiune px-6 text-control font-semibold text-pe-actiune hover:bg-actiune-apasat">Programați-vă la <?= e($c['shortName']) ?></a>
        <a href="<?= e($c['mapsLink']) ?>" target="_blank" rel="noopener noreferrer" class="inline-flex h-12 items-center rounded-chip border-[1.5px] border-cerneala px-6 text-control font-medium text-cerneala hover:bg-menta-pal">Indicații pe hartă<span class="sr-only"> (se deschide într-o filă nouă)</span></a>
      </div>
    </div>
  </article>
  <?php } ?>
</div>
    <?php
}

/** Prices with a dotted leader (PriceTable). */
function price_table(array $prices, string $label, string $class = ''): string
{
    $out = '<dl aria-label="' . e($label) . '" class="' . e(cn('flex flex-col', $class)) . '">';
    foreach ($prices as $p) {
        $out .= '<div class="flex items-baseline py-2.5 text-corp" data-pret="' . e(mb_strtolower($p['name'])) . '">'
            . '<dt class="min-w-0 text-cerneala">' . e($p['name']) . '</dt>'
            . '<span aria-hidden="true" class="mx-3 h-[0.3em] min-w-6 flex-1 self-baseline bg-[radial-gradient(circle,var(--da-linie-control)_0.9px,transparent_1.3px)] bg-[length:7px_4px] bg-bottom bg-repeat-x opacity-70"></span>'
            . '<dd class="' . e(cn('shrink-0 text-right cifre', $p['onRequest'] ? 'max-w-[11rem] text-mic text-discret sm:max-w-none' : 'font-semibold whitespace-nowrap text-cerneala')) . '">' . e($p['price']) . '</dd>'
            . '</div>';
    }
    return $out . '</dl>';
}

/** A 4:5 portrait whose eyes sit on the shared line, or the monogram plate (DoctorPortrait). */
function doctor_portrait(array $d, string $sizes, string $size = 'row', bool $priority = false, string $class = ''): string
{
    $out = '<div class="' . e(cn('relative aspect-[4/5] w-full overflow-hidden rounded-foto bg-fundal', $class)) . '">';
    $photo = doctor_photo($d);
    if ($photo === null) {
        $out .= '<div aria-hidden="true" class="flex size-full items-center justify-center bg-menta-pal font-display text-cerneala"><span class="'
            . ($size === 'profile' ? 'leading-none text-[4.5rem]' : 'leading-none text-[3rem]') . '">' . e($d['monogram']) . '</span></div>';
        return $out . '</div>';
    }
    $photo['alt'] = "Portretul medicului: {$d['publicName']}";
    $meta = content('portraits')[$d['photoPath']] ?? null;
    if ($meta !== null) {
        $crop = portrait_crop($meta);
        [$src, $srcset] = photo_sources($photo['src']);
        $out .= '<img' . html_attrs([
            'src' => $src,
            'srcset' => $srcset !== '' ? $srcset : null,
            'sizes' => $srcset !== '' ? $sizes : null,
            'alt' => $photo['alt'],
            'width' => $meta['width'],
            'height' => $meta['height'],
            'loading' => $priority ? null : 'lazy',
            'fetchpriority' => $priority ? 'high' : null,
            'decoding' => 'async',
            'class' => 'absolute h-auto max-w-none',
            'style' => "width:{$crop['widthPct']}%;left:{$crop['leftPct']}%;top:{$crop['topPct']}%",
        ]) . '>';
    } else {
        $out .= photo($photo, $sizes, $priority, 'object-[50%_20%]');
    }
    return $out . '</div>';
}

/** The crop that puts the eyes on the shared line (portraitCrop in src/content/portraits.ts). */
function portrait_crop(array $meta, float $eyeLine = 0.16, float $head = 0.28): array
{
    $ratio = 5 / 4;
    $aspect = $meta['width'] / $meta['height'];
    $imgH = max(($head * $ratio) / $meta['head'], $ratio, 1 / $aspect);
    $imgW = $imgH * $aspect;
    $top = min(0, max($ratio - $imgH, $eyeLine * $ratio - $meta['eyeY'] * $imgH));
    $left = min(0, max(1 - $imgW, 0.5 - $meta['eyeX'] * $imgW));
    return [
        'widthPct' => round($imgW * 100, 2),
        'leftPct' => round($left * 100, 2),
        'topPct' => round($top / $ratio * 100, 2),
    ];
}

/** One doctor in a row: portrait, name, role (DoctorFigure). */
function doctor_figure(array $d, string $sizes = '(min-width: 1280px) 232px, (min-width: 768px) 30vw, 72vw', string $headingLevel = 'h3', string $class = ''): string
{
    $h = $headingLevel === 'h2' ? 'h2' : 'h3';
    $profile = '/echipa/' . e($d['slug']);
    return '<figure class="' . e(cn('flex flex-col', $class)) . '">'
        . '<a href="' . $profile . '" tabindex="-1" aria-hidden="true" class="block">' . doctor_portrait($d, $sizes) . '</a>'
        . '<figcaption class="mt-4 flex flex-1 flex-col">'
        . "<{$h} class=\"font-display text-nume text-cerneala\"><a href=\"{$profile}\" class=\"underline decoration-transparent underline-offset-[0.2em] hover:text-link hover:decoration-current\">" . e($d['publicName']) . "</a></{$h}>"
        . '<p class="mt-1 text-mic text-discret">' . e($d['roleLine']) . '</p>'
        . '</figcaption></figure>';
}

/** „Vă e teamă?”: the mustard note that leads to inhalosedare. */
function comfort_note(string $title = 'Vă e teamă?', string $text = 'Intervenția se poate face sub inhalosedare: rămâneți conștient, doar mult mai relaxat.', string $class = ''): string
{
    return '<aside aria-label="' . e($title) . '" class="' . e(cn('rounded-panou bg-mustar-pal p-5 text-cerneala', $class)) . '">'
        . '<p class="flex items-center gap-2.5 text-h3 font-semibold"><span aria-hidden="true" class="inline-block size-2.5 shrink-0 rounded-full bg-mustar ring-1 ring-mustar-text"></span>' . e($title) . '</p>'
        . '<p class="mt-2 text-corp">' . e($text) . '</p>'
        . '<a href="/inhalosedare" class="mt-1 inline-flex min-h-control items-center font-medium underline decoration-1 underline-offset-[0.2em] hover:decoration-2">Despre inhalosedare</a>'
        . '</aside>';
}
