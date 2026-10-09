<?php
/**
 * The frame of every public page: header with the menus, footer, the phone's sticky bar with its
 * call sheet, and the cookie banner. Same markup as src/components/site (SiteHeader, SiteFooter,
 * MobileMenu, CallMenu, ServicesMenu, StickyCallBar, CallSheet, CookieConsent); the behaviour is in
 * public_html/assets/site.js.
 */
declare(strict_types=1);

function nav_is_current(string $href, string $path): bool
{
    if ($href === '/servicii') {
        return $path === '/servicii' || in_array(ltrim($path, '/'), service_slugs(), true);
    }
    $p = explode('#', $href)[0];
    if ($p === '/echipa') {
        return $path === '/echipa' || str_starts_with($path, '/echipa/');
    }
    return $path === $p;
}

function site_header(string $path): void
{
    ?>
<header data-print="ascuns" class="sticky top-0 z-40 bg-fundal/95 backdrop-blur-sm">
  <div class="<?= CONTAINER ?> flex h-20 items-center gap-4 xl:h-24">
    <a href="/" aria-label="Dental Arena, prima pagină" class="-ml-1 inline-flex min-h-control shrink-0 items-center rounded-control px-1">
      <?= logo('h-12 w-auto xl:h-14', true, '150px') ?>
    </a>
    <nav aria-label="Principal" class="ml-8 hidden xl:block">
      <ul class="flex items-center gap-1">
        <li><?php services_menu(nav_is_current('/servicii', $path), $path); ?></li>
        <?php foreach (content('mainNav') as $l) {
            if ($l['href'] === '/servicii') {
                continue;
            }
            $here = nav_is_current($l['href'], $path); ?>
        <li>
          <a href="<?= e($l['href']) ?>"<?= $here && !str_contains($l['href'], '#') ? ' aria-current="page"' : '' ?> class="<?= e(cn('flex min-h-control items-center rounded-control px-2 text-control font-medium hover:text-link', $here ? 'text-link underline decoration-2 underline-offset-[0.4em]' : 'text-cerneala')) ?>"><?= e($l['label']) ?></a>
        </li>
        <?php } ?>
      </ul>
    </nav>
    <div class="ml-auto flex items-center gap-2 md:gap-4">
      <?php call_menu('text', 'end', 'hidden md:block'); ?>
      <span class="hidden md:block">
        <a href="/programare" class="inline-flex h-12 items-center rounded-chip bg-actiune px-6 text-control font-semibold text-pe-actiune transition-colors duration-150 hover:bg-actiune-apasat">Programați-vă</a>
      </span>
      <?php mobile_menu($path); ?>
    </div>
  </div>
</header>
    <?php
}

function services_menu(bool $current, string $path): void
{
    ?>
<details class="group/menu relative" data-dismiss>
  <summary class="<?= e(cn('flex min-h-control list-none items-center gap-1.5 rounded-control px-2 text-control font-medium', 'hover:text-link group-open/menu:text-link', $current ? 'text-link underline decoration-2 underline-offset-[0.4em]' : 'text-cerneala')) ?>">
    Servicii
    <?= icon('chevron-down', 18, 'transition-transform duration-200 ease-filet group-open/menu:rotate-180') ?>
  </summary>
  <div class="da-rise absolute top-full left-[-1.5rem] z-50 mt-3 w-[42rem] max-w-[calc(100vw-2*var(--spacing-margine))] rounded-panou border border-linie bg-suprafata p-6 shadow-float">
    <ul class="grid grid-flow-col grid-cols-2 grid-rows-5 gap-x-8">
      <?php foreach (content('services') as $s) {
          $here = $path === "/{$s['slug']}"; ?>
      <li>
        <a href="/<?= e($s['slug']) ?>"<?= $here ? ' aria-current="page"' : '' ?> class="<?= e(cn('flex min-h-control items-center text-control text-cerneala underline-offset-4 hover:text-link hover:underline', $here ? 'font-semibold text-link underline' : '')) ?>"><?= e($s['title']) ?></a>
      </li>
      <?php } ?>
    </ul>
    <p class="mt-4 flex flex-wrap gap-x-8 border-t border-linie pt-4">
      <a href="/servicii" class="inline-flex min-h-control items-center font-medium text-link underline underline-offset-4 hover:decoration-2">Toate serviciile</a>
      <a href="/preturi" class="inline-flex min-h-control items-center font-medium text-link underline underline-offset-4 hover:decoration-2">Toate prețurile</a>
    </p>
  </div>
</details>
    <?php
}

/** „Sunați”: one row per clinic. variant text (header) or secondary (beside a booking button). */
function call_menu(string $variant = 'text', string $align = 'end', string $class = ''): void
{
    $summary = $variant === 'secondary'
        ? btn('secondary', 'm')
        : 'flex min-h-control items-center gap-1.5 rounded-control px-2 text-control font-medium text-cerneala hover:text-link group-open/call:text-link';
    ?>
<details class="<?= e(cn('group/call relative', $class)) ?>" data-dismiss>
  <summary class="<?= e(cn('list-none', $summary)) ?>">
    <?= icon('phone', 20) ?>
    Sunați
    <?= icon('chevron-down', 18, 'transition-transform duration-200 ease-filet group-open/call:rotate-180') ?>
  </summary>
  <div class="<?= e(cn('da-rise absolute top-full z-50 mt-3 w-[22rem] max-w-[calc(100vw-2*var(--spacing-margine))]', 'rounded-panou border border-linie bg-suprafata p-2 shadow-float', $align === 'end' ? 'right-0' : 'left-0')) ?>">
    <ul>
      <?php foreach (clinics() as $c) { ?>
      <li><?= phone_link($c, 'flex min-h-control-l items-center justify-between gap-6 rounded-control px-4 text-control hover:bg-menta-pal', '<span class="font-medium">' . e($c['shortName']) . '</span><span class="telefon font-semibold">' . e(format_phone($c['phone'])) . '</span>') ?></li>
      <?php } ?>
    </ul>
  </div>
</details>
    <?php
}

function mobile_menu(string $path): void
{
    $links = array_values(array_filter(content('mainNav'), static fn ($l) => $l['href'] !== '/servicii'));
    $links[] = ['href' => '/contact', 'label' => 'Contact'];
    ?>
<a href="#navigare-subsol" data-open-dialog="meniu-mobil" aria-haspopup="dialog" class="apasat inline-flex min-h-control items-center gap-2 rounded-control px-3 text-control font-medium text-cerneala hover:bg-adancit xl:hidden">
  <?= icon('menu', 22) ?>
  Meniu
</a>
<dialog id="meniu-mobil" aria-labelledby="meniu-mobil-titlu" class="da-overlay fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-fundal p-0 text-cerneala open:da-rise">
  <div class="flex min-h-full flex-col px-margine pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
    <div class="flex h-20 shrink-0 items-center justify-between gap-4">
      <a href="/" aria-label="Dental Arena, prima pagină"><?= logo('h-10 w-auto', false, '110px') ?></a>
      <button type="button" data-close-dialog class="apasat inline-flex min-h-control items-center gap-2 rounded-control px-3 text-control font-medium hover:bg-adancit">
        <?= icon('x', 22) ?>
        Închideți
      </button>
    </div>
    <h2 id="meniu-mobil-titlu" class="sr-only">Meniu</h2>
    <nav aria-label="Principal" class="mt-2">
      <ul class="flex flex-col">
        <?php foreach ($links as $l) {
            $p = explode('#', $l['href'])[0];
            $here = $path === $p && !str_contains($l['href'], '#'); ?>
        <li>
          <a href="<?= e($l['href']) ?>"<?= $here ? ' aria-current="page"' : '' ?> class="<?= e(cn('flex min-h-control-l items-center font-display text-nume', $here ? 'text-link underline decoration-2 underline-offset-[0.3em]' : 'text-cerneala')) ?>"><?= e($l['label']) ?></a>
        </li>
        <?php } ?>
      </ul>
    </nav>
    <section aria-labelledby="meniu-mobil-servicii" class="mt-6">
      <h3 id="meniu-mobil-servicii">
        <a href="/servicii" class="<?= e(cn('font-display text-nume', $path === '/servicii' ? 'text-link underline decoration-2 underline-offset-[0.3em]' : 'text-cerneala')) ?>">Servicii</a>
      </h3>
      <ul class="mt-2 grid grid-cols-1 gap-x-6 min-[30rem]:grid-cols-2">
        <?php foreach (content('services') as $s) { ?>
        <li>
          <a href="/<?= e($s['slug']) ?>"<?= $path === "/{$s['slug']}" ? ' aria-current="page"' : '' ?> class="flex min-h-control items-center text-control text-cerneala underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-link aria-[current=page]:underline"><?= e($s['title']) ?></a>
        </li>
        <?php } ?>
      </ul>
    </section>
    <div class="mt-auto pt-8">
      <ul class="grid grid-cols-2 gap-2">
        <?php foreach (clinics() as $c) { ?>
        <li><?= phone_link($c, 'flex min-h-control-l flex-col justify-center rounded-control border border-linie-control px-3 py-2 hover:border-cerneala', '<span class="text-mic text-discret">' . e($c['shortName']) . '</span><span class="telefon text-control font-semibold">' . e(format_phone($c['phone'])) . '</span>') ?></li>
        <?php } ?>
      </ul>
      <a href="/programare" class="<?= e(btn('primary', 'l', 'mt-3 w-full')) ?>">Programați-vă</a>
    </div>
  </div>
</dialog>
    <?php
}

function site_footer(): void
{
    $link = 'inline-flex min-h-control items-center underline decoration-1 underline-offset-[0.25em] hover:decoration-2';
    $site = content('site');
    $i = 0;
    ?>
<footer data-print="ascuns" class="bg-fundal pt-16 pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-cerneala md:pt-20 md:pb-12">
  <div class="<?= CONTAINER ?>">
    <div class="flex flex-col items-center text-center">
      <a href="/" aria-label="Dental Arena, prima pagină" class="rounded-control p-1"><?= logo('h-auto w-[240px] md:w-[300px]', false, '(min-width: 768px) 300px, 240px') ?></a>
      <p class="mt-5 font-display text-nume"><?= e($site['tagline']) ?></p>
    </div>
    <ul class="relative mt-14 grid grid-cols-1 gap-y-10 md:grid-cols-2">
      <span aria-hidden="true" class="absolute inset-y-0 left-1/2 hidden w-px bg-linie md:block"></span>
      <?php foreach (clinics() as $c) { ?>
      <li class="<?= $i++ === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12' ?>">
        <h2 class="font-display text-nume"><?= e($c['shortName']) ?></h2>
        <p class="mt-2 text-corp"><?= e(clinic_address($c)) ?><?= $c['area'] ? '<span class="block">' . e($c['area']) . '</span>' : '' ?></p>
        <?= phone_link($c, "{$link} telefon text-h3 font-semibold") ?>
      </li>
      <?php } ?>
    </ul>
    <div class="mt-14 grid gap-x-gutter gap-y-8 lg:grid-cols-12">
      <div class="lg:col-span-4">
        <a href="mailto:<?= e($site['email']) ?>" class="<?= $link ?> text-corp font-medium"><?= e($site['email']) ?></a>
        <ul class="flex flex-wrap gap-x-6">
          <li><a href="<?= e($site['facebookUrl']) ?>" target="_blank" rel="noopener noreferrer" class="<?= $link ?>">Facebook<span class="sr-only"> (se deschide într-o filă nouă)</span></a></li>
          <li><a href="<?= e($site['instagramUrl']) ?>" target="_blank" rel="noopener noreferrer" class="<?= $link ?>">Instagram<span class="sr-only"> (se deschide într-o filă nouă)</span></a></li>
        </ul>
      </div>
      <nav id="navigare-subsol" aria-label="Subsol" class="lg:col-span-8">
        <ul class="flex flex-wrap gap-x-6 gap-y-0 lg:justify-end">
          <?php foreach (content('footerNav') as $l) { ?>
          <li><a href="<?= e($l['href']) ?>" class="<?= $link ?> text-control"><?= e($l['label']) ?></a></li>
          <?php } ?>
        </ul>
      </nav>
    </div>
    <div class="mt-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <ul class="flex flex-wrap items-center gap-3">
        <?php foreach (content('anpc') as $b) { ?>
        <li>
          <a href="<?= e($b['href']) ?>" target="_blank" rel="noopener noreferrer" aria-label="<?= e($b['alt'] . ' (se deschide într-o filă nouă)') ?>" class="block rounded-control">
            <img src="<?= e($b['src']) ?>" alt="" width="300" height="76" loading="lazy" decoding="async" class="h-[50px] w-auto rounded-control">
          </a>
        </li>
        <?php } ?>
      </ul>
      <ul class="flex flex-wrap gap-x-6">
        <?php foreach (content('legalNav') as $l) { ?>
        <li><a href="<?= e($l['href']) ?>" class="<?= $link ?>"><?= e($l['label']) ?></a></li>
        <?php } ?>
        <li><button type="button" data-cookie-settings class="inline-flex min-h-control items-center underline underline-offset-[0.2em] hover:decoration-2">Setări cookie-uri</button></li>
      </ul>
    </div>
    <p class="mt-6 text-legal">© <?= date('Y') ?> <?= e($site['brandName']) ?>. Toate drepturile rezervate.</p>
  </div>
</footer>
    <?php
}

function sticky_call_bar(): void
{
    ?>
<div data-print="ascuns" class="fixed inset-x-0 bottom-0 z-40 border-t border-linie bg-suprafata px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-float md:hidden">
  <div class="mx-auto grid max-w-lg grid-cols-2 gap-2">
    <a href="/contact#clinici" data-open-dialog="ce-clinica" aria-haspopup="dialog" class="<?= e(btn('secondary', 'l', 'w-full')) ?>"><?= icon('phone', 22) ?>Sunați</a>
    <a href="/programare" class="<?= e(btn('primary', 'l', 'w-full')) ?>">Programați-vă</a>
  </div>
</div>
<dialog id="ce-clinica" aria-labelledby="ce-clinica-titlu" class="da-overlay fixed inset-x-0 top-auto bottom-0 m-0 h-auto max-h-[85dvh] w-full max-w-none rounded-t-panou border-t border-linie bg-suprafata p-0 text-cerneala shadow-float open:da-rise">
  <div class="px-margine pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
    <div class="flex items-center justify-between gap-4">
      <h2 id="ce-clinica-titlu" class="font-display text-nume">Ce clinică sunați?</h2>
      <button type="button" data-close-dialog aria-label="Închideți" class="apasat -mr-2 inline-flex size-control shrink-0 items-center justify-center rounded-control text-discret hover:bg-adancit hover:text-cerneala"><?= icon('x', 22) ?></button>
    </div>
    <ul class="mt-3 flex flex-col gap-2">
      <?php foreach (clinics() as $c) { ?>
      <li><?= phone_link($c, 'apasat flex min-h-control-l items-center justify-between gap-4 rounded-control border border-linie-control px-4 text-control hover:border-cerneala hover:bg-menta-pal', '<span class="inline-flex items-center gap-3 font-medium">' . icon('phone', 20, 'text-discret') . e($c['shortName']) . '</span><span class="telefon font-semibold">' . e(format_phone($c['phone'])) . '</span>') ?></li>
      <?php } ?>
    </ul>
  </div>
</dialog>
    <?php
}

/** The cookie banner: hidden until site.js finds no saved choice (cookie da_consent). */
function cookie_banner(): void
{
    ?>
<div id="cookie-uri" role="region" aria-labelledby="cookie-uri-titlu" aria-describedby="cookie-uri-text" tabindex="-1" data-print="ascuns" hidden
  class="da-rise fixed inset-x-3 z-50 max-h-[calc(100dvh-7rem)] overflow-y-auto outline-none bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-margine md:right-auto md:w-[34rem] rounded-panou border border-linie bg-suprafata p-5 text-cerneala shadow-float sm:p-6">
  <h2 id="cookie-uri-titlu" class="text-h3 font-semibold">Cookie-uri</h2>
  <p id="cookie-uri-text" class="mt-2 text-corp">
    Folosim doar cookie-urile fără de care site-ul nu funcționează. Harta Google de pe pagina de contact poate seta cookie-uri proprii, de aceea o încărcăm doar cu acordul dumneavoastră.
    <a href="/politica-cookies" class="text-link underline underline-offset-[0.2em] hover:decoration-2">Politica cookies</a>
  </p>
  <fieldset data-cookie-panel hidden class="mt-4 flex flex-col gap-3 border-t border-linie pt-4">
    <legend class="sr-only">Setări cookie-uri</legend>
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-control font-semibold">Necesare</p>
        <p class="text-mic text-discret">Țin minte alegerea de față. Fără ele site-ul nu funcționează.</p>
      </div>
      <p class="shrink-0 text-mic font-medium text-discret">Întotdeauna active</p>
    </div>
    <label class="flex items-start gap-3">
      <input type="checkbox" name="harti" class="mt-1 size-5 shrink-0 accent-actiune">
      <span><span class="block font-semibold">Hărți Google</span><span class="block text-mic text-discret">Afișează harta fiecărei clinici. Google poate seta atunci cookie-uri proprii.</span></span>
    </label>
  </fieldset>
  <div class="mt-5 flex flex-wrap items-center gap-3">
    <button type="button" data-cookie="accept" class="<?= e(btn('primary')) ?>">Acceptați toate</button>
    <button type="button" data-cookie="refuse" class="<?= e(btn('secondary')) ?>">Refuzați</button>
    <button type="button" data-cookie="settings" class="<?= e(btn('text')) ?>">Setări</button>
    <button type="button" data-cookie="save" hidden class="<?= e(btn('primary')) ?>">Salvați alegerea</button>
  </div>
</div>
    <?php
}
