<?php
/**
 * The Târgu Mureș landing pages (src/components/site/LandingPage.tsx, for /dentist-targu-mures and
 * /cabinet-stomatologic-targu-mures): they keep their WordPress URLs and point to the Cristești
 * clinic. The dentist page shows the doctors; the cabinet page one representative price per service.
 */
declare(strict_types=1);

if (!function_exists('breadcrumbs_light')) {
    /** „Acasă / …” on a light page (src/components/ui/Breadcrumbs.tsx); the last item is the page. */
    function breadcrumbs_light(array $items, string $class = ''): string
    {
        $out = '<nav aria-label="Cale de navigare" class="' . e(cn('text-mic text-discret', $class)) . '"><ol class="flex flex-wrap items-center gap-x-2 gap-y-1">';
        $last = count($items) - 1;
        foreach ($items as $i => $it) {
            $out .= '<li class="inline-flex items-center gap-2">';
            if (!empty($it['href']) && $i !== $last) {
                $out .= '<a href="' . e($it['href']) . '" class="text-discret underline underline-offset-4 hover:text-link hover:decoration-2">' . e($it['label']) . '</a>';
            } else {
                $out .= $i === $last ? '<span aria-current="page" class="text-cerneala">' . e($it['label']) . '</span>' : '<span>' . e($it['label']) . '</span>';
            }
            if ($i !== $last) {
                $out .= '<span aria-hidden="true" class="text-linie-control">/</span>';
            }
            $out .= '</li>';
        }
        return $out . '</ol></nav>';
    }
}

if (!function_exists('landing_service_index')) {
    /** „Ce tratăm” as a two-column text index (src/components/site/ServiceIndex.tsx). */
    function landing_service_index(array $rows, string $class = ''): string
    {
        $out = '<ul class="' . e(cn('grid gap-x-gutter md:grid-cols-2 lg:gap-x-[calc(var(--spacing-gutter)*3)]', $class)) . '">';
        foreach ($rows as $r) {
            $out .= '<li class="group relative flex flex-col border-t border-linie py-6">'
                . '<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">'
                . '<h3 class="text-h3 font-semibold text-cerneala"><a href="/' . e($r['slug']) . '" class="underline decoration-transparent decoration-1 underline-offset-[0.2em] group-hover:text-link group-hover:decoration-current after:absolute after:inset-0 after:content-[\'\']">' . e($r['name']) . '</a></h3>';
            if ($r['representative']) {
                $out .= '<p class="ml-auto text-right text-mic text-discret"><span class="sr-only">Exemplu de preț: </span>' . e($r['representative']['name'])
                    . ' <span class="font-semibold whitespace-nowrap text-cerneala cifre">' . e($r['representative']['price']) . '</span></p>';
            }
            $out .= '</div><p class="mt-2 text-corp text-discret masura">' . e($r['summary']) . '</p></li>';
        }
        return $out . '</ul>';
    }
}

if (!function_exists('landing_map')) {
    /**
     * A clinic map that sets no Google cookie before consent (src/components/site/MapConsent.tsx).
     * site.js loads the embed into [data-harta] once the visitor agrees; „Afișați harta” records that consent.
     */
    function landing_map(array $c, string $class = ''): string
    {
        return '<div class="' . e(cn('relative aspect-[3/2] w-full overflow-hidden rounded-foto bg-adancit', $class)) . '" data-harta data-src="' . e($c['mapsEmbed']) . '" data-title="' . e("Harta: {$c['name']}") . '">'
            . '<div class="flex size-full flex-col items-start justify-end gap-3 p-5 sm:p-6">'
            . icon('map-pin', 28, 'text-discret')
            . '<p class="max-w-[34ch] text-corp text-cerneala">Harta Google poate seta cookie-uri, de aceea o afișăm doar dacă sunteți de acord.</p>'
            . '<div class="flex flex-wrap items-center gap-x-5 gap-y-1">'
            . '<button type="button" data-incarca-harta data-mereu class="' . e(btn('secondary')) . '">Afișați harta</button>'
            . '<a href="' . e($c['mapsLink']) . '" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">Deschideți în Google Maps<span class="sr-only"> (se deschide într-o filă nouă)</span></a>'
            . '</div></div></div>';
    }
}

$slug = ltrim(request_path(), '/');
$page = content('landings')[$slug] ?? null;
if ($page === null) {
    http_response_code(404);
    require APP_DIR . '/templates/pages/404.php';
    return;
}
$c = clinics()['cristesti'];
$index = array_values(catalog());
// The dentist page shows the team; the cabinet page one price per service.
$doctors = $slug === 'dentist-targu-mures' ? public_doctors() : null;
$reps = [];
foreach ($index as $r) {
    if ($r['representative']) {
        $reps[] = ['name' => $r['representative']['name'], 'price' => $r['representative']['price'], 'onRequest' => false];
    }
}
$link = 'text-link underline underline-offset-[0.2em] hover:decoration-2';

$body = capture(function () use ($page, $c, $index, $doctors, $reps, $link): void {
    ?>
<div class="<?= CONTAINER ?> pt-6 pb-sectiune md:pt-10">
  <?= breadcrumbs_light([['href' => '/', 'label' => 'Acasă'], ['label' => $page['title']]]) ?>
  <div class="mt-8 grid grid-cols-1 items-start gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
    <div class="lg:col-span-6">
      <h1 class="font-display text-h1 text-cerneala"><?= e($page['title']) ?></h1>
      <p class="mt-6 text-lead text-discret masura-lead"><?= e($page['lead']) ?></p>
      <div class="mt-8 flex flex-wrap items-center gap-3">
        <a href="<?= e(booking_href(['clinica' => 'cristesti'])) ?>" class="<?= e(btn('primary', 'l')) ?>">Programați-vă în Cristești</a>
        <?php call_menu('secondary', 'start'); ?>
      </div>
      <div class="mt-10 flex flex-col gap-4">
        <?php foreach ($page['intro'] as $p) { ?><p class="text-corp text-cerneala masura"><?= e($p) ?></p><?php } ?>
      </div>
    </div>
    <figure class="lg:col-span-5 lg:col-start-8">
      <div class="relative aspect-[4/3] w-full overflow-hidden rounded-foto bg-adancit">
        <?= photo($c['photo'], '(min-width: 1024px) 520px, 100vw', true) ?>
      </div>
      <figcaption class="mt-3 text-mic text-discret">Clinica Dental Arena din Cristești.</figcaption>
    </figure>
  </div>
</div>

<section aria-labelledby="servicii-landing" class="bg-suprafata py-sectiune">
  <div class="<?= CONTAINER ?>">
    <h2 id="servicii-landing" class="font-display text-h2 text-cerneala"><?= e($page['servicesTitle']) ?></h2>
    <?= landing_service_index($index, 'mt-10') ?>
  </div>
</section>

<section aria-labelledby="focus-landing" class="py-sectiune">
  <div class="<?= CONTAINER ?>">
    <h2 id="focus-landing" class="font-display text-h2 text-cerneala"><?= e($page['focusTitle']) ?></h2>
    <p class="mt-4 text-lead text-discret masura-lead"><?= e($page['focusLead']) ?></p>
    <?php if ($doctors !== null) { ?>
    <ul class="mt-10 grid grid-cols-1 gap-x-gutter gap-y-12 sm:grid-cols-2 lg:grid-cols-5">
      <?php foreach ($doctors as $d) { ?>
      <li class="flex"><?= doctor_figure($d, '(min-width: 1024px) 232px, (min-width: 640px) 45vw, 100vw', 'h3', 'w-full') ?></li>
      <?php } ?>
    </ul>
    <?php } else { ?>
    <?= price_table($reps, 'Prețuri orientative, câte unul pentru fiecare serviciu', 'mt-8 max-w-3xl') ?>
    <a href="/preturi" class="mt-4 inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">Toate prețurile</a>
    <?php } ?>
  </div>
</section>

<section aria-labelledby="clinica-landing" class="bg-suprafata py-sectiune">
  <div class="<?= CONTAINER ?> grid grid-cols-1 gap-x-gutter gap-y-10 lg:grid-cols-12">
    <div class="lg:col-span-5">
      <h2 id="clinica-landing" class="font-display text-h2 text-cerneala"><?= e($page['clinicTitle']) ?></h2>
      <p class="mt-5 text-corp text-cerneala"><?= e(clinic_address($c)) ?><span class="block text-discret"><?= e($c['area']) ?></span></p>
      <?= phone_link_full($c, false, true, 'mt-2 text-h3', 'font-semibold') ?>
      <?= comfort_note($page['comfortTitle'], $page['comfortText'], 'mt-8') ?>
      <p class="mt-8 text-corp text-cerneala"><?= e($page['ludusNote']) ?> <a href="/contact#ludus" class="<?= $link ?>">Clinica din Luduș</a></p>
    </div>
    <div class="lg:col-span-6 lg:col-start-7">
      <?= landing_map($c) ?>
    </div>
  </div>
</section>

<?php booking_band('Programați o consultație în Cristești', 'Alegeți online ora care vă convine sau sunați la clinica la care veniți. Vă răspundem noi.', booking_href(['clinica' => 'cristesti'])); ?>
    <?php
});

render_page(
    $body,
    page_meta(['title' => $page['seoTitle'], 'description' => $page['description'], 'path' => "/{$page['slug']}"]),
    json_ld(dentist_ld($c), breadcrumb_ld([['name' => $page['title'], 'path' => "/{$page['slug']}"]])),
);
