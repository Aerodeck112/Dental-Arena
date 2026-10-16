<?php
/** /admin/pacienti: search by name, phone or file number, or by a tag; the most recent patients first. */
declare(strict_types=1);

[$scope, $params] = patient_scope_sql($user);
$q = query('q');
$where = "p.active = 1 AND {$scope}";
if ($q !== '') {
    $digits = preg_replace('/\D+/', '', $q) ?? '';
    $where .= ' AND (p.search_text LIKE ? OR p.file_number = ?' . ($digits !== '' && strlen($digits) >= 4 ? ' OR p.search_text LIKE ?' : '') . ')';
    $params[] = '%' . fold_text($q) . '%';
    $params[] = ctype_digit($q) ? (int) $q : -1;
    if ($digits !== '' && strlen($digits) >= 4) {
        $params[] = '%' . ltrim($digits, '0') . '%';
    }
}
$tagId = admin_int(query('eticheta'));
if ($tagId !== null) {
    $where .= ' AND EXISTS (SELECT 1 FROM patient_tags pt WHERE pt.patient_id = p.id AND pt.tag_id = ?)';
    $params[] = $tagId;
}
$total = (int) db_value("SELECT COUNT(*) FROM patients p WHERE {$where}", $params);
$pages = max(1, (int) ceil($total / ADMIN_PER_PAGE));
$pagina = min($pages, max(1, (int) query('pagina', '1')));
$rows = db_all(
    "SELECT p.*, (SELECT MIN(a.starts_at) FROM appointments a WHERE a.patient_id = p.id AND a.starts_at >= NOW() AND a.status IN ('programat','confirmat')) AS next_at,
            (SELECT MAX(a.starts_at) FROM appointments a WHERE a.patient_id = p.id AND a.starts_at < NOW() AND a.status = 'finalizat') AS last_at
     FROM patients p WHERE {$where} ORDER BY " . ($q !== '' ? 'p.last_name, p.first_name' : 'p.updated_at DESC') . ' LIMIT ' . ADMIN_PER_PAGE . ' OFFSET ' . (($pagina - 1) * ADMIN_PER_PAGE),
    $params,
);
$tagsOf = [];
if ($rows !== []) {
    foreach (db_all('SELECT pt.patient_id, t.name, t.color FROM patient_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.patient_id IN (' . implode(',', array_map(static fn ($r) => (int) $r['id'], $rows)) . ') ORDER BY t.name') as $t) {
        $tagsOf[(int) $t['patient_id']][] = '<span class="' . e(cn('rounded-chip px-2 py-0.5 text-mic', TAG_CLASSES[$t['color']] ?? TAG_CLASSES['menta'])) . '">' . e($t['name']) . '</span>';
    }
}
$allTags = db_all('SELECT t.id, t.name, COUNT(pt.patient_id) AS n FROM tags t LEFT JOIN patient_tags pt ON pt.tag_id = t.id GROUP BY t.id, t.name ORDER BY t.name');
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$tr = '';
foreach ($rows as $p) {
    $tr .= '<tr class="border-t border-linie hover:bg-fundal">'
        . '<td class="px-3 py-2 text-mic text-discret cifre">' . (int) $p['file_number'] . '</td>'
        . '<td class="px-3 py-2"><a href="/admin/pacienti/' . (int) $p['id'] . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e(patient_name($p)) . '</a> ' . alert_chips(medical_alerts((int) $p['id'])) . (isset($tagsOf[(int) $p['id']]) ? ' ' . implode(' ', $tagsOf[(int) $p['id']]) : '') . '</td>'
        . '<td class="telefon px-3 py-2">' . ($p['phone'] !== '' ? e(format_phone($p['phone'])) : '—') . '</td>'
        . '<td class="px-3 py-2 text-mic cifre">' . ($p['next_at'] ? e(short_day($p['next_at']) . ', ' . hm($p['next_at'])) : '<span class="text-discret">—</span>') . '</td>'
        . '<td class="px-3 py-2 text-mic cifre">' . ($p['last_at'] ? e(format_date($p['last_at'])) : '<span class="text-discret">—</span>') . '</td></tr>';
}
$nav = '';
if ($pages > 1) {
    $nav = '<nav aria-label="Pagini" class="mt-6 flex items-center gap-4">'
        . ($pagina > 1 ? '<a href="' . e(admin_url('/admin/pacienti', ['q' => $q, 'eticheta' => $tagId, 'pagina' => $pagina - 1])) . '" class="' . e(btn('secondary', 's')) . '">Înapoi</a>' : '')
        . '<span class="text-mic text-discret cifre">Pagina ' . $pagina . ' din ' . $pages . '</span>'
        . ($pagina < $pages ? '<a href="' . e(admin_url('/admin/pacienti', ['q' => $q, 'eticheta' => $tagId, 'pagina' => $pagina + 1])) . '" class="' . e(btn('secondary', 's')) . '">Înainte</a>' : '') . '</nav>';
}
$body = admin_header('Pacienți', $total . ($total === 1 ? ' pacient' : ' pacienți') . ($q !== '' ? " pentru „{$q}”" : ''), '<a href="/admin/pacienti/nou" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Pacient nou</a>')
    . '<form method="get" role="search" class="mb-6 flex max-w-3xl flex-wrap gap-2 sm:flex-nowrap"><label for="cauta" class="sr-only">Căutați un pacient</label>'
    . '<input id="cauta" type="search" name="q" value="' . e($q) . '" placeholder="Nume, telefon sau nr. fișă" autofocus class="' . e(input_classes('h-control')) . '">'
    . ($allTags !== [] ? '<label for="filtru-eticheta" class="sr-only">Eticheta</label><select id="filtru-eticheta" name="eticheta" data-trimite-la-schimbare class="' . e(input_classes('h-control w-auto')) . '"><option value="">Toate etichetele</option>' . implode('', array_map(static fn ($t) => '<option value="' . (int) $t['id'] . '"' . ($tagId === (int) $t['id'] ? ' selected' : '') . '>' . e($t['name'] . ' (' . $t['n'] . ')') . '</option>', $allTags)) . '</select>' : '')
    . '<button type="submit" class="' . e(btn('primary')) . '">' . icon('search', 18) . 'Căutați</button></form>'
    . ($rows === [] ? '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Niciun pacient găsit.' . ($q !== '' ? ' <a href="/admin/pacienti/nou" class="text-link underline">Adăugați unul nou</a>.' : '') . '</p>'
        : '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[44rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
        . '<th scope="col" class="' . $th . '">Fișa</th><th scope="col" class="' . $th . '">Nume</th><th scope="col" class="' . $th . '">Telefon</th><th scope="col" class="' . $th . '">Următoarea programare</th><th scope="col" class="' . $th . '">Ultima vizită</th>'
        . '</tr></thead><tbody>' . $tr . '</tbody></table></div>')
    . $nav;
admin_page('Pacienți', $body, $user);
