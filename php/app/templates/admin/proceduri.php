<?php
/**
 * /admin/proceduri: the procedures of a period (as „Statistică proceduri” in QDental): by doctor,
 * by clinic, only those not paid; with the totals (price, paid, left). A doctor sees their own by
 * default. Each line opens the patient's „Proceduri și plăți”.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
$doctors = array_column(db_all('SELECT id, public_name FROM doctors ORDER BY sort_order, id'), 'public_name', 'id');
$isDate = static fn (string $d) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) === 1;
$from = $isDate(query('de_la')) ? query('de_la') : date('Y-m-01');
$to = $isDate(query('pana_la')) ? query('pana_la') : date('Y-m-d');
if ($to < $from) {
    [$from, $to] = [$to, $from];
}
$doc = query('medic') !== '' ? (query('medic') === 'toti' ? null : admin_int(query('medic'))) : ($user['role'] === 'medic' && $user['doctor_id'] ? (int) $user['doctor_id'] : null);
$loc = admin_int(query('clinica'));
$loc = $loc !== null && in_array($loc, $allowed, true) ? $loc : null;
$unpaid = query('neachitate') === '1';

$where = ['p.performed_on BETWEEN ? AND ?', '(p.location_id IS NULL OR p.location_id IN (' . implode(',', array_map('intval', $allowed ?: [0])) . '))'];
$params = [$from, $to];
if ($doc !== null) {
    $where[] = 'p.doctor_id = ?';
    $params[] = $doc;
}
if ($loc !== null) {
    $where[] = 'p.location_id = ?';
    $params[] = $loc;
}
$rows = db_all(
    'SELECT p.*, pt.last_name, pt.first_name, pt.file_number, d.public_name AS doctor,
        COALESCE((SELECT SUM(i.amount) FROM procedure_payment_items i JOIN procedure_payments pp ON pp.id = i.payment_id WHERE i.procedure_id = p.id AND pp.cancelled_at IS NULL), 0) AS paid
     FROM procedures p JOIN patients pt ON pt.id = p.patient_id LEFT JOIN doctors d ON d.id = p.doctor_id
     WHERE ' . implode(' AND ', $where) . ' ORDER BY p.performed_on DESC, p.id DESC',
    $params,
);
if ($unpaid) {
    $rows = array_values(array_filter($rows, static fn ($r) => procedure_due($r) > (int) $r['paid']));
}
$total = $paid = $lab = 0;
foreach ($rows as $r) {
    $total += procedure_due($r);
    $paid += min((int) $r['paid'], procedure_due($r));
    $lab += (int) $r['lab_cost'];
}
$paymentsIn = (int) db_value('SELECT COALESCE(SUM(amount), 0) FROM procedure_payments WHERE cancelled_at IS NULL AND paid_on BETWEEN ? AND ?' . ($loc !== null ? ' AND location_id = ' . $loc : ''), [$from, $to]);

$shown = array_slice($rows, 0, 1500);
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$list = '';
foreach ($shown as $r) {
    $due = procedure_due($r);
    $list .= '<tr class="border-t border-linie align-top">'
        . '<td class="px-3 py-2 cifre whitespace-nowrap">' . e(date('d.m.Y', strtotime($r['performed_on']))) . '</td>'
        . '<td class="px-3 py-2"><a class="font-medium text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $r['patient_id'] . '/proceduri">' . e(patient_name($r)) . '</a><span class="block text-mic text-discret cifre">fișa ' . (int) $r['file_number'] . '</span></td>'
        . '<td class="px-3 py-2">' . e($r['name']) . ($r['tooth'] ? '<span class="block text-mic text-discret">dinte ' . e($r['tooth']) . '</span>' : '') . '</td>'
        . '<td class="px-3 py-2">' . e($r['doctor'] ?? '—') . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap">' . e(lei($due)) . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap">' . e(lei(min((int) $r['paid'], $due))) . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap font-semibold">' . e(lei(max(0, $due - (int) $r['paid']))) . '</td></tr>';
}
$docOptions = ['toti' => 'Toți medicii'] + array_map('strval', $doctors);
$locOptions = ['' => 'Ambele clinici'];
foreach ($allowed as $l) {
    $locOptions[(string) $l] = $names[$l];
}
$filters = '<form method="get" class="mb-6 grid gap-4 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">'
    . text_field('de_la', 'De la', ['type' => 'date', 'value' => $from])
    . text_field('pana_la', 'Până la', ['type' => 'date', 'value' => $to])
    . select_field('medic', 'Medicul', $docOptions, ['value' => $doc !== null ? (string) $doc : 'toti'])
    . select_field('clinica', 'Clinica', $locOptions, ['value' => $loc !== null ? (string) $loc : ''])
    . '<div class="flex flex-col gap-2">' . checkbox_field('neachitate', 'Doar neachitate', ['checked' => $unpaid]) . '<button type="submit" class="' . e(btn('primary')) . '">Arătați</button></div></form>';
$tile = static fn (string $label, int $value, string $cls = '') => '<div class="' . e(cn('rounded-panou border border-linie bg-suprafata p-4', $cls)) . '"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.75rem] leading-tight cifre">' . e(lei($value)) . '</p></div>';
$body = admin_header('Proceduri', 'Procedurile efectuate într-o perioadă, cu prețul, cât s-a achitat și cât mai e de plată. Le adaugă fiecare medic, în fișa pacientului → Proceduri și plăți.')
    . $filters
    . '<div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">'
    . $tile(count_ro(count($rows), 'o procedură', 'proceduri') . ': de plată', $total)
    . $tile('Achitat pentru ele', $paid, 'border-actiune/40')
    . $tile('Rămas de plată', $total - $paid, $total - $paid > 0 ? 'border-carmin bg-carmin-pal' : '')
    . $tile('Încasat în perioadă (toate plățile)', $paymentsIn)
    . '</div>'
    . ($lab > 0 ? '<p class="-mt-3 mb-6 text-mic text-discret">Laborator: ' . e(lei($lab)) . '</p>' : '')
    . ($list !== '' ? '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[52rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
        . '<th scope="col" class="' . $th . ' w-24">Data</th><th scope="col" class="' . $th . ' w-56">Pacientul</th><th scope="col" class="' . $th . ' min-w-[16rem]">Procedura</th><th scope="col" class="' . $th . ' w-44">Medicul</th>'
        . '<th scope="col" class="' . $th . ' w-28 text-right">De plată</th><th scope="col" class="' . $th . ' w-28 text-right">Achitat</th><th scope="col" class="' . $th . ' w-28 text-right">Rămas</th></tr></thead><tbody>' . $list . '</tbody></table></div>'
        . (count($rows) > count($shown) ? '<p class="mt-3 text-mic text-discret">Se văd primele ' . count($shown) . ' din ' . count($rows) . '; totalurile de sus le cuprind pe toate. Alegeți o perioadă mai scurtă ca să le vedeți pe toate.</p>' : '')
        : '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Nicio procedură în această perioadă.</p>');
admin_page('Proceduri', $body, $user);
