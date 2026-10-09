<?php
/** The home page (src/app/(site)/(pagini)/page.tsx). The live slots become a call / request panel. */
declare(strict_types=1);

$home = content('home');
$img = [];
foreach (['acasa.principala', 'acasa.secundara', 'acasa.confort', 'acasa.copii', 'acasa.tehnologie', 'serviciu.implantologie', 'serviciu.inhalosedare'] as $slot) {
    $img[$slot] = site_image($slot);
}
$prices = prices_by_code([...$home['children']['priceCodes'], 'INH-ORA']);
$childPrices = array_values(array_filter(array_map(static fn ($c) => $prices[$c] ?? null, $home['children']['priceCodes'])));
$sedation = $prices['INH-ORA']['price'] ?? null;
$doctors = public_doctors();
$h2 = 'font-display text-[clamp(2.5rem,1.6rem+2.8vw,4.25rem)] leading-[1.02] text-cerneala';
$link = 'inline-flex min-h-control items-center font-medium text-link underline decoration-1 underline-offset-[0.2em] hover:decoration-2';
$tile = 'apasat flex min-h-[4.5rem] flex-col items-start justify-center rounded-control border border-linie-control bg-suprafata px-3 py-2 text-control text-cerneala transition-colors duration-150 hover:border-cerneala hover:bg-menta-pal';

$body = capture(function () use ($home, $img, $childPrices, $sedation, $doctors, $h2, $link, $tile): void {
    ?>
<section aria-labelledby="titlu-acasa" class="px-3 pt-1 sm:px-4">
  <div class="relative isolate grid overflow-hidden rounded-mare bg-padure text-white lg:min-h-[min(88svh,920px)] lg:grid-cols-12">
    <div class="relative order-1 aspect-[4/3] sm:aspect-[16/9] lg:order-2 lg:col-span-5 lg:aspect-auto">
      <?= photo($img['acasa.principala'], '(min-width: 1024px) 42vw, 100vw', true, '', '50% 42%') ?>
    </div>
    <div class="order-2 flex flex-col justify-end px-6 pt-10 pb-28 sm:px-10 lg:order-1 lg:col-span-7 lg:px-16 lg:pt-28 lg:pb-36">
      <?= art('pereche', 'mb-8 w-48 text-menta sm:w-60 lg:mb-12 lg:w-72') ?>
      <h1 id="titlu-acasa" class="font-display text-mega">
        <?php foreach ($home['hero']['lines'] as $line) { ?><span class="block"><?= e($line) ?></span><?php } ?>
      </h1>
      <p class="mt-8 max-w-[44ch] text-lead text-padure-text"><?= e($home['hero']['lead']) ?></p>
      <div class="mt-10 flex flex-wrap gap-3">
        <a href="/programare" class="inline-flex h-14 items-center rounded-chip bg-menta px-8 text-control font-semibold text-pe-menta transition-colors duration-150 hover:bg-white focus-visible:outline-white">Programați-vă online</a>
        <a href="/servicii" class="inline-flex h-14 items-center rounded-chip border-[1.5px] border-white/60 px-8 text-control font-medium text-white transition-colors duration-150 hover:border-white hover:bg-white/10 focus-visible:outline-white">Vedeți serviciile</a>
      </div>
    </div>
    <div class="absolute right-6 bottom-6 z-10 hidden aspect-[4/3] w-[min(22vw,300px)] overflow-hidden rounded-mediu border-4 border-padure lg:block xl:right-10 xl:bottom-10">
      <?= photo($img['acasa.secundara'], '300px') ?>
    </div>
  </div>
  <div class="<?= CONTAINER ?> relative z-10 -mt-16 lg:-mt-24">
    <section aria-labelledby="programare-rapida" class="rounded-panou bg-suprafata p-5 shadow-float sm:p-6 lg:max-w-[78%] lg:p-8">
      <h2 id="programare-rapida" class="text-h3 font-semibold text-cerneala">Programați o consultație</h2>
      <div class="relative mt-5 grid gap-8 md:grid-cols-2 md:gap-0">
        <span aria-hidden="true" class="absolute inset-y-0 left-1/2 hidden w-px bg-linie md:block"></span>
        <?php $i = 0;
        foreach (clinics() as $slug => $c) { ?>
        <div class="<?= $i++ === 0 ? 'md:pr-8' : 'md:pl-8' ?>">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 class="font-display text-nume text-cerneala"><?= e($c['shortName']) ?></h3>
            <?php if ($c['hoursText']) { ?><p class="text-mic text-discret cifre"><?= e(strtok($c['hoursText'], "\n")) ?></p><?php } ?>
          </div>
          <ul class="grid grid-cols-2 gap-2">
            <li><a href="<?= e(tel_href($c['phone'])) ?>" class="<?= $tile ?>"><span class="text-mic text-discret">Sunați<span class="sr-only"> la <?= e($c['shortName']) ?></span></span><span class="telefon text-h3 font-semibold"><?= e(format_phone($c['phone'])) ?></span></a></li>
            <li><a href="/programare?clinica=<?= e($slug) ?>" class="<?= $tile ?>"><span class="text-mic text-discret">Cerere online</span><span class="text-h3 font-semibold">Vă sunăm noi<span class="sr-only">, la <?= e($c['shortName']) ?></span></span></a></li>
          </ul>
        </div>
        <?php } ?>
      </div>
    </section>
  </div>
</section>

<section aria-labelledby="ce-tratam" class="pt-sectiune">
  <div class="<?= CONTAINER ?>">
    <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 id="ce-tratam" class="<?= $h2 ?>"><?= e($home['services']['title']) ?></h2>
        <p class="mt-5 max-w-[52ch] text-lead text-discret"><?= e($home['services']['lead']) ?></p>
      </div>
      <p class="flex flex-wrap gap-x-8">
        <a href="/preturi" class="<?= $link ?>"><?= e($home['services']['allPrices']) ?></a>
        <a href="/servicii" class="<?= $link ?>">Toate serviciile</a>
      </p>
    </div>
    <?php service_grid([['slug' => 'implantologie', 'image' => $img['serviciu.implantologie']], ['slug' => 'inhalosedare', 'image' => $img['serviciu.inhalosedare']]], 'mt-12'); ?>
  </div>
</section>

<section aria-labelledby="confort" class="px-3 pt-sectiune sm:px-4">
  <div class="grid overflow-hidden rounded-mare bg-menta-pal lg:grid-cols-12">
    <div class="px-6 py-14 sm:px-10 lg:col-span-7 lg:px-16 lg:py-24">
      <h2 id="confort" class="<?= $h2 ?> max-w-[16ch]"><?= e($home['comfort']['question']) ?></h2>
      <p class="mt-6 mb-10 max-w-[46ch] text-lead text-discret"><?= e($home['comfort']['intro']) ?></p>
      <div data-confort>
        <ul class="flex flex-wrap gap-3" aria-labelledby="confort">
          <?php foreach ($home['comfort']['answers'] as $a) { ?>
          <li>
            <a href="<?= e(booking_href(['confort' => $a['value']])) ?>" data-alegere="<?= e($a['value']) ?>" aria-controls="confort-raspuns" class="apasat inline-flex min-h-control-l items-center gap-2.5 rounded-control border border-linie-control bg-suprafata px-5 py-2 text-left text-control font-medium text-cerneala transition-[background-color,border-color,box-shadow] duration-150 ease-filet hover:border-cerneala"><?= e($a['label']) ?></a>
          </li>
          <?php } ?>
        </ul>
        <div id="confort-raspuns" aria-live="polite" class="mt-6 min-h-0">
          <?php foreach ($home['comfort']['answers'] as $a) { ?>
          <div data-raspuns="<?= e($a['value']) ?>" hidden class="<?= e(cn('da-rise rounded-panou p-5 sm:p-6', $a['value'] === 'fara-emotii' ? 'bg-menta-pal' : 'bg-mustar-pal')) ?>">
            <p class="text-corp text-cerneala masura"><?= e($a['reply']) ?><?php if ($a['value'] === 'frica' && $sedation) { ?> <span class="font-semibold whitespace-nowrap cifre"><?= e($sedation) ?></span>.<?php } ?></p>
            <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="<?= e(booking_href(['confort' => $a['value']])) ?>" class="<?= e(btn('primary', 'l')) ?>"><?= e($a['cta']) ?></a>
              <?php if (!empty($a['link'])) { ?>
              <a href="<?= e($a['link']['href']) ?>" class="inline-flex min-h-control items-center gap-1.5 font-medium text-cerneala underline underline-offset-[0.2em] hover:decoration-2"><?= e($a['link']['label']) ?></a>
              <?php } ?>
            </div>
            <?php if ($a['value'] !== 'fara-emotii') { ?>
            <p class="mt-4 flex items-center gap-2 text-mic text-mustar-text"><?= icon('check', 18) ?>Medicul vede răspunsul înainte să intrați.</p>
            <?php } ?>
          </div>
          <?php } ?>
        </div>
      </div>
    </div>
    <div class="relative min-h-[22rem] lg:col-span-5">
      <?= photo($img['acasa.confort'], '(min-width: 1024px) 42vw, 100vw') ?>
    </div>
  </div>
</section>

<section aria-labelledby="medicii" class="pt-sectiune">
  <div class="<?= CONTAINER ?>">
    <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 id="medicii" class="<?= $h2 ?>"><?= e($home['doctors']['title']) ?></h2>
        <p class="mt-5 max-w-[52ch] text-lead text-discret"><?= e($home['doctors']['lead']) ?></p>
      </div>
      <a href="/echipa" class="<?= $link ?>"><?= e($home['doctors']['all']) ?></a>
    </div>
    <ul class="-mx-margine mt-12 flex snap-x snap-mandatory scroll-px-margine gap-gutter overflow-x-auto px-margine pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
      <?php foreach ($doctors as $d) { ?>
      <li class="flex w-[72%] shrink-0 snap-start sm:w-[40%] lg:w-auto"><?= doctor_figure($d, '(min-width: 1280px) 232px, (min-width: 768px) 30vw, 72vw', 'h3', 'w-full') ?></li>
      <?php } ?>
    </ul>
  </div>
</section>

<section aria-labelledby="prima-vizita" class="pt-sectiune">
  <div class="<?= CONTAINER ?> grid gap-12 lg:grid-cols-12 lg:items-center">
    <div class="relative aspect-[4/3] overflow-hidden rounded-mare bg-adancit lg:col-span-5 lg:aspect-[4/5]">
      <?= photo($img['acasa.tehnologie'], '(min-width: 1024px) 40vw, 100vw') ?>
    </div>
    <div class="lg:col-span-6 lg:col-start-7">
      <h2 id="prima-vizita" class="<?= $h2 ?>"><?= e($home['visit']['title']) ?></h2>
      <ol class="mt-10 flex flex-col">
        <?php foreach ($home['visit']['steps'] as $n => $s) { ?>
        <li class="grid grid-cols-[3.5rem_1fr] gap-x-4 border-t border-linie py-6">
          <span aria-hidden="true" class="font-display text-[2.5rem] leading-none text-menta cifre"><?= $n + 1 ?></span>
          <div>
            <h3 class="text-h3 font-semibold text-cerneala"><?= e($s['title']) ?></h3>
            <p class="mt-1 text-corp text-discret"><?= e($s['text']) ?></p>
          </div>
        </li>
        <?php } ?>
      </ol>
    </div>
  </div>
</section>

<section aria-labelledby="copiii" class="pt-sectiune">
  <div class="<?= CONTAINER ?> grid gap-12 lg:grid-cols-12 lg:items-center">
    <div class="lg:col-span-6">
      <h2 id="copiii" class="<?= $h2 ?>"><?= e($home['children']['title']) ?></h2>
      <div class="mt-8 flex flex-col gap-4">
        <?php foreach ($home['children']['body'] as $p) { ?><p class="text-corp text-cerneala masura"><?= e($p) ?></p><?php } ?>
      </div>
      <?php if ($childPrices !== []) { ?><?= price_table($childPrices, 'Prețuri pentru copii', 'mt-8 max-w-xl') ?><?php } ?>
      <a href="<?= e($home['children']['link']['href']) ?>" class="<?= $link ?> mt-4"><?= e($home['children']['link']['label']) ?></a>
    </div>
    <div class="relative aspect-[4/5] overflow-hidden rounded-mare bg-adancit lg:col-span-5 lg:col-start-8">
      <?= photo($img['acasa.copii'], '(min-width: 1024px) 40vw, 100vw', false, '', '50% 60%') ?>
    </div>
  </div>
</section>

<section aria-labelledby="clinicile" class="py-sectiune">
  <div class="<?= CONTAINER ?>">
    <h2 id="clinicile" class="<?= $h2 ?>"><?= e($home['clinics']['title']) ?></h2>
    <p class="mt-5 max-w-[52ch] text-lead text-discret"><?= e($home['clinics']['lead']) ?></p>
    <?php clinic_cards('h3', 'mt-12'); ?>
  </div>
</section>

<?php booking_band(); ?>
    <?php
});

$ld = json_ld(...array_merge(organization_ld(), array_map('dentist_ld', array_values(clinics()))));
render_page($body, page_meta(['title' => $home['title'], 'description' => $home['description'], 'path' => '/', 'absoluteTitle' => true]), $ld);
