<?php
/**
 * /admin/casa: the day's cash report of a clinic: what was collected for procedures, by method,
 * with „Numerar” as the money in the cash box; every payment of the day, who took it, and the
 * cancelled ones apart. Reception closes the day with it (Tipăriți). An account that starts from
 * zero („Luduș 2”) sees only the days since its own.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
$hist = history_from($user);
$today = date('Y-m-d');
$day = preg_match('/^\d{4}-\d{2}-\d{2}$/', query('ziua')) && query('ziua') <= $today ? query('ziua') : $today;
if ($hist !== null && $day < $hist) {
    $day = $hist;
}
$loc = admin_int(query('clinica')) ?? current_clinic_id($user);
$loc = $loc !== null && in_array($loc, $allowed, true) ? $loc : ($allowed[0] ?? null);
if ($loc !== null) {
    remember_clinic($loc);
}
$mine = query('cine') === 'eu';

$params = [$day, (int) $loc];
$extra = '';
if ($mine) {
    $extra = ' AND pp.received_by = ?';
    $params[] = (int) $user['id'];
}
$rows = $loc === null ? [] : db_all(
    'SELECT pp.*, pt.last_name, pt.first_name, pt.file_number, u.name AS who
     FROM procedure_payments pp JOIN patients pt ON pt.id = pp.patient_id LEFT JOIN users u ON u.id = pp.received_by
     WHERE pp.paid_on = ? AND pp.location_id = ?' . $extra . ' ORDER BY pp.created_at, pp.id',
    $params,
);
$by = array_fill_keys(['numerar', 'card', 'transfer', 'altele'], 0);
$total = 0;
$count = 0;
$list = '';
$cancelled = '';
foreach ($rows as $r) {
    $isCancelled = $r['cancelled_at'] !== null;
    if (!$isCancelled) {
        $by[$r['method']] = ($by[$r['method']] ?? 0) + (int) $r['amount'];
        $total += (int) $r['amount'];
        $count++;
    }
    $line = '<tr class="' . e(cn('border-t border-linie', $isCancelled ? 'text-discret line-through' : '')) . '">'
        . '<td class="px-3 py-2 cifre whitespace-nowrap">' . e(substr($r['created_at'], 0, 10) === $day ? hm($r['created_at']) : '—') . '</td>'
        . '<td class="px-3 py-2"><a class="font-medium text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $r['patient_id'] . '/proceduri#plati">' . e(patient_name($r)) . '</a><span class="block text-mic text-discret cifre">fișa ' . (int) $r['file_number'] . '</span></td>'
        . '<td class="px-3 py-2">' . e(PROC_PAY_METHODS[$r['method']] ?? $r['method']) . ($r['reference'] ? '<span class="block text-mic text-discret">' . e($r['reference']) . '</span>' : '') . '</td>'
        . '<td class="px-3 py-2">' . e($r['who'] ?? '—') . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap font-semibold">' . e(lei((int) $r['amount'])) . '</td></tr>';
    if ($isCancelled) {
        $cancelled .= $line;
    } else {
        $list .= $line;
    }
}

$clinicOptions = [];
foreach ($allowed as $l) {
    $clinicOptions[(string) $l] = $names[$l];
}
$filters = '<form method="get" class="mb-6 grid gap-4 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end print:hidden">'
    . text_field('ziua', 'Ziua', ['type' => 'date', 'value' => $day, 'max' => $today, 'min' => $hist])
    . (count($allowed) > 1 ? select_field('clinica', 'Clinica', $clinicOptions, ['value' => (string) $loc]) : '<input type="hidden" name="clinica" value="' . (int) $loc . '">')
    . select_field('cine', 'Încasate de', ['' => 'Toată echipa', 'eu' => 'Doar de mine'], ['value' => $mine ? 'eu' : ''])
    . '<div class="flex gap-2"><button type="submit" class="' . e(btn('primary')) . '">Arătați</button>'
    . '<button type="button" data-tipareste class="' . e(btn('secondary')) . '">' . icon('printer', 18) . 'Tipăriți</button></div></form>';
$tile = static fn (string $label, int $value, string $cls = '', string $note = '') => '<div class="' . e(cn('rounded-panou border border-linie bg-suprafata p-4', $cls)) . '"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.75rem] leading-tight cifre">' . e(lei($value)) . '</p>' . ($note !== '' ? '<p class="mt-1 text-mic text-discret">' . e($note) . '</p>' : '') . '</div>';
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$table = static fn (string $rowsHtml) => '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
    . '<th scope="col" class="' . $th . ' w-20">Ora</th><th scope="col" class="' . $th . '">Pacientul</th><th scope="col" class="' . $th . ' w-44">Cum a plătit</th><th scope="col" class="' . $th . ' w-44">A încasat</th><th scope="col" class="' . $th . ' w-32 text-right">Suma</th></tr></thead><tbody>' . $rowsHtml . '</tbody></table></div>';

$body = admin_header('Casa: ' . format_date($day, true) . ($loc !== null ? ', ' . ($names[$loc] ?? '') : ''), 'Ce s-a încasat în ziua aleasă pentru proceduri: numerarul este cât trebuie să fie în casă.' . ($hist !== null ? ' Contul vede zilele de la ' . format_date($hist) . '.' : ''))
    . $filters
    . '<div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">'
    . $tile('Numerar: bani în casă', $by['numerar'], 'border-2 border-actiune bg-menta-pal sm:col-span-2 lg:col-span-1')
    . $tile('Card', $by['card'])
    . $tile('Transfer (OP)', $by['transfer'])
    . $tile('Altă plată', $by['altele'])
    . $tile('Total încasat', $total, '', count_ro($count, 'o plată', 'plăți'))
    . '</div>'
    . ($list !== '' ? $table($list) : '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Nicio încasare în această zi.</p>')
    . ($cancelled !== '' ? '<h2 class="mb-2 mt-8 text-h3 font-semibold">Plăți anulate (nu intră în total)</h2>' . $table($cancelled) : '')
    . '<p class="mt-6 text-mic text-discret">Plățile se înregistrează în fișa pacientului → Proceduri și plăți → Încasare.</p>';
admin_page('Casa', $body, $user);
