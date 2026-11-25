<?php
/** The team (src/app/(site)/(pagini)/echipa/page.tsx): five 4:5 portraits on one eye-line. */
declare(strict_types=1);

$doctors = public_doctors();
// The assistants shown on the site (Echipa → Asistentele), under the doctors.
$assistants = [];
if (INSTALLED) {
    try {
        $assistants = db_all('SELECT * FROM team_assistants WHERE public_visible = 1 ORDER BY sort_order, last_name, id');
    } catch (Throwable $e) {
        $assistants = [];
    }
}

$body = capture(function () use ($doctors, $assistants): void {
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
  <?php if ($assistants !== []) { ?>
  <h2 class="mt-20 font-display text-h2 text-cerneala">Asistentele</h2>
  <p class="mt-2 max-w-2xl text-corp text-discret">Vă primesc, vă pregătesc pentru tratament și au grijă ca totul să fie steril și la locul lui.</p>
  <ul class="mt-8 grid grid-cols-2 gap-x-gutter gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
    <?php foreach ($assistants as $a) { $name = trim($a['first_name'] . ' ' . $a['last_name']); ?>
    <li>
      <div class="relative aspect-[4/5] w-full overflow-hidden rounded-foto bg-menta-pal">
        <?php if ($a['photo_path']) { ?><?= photo(['src' => (string) $a['photo_path'], 'alt' => 'Portretul asistentei: ' . $name], '(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw') ?><?php } else { ?><div aria-hidden="true" class="flex size-full items-center justify-center font-display text-[3rem] leading-none text-cerneala"><?= e(mb_substr($a['first_name'], 0, 1) . mb_substr($a['last_name'], 0, 1)) ?></div><?php } ?>
      </div>
      <h3 class="mt-4 text-h3 font-semibold text-cerneala"><?= e($name) ?></h3>
      <p class="text-corp text-discret"><?= e($a['role_line']) ?></p>
    </li>
    <?php } ?>
  </ul>
  <?php } ?>
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
