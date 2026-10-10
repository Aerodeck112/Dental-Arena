<?php
/**
 * /admin/jurnal (administrators): who did what in the panel, filtered by person, action, patient
 * and period; exported as CSV.
 */
declare(strict_types=1);

[$from, $to, $toEx] = admin_period(date('Y-m-d', strtotime('-6 days')), date('Y-m-d'));
$who = admin_int(query('utilizator'));
$action = query('actiune');
$file = admin_int(query('fisa'));
$page = max(1, (int) query('pagina'));
$perPage = 100;

$where = ['a.created_at >= ?', 'a.created_at < ?'];
$params = ["{$from} 00:00:00", "{$toEx} 00:00:00"];
if ($who !== null) {
    $where[] = 'a.user_id = ?';
    $params[] = $who;
}
if ($action !== '') {
    $where[] = 'a.action = ?';
    $params[] = $action;
}
if ($file !== null) {
    $where[] = 'p.file_number = ?';
    $params[] = $file;
}
$base = 'FROM audit_log a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN patients p ON p.id = a.patient_id WHERE ' . implode(' AND ', $where);

if (query('csv') === '1') {
    $rows = db_all("SELECT a.*, u.name AS user_name, p.file_number, p.first_name, p.last_name {$base} ORDER BY a.created_at, a.id", $params);
    csv_download("jurnal-{$from}-{$to}.csv", ['Data', 'Ora', 'Utilizator', 'Acțiunea', 'Pacient', 'Fișa', 'Detalii'], array_map(static fn ($r) => [
        date('d.m.Y', strtotime($r['created_at'])), substr($r['created_at'], 11, 5), (string) $r['user_name'], audit_label($r['action']),
        $r['file_number'] !== null ? patient_name($r) : '', (string) ($r['file_number'] ?? ''), (string) $r['detail'],
    ], $rows));
}

$count = (int) db_value("SELECT COUNT(*) {$base}", $params);
$rows = db_all("SELECT a.*, u.name AS user_name, p.file_number, p.first_name, p.last_name {$base} ORDER BY a.created_at DESC, a.id DESC LIMIT {$perPage} OFFSET " . (($page - 1) * $perPage), $params);

$users = ['' => 'Toți'];
foreach (db_all('SELECT id, name FROM users ORDER BY name') as $u) {
    $users[(string) $u['id']] = $u['name'];
}
$actions = ['' => 'Toate'];
foreach (db_all('SELECT DISTINCT action FROM audit_log ORDER BY action') as $a) {
    $actions[$a['action']] = audit_label($a['action']);
}
asort($actions);
$filters = ['de' => $from, 'pana' => $to, 'utilizator' => $who, 'actiune' => $action, 'fisa' => $file];
$form = '<form method="get" class="mb-6 grid gap-3 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">'
    . text_field('de', 'De la', ['type' => 'date', 'value' => $from])
    . text_field('pana', 'Până la', ['type' => 'date', 'value' => $to])
    . select_field('utilizator', 'Cine', $users, ['value' => (string) ($who ?? '')])
    . select_field('actiune', 'Ce', $actions, ['value' => $action])
    . text_field('fisa', 'Nr. fișei', ['value' => (string) ($file ?? ''), 'inputmode' => 'numeric'])
    . '<button type="submit" class="' . e(btn('primary', 'm', 'w-full')) . '">' . icon('filter', 18) . 'Filtrați</button></form>';
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$tr = '';
foreach ($rows as $r) {
    $tr .= '<tr class="border-t border-linie align-top"><td class="cifre whitespace-nowrap px-3 py-2">' . e(date('d.m.Y H:i', strtotime($r['created_at']))) . '</td>'
        . '<td class="px-3 py-2">' . e($r['user_name'] ?? '—') . '</td><td class="px-3 py-2">' . e(audit_label($r['action'])) . '</td>'
        . '<td class="px-3 py-2">' . ($r['patient_id'] !== null && $r['file_number'] !== null ? '<a class="text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $r['patient_id'] . '">' . e(patient_name($r)) . '</a>' : '') . '</td>'
        . '<td class="px-3 py-2 text-discret">' . e((string) $r['detail']) . '</td></tr>';
}
$pages = (int) ceil($count / $perPage);
$pager = $pages > 1 ? '<nav aria-label="Pagini" class="mt-4 flex gap-2">'
    . ($page > 1 ? '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/jurnal', $filters + ['pagina' => $page - 1])) . '">Înapoi</a>' : '')
    . '<span class="inline-flex items-center px-2 text-mic text-discret">Pagina ' . $page . ' din ' . $pages . '</span>'
    . ($page < $pages ? '<a class="' . e(btn('secondary', 's')) . '" href="' . e(admin_url('/admin/jurnal', $filters + ['pagina' => $page + 1])) . '">Înainte</a>' : '') . '</nav>' : '';

$body = admin_header('Jurnal', $count . ' acțiuni între ' . format_date($from) . ' și ' . format_date($to) . '. Jurnalul nu poate fi modificat din panou.', '<a href="' . e(admin_url('/admin/jurnal', $filters + ['csv' => 1])) . '" class="' . e(btn('secondary')) . '">' . icon('download', 18) . 'Export Excel (CSV)</a>')
    . $form
    . '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata p-2 md:p-4">' . ($tr !== '' ? '<table class="w-full min-w-[48rem] border-collapse text-corp"><thead><tr><th scope="col" class="' . $th . '">Când</th><th scope="col" class="' . $th . '">Cine</th><th scope="col" class="' . $th . '">Ce</th><th scope="col" class="' . $th . '">Pacient</th><th scope="col" class="' . $th . '">Detalii</th></tr></thead><tbody>' . $tr . '</tbody></table>' : '<p class="p-4 text-corp text-discret">Nicio acțiune în perioada aleasă.</p>') . '</div>'
    . $pager;
admin_page('Jurnal', $body, $user);
