<?php
/** The 2024 anniversary (src/app/(site)/(pagini)/15ani/page.tsx), told in the past tense: never a live offer. */
declare(strict_types=1);

if (!function_exists('breadcrumbs_light')) {
    /** „Despre noi / 15 ani” on a light page (src/components/ui/Breadcrumbs.tsx); the last item is the page. */
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

$a = content('anniversary');
$link = 'text-link underline underline-offset-[0.2em] hover:decoration-2';

$body = capture(function () use ($a, $link): void {
    $cel = $a['celebration'];
    // The closing sentence links its last words to the price list.
    $tail = 'pe pagina de prețuri.';
    $linked = str_ends_with($cel['closed'], $tail);
    ?>
<div class="<?= CONTAINER ?> pt-6 pb-sectiune md:pt-10">
  <?= breadcrumbs_light([['href' => '/despre-noi', 'label' => 'Despre noi'], ['label' => '15 ani']]) ?>
  <div class="mt-8 grid grid-cols-1 gap-x-gutter gap-y-12 lg:mt-12 lg:grid-cols-12">
    <div class="lg:col-span-7">
      <h1 class="font-display text-h1 text-cerneala"><?= e($a['title']) ?></h1>
      <p class="mt-6 text-lead text-discret masura-lead"><?= e($a['lead']) ?></p>

      <section aria-labelledby="sarbatoare" class="mt-16">
        <h2 id="sarbatoare" class="font-display text-h2 text-cerneala"><?= e($cel['title']) ?></h2>
        <p class="mt-5 text-corp text-cerneala masura"><?= e($cel['intro']) ?></p>
        <dl class="mt-6 flex flex-col gap-5">
          <?php foreach ($cel['items'] as $i) { ?>
          <div>
            <dt class="text-control font-semibold text-cerneala"><?= e($i['title']) ?></dt>
            <dd class="mt-1 text-corp text-cerneala masura"><?= e($i['text']) ?></dd>
          </div>
          <?php } ?>
        </dl>
        <p class="mt-8 rounded-panou bg-adancit p-5 text-corp text-cerneala masura"><?php if ($linked) { ?><?= e(substr($cel['closed'], 0, -strlen($tail))) ?>pe <a href="/preturi" class="<?= $link ?>">pagina de prețuri</a>.<?php } else { ?><?= e($cel['closed']) ?><?php } ?></p>
      </section>
    </div>
    <figure class="lg:col-span-4 lg:col-start-9">
      <div class="relative aspect-[3/4] w-full overflow-hidden rounded-foto bg-adancit">
        <?= photo($a['images']['main'], '(min-width: 1024px) 412px, 100vw', true) ?>
      </div>
    </figure>
  </div>

  <section aria-labelledby="valori" class="mt-sectiune">
    <h2 id="valori" class="font-display text-h2 text-cerneala"><?= e($a['values']['title']) ?></h2>
    <ul class="mt-10 grid grid-cols-1 gap-x-gutter gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      <?php foreach ($a['values']['items'] as $v) { ?>
      <li>
        <h3 class="font-display text-nume text-cerneala"><?= e($v['title']) ?></h3>
        <p class="mt-2 text-corp text-cerneala"><?= e($v['text']) ?></p>
      </li>
      <?php } ?>
    </ul>
  </section>

  <div class="mt-sectiune grid grid-cols-1 items-center gap-x-gutter gap-y-8 lg:grid-cols-12">
    <figure class="lg:col-span-5">
      <div class="relative aspect-[4/5] w-full overflow-hidden rounded-foto bg-adancit">
        <?= photo($a['images']['second'], '(min-width: 1024px) 520px, 100vw') ?>
      </div>
    </figure>
    <div class="lg:col-span-6 lg:col-start-7">
      <p class="font-display text-h2 text-cerneala"><?= e($a['closing']) ?></p>
      <a href="/despre-noi" class="mt-6 inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">Despre clinica noastră</a>
    </div>
  </div>
</div>
    <?php
});

render_page(
    $body,
    page_meta(['title' => $a['seoTitle'], 'description' => $a['description'], 'path' => '/15ani', 'image' => $a['images']['main']]),
    json_ld(breadcrumb_ld([['name' => 'Despre noi', 'path' => '/despre-noi'], ['name' => '15 ani', 'path' => '/15ani']])),
);
