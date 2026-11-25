<?php
/**
 * /admin/servicii/clinica/{slug}: a clinic's own price list (Luduș names and prices its services
 * otherwise than the site). While it has at least one service, „Adaugă procedură” offers this
 * list for that clinic instead of the site's. It is not shown on the site.
 */
declare(strict_types=1);

$clinic = db_one('SELECT id, slug, short_name FROM locations WHERE slug = ?', [(string) $param]);
if ($clinic === null) {
    admin_not_found($user);
}
$lid = (int) $clinic['id'];
$errors = [];
$blank = 6;
if (is_post()) {
    csrf_check();
    $changes = [];
    $adds = [];
    $deletes = [];
    foreach (is_array($_POST['r'] ?? null) ? $_POST['r'] : [] as $id => $r) {
        $id = (int) $id;
        if (!empty($r['sterge'])) {
            $deletes[] = $id;
            continue;
        }
        $name = mb_substr(trim((string) ($r['name'] ?? '')), 0, 190);
        try {
            $price = parse_lei((string) ($r['price'] ?? ''));
        } catch (InvalidArgumentException $e) {
            $errors["r-{$id}"] = "„{$name}”: " . $e->getMessage();
            continue;
        }
        if ($name === '') {
            $errors["r-{$id}"] = 'Un serviciu fără nume: scrieți-l sau bifați „Ștergeți”.';
            continue;
        }
        $changes[$id] = ['name' => $name, 'price' => $price];
    }
    foreach (is_array($_POST['n'] ?? null) ? $_POST['n'] : [] as $i => $r) {
        $name = mb_substr(trim((string) ($r['name'] ?? '')), 0, 190);
        if ($name === '') {
            continue;
        }
        try {
            $adds[] = ['name' => $name, 'price' => parse_lei((string) ($r['price'] ?? ''))];
        } catch (InvalidArgumentException $e) {
            $errors["n-{$i}"] = "„{$name}”: " . $e->getMessage();
        }
    }
    if ($errors === []) {
        db_tx(static function () use ($lid, $changes, $adds, $deletes): void {
            foreach ($changes as $id => $c) {
                db_run('UPDATE clinic_services SET name = ?, price = ?, updated_at = ? WHERE id = ? AND location_id = ? AND (name <> ? OR NOT (price <=> ?))', [$c['name'], $c['price'], now_sql(), $id, $lid, $c['name'], $c['price']]);
            }
            foreach ($adds as $a) {
                db_insert('clinic_services', ['location_id' => $lid, 'name' => $a['name'], 'price' => $a['price'], 'active' => 1, 'updated_at' => now_sql()]);
            }
            foreach ($deletes as $id) {
                db_run('DELETE FROM clinic_services WHERE id = ? AND location_id = ?', [$id, $lid]);
            }
        });
        audit('servicii-clinica', "{$clinic['short_name']}: " . count($adds) . ' adăugate, ' . count($deletes) . ' șterse');
        flash('Lista de prețuri ' . $clinic['short_name'] . ' a fost salvată.');
        redirect('/admin/servicii/clinica/' . $clinic['slug']);
    }
}

$rows = db_all('SELECT * FROM clinic_services WHERE location_id = ? ORDER BY name, id', [$lid]);
$cell = e(input_classes('h-control'));
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$line = static function (string $key, string $name, string $price, bool $existing) use ($cell): string {
    return '<tr class="border-t border-linie">'
        . '<td class="px-3 py-2"><input name="' . $key . '[name]" value="' . e($name) . '" maxlength="190" aria-label="Denumirea" class="' . $cell . ' w-full"' . ($existing ? '' : ' placeholder="Serviciu nou"') . '></td>'
        . '<td class="px-3 py-2"><input name="' . $key . '[price]" value="' . e($price) . '" inputmode="decimal" aria-label="Prețul (lei)" class="' . $cell . ' w-32 cifre"></td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . ($existing ? '<label class="inline-flex min-h-control items-center gap-2 text-mic"><input type="checkbox" name="' . $key . '[sterge]" value="1" class="size-5">Ștergeți</label>' : '') . '</td></tr>';
};
$list = '';
foreach ($rows as $r) {
    $key = 'r[' . (int) $r['id'] . ']';
    $in = is_post() ? ($_POST['r'][(int) $r['id']] ?? null) : null;
    $list .= $line($key, (string) ($in['name'] ?? $r['name']), (string) ($in['price'] ?? lei_input($r['price'] !== null ? (int) $r['price'] : null)), true);
}
for ($i = 0; $i < $blank; $i++) {
    $in = is_post() ? ($_POST['n'][$i] ?? null) : null;
    $list .= $line("n[{$i}]", (string) ($in['name'] ?? ''), (string) ($in['price'] ?? ''), false);
}
$body = '<p class="mb-4"><a href="/admin/servicii" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Servicii și prețuri</a></p>'
    . admin_header('Lista de prețuri ' . $clinic['short_name'], 'Denumirile și prețurile clinicii ' . $clinic['short_name'] . ' (nu apar pe site). '
        . ($rows !== [] ? 'La „Adaugă procedură”, pentru clinica ' . $clinic['short_name'] . ' se alege din această listă, nu din lista site-ului.' : 'Lista e goală: la „Adaugă procedură” clinica folosește lista site-ului. Când adăugați primul serviciu, folosește lista ei.'))
    . '<form method="post" novalidate class="flex max-w-4xl flex-col gap-6">' . csrf_field() . error_summary($errors)
    . '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[34rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
    . '<th scope="col" class="' . $th . '">Denumirea (' . count_ro(count($rows), 'un serviciu', 'servicii') . ')</th><th scope="col" class="' . $th . ' w-40">Prețul (lei)</th><th scope="col" class="' . $th . ' w-28"></th></tr></thead><tbody>' . $list . '</tbody></table></div>'
    . '<p class="text-mic text-discret">Prețul gol: se scrie la fiecare procedură. Rândurile goale de jos adaugă servicii noi (salvați, apoi apar altele goale). Procedurile trecute păstrează denumirea și prețul de atunci.</p>'
    . '<div class="sticky bottom-0 -mx-4 border-t border-linie bg-fundal/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-panou md:border"><button type="submit" class="' . e(btn('primary', 'l')) . '">Salvați lista</button></div></form>';
admin_page('Lista de prețuri ' . $clinic['short_name'], $body, $user);
