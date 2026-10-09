<?php
/** /admin/fotografii: every photo place of the site, with upload and „back to the original”. */
declare(strict_types=1);

$slots = content('siteImageSlots');
$byKey = array_column($slots, null, 'key');

if (is_post()) {
    csrf_check();
    $key = post('slot');
    if (!isset($byKey[$key])) {
        flash('Locul fotografiei nu există.', 'eroare');
        redirect('/admin/fotografii');
    }
    $old = db_one('SELECT * FROM site_images WHERE slot = ?', [$key]);
    if (post('actiune') === 'initiala') {
        db_run('DELETE FROM site_images WHERE slot = ?', [$key]);
        delete_media($old['path'] ?? null);
        audit('fotografie-initiala', $key);
        flash("„{$byKey[$key]['label']}”: a revenit fotografia inițială.");
        redirect('/admin/fotografii#loc-' . slugify($key));
    }
    try {
        $saved = save_uploaded_photo($_FILES['foto'] ?? [], $key);
        db_run(
            'INSERT INTO site_images (slot, path, width, height, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE path = VALUES(path), width = VALUES(width), height = VALUES(height), updated_at = VALUES(updated_at)',
            [$key, $saved['path'], $saved['width'], $saved['height'], now_sql()],
        );
        delete_media($old['path'] ?? null);
        audit('fotografie', "{$key}: {$saved['path']}");
        flash("„{$byKey[$key]['label']}”: fotografia nouă e pe site.");
    } catch (Throwable $e) {
        flash($e instanceof InvalidArgumentException || $e instanceof RuntimeException ? $e->getMessage() : 'Fotografia nu a putut fi salvată.', 'eroare');
        if (!($e instanceof InvalidArgumentException)) {
            app_log('error', 'upload: ' . $e->getMessage());
        }
    }
    redirect('/admin/fotografii#loc-' . slugify($key));
}

$uploaded = array_column(db_all('SELECT slot, updated_at FROM site_images'), 'updated_at', 'slot');
$groups = [];
foreach ($slots as $s) {
    $groups[$s['group']][] = $s;
}
$limit = upload_limit_mb();
$html = '';
foreach ($groups as $group => $items) {
    $cards = '';
    foreach ($items as $s) {
        $img = site_image($s['key']);
        $anchor = 'loc-' . slugify($s['key']);
        $isUpload = isset($uploaded[$s['key']]);
        $cards .= '<li id="' . e($anchor) . '" class="flex scroll-mt-6 flex-col overflow-hidden rounded-panou border border-linie bg-suprafata">'
            . '<div class="relative aspect-[4/3] bg-adancit">' . photo($img, '(min-width: 1024px) 320px, 100vw') . '</div>'
            . '<div class="flex flex-1 flex-col gap-3 p-4">'
            . '<div><h3 class="text-h3 font-semibold">' . e($s['label']) . '</h3><p class="mt-1 text-mic text-discret">' . e($s['hint']) . '</p>'
            . '<p class="mt-2 text-mic">' . ($isUpload ? 'Încărcată ' . e(format_datetime($uploaded[$s['key']])) : '<span class="text-discret">Fotografia inițială</span>') . '</p></div>'
            . '<form method="post" enctype="multipart/form-data" class="mt-auto flex flex-col gap-2">' . csrf_field()
            . '<input type="hidden" name="slot" value="' . e($s['key']) . '">'
            . '<label class="text-mic font-medium" for="foto-' . e($anchor) . '">Fotografie nouă (JPG, PNG sau WebP)</label>'
            . '<input id="foto-' . e($anchor) . '" type="file" name="foto" accept="image/jpeg,image/png,image/webp" required class="block w-full text-mic file:mr-3 file:rounded-control file:border-0 file:bg-menta-pal file:px-3 file:py-2 file:font-medium">'
            . '<button type="submit" class="' . e(btn('primary', 's', 'self-start')) . '">' . icon('upload', 16) . 'Încărcați</button></form>'
            . ($isUpload ? '<form method="post" data-confirma="Puneți la loc fotografia inițială?">' . csrf_field() . '<input type="hidden" name="slot" value="' . e($s['key']) . '"><input type="hidden" name="actiune" value="initiala"><button type="submit" class="' . e(btn('text', 's')) . '">' . icon('undo-2', 16) . 'Reveniți la fotografia inițială</button></form>' : '')
            . '</div></li>';
    }
    $html .= '<section class="mt-10" aria-labelledby="grup-' . e(slugify($group)) . '"><h2 id="grup-' . e(slugify($group)) . '" class="font-display text-h2">' . e($group) . '</h2><ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">' . $cards . '</ul></section>';
}
$body = admin_header('Fotografii site', "Fotografia încărcată înlocuiește pe site fotografia de acum. Merg cel mai bine fotografii de cel puțin 1600 de pixeli lățime, de maximum {$limit} MB. Portretele medicilor se schimbă din Echipa.")
    . $html;
admin_page('Fotografii site', $body, $user);
