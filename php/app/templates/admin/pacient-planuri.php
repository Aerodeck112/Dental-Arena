<?php
/**
 * /admin/pacienti/{id}/planuri: the patient's treatment plans with status, value and progress.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$id = (int) $p['id'];
$plans = db_all('SELECT * FROM treatment_plans WHERE patient_id = ? ORDER BY created_at DESC', [$id]);
$docs = doctor_short_names();
$rows = '';
foreach ($plans as $pl) {
    $t = plan_totals(plan_items((int) $pl['id']), (int) $pl['discount']);
    $pct = $t['count'] > 0 ? (int) round($t['done_count'] / $t['count'] * 100) : 0;
    $rows .= '<li class="border-t border-linie first:border-t-0"><a href="/admin/pacienti/' . $id . '/planuri/' . (int) $pl['id'] . '" class="grid gap-2 py-4 hover:bg-fundal sm:grid-cols-[1fr_auto] sm:items-center sm:px-2">'
        . '<span class="min-w-0"><span class="flex flex-wrap items-center gap-2"><span class="text-h3 font-semibold text-link">' . e($pl['title']) . '</span>' . plan_status_chip($pl['status']) . '</span>'
        . '<span class="mt-1 block text-mic text-discret">' . e(implode(' · ', array_filter(['Creat ' . format_date($pl['created_at']), $docs[(int) $pl['doctor_id']] ?? '', $t['count'] . ($t['count'] === 1 ? ' lucrare' : ' lucrări') . ", {$t['done_count']} efectuate"]))) . '</span>'
        . '<span class="mt-2 block h-1.5 max-w-xs overflow-hidden rounded-full bg-adancit" aria-hidden="true"><span class="block h-full rounded-full bg-actiune" style="width:' . $pct . '%"></span></span></span>'
        . '<span class="text-right"><span class="block font-display text-[1.5rem] leading-tight cifre">' . e(lei($t['total'])) . '</span><span class="text-mic text-discret cifre">efectuat ' . e(lei($t['done'])) . '</span></span>'
        . '</a></li>';
}
$actions = can('plans.manage', $user) && $p['anonymized_at'] === null ? '<a href="/admin/pacienti/' . $id . '/planuri/nou" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Plan nou</a>' : '';
$body = patient_header($p, $user, 'planuri', $actions)
    . admin_section_open('Planuri de tratament', 'planuri', 'Lucrările propuse, cu prețuri, pe faze. Pacientul primește planul tipărit; după ce îl acceptă, lucrările efectuate se facturează din „Facturi și plăți”.')
    . ($rows !== '' ? '<ul class="mt-3">' . $rows . '</ul>' : '<p class="mt-4 text-corp text-discret">Niciun plan de tratament.' . (can('medical', $user) ? ' Puteți porni și din odontogramă: alegeți dintele, apoi „Adăugați în plan”.' : '') . '</p>')
    . '</section>';
admin_page('Planuri: ' . patient_name($p), $body, $user);
