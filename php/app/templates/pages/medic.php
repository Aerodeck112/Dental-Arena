<?php
/**
 * A doctor's profile (src/app/(site)/(pagini)/echipa/[slug]/page.tsx): portrait, role, bio once
 * supplied, the services. routes.php sets $doctor. No schedules and no per-doctor online booking
 * in the PHP version, so „Unde lucrează” is left out and the button goes to /programare.
 */
declare(strict_types=1);

/** @var array $doctor */

if (!function_exists('breadcrumbs_light')) {
    /** „Echipa / Dr. …” on a light page (src/components/ui/Breadcrumbs.tsx); the last item is the page. */
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

$portrait = $doctor['photoPath'] ? (content('portraits')[$doctor['photoPath']] ?? null) : null;
// Small source photos get a narrower frame so they are not blown up.
$maxFrame = (int) ($portrait['maxFrameWidth'] ?? 420);
$link = 'text-link underline underline-offset-[0.2em] hover:decoration-2';

$body = capture(function () use ($doctor, $maxFrame, $link): void {
    ?>
<div class="<?= CONTAINER ?> pt-6 pb-sectiune md:pt-10">
  <?= breadcrumbs_light([['href' => '/echipa', 'label' => 'Echipa'], ['label' => $doctor['publicName']]]) ?>
  <div class="mt-8 grid grid-cols-1 gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
    <div class="lg:col-span-4">
      <div style="max-width:<?= $maxFrame ?>px">
        <?= doctor_portrait($doctor, '(min-width: 1024px) 400px, 90vw', 'profile', true) ?>
      </div>
    </div>
    <div class="lg:col-span-7 lg:col-start-6">
      <h1 class="font-display text-h1 text-cerneala"><?= e($doctor['publicName']) ?></h1>
      <p class="mt-5 text-lead text-discret masura-lead"><?= e($doctor['roleLine']) ?></p>
      <?php if ($doctor['bio']) { ?><p class="mt-6 text-corp text-cerneala masura"><?= e($doctor['bio']) ?></p><?php } ?>
      <?php if ($doctor['services'] !== []) { ?>
      <dl class="mt-10 flex flex-col gap-6">
        <div>
          <dt class="text-control font-semibold text-cerneala">Servicii</dt>
          <dd class="mt-1 text-corp text-cerneala">
            <?php $n = count($doctor['services']);
            foreach ($doctor['services'] as $i => $s) { ?><span><a href="/<?= e($s['slug']) ?>" class="<?= $link ?>"><?= e($s['name']) ?></a><?= $i < $n - 1 ? ', ' : '' ?></span><?php } ?>
          </dd>
        </div>
      </dl>
      <?php } ?>
      <div class="mt-10 flex flex-wrap items-center gap-3">
        <a href="/programare" class="<?= e(btn('primary', 'l')) ?>">Programați o consultație</a>
        <?php call_menu('secondary', 'start'); ?>
      </div>
    </div>
  </div>
</div>
    <?php
});

$role = $doctor['roleLine'];
$roleLower = mb_strtolower(mb_substr($role, 0, 1)) . mb_substr($role, 1);
$meta = [
    'title' => "{$doctor['publicName']}, medic dentist",
    'description' => "{$doctor['publicName']}, {$roleLower}, la Dental Arena în Cristești și Luduș. Programați-vă online sau la telefon.",
    'path' => "/echipa/{$doctor['slug']}",
];
if ($portrait !== null) {
    $meta['image'] = ['src' => $doctor['photoPath'], 'width' => $portrait['width'], 'height' => $portrait['height'], 'alt' => $doctor['publicName']];
} elseif (($photo = doctor_photo($doctor)) !== null) {
    // A portrait uploaded in the panel: share it too.
    $meta['image'] = ['alt' => $doctor['publicName']] + $photo;
}

render_page(
    $body,
    page_meta($meta),
    json_ld(
        physician_ld($doctor),
        breadcrumb_ld([
            ['name' => 'Echipa', 'path' => '/echipa'],
            ['name' => $doctor['publicName'], 'path' => "/echipa/{$doctor['slug']}"],
        ]),
    ),
);
