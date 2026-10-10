<?php
/**
 * One service page (src/app/(site)/(pagini)/[serviciu]/page.tsx), for $slug set by routes.php.
 * No live slots or per-doctor online booking here: every booking link goes to the request form.
 */
declare(strict_types=1);

if (!function_exists('thread_list')) {
    /**
     * „Cum decurge” (ThreadSteps variant „list”): one band of the logo's implant screw per step,
     * every step drawn as done, like the Next.js page. Paths and boxes from src/components/brand/logo-paths.ts.
     *
     * @param list<array{label:string,detail?:?string}> $steps
     */
    function thread_list(array $steps, string $label, string $class = ''): string
    {
        $mark = [
            'band1' => 'M776.3 337.1c.9-.1 1.5-.8 2.4-.9 50.4-3.1 98.3-17.7 140.2-46.4 10.1-6.8 19.9-14.1 28.8-22.5 8.3-7.9 15.8-16.4 22.1-26 2.5-3.8 6.9-13.4 9.3-16.1.5-.5 1.2-.9 1.6-1.5-.2.8.2 2 0 3-2.2 10.6-5.4 20.9-10.4 30.6-24.8 48.5-82.6 80.7-135.7 85-17.8 1.4-36 .3-53.5-3.4-1.7-.3-3.3-1.5-4.8-1.8z',
            'band2' => 'M793.7 352.3c.8.1 1.5-.3 2.3-.4 3.1-.5 20 2.1 24.8 2.3 14.4.9 28.9-.4 43-3.2 45.1-9.2 81.4-38.7 108.9-74.4-2.3 7.5-4.5 14.6-8 21.7-20.9 42.5-65.1 72.2-113.1 70.4-19.2-.7-37.5-5.8-54.8-14-1.2-.6-2.1-1.9-3.1-2.4z',
            'band3' => 'M802.7 368.6c17.7 5.9 35.8 11.6 54.5 12.4 24.3 1.1 46.8-6.8 66.7-20.3 6.9-4.7 13.5-11.7 18-14.9.9-.6 1.9-1 2.7-1.8-.4 1.1-.5 2.2-.8 3.3-2.4 8.9-9.1 17.9-15.1 24.7-23.7 26.6-58.7 35-91.8 20.9-13.4-5.8-23.6-14.5-34.2-24.3z',
            'band4' => 'M816.1 393.4c.7.5 1.6.4 2.3.7 1.3.5 12.9 8.6 17.1 10.5 15.8 7.3 33.5 8.3 50.4 4.3 5.5-1.3 11-3.1 16.1-5.4 2.1-1 5.3-3.6 7.4-4 .8-.1 1.6.1 2.2-.2-.5.7-.6 1.6-.9 2.4-1.6 3.9-8.8 10-12.3 12.6-20 14.9-48.5 15.5-67.9-.9-5.6-4.7-10.4-10.6-13.8-17.1-.4-.8-.3-2.5-.6-2.9z',
            'apex' => 'M831.6 423.6c.7.4 1.6.4 2.4.6 2 .6 4.1 3 6 4.1 4.8 2.7 9.8 4.9 14.7 7.3 2.8 1.4 6.1 4.2 9.3 4.1 3.2-.1 6.5-2.9 9.3-4.3 4.9-2.3 9.8-4.5 14.5-7.2 1.6-1 4.9-3.9 6.3-4.4.8-.3 1.6-.2 2.3-.7-.4.6-.4 1.5-.6 2.2-1.2 4.6-6.9 9.4-10.3 12.4-4.5 3.8-11.4 6.6-14.6 11.6-2.5 4-2.4 9.4-3 13.9-.5 3.2-1.5 14.2-2.8 16.5-.4.7-1.1 1.2-1.3 1.9-.1-.8-.8-1.4-1.2-2.1-1.4-2.6-2.3-12.5-2.8-16-.7-4.6-.5-10.3-3.2-14.4-3.1-4.9-9.9-7.6-14.3-11.3-4-3.4-7.5-7.3-10.2-11.8-.4-.7 0-1.8-.5-2.4z',
        ];
        // [minX, minY, maxX, maxY] of each part, in logo units.
        $boxes = [
            'band1' => [776.3, 223.7, 980.7, 342.9],
            'band2' => [793.7, 276.6, 972.7, 368.8],
            'band3' => [802.7, 344.0, 944.6, 399.6],
            'band4' => [816.1, 393.4, 911.6, 425.6],
            'apex' => [831.6, 423.1, 896.4, 481.6],
        ];
        // Five steps use the four bands and the apex; fewer use the bands nearest the apex, plus the tip.
        $n = max(1, min(5, count($steps)));
        $bands = ['band1', 'band2', 'band3', 'band4'];
        [$parts, $tip] = $n === 5 ? [[...$bands, 'apex'], null] : [array_slice($bands, 4 - $n), 'apex'];
        $span = $tip !== null ? [...$parts, $tip] : $parts;
        $minX = min(array_map(static fn ($p) => $boxes[$p][0], $span));
        $maxX = max(array_map(static fn ($p) => $boxes[$p][2], $span));
        $r = static fn (float $v): string => (string) (round($v * 10) / 10);

        $out = '<ol aria-label="' . e($label) . '" class="' . e(cn('flex flex-col gap-5', $class)) . '">';
        foreach (array_slice($steps, 0, $n) as $i => $step) {
            $segs = [$parts[$i]];
            if ($i === $n - 1 && $tip !== null) {
                $segs[] = $tip;
            }
            // Shared horizontal span keeps the taper true from row to row.
            $minY = min(array_map(static fn ($p) => $boxes[$p][1], $segs));
            $maxY = max(array_map(static fn ($p) => $boxes[$p][3], $segs));
            $w = $r($maxX - $minX + 8);
            $h = $r($maxY - $minY + 8);
            $out .= '<li class="grid grid-cols-[3.5rem_1fr] items-start gap-4">'
                . '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' . $r($minX - 4) . ' ' . $r($minY - 4) . " {$w} {$h}\""
                . ' aria-hidden="true" focusable="false" class="shrink-0 overflow-visible mt-1 w-14" style="aspect-ratio:' . "{$w} / {$h}" . '" data-thread="">';
            foreach ($segs as $part) {
                $out .= '<path d="' . $mark[$part] . '" vector-effect="non-scaling-stroke" stroke-width="1" stroke-linejoin="round" data-state="done" class="transition-[fill,stroke] duration-[220ms] ease-filet fill-menta stroke-menta"></path>';
            }
            $out .= '</svg><div><p class="text-control font-semibold">' . e($step['label']) . '</p>'
                . (!empty($step['detail']) ? '<p class="mt-1 text-corp text-discret masura">' . e($step['detail']) . '</p>' : '')
                . '</div></li>';
        }
        return $out . '</ol>';
    }
}

$content = service_content($slug);
$category = catalog()[$slug] ?? null;
if ($content === null || $category === null) {
    // Same as notFound() in Next.js: a service without its category in the price list does not exist.
    http_response_code(404);
    require __DIR__ . '/404.php';
    return;
}

$prices = $category['prices'];
$representative = null;
foreach ($prices as $p) {
    if (!$p['onRequest']) {
        $representative = $p;
        break;
    }
}
$photo = site_image("serviciu.{$slug}");
// The default photo keeps the framing chosen for it in the content; an uploaded one is centred.
if (!empty($content['image']) && $photo['src'] === $content['image']['src'] && !empty($content['image']['focus'])) {
    $photo['focus'] = $content['image']['focus'];
}
$book = booking_href(['serviciu' => $slug, 'confort' => $content['bookingComfort'] ?? null]);
$doctors = doctors_for_category($slug);
$link = 'inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2';

$body = capture(function () use ($content, $slug, $prices, $representative, $photo, $book, $doctors, $link): void {
    service_hero([
        'breadcrumbs' => [['href' => '/servicii', 'label' => 'Servicii'], ['label' => $content['title']]],
        'title' => $content['title'],
        'lead' => $content['lead'],
        'bookingHref' => $book,
        'image' => $photo,
        'priceHint' => $representative ? ['name' => $representative['name'], 'price' => $representative['price']] : null,
        'art' => content('serviceArt')[$slug] ?? null,
    ]);
    $second = $content['secondaryImage'] ?? null;
    $one = count($doctors) === 1;
    ?>
<div class="<?= CONTAINER ?> grid grid-cols-1 gap-x-gutter gap-y-16 py-sectiune lg:grid-cols-12">
  <div class="flex flex-col gap-16 lg:col-span-7">
    <section aria-label="Despre <?= e(mb_strtolower($content['title'])) ?>" class="flex flex-col gap-5">
      <?php foreach ($content['body'] as $p) { ?><p class="text-corp text-cerneala masura"><?= e($p) ?></p><?php } ?>
      <?php if ($second) { ?>
      <figure class="mt-4 max-w-md">
        <div class="relative aspect-[4/3] w-full overflow-hidden rounded-foto bg-adancit">
          <?= photo($second, '448px', false, '', $second['focus'] ?? '50% 50%') ?>
        </div>
        <?php if (!empty($second['caption'])) { ?><figcaption class="mt-3 text-mic text-discret"><?= e($second['caption']) ?></figcaption><?php } ?>
      </figure>
      <?php } ?>
    </section>
    <?php if (!empty($content['steps'])) { ?>
    <section aria-labelledby="cum-decurge">
      <h2 id="cum-decurge" class="font-display text-h2 text-cerneala">Cum decurge</h2>
      <?= thread_list($content['steps'], 'Etapele tratamentului', 'mt-8') ?>
      <?php if (!empty($content['stepsNote'])) { ?><p class="mt-6 text-corp text-discret masura"><?= e($content['stepsNote']) ?></p><?php } ?>
    </section>
    <?php } ?>
  </div>

  <aside class="lg:col-span-4 lg:col-start-9" aria-label="Medicii și confortul">
    <div class="lg:sticky lg:top-28">
      <section aria-labelledby="cine-va-trateaza" class="flex flex-col gap-8">
        <div>
          <h2 id="cine-va-trateaza" class="font-display text-h2 text-cerneala">Cine vă tratează</h2>
          <?php if ($doctors === []) { ?>
          <p class="mt-4 text-corp text-cerneala">Echipa noastră: cinci medici, în Cristești și Luduș. <a href="/echipa" class="text-link underline underline-offset-[0.2em] hover:decoration-2">Cunoașteți medicii</a></p>
          <?php } else { ?>
          <ul class="<?= $one ? 'mt-6' : 'mt-6 flex flex-col gap-6' ?>">
            <?php foreach ($doctors as $d) { ?>
            <li class="<?= $one ? '' : 'grid grid-cols-[6rem_1fr] items-start gap-4' ?>">
              <a href="/echipa/<?= e($d['slug']) ?>" tabindex="-1" aria-hidden="true" class="<?= $one ? 'block max-w-[18rem]' : 'block' ?>"><?= doctor_portrait($d, $one ? '288px' : '96px') ?></a>
              <div class="<?= $one ? 'mt-4' : '' ?>">
                <p class="font-display text-nume text-cerneala"><a href="/echipa/<?= e($d['slug']) ?>" class="underline decoration-transparent underline-offset-[0.2em] hover:text-link hover:decoration-current"><?= e($d['publicName']) ?></a></p>
                <p class="mt-1 text-mic text-discret"><?= e($d['roleLine']) ?></p>
              </div>
            </li>
            <?php } ?>
          </ul>
          <?php } ?>
        </div>
        <?php if (!empty($content['comfortNote'])) { ?><?= comfort_note() ?><?php } ?>
      </section>
    </div>
  </aside>

  <section aria-labelledby="preturi" class="lg:col-span-8">
    <h2 id="preturi" class="font-display text-h2 text-cerneala">Prețuri</h2>
    <?php if ($prices !== []) { ?>
    <?= price_table($prices, "Prețuri: {$content['title']}", 'mt-6') ?>
    <?php } else { ?>
    <p class="mt-4 text-corp text-cerneala">Prețul îl aflați la telefon.</p>
    <?php } ?>
    <p class="mt-6 text-mic text-discret masura"><?= e($content['priceNote']) ?></p>
  </section>

  <?php if (!empty($content['faqs'])) { ?>
  <section aria-labelledby="intrebari" class="lg:col-span-8">
    <h2 id="intrebari" class="font-display text-h2 text-cerneala">Întrebări</h2>
    <div class="border-t border-linie mt-6">
      <?php foreach ($content['faqs'] as $f) { ?>
      <details name="intrebari" class="group border-b border-linie">
        <summary class="flex min-h-control-l cursor-pointer list-none items-center justify-between gap-4 py-3 text-control font-semibold text-cerneala hover:text-link">
          <span><?= e($f['question']) ?></span>
          <?= icon('chevron-down', 22, 'text-discret transition-transform duration-200 ease-filet group-open:rotate-180') ?>
        </summary>
        <div class="pb-5 text-corp text-cerneala masura"><?= e($f['answer']) ?></div>
      </details>
      <?php } ?>
    </div>
  </section>
  <?php } ?>
</div>

<?php $related = array_values(array_filter(array_map('service_content', $content['related'] ?? []))); ?>
<div class="<?= CONTAINER ?> pb-12">
  <?php if ($related !== []) { ?>
  <nav aria-label="Servicii înrudite" class="text-corp">
    <p class="flex flex-wrap items-baseline gap-x-2">
      <span class="text-discret">Vă poate interesa și:</span>
      <?php foreach ($related as $i => $s) { ?>
      <span><a href="/<?= e($s['slug']) ?>" class="<?= $link ?>"><?= e($s['title']) ?></a><?= $i < count($related) - 1 ? ',' : '' ?></span>
      <?php } ?>
    </p>
  </nav>
  <?php } ?>
</div>

<?php booking_band($content['ctaTitle'], href: $book); ?>
    <?php
});

$path = "/{$slug}";
$meta = ['title' => $content['seoTitle'], 'description' => $content['description'], 'path' => $path];
if (!empty($content['image'])) {
    $meta['image'] = ['src' => $content['image']['src'], 'width' => $content['image']['width'], 'height' => $content['image']['height'], 'alt' => $content['image']['alt']];
}
$ld = json_ld(
    breadcrumb_ld([['name' => 'Servicii', 'path' => '/servicii'], ['name' => $content['title'], 'path' => $path]]),
    service_ld($content['title'], $content['description'], $path, $prices),
    faq_ld($content['faqs']),
);
render_page($body, page_meta($meta), $ld);
