<?php
/**
 * The panel's frame: the menu on the left (a top bar with a menu on phones), the user and
 * „Ieșire”, the flash messages, then the page. Never indexed, never cached.
 */
declare(strict_types=1);

/** The panel's menu: path, label, icon, administrators only. */
const ADMIN_NAV = [
    ['/admin', 'Azi', 'house', false],
    ['/admin/calendar', 'Calendar', 'calendar', false],
    ['/admin/pacienti', 'Pacienți', 'users', false],
    ['/admin/cereri', 'Cereri online', 'inbox', false],
    ['/admin/rechemari', 'Rechemări', 'phone-call', false],
    ['/admin/servicii', 'Servicii și prețuri', 'tag', true],
    ['/admin/fotografii', 'Fotografii site', 'image', true],
    ['/admin/echipa', 'Echipa', 'user-round', true],
    ['/admin/utilizatori', 'Utilizatori', 'shield', true],
    ['/admin/setari', 'Setări', 'settings', true],
];

function admin_page(string $title, string $body, ?array $user = null): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    $path = request_path();
    $flashes = take_flash();
    $active = static function (string $href) use ($path): bool {
        return $href === '/admin' ? $path === '/admin' : ($path === $href || str_starts_with($path, $href . '/'));
    };
    $newCount = $user ? new_leads_count($user) : 0;
    $nav = '';
    if ($user) {
        foreach (ADMIN_NAV as [$href, $label, $ico, $adminOnly]) {
            if ($adminOnly && !is_admin($user)) {
                continue;
            }
            $on = $active($href);
            $badge = $href === '/admin/cereri' && $newCount > 0
                ? '<span class="ml-auto rounded-chip bg-mustar px-2 text-mic font-semibold text-pe-menta cifre">' . $newCount . '<span class="sr-only"> noi</span></span>' : '';
            $nav .= '<li><a href="' . e($href) . '"' . ($on ? ' aria-current="page"' : '') . ' class="'
                . e(cn('flex min-h-control items-center gap-3 rounded-control px-3 text-control', $on ? 'bg-menta-pal font-semibold text-cerneala' : 'text-cerneala hover:bg-adancit'))
                . '">' . admin_icon($ico, 20, $on ? 'text-actiune' : 'text-discret') . e($label) . $badge . '</a></li>';
        }
    }
    ?>
<!DOCTYPE html>
<html lang="ro" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> | Panou Dental Arena</title>
<link rel="stylesheet" href="<?= e(asset('/assets/site.css')) ?>">
<link rel="icon" href="/favicon.ico" sizes="any">
<script src="<?= e(asset(is_file(PUBLIC_DIR . '/assets/admin.min.js') ? '/assets/admin.min.js' : '/assets/admin.js')) ?>" defer></script>
</head>
<body class="min-h-dvh bg-fundal font-sans text-cerneala">
<a href="#continut" class="sr-only z-[60] rounded-control bg-suprafata px-4 py-3 font-medium shadow-float focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Salt la conținut</a>
<div class="<?= $user ? 'lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]' : '' ?>">
<?php if ($user) { ?>
  <header class="border-b border-linie bg-suprafata lg:border-r lg:border-b-0">
    <div class="flex items-center justify-between gap-3 px-4 py-3 lg:sticky lg:top-0 lg:flex-col lg:items-stretch lg:px-4 lg:py-6">
      <a href="/admin" class="inline-flex items-center gap-2" aria-label="Panou Dental Arena, acasă"><?= logo('h-9 w-auto lg:h-11', true, '120px') ?></a>
      <details class="group relative lg:hidden" data-meniu-panou>
        <summary class="inline-flex min-h-control list-none items-center gap-2 rounded-control px-3 font-medium hover:bg-adancit"><?= icon('menu', 22) ?>Meniu</summary>
        <div class="absolute right-0 z-40 mt-2 w-72 rounded-panou border border-linie bg-suprafata p-2 shadow-float">
          <nav aria-label="Panou"><ul class="flex flex-col"><?= $nav ?></ul></nav>
        </div>
      </details>
      <nav aria-label="Panou" class="hidden lg:mt-8 lg:block"><ul class="flex flex-col gap-1"><?= $nav ?></ul></nav>
      <div class="hidden lg:mt-auto lg:block lg:pt-8">
        <p class="text-control font-semibold"><?= e($user['name']) ?></p>
        <p class="text-mic text-discret"><?= e(ROLES[$user['role']] ?? $user['role']) ?></p>
        <p class="mt-3 flex flex-wrap gap-x-4">
          <a href="/admin/cont" class="inline-flex min-h-control items-center text-mic text-link underline underline-offset-4">Contul meu</a>
          <a href="/" class="inline-flex min-h-control items-center text-mic text-link underline underline-offset-4">Site-ul</a>
        </p>
        <form method="post" action="/admin/iesire" class="mt-2"><?= csrf_field() ?><button type="submit" class="<?= e(btn('secondary', 's', 'w-full')) ?>"><?= icon('log-out', 16) ?>Ieșire</button></form>
      </div>
    </div>
  </header>
<?php } ?>
  <main id="continut" tabindex="-1" class="min-w-0 px-4 py-6 outline-none md:px-8 lg:py-10">
    <div class="mx-auto max-w-6xl">
      <?php foreach ($flashes as $f) {
          $cls = match ($f['kind']) {
              'eroare' => 'border-2 border-carmin bg-carmin-pal',
              'info' => 'border border-linie bg-suprafata',
              default => 'bg-menta-pal',
          }; ?>
      <p role="status" class="<?= e(cn('mb-6 flex items-start gap-3 rounded-panou p-4 text-corp', $cls)) ?>"><?= icon($f['kind'] === 'eroare' ? 'alert-triangle' : ($f['kind'] === 'info' ? 'info' : 'check'), 22, 'mt-0.5') ?><?= e($f['message']) ?></p>
      <?php } ?>
      <?= $body ?>
      <?php if ($user) { ?>
      <form method="post" action="/admin/iesire" class="mt-12 lg:hidden"><?= csrf_field() ?><p class="text-mic text-discret"><?= e($user['name']) ?> · <a href="/admin/cont" class="text-link underline">Contul meu</a></p><button type="submit" class="<?= e(btn('secondary', 's', 'mt-2')) ?>"><?= icon('log-out', 16) ?>Ieșire</button></form>
      <?php } ?>
    </div>
  </main>
</div>
</body>
</html>
    <?php
}

/** The heading of a panel page, with an optional lead and actions on the right. */
function admin_header(string $title, string $lead = '', string $actions = ''): string
{
    return '<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div>'
        . '<h1 class="font-display text-h1 text-cerneala">' . e($title) . '</h1>'
        . ($lead !== '' ? '<p class="mt-2 max-w-[60ch] text-corp text-discret">' . e($lead) . '</p>' : '')
        . '</div>' . ($actions !== '' ? '<div class="flex flex-wrap gap-3">' . $actions . '</div>' : '') . '</div>';
}

function admin_not_found(?array $user): void
{
    http_response_code(404);
    admin_page('Pagina nu există', admin_header('Pagina nu există', 'Adresa nu face parte din panou.') . '<a href="/admin" class="' . e(btn('primary')) . '">Înapoi la panou</a>', $user);
    exit;
}
