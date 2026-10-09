<?php
/**
 * /admin/servicii/{slug}: the price list of one service page. One form saves every row; the
 * row buttons (up, down, delete) save first, then act. An empty price reads „Prețul îl aflați la
 * telefon”; „de la” and a second price make „de la 200 lei” and „900 / 1.100 lei”.
 */
declare(strict_types=1);

$cat = db_one('SELECT * FROM categories WHERE slug = ?', [(string) $param]);
if ($cat === null) {
    admin_not_found($user);
}
$catId = (int) $cat['id'];
$load = static fn () => db_all('SELECT * FROM services WHERE category_id = ? ORDER BY sort_order, id', [$catId]);
$rows = $load();
$errors = [];
$input = [];

if (is_post()) {
    csrf_check();
    $op = post('op');
    $updates = [];
    $sent = $_POST['r'] ?? [];
    $sent = is_array($sent) ? $sent : [];
    $repId = (int) post('representative');
    foreach ($rows as $s) {
        $id = (int) $s['id'];
        $r = is_array($sent[$id] ?? null) ? $sent[$id] : [];
        $input[$id] = $r;
        $name = trim((string) ($r['name'] ?? ''));
        if ($name === '') {
            $errors["r{$id}"] = 'Scrieți numele serviciului.';
            continue;
        }
        try {
            $min = parse_lei((string) ($r['min'] ?? ''));
            $max = parse_lei((string) ($r['max'] ?? ''));
        } catch (InvalidArgumentException $e) {
            $errors["r{$id}"] = "„{$name}”: " . $e->getMessage();
            continue;
        }
        if ($min === null && $max !== null) {
            $errors["r{$id}"] = "„{$name}”: scrieți întâi prețul de bază.";
            continue;
        }
        if ($max !== null && $max <= $min) {
            $errors["r{$id}"] = "„{$name}”: al doilea preț trebuie să fie mai mare decât primul.";
            continue;
        }
        $unit = (string) ($r['unit'] ?? '');
        $updates[$id] = [
            'name' => mb_substr($name, 0, 190),
            'price_min' => $min,
            'price_max' => $max,
            'price_from' => !empty($r['from']) && $min !== null ? 1 : 0,
            'unit' => isset(UNIT_LABEL[$unit]) && $unit !== 'ACT' ? $unit : null,
            'public_visible' => !empty($r['visible']) ? 1 : 0,
            'representative' => $id === $repId ? 1 : 0,
            'updated_at' => now_sql(),
        ];
    }
    $newName = trim(post('new_name'));
    $newMin = null;
    if ($newName !== '') {
        try {
            $newMin = parse_lei(post('new_min'));
        } catch (InvalidArgumentException $e) {
            $errors['new'] = 'Serviciul nou: ' . $e->getMessage();
        }
    }
    $summary = trim(post('summary'));
    if ($summary === '') {
        $errors['summary'] = 'Scrieți descrierea scurtă a serviciului.';
    }
    if ($errors === []) {
        db_tx(static function () use ($updates, $catId, $newName, $newMin, $summary, $op, $cat): void {
            foreach ($updates as $id => $u) {
                db_update('services', $u, 'id = :id AND category_id = :c', ['id' => $id, 'c' => $catId]);
            }
            db_update('categories', ['summary' => mb_substr($summary, 0, 1000)], 'id = :id', ['id' => $catId]);
            if ($newName !== '') {
                $sort = (int) db_value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM services WHERE category_id = ?', [$catId]);
                db_insert('services', [
                    'category_id' => $catId,
                    'code' => null,
                    'name' => mb_substr($newName, 0, 190),
                    'price_min' => $newMin,
                    'price_max' => null,
                    'price_from' => 0,
                    'unit' => null,
                    'representative' => 0,
                    'public_visible' => 1,
                    'sort_order' => $sort,
                    'updated_at' => now_sql(),
                ]);
            }
            if (preg_match('/^(sus|jos|sterge):(\d+)$/', $op, $m)) {
                $target = (int) $m[2];
                if ($m[1] === 'sterge') {
                    db_run('DELETE FROM services WHERE id = ? AND category_id = ?', [$target, $catId]);
                } else {
                    $ids = array_map('intval', array_column(db_all('SELECT id FROM services WHERE category_id = ? ORDER BY sort_order, id', [$catId]), 'id'));
                    $i = array_search($target, $ids, true);
                    $j = $m[1] === 'sus' ? $i - 1 : $i + 1;
                    if ($i !== false && isset($ids[$j])) {
                        [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
                    }
                    foreach ($ids as $pos => $sid) {
                        db_run('UPDATE services SET sort_order = ? WHERE id = ?', [$pos + 1, $sid]);
                    }
                }
            }
            audit('preturi', "{$cat['name']}" . ($newName !== '' ? ", adăugat „{$newName}”" : '') . ($op !== '' ? ", {$op}" : ''));
        });
        flash($op !== '' && str_starts_with($op, 'sterge') ? 'Serviciul a fost șters.' : 'Prețurile au fost salvate. Sunt deja pe site.');
        redirect("/admin/servicii/{$cat['slug']}");
    }
}

$unitOptions = ['' => 'per act'];
foreach (UNIT_LABEL as $k => $l) {
    if ($k !== 'ACT') {
        $unitOptions[$k] = "/ {$l}";
    }
}
$cell = 'block w-full rounded-control border border-linie-control bg-suprafata px-2.5 text-control hover:border-cerneala aria-[invalid=true]:border-2 aria-[invalid=true]:border-carmin';
$rowsHtml = '';
$count = count($rows);
foreach ($rows as $i => $s) {
    $id = (int) $s['id'];
    $in = $input[$id] ?? null;
    $val = static fn (string $k, mixed $db) => $in !== null ? (string) ($in[$k] ?? '') : (string) $db;
    $chk = static fn (string $k, bool $db) => $in !== null ? !empty($in[$k]) : $db;
    $bad = isset($errors["r{$id}"]) ? ' aria-invalid="true"' : '';
    $units = '';
    foreach ($unitOptions as $k => $l) {
        $units .= '<option value="' . e($k) . '"' . ($val('unit', $s['unit'] ?? '') === (string) $k ? ' selected' : '') . '>' . e($l) . '</option>';
    }
    $preview = format_lei($s['price_min'] === null ? null : (int) $s['price_min'], (bool) $s['price_from'], $s['price_max'] === null ? null : (int) $s['price_max'], $s['unit']);
    $rowsHtml .= '<li id="field-r' . $id . '" tabindex="-1" class="grid gap-3 border-t border-linie py-4 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">'
        . '<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem_8rem]">'
        . '<label class="flex flex-col gap-1"><span class="text-mic text-discret">Serviciul</span><input name="r[' . $id . '][name]" value="' . e($val('name', $s['name'])) . '" maxlength="190" class="' . $cell . ' h-control"' . $bad . '></label>'
        . '<label class="flex items-center gap-2 sm:mt-6"><input type="checkbox" name="r[' . $id . '][from]" value="1"' . ($chk('from', (bool) $s['price_from']) ? ' checked' : '') . ' class="size-5 accent-actiune">de la</label>'
        . '<label class="flex flex-col gap-1"><span class="text-mic text-discret">Preț (lei)</span><input name="r[' . $id . '][min]" value="' . e($val('min', lei_input($s['price_min'] === null ? null : (int) $s['price_min']))) . '" inputmode="decimal" placeholder="la telefon" class="' . $cell . ' h-control cifre"' . $bad . '></label>'
        . '<label class="flex flex-col gap-1"><span class="text-mic text-discret">Al doilea preț</span><input name="r[' . $id . '][max]" value="' . e($val('max', lei_input($s['price_max'] === null ? null : (int) $s['price_max']))) . '" inputmode="decimal" placeholder="opțional" class="' . $cell . ' h-control cifre"></label>'
        . '<label class="flex flex-col gap-1"><span class="text-mic text-discret">Unitate</span><select name="r[' . $id . '][unit]" class="' . $cell . ' h-control">' . $units . '</select></label>'
        . '</div>'
        . '<div class="flex flex-wrap items-center gap-x-4 gap-y-2 lg:mt-6">'
        . '<label class="flex items-center gap-2"><input type="checkbox" name="r[' . $id . '][visible]" value="1"' . ($chk('visible', (bool) $s['public_visible']) ? ' checked' : '') . ' class="size-5 accent-actiune">pe site</label>'
        . '<label class="flex items-center gap-2" title="Prețul arătat ca exemplu pe prima pagină și în capul paginii serviciului"><input type="radio" name="representative" value="' . $id . '"' . ((int) $s['representative'] === 1 ? ' checked' : '') . ' class="size-5 accent-actiune">exemplu</label>'
        . '<span class="flex gap-1">'
        . ($i > 0 ? '<button type="submit" name="op" value="sus:' . $id . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Mutați mai sus: ' . e($s['name']) . '">' . icon('chevron-up', 16) . '</button>' : '')
        . ($i < $count - 1 ? '<button type="submit" name="op" value="jos:' . $id . '" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="Mutați mai jos: ' . e($s['name']) . '">' . icon('chevron-down', 16) . '</button>' : '')
        . '<button type="submit" name="op" value="sterge:' . $id . '" data-confirma="Ștergeți „' . e($s['name']) . '” din listă?" class="' . e(btn('danger', 's', 'px-2')) . '" aria-label="Ștergeți: ' . e($s['name']) . '">' . icon('trash-2', 16) . '</button>'
        . '</span></div>'
        . '<p class="text-mic text-discret lg:col-span-2">Pe site: <span class="font-semibold text-cerneala cifre">' . e($preview) . '</span>' . ((int) $s['public_visible'] === 0 ? ' · ascuns' : '') . '</p>'
        . '</li>';
}

$body = '<p class="mb-4"><a href="/admin/servicii" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Toate serviciile</a></p>'
    . admin_header($cat['name'], 'Lăsați prețul gol pentru „Prețul îl aflați la telefon”. Bifați „de la” pentru „de la 200 lei”; al doilea preț face „900 / 1.100 lei”.', '<a href="/' . e($cat['slug']) . '" target="_blank" rel="noopener" class="' . e(btn('secondary')) . '">' . icon('external-link', 18) . 'Pagina de pe site</a>')
    . '<form method="post" novalidate class="flex flex-col gap-8">' . csrf_field()
    . error_summary(array_map(static fn ($m) => $m, $errors), 'Prețurile nu au fost salvate')
    . admin_section_open('Prețurile', 'preturi', count($rows) . ' rânduri, în ordinea de pe site.')
    . '<ul class="mt-2">' . ($rowsHtml !== '' ? $rowsHtml : '<li class="py-4 text-discret">Niciun preț încă.</li>') . '</ul></section>'
    . admin_section_open('Adăugați un serviciu', 'nou')
    . '<div class="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">'
    . text_field('new_name', 'Numele serviciului', ['value' => post('new_name'), 'maxlength' => 190, 'id' => 'field-new'])
    . text_field('new_min', 'Preț (lei)', ['value' => post('new_min'), 'inputmode' => 'decimal', 'hint' => 'Gol = la telefon'])
    . '</div></section>'
    . admin_section_open('Descrierea scurtă', 'descriere', 'Apare sub numele serviciului pe prima pagină și pe pagina Servicii.')
    . '<div class="mt-4">' . text_area('summary', 'Text', ['value' => is_post() ? post('summary') : $cat['summary'], 'rows' => 3, 'maxlength' => 1000, 'error' => $errors['summary'] ?? null]) . '</div></section>'
    . '<div class="sticky bottom-0 -mx-4 border-t border-linie bg-fundal/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-panou md:border"><button type="submit" class="' . e(btn('primary', 'l')) . '">Salvați prețurile</button></div>'
    . '</form>';
admin_page($cat['name'], $body, $user);
