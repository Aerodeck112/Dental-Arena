<?php
/**
 * /admin/pacienti/{id}/planuri/{plan}/tipar: the treatment plan and cost estimate on A4, for the
 * patient to take home or sign.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$plan = find_plan((int) $param2, (int) $p['id']);
if ($plan === null) {
    admin_not_found($user);
}
$items = array_values(array_filter(plan_items((int) $plan['id']), static fn ($i) => $i['status'] !== 'anulat'));
$t = plan_totals($items, (int) $plan['discount']);
$docs = db_one('SELECT public_name FROM doctors WHERE id = ?', [(int) $plan['doctor_id']]);
$clinic = $plan['location_id'] ? db_one('SELECT * FROM locations WHERE id = ?', [(int) $plan['location_id']]) : null;
audit('plan-tiparit', $plan['title'], null, (int) $p['id']);

$td = 'border-b border-linie px-2 py-1.5 align-top';
$th = 'border-b-2 border-cerneala px-2 py-1.5 text-left text-mic font-semibold';
$rows = '';
$phase = null;
foreach ($items as $i) {
    if ((int) $i['phase'] !== $phase) {
        $phase = (int) $i['phase'];
        $rows .= '<tr><td colspan="5" class="px-2 pt-4 pb-1 font-semibold">Faza ' . $phase . '</td></tr>';
    }
    $gross = (int) $i['quantity'] * (int) $i['unit_price'];
    $net = $gross - min((int) $i['discount'], $gross);
    $rows .= '<tr><td class="' . $td . ' cifre">' . ($i['tooth'] ? (int) $i['tooth'] : '') . '</td>'
        . '<td class="' . $td . '">' . e($i['description']) . ($i['status'] === 'efectuat' ? ' <span class="text-mic text-discret">(efectuat)</span>' : '') . '</td>'
        . '<td class="' . $td . ' cifre text-right">' . (int) $i['quantity'] . '</td>'
        . '<td class="' . $td . ' cifre text-right">' . e(amount_2d((int) $i['unit_price'])) . ((int) $i['discount'] > 0 ? '<span class="block text-mic">−' . e(amount_2d((int) $i['discount'])) . '</span>' : '') . '</td>'
        . '<td class="' . $td . ' cifre text-right">' . e(amount_2d($net)) . '</td></tr>';
}

$body = '<div class="flex flex-wrap items-start justify-between gap-6 border-b border-linie pb-6">'
    . '<div>' . logo('h-12 w-auto', true, '160px', 'Dental Arena') . '<div class="mt-3 text-mic">' . seller_block($clinic) . '</div></div>'
    . '<div class="text-right"><h1 class="font-display text-[1.75rem] leading-tight">Plan de tratament<br>și deviz estimativ</h1>'
    . '<p class="mt-2">Data: <span class="cifre">' . e(date('d.m.Y')) . '</span></p>'
    . ($plan['valid_until'] ? '<p>Valabil până la: <span class="cifre">' . e(date('d.m.Y', strtotime($plan['valid_until']))) . '</span></p>' : '') . '</div></div>'
    . '<div class="grid gap-4 py-6 sm:grid-cols-2 print:grid-cols-2">'
    . '<div><p class="text-mic font-semibold uppercase tracking-wide text-discret">Pacient</p><p class="font-semibold">' . e(patient_name($p)) . '</p><p>Fișa nr. ' . (int) $p['file_number'] . ($p['birth_date'] ? ' · născut(ă) ' . e(date('d.m.Y', strtotime($p['birth_date']))) : '') . '</p></div>'
    . '<div><p class="text-mic font-semibold uppercase tracking-wide text-discret">Medic</p><p class="font-semibold">' . e($docs['public_name'] ?? '') . '</p><p>' . e($plan['title']) . '</p></div></div>'
    . '<div class="relative overflow-x-auto print:overflow-visible"><table class="w-full min-w-[34rem] border-collapse print:min-w-0"><thead><tr><th class="' . $th . ' w-14">Dinte</th><th class="' . $th . '">Lucrarea</th><th class="' . $th . ' text-right">Cant.</th><th class="' . $th . ' text-right">Preț (lei)</th><th class="' . $th . ' text-right">Valoare (lei)</th></tr></thead><tbody>' . $rows . '</tbody></table></div>'
    . '<dl class="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1">'
    . ($t['line_discounts'] + $t['plan_discount'] > 0 ? '<dt>Valoare</dt><dd class="cifre text-right">' . e(lei($t['subtotal'])) . '</dd><dt>Reduceri</dt><dd class="cifre text-right">−' . e(lei($t['line_discounts'] + $t['plan_discount'])) . '</dd>' : '')
    . '<dt class="border-t-2 border-cerneala pt-1 font-semibold">Total estimat</dt><dd class="cifre border-t-2 border-cerneala pt-1 text-right text-h3 font-semibold">' . e(lei($t['total'])) . '</dd></dl>'
    . ($plan['notes'] ? '<div class="mt-6"><p class="font-semibold">Observații</p><p class="whitespace-pre-line">' . e($plan['notes']) . '</p></div>' : '')
    . '<p class="mt-6 text-mic">Planul și prețurile pot fi ajustate în funcție de evoluția clinică, numai cu acordul pacientului. Plata se face pe măsura efectuării lucrărilor, dacă nu s-a convenit altfel.</p>'
    . '<p class="mt-4">Am primit explicațiile medicului despre lucrările propuse, alternative și costuri, și sunt de acord cu acest plan de tratament.</p>'
    . '<div class="mt-12 grid grid-cols-2 gap-12"><p class="border-t border-cerneala pt-1 text-center text-mic">Medic (semnătura și parafa)</p><p class="border-t border-cerneala pt-1 text-center text-mic">Pacient / reprezentant legal (semnătura)</p></div>';
print_page($plan['title'] . ': ' . patient_name($p), $body, '/admin/pacienti/' . (int) $p['id'] . '/planuri/' . (int) $plan['id']);
