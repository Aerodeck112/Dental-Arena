<?php
/**
 * /admin/pacienti/{id}/planuri/{plan|nou}: a treatment plan. Doctors and administrators create
 * it, add lines (from the price list, per tooth, in phases), move it through its steps and mark
 * the work done; reception sees it, prints it and invoices it.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$manage = can('plans.manage', $user) && $p['anonymized_at'] === null;
$names = admin_clinic_names();
$docs = doctor_short_names();
$isNew = $param2 === 'nou';
$plan = $isNew ? null : find_plan((int) $param2, $pid);
if ((!$isNew && $plan === null) || ($isNew && !$manage)) {
    admin_not_found($user);
}
$base = "/admin/pacienti/{$pid}/planuri";
$errors = [];
$userDoctor = isset($user['doctor_id']) && $user['doctor_id'] ? (int) $user['doctor_id'] : null;

$meta = [
    'title' => $plan['title'] ?? 'Plan de tratament',
    'doctor_id' => (string) ($plan['doctor_id'] ?? $userDoctor ?? $p['primary_doctor_id'] ?? ''),
    'location_id' => (string) ($plan['location_id'] ?? $p['preferred_location_id'] ?? current_clinic_id($user) ?? ''),
    'valid_until' => $plan['valid_until'] ?? date('Y-m-d', strtotime('+60 days')),
    'discount' => lei_input(isset($plan['discount']) && (int) $plan['discount'] > 0 ? (int) $plan['discount'] : null),
    'notes' => $plan['notes'] ?? '',
];
$editId = admin_int(query('linie') ?: post('item_id'));
$editItem = $editId !== null && $plan ? db_one('SELECT * FROM treatment_plan_items WHERE id = ? AND plan_id = ?', [$editId, $plan['id']]) : null;
$it = [
    'service_id' => (string) ($editItem['service_id'] ?? query('serviciu')),
    'description' => $editItem['description'] ?? '',
    'tooth' => (string) ($editItem['tooth'] ?? query('dinte')),
    'phase' => (string) ($editItem['phase'] ?? query('faza') ?: '1'),
    'quantity' => (string) ($editItem['quantity'] ?? '1'),
    'price' => $editItem ? lei_input((int) $editItem['unit_price']) : '',
    'discount' => $editItem && (int) $editItem['discount'] > 0 ? lei_input((int) $editItem['discount']) : '',
];

if (is_post() && $manage) {
    csrf_check();
    $op = post('op');
    $planId = $plan ? (int) $plan['id'] : null;
    try {
        if ($op === 'detalii') {
            foreach (array_keys($meta) as $k) {
                $meta[$k] = post($k);
            }
            if (mb_strlen($meta['title']) < 2) {
                $errors['title'] = 'Scrieți un titlu, de exemplu „Reabilitare arcada inferioară”.';
            }
            if ($meta['valid_until'] !== '' && DateTimeImmutable::createFromFormat('!Y-m-d', $meta['valid_until']) === false) {
                $errors['valid_until'] = 'Data nu este corectă.';
            }
            $disc = 0;
            try {
                $disc = parse_lei($meta['discount']) ?? 0;
            } catch (InvalidArgumentException $e) {
                $errors['discount'] = 'Reducerea este o sumă în lei.';
            }
            if ($errors === []) {
                $row = [
                    'title' => mb_substr($meta['title'], 0, 190),
                    'doctor_id' => isset($docs[(int) $meta['doctor_id']]) ? (int) $meta['doctor_id'] : null,
                    'location_id' => isset($names[(int) $meta['location_id']]) ? (int) $meta['location_id'] : null,
                    'valid_until' => $meta['valid_until'] ?: null,
                    'notes' => mb_substr($meta['notes'], 0, 2000) ?: null,
                    'updated_at' => now_sql(),
                ];
                if ($plan === null || plan_prices_editable($plan['status'])) {
                    $row['discount'] = $disc;
                }
                if ($plan === null) {
                    $planId = db_insert('treatment_plans', $row + ['patient_id' => $pid, 'status' => 'ciorna', 'created_by' => $user['id'], 'created_at' => now_sql()]);
                    audit('plan-nou', $row['title'], null, $pid);
                    flash('Planul a fost creat. Adăugați lucrările.');
                } else {
                    db_update('treatment_plans', $row, 'id = :id', ['id' => $planId]);
                    audit('plan', $row['title'], null, $pid);
                    flash('Planul a fost salvat.');
                }
                redirect("{$base}/{$planId}");
            }
        } elseif ($plan !== null && $op === 'stare') {
            $to = post('stare');
            if (!in_array($to, PLAN_TRANSITIONS[$plan['status']], true)) {
                throw new DomainException('Planul nu poate trece din „' . PLAN_STATUS[$plan['status']] . '” în „' . (PLAN_STATUS[$to] ?? $to) . '”.');
            }
            db_tx(static function () use ($plan, $to, $pid): void {
                $row = ['status' => $to, 'updated_at' => now_sql()];
                if ($to === 'prezentat') {
                    $row['presented_at'] = now_sql();
                }
                if ($to === 'acceptat') {
                    $row['accepted_at'] = now_sql();
                    db_run("UPDATE treatment_plan_items SET status = 'acceptat' WHERE plan_id = ? AND status = 'propus'", [$plan['id']]);
                }
                db_update('treatment_plans', $row, 'id = :id', ['id' => $plan['id']]);
                audit('plan-' . $to, $plan['title'], null, $pid);
            });
            flash('Planul este acum „' . PLAN_STATUS[$to] . '”.');
            redirect("{$base}/{$planId}");
        } elseif ($plan !== null && $op === 'linie') {
            if (!plan_open($plan['status'])) {
                throw new DomainException('Planul este închis; nu se mai adaugă lucrări.');
            }
            foreach (array_keys($it) as $k) {
                $it[$k] = post($k);
            }
            $svc = admin_int($it['service_id']);
            $svcRow = $svc !== null ? db_one('SELECT * FROM services WHERE id = ?', [$svc]) : null;
            if ($it['description'] === '' && $svcRow) {
                $it['description'] = $svcRow['name'];
            }
            if (mb_strlen($it['description']) < 2) {
                $errors['description'] = 'Alegeți serviciul sau scrieți ce se face.';
            }
            $tooth = $it['tooth'] !== '' ? (int) $it['tooth'] : null;
            if ($tooth !== null && !is_fdi_tooth($tooth)) {
                $errors['tooth'] = 'Scrieți dintele ca în schema FDI, de exemplu 36 (sau 75 la dinții temporari).';
            }
            $phase = max(1, min(9, (int) $it['phase']));
            $qty = ctype_digit($it['quantity']) ? (int) $it['quantity'] : 0;
            if ($qty < 1 || $qty > 99) {
                $errors['quantity'] = 'Cantitatea este între 1 și 99.';
            }
            $price = 0;
            $disc = 0;
            try {
                $price = parse_lei($it['price']) ?? ($svcRow && $svcRow['price_min'] !== null ? (int) $svcRow['price_min'] : null);
                $disc = parse_lei($it['discount']) ?? 0;
            } catch (InvalidArgumentException $e) {
                $errors['price'] = 'Prețul și reducerea sunt sume în lei, de exemplu 2.200 sau 150,50.';
            }
            if ($price === null && !isset($errors['price'])) {
                $errors['price'] = 'Scrieți prețul.';
            }
            if (!isset($errors['price']) && $disc > $qty * $price) {
                $errors['discount'] = 'Reducerea nu poate depăși valoarea lucrării.';
            }
            if ($errors === []) {
                $row = ['service_id' => $svcRow ? (int) $svcRow['id'] : null, 'tooth' => $tooth, 'description' => mb_substr($it['description'], 0, 255), 'phase' => $phase];
                if ($editItem === null || plan_prices_editable($plan['status'])) {
                    $row += ['quantity' => $qty, 'unit_price' => $price, 'discount' => $disc];
                }
                if ($editItem !== null) {
                    db_update('treatment_plan_items', $row, 'id = :id', ['id' => $editItem['id']]);
                } else {
                    $order = (int) db_value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM treatment_plan_items WHERE plan_id = ?', [$plan['id']]);
                    db_insert('treatment_plan_items', $row + ['plan_id' => $plan['id'], 'status' => in_array($plan['status'], ['acceptat', 'in-curs'], true) ? 'acceptat' : 'propus', 'sort_order' => $order]);
                }
                db_update('treatment_plans', ['updated_at' => now_sql()], 'id = :id', ['id' => $plan['id']]);
                audit($editItem ? 'plan-linie' : 'plan-linie-noua', $row['description'] . ($tooth ? " (dinte {$tooth})" : ''), null, $pid);
                flash($editItem ? 'Lucrarea a fost salvată.' : 'Lucrarea a fost adăugată.');
                redirect("{$base}/{$planId}#lucrari");
            }
        } elseif ($plan !== null && in_array($op, ['stare-linie', 'sterge-linie'], true)) {
            $item = db_one('SELECT * FROM treatment_plan_items WHERE id = ? AND plan_id = ?', [(int) post('item_id'), $plan['id']]);
            if ($item === null) {
                throw new DomainException('Lucrarea nu mai există.');
            }
            if (in_array((int) $item['id'], invoiced_item_ids((int) $plan['id']), true)) {
                throw new DomainException('Lucrarea este pe o factură emisă; nu se mai schimbă.');
            }
            if ($op === 'sterge-linie') {
                if (!plan_prices_editable($plan['status'])) {
                    throw new DomainException('După acceptare lucrările nu se șterg; anulați-le.');
                }
                db_run('DELETE FROM treatment_plan_items WHERE id = ?', [$item['id']]);
                audit('plan-linie-stearsa', $item['description'], null, $pid);
                flash('Lucrarea a fost ștearsă.');
            } else {
                $to = post('stare');
                if (!in_array($to, ITEM_TRANSITIONS[$item['status']], true)) {
                    throw new DomainException('Lucrarea nu poate trece din „' . ITEM_STATUS[$item['status']] . '” în „' . (ITEM_STATUS[$to] ?? $to) . '”.');
                }
                db_tx(static function () use ($item, $to, $plan, $userDoctor, $pid): void {
                    $row = ['status' => $to];
                    if ($to === 'efectuat') {
                        $row += ['performed_at' => now_sql(), 'performed_by' => $userDoctor ?? ($plan['doctor_id'] !== null ? (int) $plan['doctor_id'] : null)];
                        if ($plan['status'] === 'acceptat') {
                            db_update('treatment_plans', ['status' => 'in-curs', 'updated_at' => now_sql()], 'id = :id', ['id' => $plan['id']]);
                        }
                    }
                    db_update('treatment_plan_items', $row, 'id = :id', ['id' => $item['id']]);
                    audit('plan-linie-' . $to, $item['description'] . ($item['tooth'] ? " (dinte {$item['tooth']})" : ''), null, $pid);
                });
                flash('„' . $item['description'] . '”: ' . mb_strtolower(ITEM_STATUS[$to]) . '.');
            }
            redirect("{$base}/{$planId}#lucrari");
        }
    } catch (DomainException $e) {
        flash($e->getMessage(), 'eroare');
        redirect($plan ? "{$base}/{$plan['id']}" : $base);
    }
}

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$docOptions = ['' => 'Nespecificat'] + array_map('strval', $docs);
$clinicOptions = ['' => 'Nespecificată'];
foreach ($names as $lid => $n) {
    $clinicOptions[(string) $lid] = $n;
}
$metaForm = '<form method="post" novalidate class="flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="detalii">'
    . ($isNew ? error_summary($errors) : '')
    . text_field('title', 'Titlul planului', ['value' => $meta['title'], 'required' => true, 'error' => $err('title')])
    . '<div class="grid gap-4 md:grid-cols-3">'
    . select_field('doctor_id', 'Medicul', $docOptions, ['value' => $meta['doctor_id']])
    . select_field('location_id', 'Clinica', $clinicOptions, ['value' => $meta['location_id']])
    . text_field('valid_until', 'Prețuri valabile până la', ['type' => 'date', 'value' => $meta['valid_until'], 'optional' => true, 'error' => $err('valid_until')])
    . '</div>'
    . (($plan === null || plan_prices_editable($plan['status'])) ? text_field('discount', 'Reducere pe tot planul (lei)', ['value' => $meta['discount'], 'inputmode' => 'decimal', 'optional' => true, 'error' => $err('discount'), 'class' => 'max-w-xs']) : '')
    . text_area('notes', 'Observații pentru pacient', ['value' => $meta['notes'], 'rows' => 3, 'optional' => true, 'hint' => 'Apar pe planul tipărit: alternative, durata estimată, indicații.'])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . ($isNew ? 'Creați planul' : 'Salvați detaliile') . '</button></div></form>';

if ($isNew) {
    $body = patient_header($p, $user, 'planuri') . '<div class="max-w-3xl">' . admin_section_open('Plan nou', 'plan-nou') . '<div class="mt-4">' . $metaForm . '</div></section></div>';
    admin_page('Plan nou', $body, $user);
    exit;
}

$planId = (int) $plan['id'];
$items = plan_items($planId);
$invoiced = invoiced_item_ids($planId);
$t = plan_totals($items, (int) $plan['discount']);
$editable = plan_prices_editable($plan['status']);

// The lines, by phase.
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$byPhase = [];
foreach ($items as $i) {
    $byPhase[(int) $i['phase']][] = $i;
}
$tables = '';
foreach ($byPhase as $phase => $list) {
    $rows = '';
    foreach ($list as $i) {
        $iid = (int) $i['id'];
        $gross = (int) $i['quantity'] * (int) $i['unit_price'];
        $net = $gross - min((int) $i['discount'], $gross);
        $isInvoiced = in_array($iid, $invoiced, true);
        $btns = '';
        if ($manage && !$isInvoiced) {
            foreach (ITEM_TRANSITIONS[$i['status']] as $to) {
                if ($to === 'propus' && $i['status'] !== 'anulat') {
                    continue;
                }
                $label = ['acceptat' => 'Acceptat', 'programat' => 'Programat', 'efectuat' => 'Efectuat', 'anulat' => 'Anulați', 'propus' => 'Reactivați'][$to];
                $btns .= '<button type="submit" name="stare" value="' . e($to) . '" class="' . e(btn($to === 'efectuat' ? 'primary' : 'text', 's')) . '"' . ($to === 'anulat' ? ' data-confirma="Anulați lucrarea?"' : '') . '>' . e($label) . '</button>';
            }
        }
        $tools = '';
        if ($manage && !$isInvoiced && plan_open($plan['status']) && $i['status'] !== 'efectuat') {
            $tools .= '<a href="' . e(admin_url("{$base}/{$planId}", ['linie' => $iid])) . '#linie-noua" class="' . e(btn('text', 's')) . '" aria-label="Modificați: ' . e($i['description']) . '">' . icon('pencil', 16) . '</a>';
        }
        if ($manage && !$isInvoiced && $editable) {
            $tools .= '<form method="post" class="inline" data-confirma="Ștergeți lucrarea?">' . csrf_field() . '<input type="hidden" name="op" value="sterge-linie"><input type="hidden" name="item_id" value="' . $iid . '"><button type="submit" class="' . e(btn('text', 's')) . '" aria-label="Ștergeți: ' . e($i['description']) . '">' . icon('trash-2', 16) . '</button></form>';
        }
        $rows .= '<tr class="' . e(cn('border-t border-linie align-top', $i['status'] === 'anulat' ? 'text-discret' : '')) . '">'
            . '<td class="cifre px-3 py-2 font-semibold">' . ($i['tooth'] ? (int) $i['tooth'] : '—') . '</td>'
            . '<td class="px-3 py-2"><span class="' . ($i['status'] === 'anulat' ? 'line-through' : '') . '">' . e($i['description']) . '</span>'
            . ($i['performed_at'] ? '<span class="block text-mic text-discret">Efectuat ' . e(format_date($i['performed_at'])) . ($i['performed_by'] ? ', ' . e($docs[(int) $i['performed_by']] ?? '') : '') . '</span>' : '')
            . ($isInvoiced ? '<span class="block text-mic font-medium text-actiune">Facturat</span>' : '') . '</td>'
            . '<td class="cifre whitespace-nowrap px-3 py-2 text-right">' . ((int) $i['quantity'] > 1 ? (int) $i['quantity'] . ' × ' : '') . e(lei((int) $i['unit_price'])) . ((int) $i['discount'] > 0 ? '<span class="block text-mic text-discret">−' . e(lei((int) $i['discount'])) . '</span>' : '') . '</td>'
            . '<td class="cifre whitespace-nowrap px-3 py-2 text-right font-semibold">' . e(lei($net)) . '</td>'
            . '<td class="px-3 py-2">' . item_status_chip($i['status']) . '</td>'
            . '<td class="px-3 py-2"><div class="flex flex-wrap items-center justify-end gap-1">'
            . ($btns !== '' ? '<form method="post" class="flex flex-wrap gap-1">' . csrf_field() . '<input type="hidden" name="op" value="stare-linie"><input type="hidden" name="item_id" value="' . $iid . '">' . $btns . '</form>' : '')
            . $tools . '</div></td></tr>';
    }
    $tables .= '<h3 class="mt-6 text-control font-semibold first:mt-3">Faza ' . $phase . '</h3>'
        . '<div class="mt-2 relative overflow-x-auto"><table class="w-full min-w-[52rem] table-fixed border-collapse text-corp"><thead><tr><th scope="col" class="' . $th . ' w-16">Dinte</th><th scope="col" class="' . $th . '">Lucrarea</th><th scope="col" class="' . $th . ' w-32 text-right">Preț</th><th scope="col" class="' . $th . ' w-32 text-right">Valoare</th><th scope="col" class="' . $th . ' w-28">Stare</th><th scope="col" class="' . $th . ' w-72"><span class="sr-only">Acțiuni</span></th></tr></thead><tbody>' . $rows . '</tbody></table></div>';
}
if ($tables === '') {
    $tables = '<p class="mt-3 text-corp text-discret">Nicio lucrare încă.' . ($manage ? ' Adăugați-le mai jos sau din odontogramă.' : '') . '</p>';
}

$itemForm = '';
if ($manage && plan_open($plan['status'])) {
    $itemForm = admin_section_open($editItem ? 'Modificați lucrarea' : 'Adăugați o lucrare', 'linie-noua', $editItem && !$editable ? 'Planul este acceptat: prețul nu se mai schimbă.' : 'Alegeți din lista de prețuri; prețul se completează singur și îl puteți schimba.')
        . '<form method="post" novalidate class="mt-4 grid gap-4 md:grid-cols-12">' . csrf_field() . '<input type="hidden" name="op" value="linie">' . ($editItem ? '<input type="hidden" name="item_id" value="' . (int) $editItem['id'] . '">' : '')
        . '<div class="md:col-span-12">' . error_summary($errors) . '</div>'
        . service_select('service_id', 'Serviciul', admin_int($it['service_id']), ['class' => 'md:col-span-6', 'target' => 'field-price', 'nameTarget' => 'field-description', 'empty' => 'Din lista de prețuri'])
        . text_field('description', 'Descrierea', ['value' => $it['description'], 'error' => $err('description'), 'class' => 'md:col-span-6'])
        . text_field('tooth', 'Dintele', ['value' => $it['tooth'], 'inputmode' => 'numeric', 'maxlength' => 2, 'optional' => true, 'error' => $err('tooth'), 'class' => 'md:col-span-2'])
        . select_field('phase', 'Faza', array_combine(array_map('strval', range(1, 6)), array_map(static fn ($n) => "Faza {$n}", range(1, 6))), ['value' => $it['phase'], 'class' => 'md:col-span-2'])
        . (($editItem === null || $editable) ? text_field('quantity', 'Cantitatea', ['value' => $it['quantity'], 'inputmode' => 'numeric', 'error' => $err('quantity'), 'class' => 'md:col-span-2'])
            . text_field('price', 'Preț unitar (lei)', ['value' => $it['price'], 'inputmode' => 'decimal', 'error' => $err('price'), 'class' => 'md:col-span-3'])
            . text_field('discount', 'Reducere (lei)', ['value' => $it['discount'], 'inputmode' => 'decimal', 'optional' => true, 'error' => $err('discount'), 'class' => 'md:col-span-3'])
            : '<input type="hidden" name="quantity" value="' . e($it['quantity']) . '"><input type="hidden" name="price" value="' . e($it['price']) . '"><input type="hidden" name="discount" value="' . e($it['discount']) . '">')
        . '<div class="flex flex-wrap gap-3 md:col-span-12"><button type="submit" class="' . e(btn('primary')) . '">' . ($editItem ? 'Salvați lucrarea' : icon('plus', 18) . 'Adăugați lucrarea') . '</button>'
        . ($editItem ? '<a href="' . e("{$base}/{$planId}") . '" class="' . e(btn('text')) . '">Renunțați</a>' : '') . '</div></form></section>';
}

$statusButtons = '';
if ($manage) {
    foreach (PLAN_TRANSITIONS[$plan['status']] as $to) {
        $statusButtons .= '<button type="submit" name="stare" value="' . e($to) . '" class="' . e(btn(in_array($to, ['anulat', 'ciorna', 'respins'], true) ? 'secondary' : 'primary', 's')) . '"' . ($to === 'anulat' ? ' data-confirma="Anulați planul?"' : '') . '>' . e(PLAN_ACTION[$to]) . '</button>';
    }
    $statusButtons = $statusButtons !== '' ? '<form method="post" class="flex flex-wrap gap-2">' . csrf_field() . '<input type="hidden" name="op" value="stare">' . $statusButtons . '</form>' : '';
}
$tile = static fn (string $label, string $value, string $cls = '') => '<div class="' . e(cn('rounded-panou border border-linie bg-suprafata p-4', $cls)) . '"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.6rem] leading-tight cifre">' . e($value) . '</p></div>';
$tiles = '<div class="grid gap-3 sm:grid-cols-3">' . $tile('Total plan', lei($t['total']), 'bg-menta-pal')
    . $tile('Efectuat', lei($t['done']) . ' · ' . $t['done_count'] . '/' . $t['count'])
    . $tile($t['plan_discount'] > 0 ? 'Reduceri (din care pe plan)' : 'Reduceri', lei($t['line_discounts'] + $t['plan_discount']) . ($t['plan_discount'] > 0 ? ' · ' . format_amount($t['plan_discount']) : '')) . '</div>';

$actions = '<a href="' . e("{$base}/{$planId}/tipar") . '" class="' . e(btn('secondary')) . '">' . icon('printer', 18) . 'Tipăriți</a>'
    . (can('billing', $user) && in_array($plan['status'], ['acceptat', 'in-curs', 'finalizat'], true) ? '<a href="/admin/facturi/noua?pacient=' . $pid . '" class="' . e(btn('primary')) . '">' . icon('receipt', 18) . 'Facturați</a>' : '');
$body = patient_header($p, $user, 'planuri')
    . '<div class="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div>'
    . '<p><a href="' . e($base) . '" class="text-mic text-link underline">Toate planurile</a></p>'
    . '<h2 class="mt-1 flex flex-wrap items-center gap-3 font-display text-h2">' . e($plan['title']) . ' ' . plan_status_chip($plan['status']) . '</h2>'
    . '<p class="mt-1 text-mic text-discret">' . e(implode(' · ', array_filter(['Creat ' . format_date($plan['created_at']), $docs[(int) $plan['doctor_id']] ?? '', $names[(int) $plan['location_id']] ?? '', $plan['valid_until'] ? 'prețuri valabile până la ' . format_date($plan['valid_until']) : '']))) . '</p>'
    . '</div><div class="flex flex-wrap gap-3">' . $actions . '</div></div>'
    . ($statusButtons !== '' ? '<div class="mb-6 rounded-panou border border-linie bg-suprafata p-4"><p class="mb-2 text-mic font-semibold text-discret">Pasul următor</p>' . $statusButtons . '</div>' : '')
    . $tiles
    . '<div class="mt-8 flex flex-col gap-8">'
    . admin_section_open('Lucrări', 'lucrari') . $tables . '</section>'
    . $itemForm
    . ($manage ? '<details class="rounded-panou border border-linie bg-suprafata p-4 md:p-6"' . ($errors !== [] && post('op') === 'detalii' ? ' open' : '') . '><summary class="cursor-pointer text-h3 font-semibold">Detaliile planului</summary><div class="mt-4">' . $metaForm . '</div></details>'
        : ($plan['notes'] ? admin_section_open('Observații', 'observatii') . '<p class="mt-2 whitespace-pre-line text-corp">' . e($plan['notes']) . '</p></section>' : ''))
    . '</div>';
admin_page($plan['title'], $body, $user);
