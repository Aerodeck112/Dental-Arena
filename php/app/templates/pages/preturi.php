<?php
/**
 * /preturi (src/app/(site)/(pagini)/preturi/page.tsx): every price, grouped by service, with the
 * search of PriceSearch (site.js). Without JavaScript the whole list shows and the field stays hidden.
 */
declare(strict_types=1);

$categories = array_values(array_filter(catalog(), static fn ($c) => $c['prices'] !== []));

$body = capture(function () use ($categories): void {
    service_hero([
        'breadcrumbs' => [['href' => '/', 'label' => 'Acasă'], ['label' => 'Prețuri']],
        'title' => 'Prețuri',
        'lead' => 'Prețurile sunt orientative și includ manopera. Costul exact îl aflați după consultație și, unde este nevoie, după radiografii.',
        'bookingHref' => '/programare',
        'secondary' => null,
        'art' => 'culori',
    ]);
    ?>
<div class="<?= CONTAINER ?> py-sectiune">
  <form role="search" data-doar-js hidden class="max-w-xl" onsubmit="return false">
    <label for="cauta-pret" class="mb-2 block text-control font-medium text-cerneala">Căutați un tratament</label>
    <div class="relative">
      <?= icon('search', 20, 'pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-discret') ?>
      <input id="cauta-pret" type="search" data-cauta-pret autocomplete="off" enterkeyhint="search" aria-describedby="cauta-pret-stare" placeholder="de exemplu: extracție, coroană, aparat" class="<?= e(input_classes('h-control pl-11')) ?>">
    </div>
    <p id="cauta-pret-stare" role="status" class="mt-2 text-mic text-discret cifre"></p>
  </form>
  <div data-niciun-pret hidden class="mt-10 max-w-xl rounded-panou bg-suprafata p-6">
    <p class="text-h3 font-semibold text-cerneala">Nu am găsit acest tratament în lista de prețuri.</p>
    <p class="mt-2 text-corp text-cerneala">Încercați alt cuvânt sau <a href="/contact#clinici" class="text-link underline underline-offset-[0.2em] hover:decoration-2">sunați-ne</a>: vă spunem prețul la telefon.</p>
  </div>
  <div class="mt-6 flex flex-col gap-14">
    <?php foreach ($categories as $c) { ?>
    <section aria-labelledby="grup-<?= e($c['slug']) ?>" data-grup-pret="<?= e(mb_strtolower($c['name'])) ?>" class="grid gap-x-gutter gap-y-3 lg:grid-cols-12">
      <div class="lg:col-span-4">
        <h2 id="grup-<?= e($c['slug']) ?>" class="font-display text-nume text-cerneala"><?= e($c['name']) ?></h2>
        <a href="/<?= e($c['slug']) ?>" class="mt-1 inline-flex min-h-control items-center text-mic text-link underline underline-offset-[0.2em] hover:decoration-2">Despre <?= e(mb_strtolower($c['name'])) ?></a>
      </div>
      <?= price_table($c['prices'], "Prețuri: {$c['name']}", 'lg:col-span-8') ?>
    </section>
    <?php } ?>
  </div>
</div>
<?php booking_band(); ?>
    <?php
});

render_page($body, page_meta([
    'title' => 'Prețuri stomatologie: lista completă',
    'description' => 'Prețuri stomatologie în Cristești și Luduș: consultație, obturații, tratament de canal, implant dentar, coroane, aparat dentar, albire și inhalosedare.',
    'path' => '/preturi',
]), json_ld(breadcrumb_ld([['name' => 'Prețuri', 'path' => '/preturi']])));
