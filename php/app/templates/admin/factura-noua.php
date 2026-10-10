<?php
/**
 * /admin/facturi/noua?pacient=ID: a new invoice. Lines come from the treatment plans (accepted
 * or done, not yet invoiced) and from the price list or free text; the payment can be recorded
 * at once. Without a patient, the page first asks for one.
 */
declare(strict_types=1);

$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
$pid = admin_int(query('pacient') ?: post('pacient'));
$p = $pid !== null ? find_patient($pid, $user) : null;

if ($p === null) {
    $q = trim(query('q'));
    $list = '';
    if ($q !== '') {
        [$scope, $params] = patient_scope_sql($user);
        $rows = db_all("SELECT p.* FROM patients p WHERE p.active = 1 AND {$scope} AND (p.search_text LIKE ? OR p.file_number = ?) ORDER BY p.last_name, p.first_name LIMIT 20", array_merge($params, ['%' . fold_text($q) . '%', ctype_digit($q) ? (int) $q : 0]));
        foreach ($rows as $r) {
            $list .= '<li class="border-t border-linie first:border-t-0"><a href="/admin/facturi/noua?pacient=' . (int) $r['id'] . '" class="flex min-h-control items-center justify-between gap-3 px-1 py-2 hover:bg-fundal"><span class="font-semibold text-link">' . e(patient_name($r)) . '</span><span class="text-mic text-discret">Fișa ' . (int) $r['file_number'] . ($r['phone'] ? ' · ' . e(format_phone($r['phone'])) : '') . '</span></a></li>';
        }
        $list = $list !== '' ? '<ul class="mt-4">' . $list . '</ul>' : '<p class="mt-4 text-corp text-discret">Niciun pacient găsit.</p>';
    }
    $body = admin_header('Factură nouă', 'Pentru ce pacient?')
        . '<div class="max-w-2xl">' . admin_section_open('Căutați pacientul', 'cauta')
        . '<form method="get" class="mt-4 flex flex-wrap items-end gap-3"><div class="min-w-0 flex-1">' . text_field('q', 'Nume, telefon sau nr. fișei', ['value' => $q, 'autocomplete' => 'off']) . '</div><button type="submit" class="' . e(btn('primary')) . '">' . icon('search', 18) . 'Căutați</button></form>'
        . $list . '</section></div>';
    admin_page('Factură nouă', $body, $user);
    exit;
}

$id = (int) $p['id'];
if ($p['anonymized_at'] !== null) {
    flash('Fișa este anonimizată; nu se mai emit facturi noi.', 'eroare');
    redirect("/admin/pacienti/{$id}/financiar");
}
$cfg = invoicing();
$candidates = invoice_candidates($id);
$doctors = doctor_short_names();
$rowsCount = max(1, min(20, (int) (query('randuri') ?: post('randuri') ?: ($candidates === [] ? 3 : 1))));
$address = implode(', ', array_filter([$p['street'], $p['city'], $p['county'] ? 'jud. ' . $p['county'] : null]));
$defaultLoc = (int) ($p['preferred_location_id'] ?? 0);
$v = [
    'location_id' => (string) (in_array($defaultLoc, $allowed, true) ? $defaultLoc : (current_clinic_id($user) ?? '')),
    'buyer' => 'pacient',
    'buyer_name' => patient_name($p),
    'buyer_address' => $address,
    'buyer_email' => (string) $p['email'],
    'buyer_company' => '',
    'buyer_cui' => '',
    'buyer_reg_com' => '',
    'vat_rate' => (string) (int) $cfg['vatRate'],
    'notes' => '',
    'pay' => 'numerar',
    'pay_amount' => '',
];
$picked = [];
foreach ($candidates as $c) {
    if ($c['status'] === 'efectuat') {
        $picked[(int) $c['id']] = true;
    }
}
$free = array_fill(0, $rowsCount, ['service_id' => '', 'description' => '', 'tooth' => '', 'quantity' => '1', 'price' => '', 'discount' => '', 'doctor_id' => '']);
$errors = [];

if (is_post()) {
    csrf_check();
    foreach (array_keys($v) as $k) {
        $v[$k] = post($k);
    }
    $vat = (int) $v['vat_rate'];
    $lines = [];
    $picked = [];
    $byId = [];
    foreach ($candidates as $c) {
        $byId[(int) $c['id']] = $c;
    }
    foreach ((array) ($_POST['plan'] ?? []) as $cid) {
        $cid = (int) $cid;
        if (!isset($byId[$cid])) {
            $errors['form'] = 'O lucrare din plan nu mai poate fi facturată (a fost facturată sau schimbată). Verificați lista.';
            continue;
        }
        $c = $byId[$cid];
        $picked[$cid] = true;
        $lines[] = [
            'plan_item_id' => $cid,
            'service_id' => $c['service_id'] !== null ? (int) $c['service_id'] : null,
            'doctor_id' => $c['performed_by'] !== null ? (int) $c['performed_by'] : ($c['plan_doctor_id'] !== null ? (int) $c['plan_doctor_id'] : null),
            'description' => $c['description'],
            'tooth' => $c['tooth'] !== null ? (int) $c['tooth'] : null,
            'quantity' => (int) $c['quantity'],
            'unit_price' => (int) $c['unit_price'],
            'discount' => min((int) $c['discount'], (int) $c['quantity'] * (int) $c['unit_price']),
            'vat_rate' => $vat,
        ];
    }
    $free = [];
    foreach ((array) ($_POST['linie'] ?? []) as $i => $r) {
        $r = array_map(static fn ($x) => is_string($x) ? trim($x) : '', (array) $r) + ['service_id' => '', 'description' => '', 'tooth' => '', 'quantity' => '1', 'price' => '', 'discount' => '', 'doctor_id' => ''];
        $free[] = $r;
        if ($r['description'] === '' && $r['service_id'] === '' && $r['price'] === '') {
            continue;
        }
        $n = count($free);
        try {
            $price = parse_lei($r['price']) ?? 0;
            $disc = parse_lei($r['discount']) ?? 0;
        } catch (InvalidArgumentException $e) {
            $errors["linie-{$i}"] = "Rândul {$n}: prețul sau reducerea nu sunt numere.";
            continue;
        }
        $tooth = $r['tooth'] !== '' ? (int) $r['tooth'] : null;
        if ($tooth !== null && !is_fdi_tooth($tooth)) {
            $errors["linie-{$i}"] = "Rândul {$n}: dintele se scrie ca în schema FDI, de exemplu 36.";
            continue;
        }
        $line = [
            'plan_item_id' => null,
            'service_id' => admin_int($r['service_id']),
            'doctor_id' => isset($doctors[(int) $r['doctor_id']]) ? (int) $r['doctor_id'] : null,
            'description' => $r['description'],
            'tooth' => $tooth,
            'quantity' => ctype_digit($r['quantity']) ? (int) $r['quantity'] : 0,
            'unit_price' => $price,
            'discount' => $disc,
            'vat_rate' => $vat,
        ];
        if (($pr = line_problems($line)) !== []) {
            $errors["linie-{$i}"] = "Rândul {$n}: " . implode(' ', $pr);
            continue;
        }
        $lines[] = $line;
    }
    if ($lines === [] && !isset($errors['form'])) {
        $errors['form'] = 'Factura nu are nicio linie. Bifați o lucrare din plan sau completați un serviciu.';
    }
    if ($vat < 0 || $vat > 100 || !ctype_digit($v['vat_rate'])) {
        $errors['vat_rate'] = 'Cota TVA este între 0 și 100.';
    }
    $loc = admin_int($v['location_id']);
    if ($loc === null || !in_array($loc, $allowed, true)) {
        $errors['location_id'] = 'Alegeți clinica.';
    }
    $company = $v['buyer'] === 'firma';
    if ($company) {
        if (mb_strlen($v['buyer_company']) < 2) {
            $errors['buyer_company'] = 'Scrieți denumirea firmei.';
        }
        if (!preg_match('/^(RO)?\d{2,10}$/i', str_replace(' ', '', $v['buyer_cui']))) {
            $errors['buyer_cui'] = 'CUI-ul are doar cifre, eventual cu RO în față.';
        }
    } elseif (mb_strlen($v['buyer_name']) < 2) {
        $errors['buyer_name'] = 'Scrieți numele cumpărătorului.';
    }
    if ($v['buyer_email'] !== '' && !filter_var($v['buyer_email'], FILTER_VALIDATE_EMAIL)) {
        $errors['buyer_email'] = 'E-mailul nu este corect.';
    }
    $payAmount = null;
    if (isset(PAYMENT_METHODS[$v['pay']]) && $v['pay_amount'] !== '') {
        try {
            $payAmount = parse_lei($v['pay_amount']);
        } catch (InvalidArgumentException $e) {
            $errors['pay_amount'] = 'Scrieți suma încasată, de exemplu 250.';
        }
    }
    $total = invoice_totals($lines)['total'];
    if ($payAmount !== null && ($payAmount <= 0 || $payAmount > $total)) {
        $errors['pay_amount'] = 'Suma încasată este între 0 și totalul facturii (' . lei($total) . ').';
    }
    if ($errors === []) {
        try {
            $res = create_invoice([
                'patient_id' => $id,
                'location_id' => $loc,
                'lines' => $lines,
                'buyer_name' => mb_substr($company ? $v['buyer_company'] : $v['buyer_name'], 0, 190),
                'buyer_address' => mb_substr($v['buyer_address'], 0, 255) ?: null,
                'buyer_email' => $v['buyer_email'] ?: null,
                'buyer_company' => $company ? mb_substr($v['buyer_company'], 0, 190) : null,
                'buyer_cui' => $company ? strtoupper(str_replace(' ', '', $v['buyer_cui'])) : null,
                'buyer_reg_com' => $company ? mb_substr($v['buyer_reg_com'], 0, 40) ?: null : null,
                'notes' => mb_substr($v['notes'], 0, 1000) ?: null,
                'pay_method' => isset(PAYMENT_METHODS[$v['pay']]) ? $v['pay'] : null,
                'pay_amount' => $payAmount,
            ], $user);
            flash("Factura {$res['number']} a fost emisă" . ($res['payment_id'] ? ' și încasată' : '') . '.');
            redirect("/admin/facturi/{$res['id']}" . ($res['payment_id'] ? "?incasare={$res['payment_id']}" : ''));
        } catch (DomainException $e) {
            $errors['form'] = $e->getMessage();
            $candidates = invoice_candidates($id);
        }
    }
}

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$locOptions = [];
foreach ($allowed as $l) {
    $locOptions[(string) $l] = $names[$l];
}

// Lines from the plans.
$planRows = '';
foreach ($candidates as $c) {
    $cid = (int) $c['id'];
    $gross = (int) $c['quantity'] * (int) $c['unit_price'];
    $net = $gross - min((int) $c['discount'], $gross);
    $doc = $doctors[(int) ($c['performed_by'] ?? $c['plan_doctor_id'] ?? 0)] ?? '';
    $planRows .= '<li class="border-t border-linie first:border-t-0">'
        . checkbox_field('plan[]', '<span class="font-semibold">' . e($c['description']) . ($c['tooth'] ? ' · dinte ' . (int) $c['tooth'] : '') . '</span> <span class="cifre">' . e(lei($net)) . '</span>', [
            'id' => "plan-{$cid}", 'value' => (string) $cid, 'checked' => isset($picked[$cid]),
            'description' => $c['plan_title'] . ' · ' . (ITEM_STATUS[$c['status']] ?? $c['status']) . ($doc !== '' ? ' · ' . $doc : '') . ((int) $c['quantity'] > 1 ? ' · ' . (int) $c['quantity'] . ' × ' . lei((int) $c['unit_price']) : '') . ((int) $c['discount'] > 0 ? ' · reducere ' . lei((int) $c['discount']) : ''),
            'class' => 'py-1',
        ])
        . '<input type="hidden" data-linie-plan="' . $cid . '" data-valoare="' . $net . '"></li>';
}

// Free lines.
$docOptions = ['' => 'Medicul (opțional)'];
foreach ($doctors as $did => $dn) {
    $docOptions[(string) $did] = $dn;
}
$freeRows = '';
foreach ($free as $i => $r) {
    $f = static fn (string $k) => "linie[{$i}][{$k}]";
    $fid = static fn (string $k) => "linie-{$i}-{$k}";
    $freeRows .= '<fieldset id="field-linie-' . $i . '" tabindex="-1" class="grid gap-3 border-t border-linie pt-4 first:border-t-0 first:pt-0 md:grid-cols-12" data-linie-libera>'
        . '<legend class="sr-only">Rândul ' . ($i + 1) . '</legend>'
        . service_select($f('service_id'), 'Serviciul', admin_int((string) $r['service_id']), ['id' => $fid('service_id'), 'class' => 'md:col-span-6', 'target' => $fid('price'), 'nameTarget' => $fid('description'), 'empty' => 'Din lista de prețuri (opțional)'])
        . text_field($f('description'), 'Descrierea pe factură', ['id' => $fid('description'), 'value' => $r['description'], 'class' => 'md:col-span-6'])
        . text_field($f('tooth'), 'Dinte', ['id' => $fid('tooth'), 'value' => $r['tooth'], 'inputmode' => 'numeric', 'maxlength' => 2, 'optional' => true, 'class' => 'md:col-span-2'])
        . text_field($f('quantity'), 'Cant.', ['id' => $fid('quantity'), 'value' => $r['quantity'], 'inputmode' => 'numeric', 'class' => 'md:col-span-2', 'attrs' => ['data-cant' => true]])
        . text_field($f('price'), 'Preț (lei)', ['id' => $fid('price'), 'value' => $r['price'], 'inputmode' => 'decimal', 'class' => 'md:col-span-2', 'attrs' => ['data-pret' => true]])
        . text_field($f('discount'), 'Reducere (lei)', ['id' => $fid('discount'), 'value' => $r['discount'], 'inputmode' => 'decimal', 'optional' => true, 'class' => 'md:col-span-2', 'attrs' => ['data-reducere' => true]])
        . select_field($f('doctor_id'), 'Medic', $docOptions, ['id' => $fid('doctor_id'), 'value' => (string) $r['doctor_id'], 'class' => 'md:col-span-4'])
        . '<div class="md:col-span-12">' . field_error($fid('eroare'), $errors["linie-{$i}"] ?? null) . '</div>'
        . '</fieldset>';
}

$form = '<form method="post" novalidate class="flex flex-col gap-8" data-factura data-confirma="Emiteți factura? Primește număr și apoi nu mai poate fi ștearsă, doar anulată.">' . csrf_field()
    . '<input type="hidden" name="pacient" value="' . $id . '"><input type="hidden" name="randuri" value="' . $rowsCount . '">'
    . error_summary($errors)
    . ($candidates !== [] ? admin_section_open('Din planurile de tratament', 'din-plan', 'Lucrările acceptate sau efectuate care nu sunt încă facturate. Cele efectuate sunt bifate.') . '<ul class="mt-3">' . $planRows . '</ul></section>' : '')
    . admin_section_open($candidates !== [] ? 'Alte servicii' : 'Servicii', 'servicii-libere', 'Alegeți din lista de prețuri (prețul se completează singur) sau scrieți descrierea. Rândurile goale nu apar pe factură.')
    . '<div class="mt-4 flex flex-col gap-5">' . $freeRows . '</div>'
    . '<p class="mt-4"><a href="' . e(admin_url('/admin/facturi/noua', ['pacient' => $id, 'randuri' => $rowsCount + 3])) . '" class="text-link underline underline-offset-4">Mai multe rânduri</a></p></section>'
    . admin_section_open('Cumpărătorul', 'cumparator')
    . '<div class="mt-4 flex flex-col gap-4">'
    . radio_group('buyer', 'Factura se emite pe', ['pacient' => 'Numele pacientului (persoană fizică)', 'firma' => 'O firmă (decontare)'], ['inline' => true, 'value' => $v['buyer']])
    . '<div class="grid gap-4 md:grid-cols-2">'
    . text_field('buyer_name', 'Numele (persoană fizică)', ['value' => $v['buyer_name'], 'error' => $err('buyer_name')])
    . text_field('buyer_email', 'E-mail', ['type' => 'email', 'value' => $v['buyer_email'], 'optional' => true, 'error' => $err('buyer_email')])
    . text_field('buyer_address', 'Adresa', ['value' => $v['buyer_address'], 'optional' => true, 'class' => 'md:col-span-2'])
    . text_field('buyer_company', 'Denumirea firmei', ['value' => $v['buyer_company'], 'optional' => true, 'error' => $err('buyer_company'), 'hint' => 'Doar dacă factura se emite pe firmă.'])
    . text_field('buyer_cui', 'CUI firmă', ['value' => $v['buyer_cui'], 'optional' => true, 'error' => $err('buyer_cui')])
    . text_field('buyer_reg_com', 'Nr. Reg. Com.', ['value' => $v['buyer_reg_com'], 'optional' => true])
    . '</div></div></section>'
    . admin_section_open('Detalii și plata', 'plata')
    . '<div class="mt-4 grid gap-4 md:grid-cols-3">'
    . (count($allowed) > 1 ? select_field('location_id', 'Clinica', $locOptions, ['value' => $v['location_id'], 'error' => $err('location_id')]) : '<input type="hidden" name="location_id" value="' . e((string) ($allowed[0] ?? '')) . '">')
    . text_field('vat_rate', 'Cota TVA (%)', ['value' => $v['vat_rate'], 'inputmode' => 'numeric', 'error' => $err('vat_rate'), 'hint' => (int) $cfg['vatRate'] === 0 ? 'Serviciile stomatologice sunt scutite: 0.' : null, 'attrs' => ['data-tva' => true]])
    . '</div>'
    . text_area('notes', 'Mențiuni pe factură', ['value' => $v['notes'], 'rows' => 2, 'optional' => true, 'class' => 'mt-4'])
    . '<div class="mt-4 grid gap-4 md:grid-cols-2">'
    . radio_group('pay', 'Încasați acum?', ['numerar' => 'Numerar', 'card' => 'Card', 'transfer' => 'Transfer', 'nu' => 'Nu acum'], ['inline' => true, 'value' => $v['pay']])
    . text_field('pay_amount', 'Suma încasată (lei)', ['value' => $v['pay_amount'], 'inputmode' => 'decimal', 'optional' => true, 'error' => $err('pay_amount'), 'hint' => 'Gol = tot totalul facturii.'])
    . '</div></section>'
    . '<div class="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t border-linie bg-fundal/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-panou md:border">'
    . '<p class="text-corp">Total: <strong class="font-display text-[1.5rem] cifre" data-total-factura>—</strong></p>'
    . '<button type="submit" class="' . e(btn('primary', 'l', 'ml-auto')) . '">' . icon('receipt', 20) . 'Emiteți factura</button></div>'
    . '</form>';

$body = '<p class="mb-4"><a href="/admin/pacienti/' . $id . '/financiar" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . e(patient_name($p)) . '</a></p>'
    . admin_header('Factură nouă', 'Pentru ' . patient_name($p) . ', fișa nr. ' . (int) $p['file_number'] . '. Seria ' . $cfg['invoiceSeries'] . ', următorul număr: ' . doc_number($cfg['invoiceSeries'], peek_sequence('factura:' . $cfg['invoiceSeries'])) . '.')
    . '<div class="max-w-5xl">' . $form . '</div>';
admin_page('Factură nouă', $body, $user);
