<?php
/** /admin/pacienti: search by name, phone or file number; the most recent patients first. */
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
$total = (int) db_value("SELECT COUNT(*) FROM patients p WHERE {$where}", $params);
$pages = max(1, (int) ceil($total / ADMIN_PER_PAGE));
$pagina = min($pages, max(1, (int) query('pagina', '1')));
$rows = db_all(
    "SELECT p.*, (SELECT MIN(a.starts_at) FROM appointments a WHERE a.patient_id = p.id AND a.starts_at >= NOW() AND a.status IN ('programat','confirmat')) AS next_at,
            (SELECT MAX(a.starts_at) FROM appointments a WHERE a.patient_id = p.id AND a.starts_at < NOW() AND a.status = 'finalizat') AS last_at
     FROM patients p WHERE {$where} ORDER BY " . ($q !== '' ? 'p.last_name, p.first_name' : 'p.updated_at DESC') . ' LIMIT ' . ADMIN_PER_PAGE . ' OFFSET ' . (($pagina - 1) * ADMIN_PER_PAGE),
    $params,
);
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$tr = '';
foreach ($rows as $p) {
    $tr .= '<tr class="border-t border-linie hover:bg-fundal">'
        . '<td class="px-3 py-2 text-mic text-discret cifre">' . (int) $p['file_number'] . '</td>'
        . '<td class="px-3 py-2"><a href="/admin/pacienti/' . (int) $p['id'] . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e(patient_name($p)) . '</a> ' . alert_chips(medical_alerts((int) $p['id'])) . '</td>'
        . '<td class="telefon px-3 py-2">' . ($p['phone'] !== '' ? e(format_phone($p['phone'])) : '—') . '</td>'
        . '<td class="px-3 py-2 text-mic cifre">' . ($p['next_at'] ? e(short_day($p['next_at']) . ', ' . hm($p['next_at'])) : '<span class="text-discret">—</span>') . '</td>'
        . '<td class="px-3 py-2 text-mic cifre">' . ($p['last_at'] ? e(format_date($p['last_at'])) : '<span class="text-discret">—</span>') . '</td></tr>';
}
$nav = '';
if ($pages > 1) {
    $nav = '<nav aria-label="Pagini" class="mt-6 flex items-center gap-4">'
        . ($pagina > 1 ? '<a href="' . e(admin_url('/admin/pacienti', ['q' => $q, 'pagina' => $pagina - 1])) . '" class="' . e(btn('secondary', 's')) . '">Înapoi</a>' : '')
        . '<span class="text-mic text-discret cifre">Pagina ' . $pagina . ' din ' . $pages . '</span>'
        . ($pagina < $pages ? '<a href="' . e(admin_url('/admin/pacienti', ['q' => $q, 'pagina' => $pagina + 1])) . '" class="' . e(btn('secondary', 's')) . '">Înainte</a>' : '') . '</nav>';
}
$body = admin_header('Pacienți', $total . ($total === 1 ? ' pacient' : ' pacienți') . ($q !== '' ? " pentru „{$q}”" : ''), '<a href="/admin/pacienti/nou" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Pacient nou</a>')
    . '<form method="get" role="search" class="mb-6 flex max-w-xl gap-2"><label for="cauta" class="sr-only">Căutați un pacient</label>'
    . '<input id="cauta" type="search" name="q" value="' . e($q) . '" placeholder="Nume, telefon sau nr. fișă" autofocus class="' . e(input_classes('h-control')) . '">'
    . '<button type="submit" class="' . e(btn('primary')) . '">' . icon('search', 18) . 'Căutați</button></form>'
    . ($rows === [] ? '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Niciun pacient găsit.' . ($q !== '' ? ' <a href="/admin/pacienti/nou" class="text-link underline">Adăugați unul nou</a>.' : '') . '</p>'
        : '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[44rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
        . '<th scope="col" class="' . $th . '">Fișa</th><th scope="col" class="' . $th . '">Nume</th><th scope="col" class="' . $th . '">Telefon</th><th scope="col" class="' . $th . '">Următoarea programare</th><th scope="col" class="' . $th . '">Ultima vizită</th>'
        . '</tr></thead><tbody>' . $tr . '</tbody></table></div>')
    . $nav;
admin_page('Pacienți', $body, $user);
