<?php
/** All services (src/app/(site)/(pagini)/servicii/page.tsx): a two-column text index, one price each. */
declare(strict_types=1);

// ServiceIndex: only the categories that have a page, with the panel's summary or the page's own.
$rows = [];
foreach (catalog() as $slug => $c) {
    $sc = service_content($slug);
    if ($sc === null) {
        continue;
    }
    $rows[] = ['slug' => $slug, 'name' => $c['name'], 'summary' => trim((string) $c['summary']) !== '' ? $c['summary'] : $sc['summary'], 'representative' => $c['representative']];
}

$body = capture(function () use ($rows): void {
    service_hero([
        'breadcrumbs' => [['href' => '/', 'label' => 'Acasă'], ['label' => 'Servicii']],
        'title' => 'Servicii',
        'lead' => 'De la controlul periodic la implanturi, pentru adulți și copii. Lângă fiecare serviciu vedeți un preț din clinică; prețul exact îl aflați după consultație.',
        'bookingHref' => '/programare',
        'secondary' => null,
        'art' => 'pereche',
    ]);
    ?>
<div class="<?= CONTAINER ?> py-sectiune">
  <ul class="grid gap-x-gutter md:grid-cols-2 lg:gap-x-[calc(var(--spacing-gutter)*3)]">
    <?php foreach ($rows as $r) { ?>
    <li class="group relative flex flex-col border-t border-linie py-6">
      <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 class="text-h3 font-semibold text-cerneala">
          <a href="/<?= e($r['slug']) ?>" class="underline decoration-transparent decoration-1 underline-offset-[0.2em] group-hover:text-link group-hover:decoration-current after:absolute after:inset-0 after:content-['']"><?= e($r['name']) ?></a>
        </h2>
        <?php if ($r['representative']) { ?>
        <p class="ml-auto text-right text-mic text-discret"><span class="sr-only">Exemplu de preț: </span><?= e($r['representative']['name']) ?> <span class="font-semibold whitespace-nowrap text-cerneala cifre"><?= e($r['representative']['price']) ?></span></p>
        <?php } ?>
      </div>
      <p class="mt-2 text-corp text-discret masura"><?= e($r['summary']) ?></p>
    </li>
    <?php } ?>
  </ul>
</div>
<?php booking_band('Nu știți de ce aveți nevoie? Începeți cu o consultație.', href: booking_href()); ?>
    <?php
});

render_page(
    $body,
    page_meta([
        'title' => 'Servicii stomatologice în Cristești și Luduș',
        'description' => 'Servicii stomatologice în Cristești și Luduș: consultație, carii, implanturi, extracții, coroane, aparat dentar, copii, albire și inhalosedare, cu prețuri.',
        'path' => '/servicii',
    ]),
    json_ld(breadcrumb_ld([['name' => 'Servicii', 'path' => '/servicii']])),
);
