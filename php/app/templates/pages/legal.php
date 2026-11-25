<?php
/**
 * /termeni-si-conditii, /politica-de-confidentialitate, /politica-cookies (LegalPage.tsx): a
 * structured draft whose company details come from the panel's settings and read „[de completat]”
 * until an administrator enters them.
 */
declare(strict_types=1);

$docKey = ['/termeni-si-conditii' => 'termeni', '/politica-de-confidentialitate' => 'confidentialitate', '/politica-cookies' => 'cookies'][request_path()];
$doc = content("legal.{$docKey}");
$values = legal_values();

$body = capture(function () use ($doc, $values, $docKey): void {
    $updated = format_date($doc['updated']);
    ?>
<div class="<?= CONTAINER ?> pt-6 pb-sectiune md:pt-10">
  <nav aria-label="Cale de navigare" class="text-mic text-discret">
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <li class="inline-flex items-center gap-2"><a class="text-discret underline underline-offset-4 hover:text-link hover:decoration-2" href="/">Acasă</a><span aria-hidden="true" class="text-linie-control">/</span></li>
      <li class="inline-flex items-center gap-2"><span aria-current="page" class="text-cerneala"><?= e($doc['title']) ?></span></li>
    </ol>
  </nav>
  <div class="mt-8 grid grid-cols-1 gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
    <header class="lg:col-span-8">
      <h1 class="font-display text-h1 text-cerneala"><?= e($doc['title']) ?></h1>
      <p class="mt-4 text-mic text-discret cifre">Versiunea din <?= e($updated) ?></p>
      <?php if (!empty($doc['reviewNote'])) { ?>
      <p class="mt-6 flex gap-3 rounded-panou bg-adancit p-4 text-mic text-cerneala masura"><?= icon('info', 20, 'mt-0.5 shrink-0 text-discret') ?><?= e($doc['reviewNote']) ?></p>
      <?php } ?>
      <p class="mt-8 text-lead text-discret masura-lead"><?= e(fill_legal($doc['intro'], $values)) ?></p>
    </header>
    <nav aria-label="Cuprins" class="lg:col-span-3 lg:col-start-10 lg:row-span-2">
      <div class="lg:sticky lg:top-28">
        <p class="text-control font-semibold text-cerneala">Cuprins</p>
        <ol class="mt-2 flex flex-col text-mic">
          <?php foreach ($doc['sections'] as $s) { ?>
          <li><a href="#<?= e($s['id']) ?>" class="inline-flex min-h-control items-center text-link underline decoration-1 underline-offset-[0.2em] hover:decoration-2"><?= e($s['title']) ?></a></li>
          <?php } ?>
        </ol>
      </div>
    </nav>
    <div class="flex min-w-0 flex-col gap-12 lg:col-span-8">
      <?php foreach ($doc['sections'] as $s) { ?>
      <section id="<?= e($s['id']) ?>" aria-labelledby="<?= e($s['id']) ?>-titlu" class="scroll-mt-28">
        <h2 id="<?= e($s['id']) ?>-titlu" class="font-display text-h2 text-cerneala"><?= e($s['title']) ?></h2>
        <div class="mt-5 flex flex-col gap-4">
          <?php foreach ($s['blocks'] as $b) {
              if ($b['kind'] === 'p') { ?>
          <p class="text-corp text-cerneala masura"><?= e(fill_legal($b['text'], $values)) ?></p>
              <?php } elseif ($b['kind'] === 'ul') { ?>
          <ul class="flex list-disc flex-col gap-2 pl-6 text-corp text-cerneala masura marker:text-discret">
            <?php foreach ($b['items'] as $item) { ?><li><?= e(fill_legal($item, $values)) ?></li><?php } ?>
          </ul>
              <?php } else { ?>
          <div class="-mx-margine overflow-x-auto px-margine">
            <table class="w-full min-w-[36rem] border-collapse text-left text-mic text-cerneala">
              <caption class="mb-3 text-left text-mic text-discret"><?= e($b['caption']) ?></caption>
              <thead><tr class="border-b border-linie-control"><?php foreach ($b['head'] as $h) { ?><th scope="col" class="py-2 pr-4 align-bottom font-semibold"><?= e($h) ?></th><?php } ?></tr></thead>
              <tbody>
                <?php foreach ($b['rows'] as $row) { ?>
                <tr class="border-b border-linie align-top">
                  <?php foreach ($row as $j => $cell) {
                      if ($j === 0) { ?><th scope="row" class="py-3 pr-4 font-medium"><?= e(fill_legal($cell, $values)) ?></th><?php } else { ?><td class="py-3 pr-4"><?= e(fill_legal($cell, $values)) ?></td><?php }
                  } ?>
                </tr>
                <?php } ?>
              </tbody>
            </table>
          </div>
              <?php }
          } ?>
          <?php if ($docKey === 'cookies' && $s['id'] === 'control') { ?>
          <button type="button" data-cookie-settings class="inline-flex min-h-control items-center self-start font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">Setări cookie-uri</button>
          <?php } ?>
        </div>
      </section>
      <?php } ?>
    </div>
  </div>
</div>
    <?php
});

render_page($body, page_meta(['title' => $doc['seoTitle'], 'description' => $doc['description'], 'path' => '/' . $doc['slug']]), json_ld(breadcrumb_ld([['name' => $doc['title'], 'path' => '/' . $doc['slug']]])));
