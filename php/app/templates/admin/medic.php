<?php
/** /admin/echipa/{id|nou}: a doctor's profile on the site, the services they do and the portrait. */
declare(strict_types=1);

$isNew = $param === 'nou';
$doc = $isNew ? null : db_one('SELECT * FROM doctors WHERE id = ?', [(int) $param]);
if (!$isNew && $doc === null) {
    admin_not_found($user);
}
$cats = db_all('SELECT * FROM categories ORDER BY sort_order');
$links = [];
if (!$isNew) {
    foreach (db_all('SELECT category_id, show_on_site FROM doctor_categories WHERE doctor_id = ?', [$doc['id']]) as $l) {
        $links[(int) $l['category_id']] = (int) $l['show_on_site'];
    }
}
$errors = [];
$v = [
    'public_name' => $doc['public_name'] ?? 'Dr. ',
    'first_name' => $doc['first_name'] ?? '',
    'last_name' => $doc['last_name'] ?? '',
    'role_line' => $doc['role_line'] ?? 'Medic dentist',
    'bio' => $doc['bio'] ?? '',
    'sort_order' => (string) ($doc['sort_order'] ?? ((int) db_value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM doctors'))),
    'public_visible' => (string) ($doc['public_visible'] ?? 1),
];

if (is_post()) {
    csrf_check();
    $id = $isNew ? null : (int) $doc['id'];
    if (!$isNew && post('actiune') === 'sterge-foto') {
        delete_media($doc['photo_path']);
        db_update('doctors', ['photo_path' => null], 'id = :id', ['id' => $id]);
        audit('medic-foto-sters', $doc['public_name']);
        flash('Portretul a fost scos. Pe site apar inițialele.');
        redirect("/admin/echipa/{$id}");
    }
    foreach (['public_name', 'first_name', 'last_name', 'role_line', 'bio', 'sort_order'] as $k) {
        $v[$k] = post($k);
    }
    $v['public_visible'] = post('public_visible') === '1' ? '1' : '0';
    foreach (['public_name' => 'Scrieți numele afișat pe site.', 'first_name' => 'Scrieți prenumele.', 'last_name' => 'Scrieți numele de familie.', 'role_line' => 'Scrieți specialitatea.'] as $k => $msg) {
        if (mb_strlen($v[$k]) < 2) {
            $errors[$k] = $msg;
        }
    }
    $photo = null;
    if (($_FILES['foto']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        try {
            $photo = save_uploaded_photo($_FILES['foto'], 'medic-' . slugify($v['last_name'] ?: 'nou'));
        } catch (Throwable $e) {
            $errors['foto'] = $e instanceof InvalidArgumentException || $e instanceof RuntimeException ? $e->getMessage() : 'Portretul nu a putut fi salvat.';
        }
    }
    if ($errors === []) {
        $row = [
            'public_name' => mb_substr($v['public_name'], 0, 160),
            'first_name' => mb_substr($v['first_name'], 0, 80),
            'last_name' => mb_substr($v['last_name'], 0, 80),
            'role_line' => mb_substr($v['role_line'], 0, 255),
            'bio' => $v['bio'] !== '' ? mb_substr($v['bio'], 0, 4000) : null,
            'sort_order' => (int) $v['sort_order'],
            'public_visible' => (int) $v['public_visible'],
        ];
        if ($photo !== null) {
            $row['photo_path'] = $photo['path'];
        }
        $id = db_tx(static function () use ($row, $id, $cats, $doc) {
            if ($id === null) {
                $base = slugify(preg_replace('/^dr\.?\s+/i', '', $row['public_name']) ?? $row['public_name']) ?: 'medic';
                $slug = $base;
                for ($n = 2; db_value('SELECT 1 FROM doctors WHERE slug = ?', [$slug]); $n++) {
                    $slug = "{$base}-{$n}";
                }
                $id = db_insert('doctors', $row + ['slug' => $slug]);
            } else {
                db_update('doctors', $row, 'id = :id', ['id' => $id]);
                if (isset($row['photo_path'])) {
                    delete_media($doc['photo_path']);
                }
            }
            db_run('DELETE FROM doctor_categories WHERE doctor_id = ?', [$id]);
            $sent = is_array($_POST['cat'] ?? null) ? $_POST['cat'] : [];
            foreach ($cats as $c) {
                $cid = (int) $c['id'];
                $state = $sent[$cid] ?? '';
                if ($state === 'face' || $state === 'arata') {
                    db_run('INSERT INTO doctor_categories (doctor_id, category_id, show_on_site) VALUES (?, ?, ?)', [$id, $cid, $state === 'arata' ? 1 : 0]);
                }
            }
            return $id;
        });
        audit($isNew ? 'medic-nou' : 'medic', $row['public_name']);
        flash($isNew ? 'Medicul a fost adăugat.' : 'Profilul a fost salvat. E deja pe site.');
        redirect("/admin/echipa/{$id}");
    }
    $sent = is_array($_POST['cat'] ?? null) ? $_POST['cat'] : [];
    $links = [];
    foreach ($sent as $cid => $state) {
        if ($state === 'face' || $state === 'arata') {
            $links[(int) $cid] = $state === 'arata' ? 1 : 0;
        }
    }
}

$catRows = '';
foreach ($cats as $c) {
    $cid = (int) $c['id'];
    $state = isset($links[$cid]) ? ($links[$cid] === 1 ? 'arata' : 'face') : '';
    $opt = '';
    foreach (['' => 'Nu', 'face' => 'Da', 'arata' => 'Da, și apare la „Cine vă tratează”'] as $k => $l) {
        $opt .= '<option value="' . $k . '"' . ($state === $k ? ' selected' : '') . '>' . e($l) . '</option>';
    }
    $catRows .= '<li class="grid items-center gap-2 border-t border-linie py-2 first:border-t-0 sm:grid-cols-[1fr_18rem]"><label for="cat-' . $cid . '" class="text-corp">' . e($c['name']) . '</label>'
        . '<select id="cat-' . $cid . '" name="cat[' . $cid . ']" class="' . e(input_classes('h-control-s')) . '">' . $opt . '</select></li>';
}
$portrait = '';
if (!$isNew) {
    $d = public_doctor($doc);
    $portrait = '<div class="w-48">' . doctor_portrait($d, '192px', 'profile') . '</div>';
}
$body = '<p class="mb-4"><a href="/admin/echipa" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Echipa</a></p>'
    . admin_header($isNew ? 'Medic nou' : $doc['public_name'], '', !$isNew && (int) $doc['public_visible'] === 1 ? '<a href="/echipa/' . e($doc['slug']) . '" target="_blank" rel="noopener" class="' . e(btn('secondary')) . '">' . icon('external-link', 18) . 'Profilul de pe site</a>' : '')
    . '<form method="post" enctype="multipart/form-data" novalidate class="flex flex-col gap-8">' . csrf_field() . error_summary($errors)
    . admin_section_open('Pe site', 'profil')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . text_field('public_name', 'Numele afișat', ['value' => $v['public_name'], 'required' => true, 'error' => $errors['public_name'] ?? null, 'hint' => 'De exemplu: Dr. Andrei Marcoci'])
    . text_field('role_line', 'Specialitatea', ['value' => $v['role_line'], 'required' => true, 'error' => $errors['role_line'] ?? null])
    . text_field('first_name', 'Prenumele', ['value' => $v['first_name'], 'required' => true, 'error' => $errors['first_name'] ?? null, 'hint' => 'Pentru inițiale, când nu are portret.'])
    . text_field('last_name', 'Numele de familie', ['value' => $v['last_name'], 'required' => true, 'error' => $errors['last_name'] ?? null])
    . '</div><div class="mt-5">' . text_area('bio', 'Despre medic', ['value' => $v['bio'], 'rows' => 5, 'optional' => true, 'hint' => 'Câteva fraze despre experiență și ce îi place să facă. Apare pe profilul medicului.']) . '</div>'
    . '<div class="mt-5 grid gap-5 md:grid-cols-2">' . text_field('sort_order', 'Ordinea pe site', ['type' => 'number', 'value' => $v['sort_order'], 'min' => 0, 'inputClass' => 'max-w-32'])
    . checkbox_field('public_visible', 'Apare pe site', ['checked' => $v['public_visible'] === '1', 'class' => 'md:mt-7']) . '</div></section>'
    . admin_section_open('Portretul', 'portret', 'O fotografie verticală, cu fața în treimea de sus. Fără portret, pe site apar inițialele.')
    . '<div class="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">' . $portrait
    . '<div class="flex flex-col gap-2"><label for="foto" class="text-control font-medium">Portret nou (JPG, PNG sau WebP)</label>'
    . '<input id="foto" type="file" name="foto" accept="image/jpeg,image/png,image/webp" class="block text-mic file:mr-3 file:rounded-control file:border-0 file:bg-menta-pal file:px-3 file:py-2 file:font-medium">'
    . (isset($errors['foto']) ? field_error('foto-error', $errors['foto']) : '') . '</div></div></section>'
    . admin_section_open('Serviciile', 'servicii', 'Ce face medicul. Cei marcați „apare” sunt arătați pe pagina serviciului.')
    . '<ul class="mt-3">' . $catRows . '</ul></section>'
    . '<div><button type="submit" class="' . e(btn('primary', 'l')) . '">' . ($isNew ? 'Adăugați medicul' : 'Salvați') . '</button></div></form>'
    . (!$isNew && $doc['photo_path'] && str_starts_with($doc['photo_path'], '/media/') ? '<form method="post" class="mt-6" data-confirma="Scoateți portretul?">' . csrf_field() . '<input type="hidden" name="actiune" value="sterge-foto"><button type="submit" class="' . e(btn('text', 's')) . '">' . icon('trash-2', 16) . 'Scoateți portretul</button></form>' : '');
admin_page($isNew ? 'Medic nou' : $doc['public_name'], $body, $user);
