<?php
/**
 * /admin/pacienti/{id}/proceduri: the procedures done for the patient and what was paid for them
 * (as in QDental): the totals (to pay, paid, left, advance), „Adaugă procedură” for the doctor,
 * the list with the state of each one, the payments and „Încasare” for reception.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$writable = $p['anonymized_at'] === null;
$canPay = can('procedures.pay', $user) && $writable;
$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
$doctors = array_column(db_all('SELECT id, public_name FROM doctors ORDER BY sort_order, id'), 'public_name', 'id');
$errors = [];
$back = "/admin/pacienti/{$pid}/proceduri";
$today = date('Y-m-d');
$v = [
    'performed_on' => preg_match('/^\d{4}-\d{2}-\d{2}$/', query('data')) ? query('data') : $today,
    'doctor_id' => (string) (admin_int(query('medic')) ?? ($user['doctor_id'] ?? null) ?? ($p['primary_doctor_id'] ?? '')),
    'location_id' => (string) (admin_int(query('clinica')) ?? current_clinic_id($user) ?? ($p['preferred_location_id'] ?? ($allowed[0] ?? ''))),
    'service_id' => '', 'name' => '', 'tooth' => '', 'price' => '', 'discount' => '', 'lab' => '', 'done' => '1', 'notes' => '',
    'appointment_id' => (string) (admin_int(query('programare')) ?? ''),
];
// An account that starts from zero („Luduș 2”) sees and changes only what is since its day; an
// account with its own ledger only what it entered; the others the common ledger; the
// administrators all (or one ledger, ?registru=).
$hist = history_from($user);
$scope = proc_scope($user, query('registru'));
$ledgers = ledger_users();
$inScope = static fn (array $r) => ($scope['ledger'] === null || (int) ($r['ledger_user_id'] ?? 0) === $scope['ledger']) && ($hist === null || $r['performed_on'] >= $hist);
// Who may change or delete a procedure: an administrator, or whoever added it, the same week.
$mayEdit = static fn (array $r) => $writable && $inScope($r) && (is_admin($user) || ((int) $r['created_by'] === (int) $user['id'] && strtotime($r['created_at']) > time() - 7 * 86400));

if (is_post() && $writable) {
    csrf_check();
    $op = post('op');
    if ($op === 'adauga' || $op === 'modifica') {
        foreach (array_keys($v) as $k) {
            $v[$k] = post($k);
        }
        $v['done'] = post('done') === '1' ? '1' : '0';
        $edit = null;
        if ($op === 'modifica') {
            $edit = db_one('SELECT * FROM procedures WHERE id = ? AND patient_id = ?', [(int) post('id'), $pid]);
            if ($edit === null || !$mayEdit($edit)) {
                flash('Procedura nu mai poate fi modificată.', 'eroare');
                redirect($back);
            }
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $v['performed_on']);
        if ($date === false || $v['performed_on'] > $today || ($hist !== null && $v['performed_on'] < $hist)) {
            $errors['performed_on'] = 'Alegeți ziua în care s-a făcut procedura (nu în viitor).';
        }
        // „c12”: a service of the clinic's own list (Luduș), with its name and price.
        $service = null;
        if (preg_match('/^c(\d+)$/', $v['service_id'], $cm)) {
            $cs = db_one('SELECT * FROM clinic_services WHERE id = ?', [(int) $cm[1]]);
            $service = $cs !== null ? ['id' => null, 'name' => $cs['name'], 'price_min' => $cs['price']] : null;
        } elseif ($v['service_id'] !== '') {
            $service = db_one('SELECT * FROM services WHERE id = ?', [(int) $v['service_id']]);
        }
        $name = trim($v['name']) !== '' ? trim($v['name']) : (string) ($service['name'] ?? '');
        if ($name === '') {
            $errors['service_id'] = 'Alegeți procedura din listă sau scrieți-o.';
        }
        $doc = admin_int($v['doctor_id']);
        if ($doc !== null && !isset($doctors[$doc])) {
            $doc = null;
        }
        $loc = admin_int($v['location_id']);
        if ($loc === null || !in_array($loc, $allowed, true)) {
            $errors['location_id'] = 'Alegeți clinica.';
        }
        try {
            $price = parse_lei($v['price']) ?? ($service && $service['price_min'] !== null ? (int) $service['price_min'] : null);
            $lab = parse_lei($v['lab']) ?? 0;
        } catch (InvalidArgumentException $e) {
            $errors['price'] = $e->getMessage();
            $price = $lab = 0;
        }
        if ($price === null) {
            $errors['price'] = 'Scrieți prețul (0 pentru o procedură fără plată).';
        }
        $pct = str_replace(',', '.', trim($v['discount']));
        if ($pct !== '' && (!is_numeric($pct) || (float) $pct < 0 || (float) $pct > 100)) {
            $errors['discount'] = 'Reducerea este între 0 și 100%.';
        }
        // Several teeth („13, 14, 15”): one line for each, each at the price above.
        $teeth = array_values(array_filter(preg_split('/[\s,;]+/', trim($v['tooth'])) ?: [], static fn ($t) => $t !== ''));
        if (count($teeth) > 16) {
            $errors['tooth'] = 'Cel mult 16 dinți odată.';
        }
        if ($errors === []) {
            $row = [
                'location_id' => $loc, 'doctor_id' => $doc, 'service_id' => $service && $service['id'] !== null ? (int) $service['id'] : null,
                'performed_on' => $v['performed_on'], 'name' => mb_substr($name, 0, 255),
                'price' => (int) $price, 'discount' => (int) round((int) $price * ((float) ($pct ?: 0)) / 100),
                'lab_cost' => (int) $lab, 'done' => (int) $v['done'], 'notes' => mb_substr(trim($v['notes']), 0, 500) ?: null,
                'updated_at' => now_sql(),
            ];
            $ledger = proc_new_ledger($user, post('ledger') ?: 'medic', $doc);
            db_tx(static function () use ($op, $edit, $row, $teeth, $pid, $user, $v, $scope, $ledger): void {
                if ($op === 'modifica') {
                    db_update('procedures', $row + ['tooth' => $teeth !== [] ? mb_substr(implode(', ', $teeth), 0, 40) : null], 'id = :id', ['id' => (int) $edit['id']]);
                    // A lower price: what was paid over it goes back to the advance.
                    db_run('DELETE FROM procedure_payment_items WHERE procedure_id = ?', [(int) $edit['id']]);
                } else {
                    foreach ($teeth !== [] ? $teeth : [null] as $t) {
                        db_insert('procedures', $row + [
                            'patient_id' => $pid, 'tooth' => $t !== null ? mb_substr($t, 0, 40) : null,
                            'appointment_id' => admin_int($v['appointment_id']), 'source' => 'panou', 'ledger_user_id' => $ledger,
                            'created_by' => (int) $user['id'], 'created_at' => now_sql(),
                        ]);
                    }
                }
                procedures_allocate($pid, $scope);
            });
            $n = max(1, count($teeth));
            audit($op === 'modifica' ? 'procedura-modificata' : 'procedura', $name . ($teeth !== [] ? ' · ' . implode(', ', $teeth) : '') . ' · ' . lei((int) $price - $row['discount']) . ($n > 1 ? " × {$n}" : ''), null, $pid);
            flash($op === 'modifica' ? 'Procedura a fost modificată.' : ($n > 1 ? "Au fost adăugate {$n} proceduri." : 'Procedura a fost adăugată.'));
            redirect($back);
        }
    } elseif ($op === 'sterge') {
        $r = db_one('SELECT * FROM procedures WHERE id = ? AND patient_id = ?', [(int) post('id'), $pid]);
        if ($r !== null && $mayEdit($r)) {
            db_tx(static function () use ($r, $pid, $scope): void {
                db_run('DELETE FROM procedures WHERE id = ?', [(int) $r['id']]);
                procedures_allocate($pid, $scope);
            });
            audit('procedura-stearsa', $r['name'] . ' · ' . format_date($r['performed_on']), null, $pid);
            flash('Procedura a fost ștearsă. Ce se plătise pentru ea a rămas ca avans.');
        }
        redirect($back);
    } elseif ($op === 'plata' && $canPay) {
        try {
            $amount = parse_lei(post('amount'));
        } catch (InvalidArgumentException $e) {
            $amount = null;
        }
        $method = isset(PROC_PAY_METHODS[post('pay_method')]) && post('pay_method') !== 'qdental' ? post('pay_method') : '';
        $paidOn = DateTimeImmutable::createFromFormat('!Y-m-d', post('paid_on'));
        $loc = admin_int(post('pay_location'));
        if ($amount === null || $amount <= 0) {
            $errors['amount'] = 'Scrieți suma încasată.';
        }
        if ($method === '') {
            $errors['pay_method'] = 'Alegeți cum a plătit.';
        }
        if ($paidOn === false || post('paid_on') > $today || ($hist !== null && post('paid_on') < $hist)) {
            $errors['paid_on'] = 'Alegeți ziua plății (nu în viitor).';
        }
        if ($loc === null || !in_array($loc, $allowed, true)) {
            $errors['pay_location'] = 'Alegeți clinica.';
        }
        if ($errors === []) {
            $ledger = proc_new_ledger($user, post('pay_ledger') ?: 'comun');
            db_tx(static function () use ($pid, $loc, $amount, $method, $user, $scope, $ledger): void {
                db_insert('procedure_payments', [
                    'patient_id' => $pid, 'location_id' => $loc, 'amount' => $amount, 'paid_on' => post('paid_on'), 'method' => $method,
                    'reference' => mb_substr(trim(post('reference')), 0, 60) ?: null, 'notes' => mb_substr(trim(post('pay_notes')), 0, 255) ?: null,
                    'received_by' => (int) $user['id'], 'ledger_user_id' => $ledger, 'created_at' => now_sql(),
                ]);
                procedures_allocate($pid, $scope);
            });
            audit('plata-proceduri', lei($amount) . ', ' . PROC_PAY_METHODS[$method], null, $pid);
            flash('Plata de ' . lei($amount) . ' a fost înregistrată.');
            redirect($back . '#plati');
        }
    } elseif ($op === 'anuleaza-plata' && is_admin($user)) {
        $pay = db_one('SELECT * FROM procedure_payments WHERE id = ? AND patient_id = ? AND cancelled_at IS NULL', [(int) post('id'), $pid]);
        if ($pay !== null) {
            db_tx(static function () use ($pay, $pid, $user): void {
                db_update('procedure_payments', ['cancelled_at' => now_sql(), 'cancelled_by' => (int) $user['id']], 'id = :id', ['id' => (int) $pay['id']]);
                db_run('DELETE FROM procedure_payment_items WHERE payment_id = ?', [(int) $pay['id']]);
                procedures_allocate($pid);
            });
            audit('plata-proceduri-anulata', lei((int) $pay['amount']) . ' din ' . format_date($pay['paid_on']), null, $pid);
            flash('Plata a fost anulată.');
        }
        redirect($back . '#plati');
    }
}

$rows = patient_procedures($pid, $scope);
$sum = procedures_summary($pid, $scope);
[$payWhere, $payParams] = proc_scope_sql($scope, 'pp', 'paid_on');
$payments = db_all('SELECT pp.*, u.name AS who FROM procedure_payments pp LEFT JOIN users u ON u.id = pp.received_by WHERE pp.patient_id = ?' . $payWhere . ' ORDER BY pp.paid_on DESC, pp.id DESC', array_merge([$pid], $payParams));
// The ledger of a row, for the administrators (who see them all).
$ledgerTag = static fn (array $r): string => is_admin($user) && (int) ($r['ledger_user_id'] ?? 0) > 0
    ? '<span class="mt-1 flex w-fit whitespace-nowrap rounded-chip border border-linie-control px-2 text-mic text-discret">' . e(ledger_label((int) $r['ledger_user_id'])) . '</span>' : '';
$err = static fn (string $k): ?string => $errors[$k] ?? null;

// ── The totals ──
$tile = static fn (string $label, int $value, string $cls = '') => '<div class="' . e(cn('rounded-panou border border-linie bg-suprafata p-4', $cls)) . '"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.75rem] leading-tight cifre">' . e(lei($value)) . '</p></div>';
$tiles = '<div class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">'
    . $tile('Total de plată', $sum['total'])
    . $tile('Achitat', $sum['paid'], 'border-actiune/40')
    . $tile('Rămas de plată', $sum['rest'], $sum['rest'] > 0 ? 'border-carmin bg-carmin-pal' : '')
    . $tile('Avans (plătit în plus)', $sum['advance'])
    . '</div>';

// ── „Adaugă procedură” ──
$priceList = procedure_price_options();
// Each option has the site price and the price approved at each clinic; the form takes the price
// of the clinic chosen below (admin.js), and the list shows the one of the usual clinic.
$priceClinic = (int) $v['location_id'];
// A clinic with its own price list (Luduș) gets it instead of the site's: its options carry
// data-clinica, and admin.js shows those of the clinic chosen below.
$clinicLists = array_intersect_key(clinic_service_lists(), array_flip($allowed));
$opts = static function (string $selected) use ($priceList, $priceClinic, $clinicLists, $names): string {
    $out = '<option value="">Alegeți din lista de prețuri…</option>';
    foreach ($clinicLists as $lid => $items) {
        $out .= '<optgroup label="' . e('Lista ' . ($names[$lid] ?? '')) . '" data-clinica="' . (int) $lid . '">';
        foreach ($items as $cid => $c) {
            $out .= '<option value="c' . $cid . '" data-clinica="' . (int) $lid . '" data-pret="' . e($c['price'] !== null ? lei_input($c['price']) : '') . '"' . ("c{$cid}" === $selected ? ' selected' : '') . '>'
                . e($c['name'] . ($c['price'] !== null ? ' · ' . lei($c['price']) : '')) . '</option>';
        }
        $out .= '</optgroup>';
    }
    foreach ($priceList as $cat => $items) {
        $out .= '<optgroup label="' . e($cat) . '">';
        foreach ($items as $sid => $s) {
            $shown = $s['clinics'][$priceClinic] ?? $s['price'];
            $out .= '<option value="' . $sid . '" data-pret="' . e($s['price'] !== null ? lei_input($s['price']) : '') . '"'
                . implode('', array_map(static fn ($lid, $pr) => ' data-pret-' . (int) $lid . '="' . e(lei_input((int) $pr)) . '"', array_keys($s['clinics']), $s['clinics']))
                . ((string) $sid === $selected ? ' selected' : '') . '>' . e($s['name'] . ($shown !== null ? ' · ' . lei((int) $shown) : '')) . '</option>';
        }
        $out .= '</optgroup>';
    }
    return $out;
};
$docOptions = ['' => '—'] + array_map('strval', $doctors);
$locOptions = [];
foreach ($allowed as $l) {
    $locOptions[(string) $l] = $names[$l];
}
// „Adaugă procedură”: the tooth chart. A click puts the tooth in „Dintele (dinții)”, another click
// takes it out (admin.js); the doctors also see on it what the odontogram notes.
$findings = [];
if (can('medical', $user)) {
    foreach (db_all('SELECT tooth, kind, surfaces FROM tooth_conditions WHERE patient_id = ? AND resolved_at IS NULL', [$pid]) as $c) {
        $findings[(int) $c['tooth']][] = $c;
    }
}
$age = !empty($p['birth_date']) ? (new DateTimeImmutable($p['birth_date']))->diff(new DateTimeImmutable())->y : null;
$milk = query('temporari') !== '' ? query('temporari') === '1' : (array_filter(array_keys($findings), static fn ($t) => intdiv($t, 10) >= 5) !== [] || ($age !== null && $age < 13));
$toothChart = '<div class="flex flex-col gap-2"><div class="flex flex-wrap items-baseline justify-between gap-2"><p class="text-control font-medium">Alegeți dinții pe odontogramă</p>'
    . '<a class="text-mic text-link underline underline-offset-4" href="' . e(admin_url($back, ['adauga' => '1', 'temporari' => $milk ? '0' : '1'] + array_diff_key($_GET, ['adauga' => 1, 'temporari' => 1]))) . '#adauga">' . ($milk ? 'Ascundeți dinții temporari' : 'Arătați dinții temporari') . '</a></div>'
    . '<p class="-mt-1 text-mic text-discret">Clic pe dinte: intră la „Dintele (dinții)”; încă un clic îl scoate. Fiecare dinte devine un rând, cu prețul lui.</p>'
    . '<div class="overflow-x-auto rounded-control border border-linie bg-fundal p-2" data-alege-dinti="#field-tooth">' . odontogram_svg($findings, null, static fn (int $t) => '#dinte-' . $t, $milk) . '</div></div>';
$ledgerOptions = ['comun' => 'Registrul comun'] + array_combine(array_map('strval', array_keys($ledgers)), array_map(static fn ($id) => ledger_label((int) $id), array_keys($ledgers)));
$ledgerPick = is_admin($user) && $ledgers !== []
    ? select_field('ledger', 'Registrul', ['medic' => 'Al medicului ales (dacă are registru separat), altfel comun'] + $ledgerOptions, ['value' => post('ledger') ?: 'medic', 'class' => 'sm:col-span-2'])
    : '';
$procForm = static function (array $v, string $op, ?int $id) use ($opts, $docOptions, $locOptions, $err, $toothChart, $ledgerPick, $clinicLists): string {
    $sid = $id !== null ? "-{$id}" : '';
    return '<form method="post" novalidate class="flex flex-col gap-5">' . csrf_field()
        . '<input type="hidden" name="op" value="' . $op . '">' . ($id !== null ? '<input type="hidden" name="id" value="' . $id . '">' : '')
        . '<input type="hidden" name="appointment_id" value="' . e($v['appointment_id']) . '">'
        . '<div class="flex flex-col gap-1.5"><label for="field-service_id' . $sid . '" class="text-control font-medium">Procedura</label>'
        . '<select id="field-service_id' . $sid . '" name="service_id" data-pret-sursa="#field-price' . $sid . '" data-pret-clinica="#field-location_id' . $sid . '" data-liste-clinici="' . e(implode(',', array_keys($clinicLists))) . '" class="' . e(input_classes('h-control')) . '">' . $opts($v['service_id']) . '</select>'
        . field_error("field-service_id{$sid}-error", $id === null ? $err('service_id') : null) . '</div>'
        . text_field('name', 'Sau scrieți procedura', ['id' => "field-name{$sid}", 'value' => $v['name'], 'optional' => true, 'maxlength' => 255, 'hint' => 'Doar dacă nu e în listă (sau ca s-o numiți altfel).'])
        . ($id === null ? $toothChart : '')
        . '<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">'
        . text_field('performed_on', 'Data', ['id' => "field-performed_on{$sid}", 'type' => 'date', 'value' => $v['performed_on'], 'max' => date('Y-m-d'), 'error' => $id === null ? $err('performed_on') : null])
        . text_field('tooth', 'Dintele (dinții)', ['id' => "field-tooth{$sid}", 'value' => $v['tooth'], 'optional' => true, 'maxlength' => 80, 'hint' => $id === null ? 'De exemplu 16 sau 13, 14, 15 (câte un rând pe dinte).' : null, 'error' => $id === null ? $err('tooth') : null])
        . text_field('price', 'Prețul (lei)', ['id' => "field-price{$sid}", 'value' => $v['price'], 'inputmode' => 'decimal', 'error' => $id === null ? $err('price') : null, 'attrs' => ['data-pret-tinta' => '']])
        . text_field('discount', 'Reducere (%)', ['id' => "field-discount{$sid}", 'value' => $v['discount'], 'inputmode' => 'decimal', 'optional' => true, 'error' => $id === null ? $err('discount') : null])
        . select_field('doctor_id', 'Medicul', $docOptions, ['id' => "field-doctor_id{$sid}", 'value' => $v['doctor_id']])
        . select_field('location_id', 'Clinica', $locOptions, ['id' => "field-location_id{$sid}", 'value' => $v['location_id'], 'error' => $id === null ? $err('location_id') : null])
        . text_field('lab', 'Laborator (lei)', ['id' => "field-lab{$sid}", 'value' => $v['lab'], 'inputmode' => 'decimal', 'optional' => true, 'hint' => 'Costul lucrării de laborator, dacă e.'])
        . '<div class="flex items-end pb-2">' . checkbox_field('done', 'Procedura e efectuată', ['id' => "field-done{$sid}", 'checked' => $v['done'] === '1']) . '</div>'
        . ($id === null ? $ledgerPick : '')
        . '</div>'
        . text_field('notes', 'Observații', ['id' => "field-notes{$sid}", 'value' => $v['notes'], 'optional' => true, 'maxlength' => 500])
        . '<div><button type="submit" class="' . e(btn('primary')) . '">' . ($id === null ? icon('plus', 18) . 'Adăugați procedura' : 'Salvați') . '</button></div></form>';
};
$addSection = $writable ? '<details id="adauga" class="mb-8 rounded-panou border border-linie bg-suprafata p-5"' . ($errors !== [] && post('op') === 'adauga' || query('programare') !== '' || query('adauga') === '1' ? ' open' : '') . '>'
    . '<summary class="flex min-h-control cursor-pointer items-center gap-2 text-h3 font-semibold">' . icon('plus', 20) . 'Adaugă procedură</summary>'
    . '<div class="mt-4">' . ($errors !== [] && post('op') === 'adauga' ? error_summary($errors) : '') . $procForm($v, 'adauga', null) . '</div></details>' : '';

// ── The list ──
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$list = '';
foreach ($rows as $r) {
    $due = procedure_due($r);
    $edit = '';
    if ($mayEdit($r)) {
        $ev = ['performed_on' => $r['performed_on'], 'doctor_id' => (string) ($r['doctor_id'] ?? ''), 'location_id' => (string) ($r['location_id'] ?? ''), 'service_id' => (string) ($r['service_id'] ?? ''), 'name' => $r['service_id'] ? '' : $r['name'],
            'tooth' => (string) $r['tooth'], 'price' => lei_input((int) $r['price']), 'discount' => (int) $r['price'] > 0 && (int) $r['discount'] > 0 ? rtrim(rtrim(number_format((int) $r['discount'] / (int) $r['price'] * 100, 2, ',', ''), '0'), ',') : '',
            'lab' => (int) $r['lab_cost'] > 0 ? lei_input((int) $r['lab_cost']) : '', 'done' => (string) $r['done'], 'notes' => (string) $r['notes'], 'appointment_id' => (string) ($r['appointment_id'] ?? '')];
        $edit = '<details class="mt-2"><summary class="cursor-pointer text-mic text-link underline">Modificați</summary><div class="mt-3 rounded-panou border border-linie p-4">' . $procForm($ev, 'modifica', (int) $r['id'])
            . '<form method="post" class="mt-4 border-t border-linie pt-4" data-confirma="Ștergeți procedura „' . e($r['name']) . '”?">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><input type="hidden" name="id" value="' . (int) $r['id'] . '"><button type="submit" class="' . e(btn('danger', 's')) . '">' . icon('trash-2', 16) . 'Ștergeți procedura</button></form>'
            . '</div></details>';
    }
    $list .= '<tr class="border-t border-linie align-top">'
        . '<td class="px-3 py-2 cifre whitespace-nowrap">' . e(date('d.m.Y', strtotime($r['performed_on']))) . '</td>'
        . '<td class="px-3 py-2 cifre">' . e((string) $r['tooth']) . '</td>'
        . '<td class="px-3 py-2"><span class="font-medium">' . e($r['name']) . '</span>'
        . ((int) $r['discount'] > 0 ? '<span class="block text-mic text-discret">Reducere ' . e(lei((int) $r['discount'])) . '</span>' : '')
        . ((int) $r['lab_cost'] > 0 ? '<span class="block text-mic text-discret">Laborator ' . e(lei((int) $r['lab_cost'])) . '</span>' : '')
        . ($r['notes'] ? '<span class="block text-mic text-discret">' . e($r['notes']) . '</span>' : '') . $ledgerTag($r) . $edit . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . e($r['doctor'] ?? '—') . ($r['clinic'] ? '<span class="block text-mic text-discret">' . e($r['clinic']) . '</span>' : '') . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap">' . e(lei($due)) . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap">' . e(lei((int) $r['paid'])) . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap font-semibold">' . e(lei(max(0, $due - (int) $r['paid']))) . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . procedure_state_chip($r) . '</td></tr>';
}
$table = $list !== ''
    ? '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[56rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
        . '<th scope="col" class="' . $th . ' w-24">Data</th><th scope="col" class="' . $th . ' w-20">Dinte</th><th scope="col" class="' . $th . ' min-w-[16rem]">Procedura</th><th scope="col" class="' . $th . ' w-44">Medicul</th>'
        . '<th scope="col" class="' . $th . ' w-28 text-right">De plată</th><th scope="col" class="' . $th . ' w-28 text-right">Achitat</th><th scope="col" class="' . $th . ' w-28 text-right">Rămas</th><th scope="col" class="' . $th . ' w-36">Starea</th></tr></thead><tbody>' . $list . '</tbody></table></div>'
    : '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Nicio procedură încă. Medicul o adaugă după intervenție, cu „Adaugă procedură”.</p>';

// ── The payments ──
$payRows = '';
foreach ($payments as $pay) {
    $cancelled = $pay['cancelled_at'] !== null;
    $payRows .= '<tr class="' . e(cn('border-t border-linie', $cancelled ? 'text-discret line-through' : '')) . '">'
        . '<td class="px-3 py-2 cifre whitespace-nowrap">' . e(date('d.m.Y', strtotime($pay['paid_on']))) . '</td>'
        . '<td class="px-3 py-2 text-right cifre whitespace-nowrap font-semibold">' . e(lei((int) $pay['amount'])) . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . e(PROC_PAY_METHODS[$pay['method']] ?? $pay['method']) . '</td>'
        . '<td class="px-3 py-2 cifre">' . e((string) $pay['reference']) . '</td>'
        . '<td class="px-3 py-2 text-mic text-discret">' . e(trim(($pay['who'] ?? '') . ($pay['notes'] ? ' · ' . $pay['notes'] : ''), ' ·')) . $ledgerTag($pay) . '</td>'
        . '<td class="px-3 py-2">' . (!$cancelled && is_admin($user) && $writable ? '<form method="post" data-confirma="Anulați plata de ' . e(lei((int) $pay['amount'])) . '?">' . csrf_field() . '<input type="hidden" name="op" value="anuleaza-plata"><input type="hidden" name="id" value="' . (int) $pay['id'] . '"><button type="submit" class="' . e(btn('text', 's')) . '">Anulați</button></form>' : ($cancelled ? 'anulată' : '')) . '</td></tr>';
}
$payTable = $payRows !== ''
    ? '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead class="bg-fundal"><tr><th scope="col" class="' . $th . ' w-24">Data</th><th scope="col" class="' . $th . ' w-32 text-right">Suma</th><th scope="col" class="' . $th . ' w-32">Cum</th><th scope="col" class="' . $th . ' w-28">Nr. chitanță</th><th scope="col" class="' . $th . '">Cine / observații</th><th scope="col" class="' . $th . ' w-24"></th></tr></thead><tbody>' . $payRows . '</tbody></table></div>'
    : '<p class="text-corp text-discret">Nicio plată încă.</p>';
// An administrator's payment goes by default to the ledger of the oldest procedure not yet paid.
$payLedgerDefault = 'comun';
foreach (array_reverse($rows) as $r) {
    if (procedure_due($r) > (int) $r['paid']) {
        $payLedgerDefault = (int) ($r['ledger_user_id'] ?? 0) > 0 ? (string) (int) $r['ledger_user_id'] : 'comun';
        break;
    }
}
$payForm = $canPay ? '<form method="post" novalidate class="mt-4 flex flex-col gap-4 rounded-panou border border-linie bg-suprafata p-5">' . csrf_field() . '<input type="hidden" name="op" value="plata">'
    . '<h3 class="text-h3 font-semibold">Încasare</h3>' . (post('op') === 'plata' && $errors !== [] ? error_summary($errors) : '')
    . '<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">'
    . text_field('amount', 'Suma (lei)', ['value' => post('op') === 'plata' ? post('amount') : ($sum['rest'] > 0 ? lei_input($sum['rest']) : ''), 'inputmode' => 'decimal', 'error' => $err('amount'), 'hint' => 'Se trece pe procedurile neachitate, de la cea mai veche.'])
    . text_field('paid_on', 'Data', ['type' => 'date', 'value' => post('op') === 'plata' ? post('paid_on') : $today, 'max' => $today, 'error' => $err('paid_on')])
    . text_field('reference', 'Nr. chitanță', ['value' => post('reference'), 'optional' => true, 'maxlength' => 60])
    . select_field('pay_location', 'Clinica', $locOptions, ['value' => post('pay_location') ?: $v['location_id'], 'error' => $err('pay_location')])
    . (is_admin($user) && $ledgers !== [] ? select_field('pay_ledger', 'Registrul', $ledgerOptions, ['value' => post('pay_ledger') ?: $payLedgerDefault, 'class' => 'sm:col-span-2', 'hint' => 'Plata se trece doar pe procedurile acestui registru.']) : '')
    . '</div>'
    . radio_group('pay_method', 'Cum a plătit', array_diff_key(PROC_PAY_METHODS, ['qdental' => '']), ['inline' => true, 'value' => post('pay_method') ?: 'numerar', 'error' => $err('pay_method')])
    . text_field('pay_notes', 'Observații', ['value' => post('pay_notes'), 'optional' => true, 'maxlength' => 255])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . icon('wallet', 18) . 'Înregistrați plata</button></div></form>' : '';

$actions = $writable ? '<a href="#adauga" data-deschide="adauga" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Adaugă procedură</a>' : '';
$ledgerBar = '';
if (is_admin($user) && $ledgers !== []) {
    $ledgerBar = '<form method="get" class="mb-4 flex flex-wrap items-end gap-3">' . select_field('registru', 'Registrul', ['' => 'Toate registrele'] + $ledgerOptions, ['value' => query('registru')])
        . '<button type="submit" class="' . e(btn('secondary')) . '">Arătați</button></form>';
} elseif ($scope['ledger'] !== null && $scope['ledger'] > 0) {
    $ledgerBar = '<p class="mb-4 rounded-panou bg-menta-pal p-3 text-corp">Registrul dumneavoastră: vedeți doar procedurile și plățile trecute de dumneavoastră.</p>';
}
$body = patient_header($p, $user, 'proceduri', $actions)
    . (post('op') === 'modifica' && $errors !== [] ? error_summary($errors, 'Procedura nu a fost modificată') : '')
    . $ledgerBar . $tiles . $addSection
    . admin_section_open('Procedurile efectuate', 'lista', count_ro($sum['count'], 'o procedură', 'proceduri') . ($sum['lab'] > 0 ? ' · laborator ' . lei($sum['lab']) : '') . '. Cele mai noi sus.')
    . '<div class="mt-4">' . $table . '</div></section>'
    . '<div class="mt-8">' . admin_section_open('Plățile pacientului', 'plati', 'Fiecare plată se trece pe procedurile neachitate; ce rămâne în plus e avans pentru următoarele.')
    . '<div class="mt-4">' . $payTable . '</div>' . $payForm . '</section></div>';
admin_page('Proceduri: ' . patient_name($p), $body, $user);
