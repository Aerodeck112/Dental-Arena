<?php
/** /admin/servicii: the 10 service pages, each with its price list. */
declare(strict_types=1);

$rows = db_all('SELECT c.*, (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id) AS n, (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id AND s.public_visible = 1) AS shown FROM categories c ORDER BY c.sort_order, c.name');
$items = '';
foreach ($rows as $c) {
    $items .= '<li><a href="/admin/servicii/' . e($c['slug']) . '" class="flex items-center justify-between gap-4 rounded-panou border border-linie bg-suprafata p-4 hover:border-cerneala">'
        . '<span><span class="block text-h3 font-semibold">' . e($c['name']) . '</span><span class="text-mic text-discret cifre">' . (int) $c['shown'] . ' prețuri pe site' . ((int) $c['n'] > (int) $c['shown'] ? ', ' . ((int) $c['n'] - (int) $c['shown']) . ' ascunse' : '') . '</span></span>'
        . icon('chevron-right', 20, 'text-discret') . '</a></li>';
}
$body = admin_header('Servicii și prețuri', 'Prețurile apar pe pagina fiecărui serviciu, pe pagina Prețuri și, prețul ales ca exemplu, pe prima pagină. Se schimbă pe site imediat după salvare.')
    . '<ul class="grid gap-3 md:grid-cols-2">' . $items . '</ul>';
admin_page('Servicii și prețuri', $body, $user);
