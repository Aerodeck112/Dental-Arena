<?php
/**
 * /admin/implanturi (doctors and administrators): every implant case in progress, the next step
 * first (overdue ones marked), so no patient is forgotten between surgery and the final work.
 */
declare(strict_types=1);

$docs = doctor_short_names();
$doctor = admin_int(query('medic'));
if ($doctor === null && $user['role'] === 'medic' && $user['doctor_id'] && query('medic') === '') {
    $doctor = (int) $user['doctor_id'];
}
$cases = array_values(array_filter(implant_cases(), static fn ($c) => $doctor === null || (int) $c['doctor_id'] === $doctor));
$keys = array_keys(IMPLANT_STAGES);
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$rows = '';
foreach ($cases as $c) {
    $pos = (int) array_search($c['stage'], $keys, true);
    $next = IMPLANT_STAGES[$keys[min($pos + 1, count($keys) - 1)]][0];
    $overdue = $c['next_due'] && $c['next_due'] < date('Y-m-d');
    $rows .= '<tr class="border-t border-linie">'
        . '<td class="px-3 py-2"><a class="font-semibold text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $c['patient_id'] . '#implanturi">' . e(patient_name($c)) . '</a><span class="block text-mic text-discret">fișa ' . (int) $c['file_number'] . ($c['phone'] !== '' ? ' · ' . e(format_phone($c['phone'])) : '') . '</span></td>'
        . '<td class="px-3 py-2 cifre">' . e($c['teeth']) . ($c['system_name'] ? '<span class="block text-mic text-discret">' . e($c['system_name']) . '</span>' : '') . '</td>'
        . '<td class="px-3 py-2">' . e(IMPLANT_STAGES[$c['stage']][0] ?? $c['stage']) . '</td>'
        . '<td class="px-3 py-2">' . e($next) . '</td>'
        . '<td class="' . e(cn('px-3 py-2 cifre', $overdue ? 'font-semibold text-carmin' : '')) . '">' . ($c['next_due'] ? e(format_date($c['next_due'])) . ($overdue ? ' · a trecut' : '') : '—') . '</td>'
        . '<td class="px-3 py-2">' . e($docs[(int) $c['doctor_id']] ?? '—') . '</td></tr>';
}
$options = ['' => 'Toți medicii'] + array_map('strval', $docs);
$body = admin_header('Implanturi', count_ro(count($cases), 'un caz în curs', 'cazuri în curs') . '. Etapele se notează în fișa pacientului, la „Implanturi”.')
    . '<form method="get" class="mb-6 flex max-w-md items-end gap-3">' . select_field('medic', 'Medicul', $options, ['value' => $doctor !== null ? (string) $doctor : '']) . '<button type="submit" class="' . e(btn('secondary')) . '">Arătați</button></form>'
    . ($rows !== '' ? '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[48rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
        . '<th scope="col" class="' . $th . '">Pacientul</th><th scope="col" class="' . $th . '">Dinții</th><th scope="col" class="' . $th . '">Etapa de acum</th><th scope="col" class="' . $th . '">Urmează</th><th scope="col" class="' . $th . '">Când</th><th scope="col" class="' . $th . '">Medicul</th>'
        . '</tr></thead><tbody>' . $rows . '</tbody></table></div>'
        : '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Niciun caz de implant în curs.</p>');
admin_page('Implanturi', $body, $user);
