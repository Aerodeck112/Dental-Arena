<?php
/** The team (src/app/(site)/(pagini)/echipa/page.tsx): five 4:5 portraits on one eye-line. */
declare(strict_types=1);

$doctors = public_doctors();

$body = capture(function () use ($doctors): void {
    service_hero([
        'breadcrumbs' => [['href' => '/', 'label' => 'Acasă'], ['label' => 'Echipa']],
        'title' => 'Medicii',
        'lead' => 'Cinci medici, în Cristești și Luduș. Respectăm ora programării, iar medicii noștri au acea „mână ușoară” pe care o căutați.',
        'bookingHref' => '/programare',
        'secondary' => null,
        'art' => 'consult',
    ]);
    ?>
<div class="<?= CONTAINER ?> py-sectiune">
  <ul class="grid grid-cols-1 gap-x-gutter gap-y-14 sm:grid-cols-2 lg:grid-cols-5">
    <?php foreach ($doctors as $d) { ?>
    <li class="flex"><?= doctor_figure($d, '(min-width: 1280px) 232px, (min-width: 1024px) 18vw, (min-width: 640px) 45vw, 100vw', 'h2', 'w-full') ?></li>
    <?php } ?>
  </ul>
</div>
<?php booking_band('Programați-vă la medicul dumneavoastră'); ?>
    <?php
});

render_page(
    $body,
    page_meta([
        'title' => 'Medicii dentiști din Cristești și Luduș',
        'description' => 'Cei cinci medici dentiști Dental Arena din Cristești și Luduș: stomatologie generală, implanturi, chirurgie și ortodonție. Programare direct la medic.',
        'path' => '/echipa',
    ]),
    json_ld(breadcrumb_ld([['name' => 'Echipa', 'path' => '/echipa']])),
);
