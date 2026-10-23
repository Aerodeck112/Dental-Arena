<?php
/** Any unknown address (src/app/not-found.tsx): the moss wall with the logo, and a way on. Status 404 is set by routes.php. */
declare(strict_types=1);

$body = capture(function (): void {
    $link = 'inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2';
    ?>
<div class="<?= CONTAINER ?> grid grid-cols-1 items-center gap-x-gutter gap-y-10 py-sectiune lg:grid-cols-12">
  <div class="lg:col-span-6">
    <h1 class="font-display text-h1 text-cerneala">Pagina aceasta nu există.</h1>
    <p class="mt-6 text-lead text-discret masura-lead">Poate a fost mutată când am refăcut site-ul. Găsiți serviciile, prețurile și programarea de mai jos.</p>
    <div class="mt-8 flex flex-wrap items-center gap-3">
      <a href="/" class="<?= e(btn('primary', 'l')) ?>">Mergeți la prima pagină</a>
      <a href="/programare" class="<?= e(btn('secondary', 'l')) ?>">Programați-vă</a>
    </div>
    <ul class="mt-8 flex flex-wrap gap-x-6">
      <?php foreach (['/servicii' => 'Servicii', '/preturi' => 'Prețuri', '/echipa' => 'Echipa', '/contact' => 'Contact'] as $href => $label) { ?>
      <li><a href="<?= $href ?>" class="<?= $link ?>"><?= e($label) ?></a></li>
      <?php } ?>
    </ul>
    <ul class="mt-6 flex flex-wrap gap-x-8">
      <?php foreach (clinics() as $c) { ?><li><?= phone_link_full($c, true, true) ?></li><?php } ?>
    </ul>
  </div>
  <figure class="lg:col-span-4 lg:col-start-9">
    <div class="relative aspect-[3/4] w-full overflow-hidden rounded-foto bg-adancit">
      <?= photo(['src' => '/images/clinica/perete-muschi.jpg', 'alt' => 'Peretele de mușchi viu din clinică, cu sigla Dental Arena'], '(min-width: 1024px) 412px, 100vw') ?>
    </div>
  </figure>
</div>
    <?php
});

render_page($body, page_meta(['title' => 'Pagina nu există', 'description' => 'Pagina căutată nu există pe site-ul Dental Arena.', 'path' => request_path(), 'noindex' => true]));
