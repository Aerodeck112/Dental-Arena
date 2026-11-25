<?php
/** About the clinic (src/app/(site)/(pagini)/despre-noi/page.tsx): the story and „Fără durere / Fără frică / Precizie”. */
declare(strict_types=1);

$about = content('about');
$main = site_image('despre.principala');
$second = site_image('despre.secundara');
$link = 'inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2';

$body = capture(function () use ($about, $main, $second, $link): void {
    service_hero([
        'breadcrumbs' => [['href' => '/', 'label' => 'Acasă'], ['label' => $about['title']]],
        'title' => $about['title'],
        'lead' => $about['lead'],
        'image' => $main,
        'bookingHref' => '/programare',
        'secondary' => ['href' => '/echipa', 'label' => 'Cunoașteți medicii'],
    ]);
    ?>
<div class="<?= CONTAINER ?> py-sectiune">
  <div class="grid items-center gap-x-gutter gap-y-12 lg:grid-cols-12">
    <div class="relative aspect-[4/3] overflow-hidden rounded-mare bg-adancit lg:col-span-5">
      <?= photo($second, '(min-width: 1024px) 40vw, 100vw') ?>
    </div>
    <div class="flex flex-col gap-5 lg:col-span-6 lg:col-start-7">
      <?php foreach ($about['story'] as $p) { ?><p class="text-corp text-cerneala masura"><?= e($p) ?></p><?php } ?>
      <p class="text-corp font-semibold text-cerneala masura"><?= e($about['years']['text']) ?></p>
      <a href="<?= e($about['years']['link']['href']) ?>" class="<?= $link ?>"><?= e($about['years']['link']['label']) ?></a>
    </div>
  </div>
</div>

<section aria-labelledby="principii" class="bg-suprafata py-sectiune">
  <div class="<?= CONTAINER ?>">
    <h2 id="principii" class="font-display text-h2 text-cerneala"><?= e($about['principlesTitle']) ?></h2>
    <ul class="mt-12 grid grid-cols-1 gap-x-gutter gap-y-14 md:grid-cols-3">
      <?php foreach ($about['principles'] as $p) { ?>
      <li>
        <div class="relative aspect-[4/3] w-full overflow-hidden rounded-mare bg-adancit">
          <?= photo($p['image'], '(min-width: 768px) 400px, 100vw') ?>
        </div>
        <h3 class="mt-6 font-display text-nume text-cerneala"><?= e($p['title']) ?></h3>
        <p class="mt-3 text-corp text-cerneala"><?= e($p['text']) ?></p>
      </li>
      <?php } ?>
    </ul>
  </div>
</section>

<section aria-labelledby="echipa" class="py-sectiune">
  <div class="<?= CONTAINER ?> grid gap-x-gutter gap-y-6 lg:grid-cols-12">
    <h2 id="echipa" class="font-display text-h2 text-cerneala lg:col-span-4"><?= e($about['teamTitle']) ?></h2>
    <div class="lg:col-span-7 lg:col-start-6">
      <p class="text-lead text-discret masura-lead"><?= e($about['teamText']) ?></p>
      <a href="/echipa" class="<?= $link ?> mt-2">Cunoașteți medicii</a>
    </div>
  </div>
</section>

<section aria-labelledby="unde" class="py-sectiune">
  <div class="<?= CONTAINER ?>">
    <h2 id="unde" class="font-display text-h2 text-cerneala"><?= e($about['clinicsTitle']) ?></h2>
    <?php clinic_cards('h3', 'mt-12'); ?>
  </div>
</section>

<?php booking_band(); ?>
    <?php
});

render_page(
    $body,
    page_meta(['title' => $about['seoTitle'], 'description' => $about['description'], 'path' => '/despre-noi', 'image' => $about['heroImage']]),
    json_ld(breadcrumb_ld([['name' => 'Despre noi', 'path' => '/despre-noi']])),
);
