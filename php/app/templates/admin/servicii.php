<?php
/**
 * /admin/servicii: the service pages of the site, each with its price list. The administrator adds
 * a service (a new page at /its-name), changes the order with the arrows, opens one to change its
 * prices (the sub-services), its texts, to hide it or to delete it.
 */
declare(strict_types=1);

// Addresses the site already uses; a new service gets another one.
const RESERVED_PAGES = ['admin', 'servicii', 'preturi', 'echipa', 'despre-noi', '15ani', 'contact', 'programare', 'dentist-targu-mures', 'cabinet-stomatologic-targu-mures', 'termeni-si-conditii', 'politica-de-confidentialitate', 'politica-cookies', 'tableta', 'p', 'd', 'media', 'images', 'assets', 'brand', 'sitemap', 'robots', 'webhook', 'inhalosedare', 'stomatologie-generala', 'estetica-dentara', 'medici', 'cookies', 'gdpr'];

$errors = [];
if (is_post()) {
    csrf_check();
    if (post('op') === 'ordine') {
        $ids = array_map('intval', array_column(db_all('SELECT id FROM categories ORDER BY sort_order, name, id'), 'id'));
        $at = array_search((int) post('id'), $ids, true);
        $to = $at === false ? false : $at + (post('dir') === 'sus' ? -1 : 1);
        if ($at !== false && $to >= 0 && $to < count($ids)) {
            [$ids[$at], $ids[$to]] = [$ids[$to], $ids[$at]];
            db_tx(static function () use ($ids): void {
                foreach ($ids as $i => $id) {
                    db_run('UPDATE categories SET sort_order = ? WHERE id = ?', [$i + 1, $id]);
                }
            });
            audit('servicii-ordine', implode(', ', array_column(db_all('SELECT name FROM categories ORDER BY sort_order'), 'name')));
        }
        redirect('/admin/servicii#serviciu-' . (int) post('id'));
    }
    if (post('op') === 'nou') {
        $name = trim(post('name'));
        $summary = trim(post('summary'));
        if (mb_strlen($name) < 3) {
            $errors['name'] = 'Scrieți numele serviciului, de exemplu Albire dentară.';
        } elseif (db_value('SELECT 1 FROM categories WHERE name = ?', [$name])) {
            $errors['name'] = 'Există deja un serviciu cu acest nume.';
        }
        if ($summary === '') {
            $errors['summary'] = 'Scrieți o descriere scurtă: apare pe pagina Servicii și sub titlul paginii.';
        }
        if ($errors === []) {
            $base = slugify($name) ?: 'serviciu';
            $slug = $base;
            for ($n = 2; in_array($slug, RESERVED_PAGES, true) || db_value('SELECT 1 FROM categories WHERE slug = ?', [$slug]); $n++) {
                $slug = "{$base}-{$n}";
            }
            db_insert('categories', [
                'slug' => $slug,
                'name' => mb_substr($name, 0, 120),
                'summary' => mb_substr($summary, 0, 1000),
                'sort_order' => (int) db_value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories'),
                'public_visible' => 1,
            ]);
            audit('serviciu-nou', "{$name} (/{$slug})");
            flash("Serviciul „{$name}” a fost adăugat, cu pagina /{$slug}. Adăugați acum prețurile (sub-serviciile) și, dacă vreți, un text mai lung.");
            redirect("/admin/servicii/{$slug}");
        }
    }
}

$rows = db_all('SELECT c.*, (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id) AS n, (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id AND s.public_visible = 1) AS shown FROM categories c ORDER BY c.sort_order, c.name');
$last = count($rows) - 1;
$arrow = static fn (int $id, string $dir, string $label, string $icon, bool $off) => '<form method="post">' . csrf_field()
    . '<input type="hidden" name="op" value="ordine"><input type="hidden" name="id" value="' . $id . '"><input type="hidden" name="dir" value="' . $dir . '">'
    . '<button type="submit" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="' . e($label) . '"' . ($off ? ' disabled' : '') . '>' . icon($icon, 18) . '</button></form>';
$items = '';
foreach ($rows as $i => $c) {
    $id = (int) $c['id'];
    $hidden = (int) $c['public_visible'] === 0;
    $items .= '<li id="serviciu-' . $id . '" class="flex items-center gap-3 rounded-panou border border-linie bg-suprafata p-3">'
        . '<a href="/admin/servicii/' . e($c['slug']) . '" class="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-control p-1 hover:underline">'
        . '<span class="min-w-0"><span class="block text-h3 font-semibold">' . e($c['name']) . '</span><span class="text-mic text-discret cifre">'
        . ($hidden ? '<span class="mr-1 rounded-chip bg-adancit px-2 text-cerneala">Ascuns pe site</span>' : '/' . e($c['slug']) . ' · ')
        . (int) $c['shown'] . ' prețuri pe site' . ((int) $c['n'] > (int) $c['shown'] ? ', ' . ((int) $c['n'] - (int) $c['shown']) . ' ascunse' : '') . '</span></span>'
        . icon('chevron-right', 20, 'shrink-0 text-discret') . '</a>'
        . '<div class="flex shrink-0 flex-col gap-1">'
        . $arrow($id, 'sus', 'Mai sus: ' . $c['name'], 'chevron-up', $i === 0)
        . $arrow($id, 'jos', 'Mai jos: ' . $c['name'], 'chevron-down', $i === $last) . '</div></li>';
}
$form = '<form method="post" novalidate class="flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="nou">' . error_summary($errors)
    . text_field('name', 'Numele serviciului', ['value' => post('op') === 'nou' ? post('name') : '', 'maxlength' => 120, 'error' => $errors['name'] ?? null, 'hint' => 'Devine titlul paginii și adresa ei, de exemplu Albire dentară → /albire-dentara.'])
    . text_area('summary', 'Descrierea scurtă', ['value' => post('op') === 'nou' ? post('summary') : '', 'rows' => 3, 'maxlength' => 1000, 'error' => $errors['summary'] ?? null])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Adăugați serviciul</button></div></form>';
$body = admin_header('Servicii și prețuri', 'Fiecare serviciu are pagina lui pe site, cu prețurile lui (sub-serviciile). Ordinea de aici este ordinea din meniul site-ului, de pe pagina Servicii și de pe pagina Prețuri. Se schimbă pe site imediat după salvare.')
    . '<div class="grid max-w-6xl gap-8 lg:grid-cols-12"><ol class="grid gap-3 lg:col-span-7">' . $items . '</ol>'
    . '<div class="lg:col-span-5">' . admin_section_open('Serviciu nou', 'serviciu-nou', 'O pagină nouă pe site. După ce o adăugați, îi puneți prețurile și textul.') . '<div class="mt-4">' . $form . '</div></section></div></div>';
admin_page('Servicii și prețuri', $body, $user);
