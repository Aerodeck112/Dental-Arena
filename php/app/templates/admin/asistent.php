<?php
/**
 * /admin/echipa/asistent/{id|nou}: an assistant of the team: the name, the role line, the portrait,
 * the clinics and whether she is shown on the site's team page.
 */
declare(strict_types=1);

$isNew = $param === 'nou';
$a = $isNew ? null : db_one('SELECT * FROM team_assistants WHERE id = ?', [(int) $param]);
if (!$isNew && $a === null) {
    admin_not_found($user);
}
$names = admin_clinic_names();
$errors = [];
$v = [
    'first_name' => $a['first_name'] ?? '', 'last_name' => $a['last_name'] ?? '', 'role_line' => $a['role_line'] ?? 'Asistentă medicală',
    'public_visible' => (string) ($a['public_visible'] ?? 1), 'sort_order' => (string) ($a['sort_order'] ?? 0),
    'locations' => array_map('intval', array_filter(explode(',', (string) ($a['locations'] ?? '')))),
];
if (is_post()) {
    csrf_check();
    if (post('op') === 'sterge' && $a !== null) {
        db_run('DELETE FROM team_assistants WHERE id = ?', [(int) $a['id']]);
        delete_media($a['photo_path'] ?? null);
        audit('asistent-sters', trim($a['first_name'] . ' ' . $a['last_name']));
        flash('Asistenta a fost scoasă din echipă.');
        redirect('/admin/echipa');
    }
    foreach (['first_name', 'last_name', 'role_line', 'sort_order'] as $k) {
        $v[$k] = trim(post($k));
    }
    $v['public_visible'] = post('public_visible') === '1' ? '1' : '0';
    $v['locations'] = array_values(array_filter(array_map('intval', (array) ($_POST['locations'] ?? [])), static fn ($l) => isset($names[$l])));
    if (mb_strlen($v['first_name']) < 2) {
        $errors['first_name'] = 'Scrieți prenumele.';
    }
    if (mb_strlen($v['last_name']) < 2) {
        $errors['last_name'] = 'Scrieți numele de familie.';
    }
    $photo = null;
    if (($_FILES['foto']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        try {
            $photo = save_uploaded_photo($_FILES['foto'], 'asistent-' . slugify($v['last_name'] ?: 'nou'));
        } catch (Throwable $e) {
            $errors['foto'] = $e instanceof InvalidArgumentException || $e instanceof RuntimeException ? $e->getMessage() : 'Fotografia nu a putut fi salvată.';
        }
    }
    if ($errors === []) {
        $row = ['first_name' => mb_substr($v['first_name'], 0, 80), 'last_name' => mb_substr($v['last_name'], 0, 80), 'role_line' => mb_substr($v['role_line'] ?: 'Asistentă medicală', 0, 160),
            'public_visible' => (int) $v['public_visible'], 'sort_order' => (int) $v['sort_order'], 'locations' => implode(',', $v['locations'])];
        if ($photo !== null) {
            $row['photo_path'] = $photo['path'];
            delete_media($a['photo_path'] ?? null);
        }
        if ($isNew) {
            $id = db_insert('team_assistants', $row + ['created_at' => now_sql()]);
        } else {
            $id = (int) $a['id'];
            db_update('team_assistants', $row, 'id = :id', ['id' => $id]);
        }
        audit($isNew ? 'asistent-nou' : 'asistent', trim($row['first_name'] . ' ' . $row['last_name']));
        flash($isNew ? 'Asistenta a fost adăugată în echipă.' : 'Datele au fost salvate.');
        redirect("/admin/echipa/asistent/{$id}");
    }
}
$boxes = '';
foreach ($names as $id => $n) {
    $boxes .= checkbox_field('locations[]', e($n), ['id' => "field-locations-{$id}", 'value' => (string) $id, 'checked' => in_array($id, $v['locations'], true)]);
}
$portrait = $a !== null && $a['photo_path'] ? '<div class="relative aspect-[4/5] w-40 overflow-hidden rounded-foto bg-fundal"><img src="' . e((string) $a['photo_path']) . '" alt="" class="absolute inset-0 size-full object-cover"></div>' : '';
$body = '<p class="mb-4"><a href="/admin/echipa" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Echipa</a></p>'
    . admin_header($isNew ? 'Asistentă nouă' : trim($a['first_name'] . ' ' . $a['last_name']), 'Pe pagina Echipa a site-ului, sub medici. Contul de panou: Utilizatori, rolul „Asistent(ă) medical(ă)”.')
    . '<form method="post" enctype="multipart/form-data" novalidate class="flex max-w-3xl flex-col gap-6">' . csrf_field() . error_summary($errors)
    . '<div class="grid gap-5 md:grid-cols-2">'
    . text_field('first_name', 'Prenumele', ['value' => $v['first_name'], 'error' => $errors['first_name'] ?? null])
    . text_field('last_name', 'Numele de familie', ['value' => $v['last_name'], 'error' => $errors['last_name'] ?? null])
    . text_field('role_line', 'Rolul (cum apare pe site)', ['value' => $v['role_line'], 'hint' => 'De exemplu: Asistentă medicală, Asistentă coordonatoare.'])
    . text_field('sort_order', 'Ordinea', ['type' => 'number', 'value' => $v['sort_order'], 'hint' => 'Mai mic = mai sus.'])
    . '</div>'
    . '<fieldset class="flex flex-col gap-1"><legend class="mb-1.5 text-control font-medium">Clinica în care lucrează</legend><div class="flex flex-wrap gap-x-8">' . $boxes . '</div></fieldset>'
    . '<div class="flex flex-col gap-4 sm:flex-row sm:items-start">' . $portrait . '<div class="flex flex-col gap-1.5"><label for="field-foto" class="text-control font-medium">Fotografia (verticală, ca a medicilor)</label>'
    . '<input id="field-foto" type="file" name="foto" accept="image/jpeg,image/png,image/webp" class="text-corp">' . field_error('field-foto-error', $errors['foto'] ?? null) . '</div></div>'
    . checkbox_field('public_visible', 'Apare pe site, pe pagina Echipa', ['checked' => $v['public_visible'] === '1'])
    . '<div><button type="submit" class="' . e(btn('primary', 'l')) . '">' . ($isNew ? 'Adăugați' : 'Salvați') . '</button></div></form>'
    . (!$isNew ? '<form method="post" class="mt-8" data-confirma="Scoateți asistenta din echipă?">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><button type="submit" class="' . e(btn('danger')) . '">' . icon('trash-2', 18) . 'Scoateți din echipă</button></form>' : '');
admin_page($isNew ? 'Asistentă nouă' : trim($a['first_name'] . ' ' . $a['last_name']), $body, $user);
