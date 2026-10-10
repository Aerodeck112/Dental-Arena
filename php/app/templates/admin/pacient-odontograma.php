<?php
/**
 * /admin/pacienti/{id}/odontograma: the teeth chart (FDI). A click on a tooth opens it: what is
 * noted on it, a new finding (with the surfaces), and „Adăugați în plan”. A finding is never
 * edited: it is resolved, so the history stays. Doctors and administrators.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$base = "/admin/pacienti/{$pid}/odontograma";
$sel = admin_int(query('dinte') ?: post('tooth'));
$sel = $sel !== null && is_fdi_tooth($sel) ? $sel : null;
$errors = [];
$writable = $p['anonymized_at'] === null;

if (is_post() && $writable) {
    csrf_check();
    $op = post('op');
    if ($op === 'adauga' && $sel !== null) {
        $kind = post('kind');
        $surfaces = canonical_surfaces(implode('', array_filter((array) ($_POST['surfaces'] ?? []), 'is_string')));
        if (!isset(TOOTH_KINDS[$kind])) {
            $errors['kind'] = 'Alegeți ce ați constatat.';
        } else {
            db_tx(static function () use ($pid, $sel, $kind, $surfaces, $user): void {
                $active = db_all('SELECT * FROM tooth_conditions WHERE patient_id = ? AND tooth = ? AND resolved_at IS NULL FOR UPDATE', [$pid, $sel]);
                $old = superseded_ids($active, $sel, $kind, in_array($kind, SURFACE_KINDS, true) ? ($surfaces ?: null) : null, post('inlocuieste') === '1');
                // A filling on the same surfaces closes the caries there.
                if ($kind === 'obturatie' && $surfaces !== '') {
                    $old = array_merge($old, superseded_ids($active, $sel, 'carie', $surfaces, false));
                }
                if ($old !== []) {
                    db_run('UPDATE tooth_conditions SET resolved_at = ?, resolved_by = ? WHERE id IN (' . implode(',', array_map('intval', $old)) . ')', [now_sql(), $user['id']]);
                }
                db_insert('tooth_conditions', ['patient_id' => $pid, 'tooth' => $sel, 'kind' => $kind, 'surfaces' => in_array($kind, SURFACE_KINDS, true) && $surfaces !== '' ? $surfaces : null, 'note' => mb_substr(post('note'), 0, 255) ?: null, 'created_by' => $user['id'], 'created_at' => now_sql()]);
                audit('odontograma', "dinte {$sel}: " . TOOTH_KINDS[$kind] . ($surfaces !== '' ? " {$surfaces}" : ''), null, $pid);
            });
            flash("Dintele {$sel}: " . mb_strtolower(TOOTH_KINDS[$kind]) . ' notată.');
            redirect(admin_url($base, ['dinte' => $sel]) . '#dinte');
        }
    }
    if ($op === 'rezolva') {
        $row = db_one('SELECT * FROM tooth_conditions WHERE id = ? AND patient_id = ? AND resolved_at IS NULL', [(int) post('id'), $pid]);
        if ($row) {
            db_update('tooth_conditions', ['resolved_at' => now_sql(), 'resolved_by' => $user['id']], 'id = :id', ['id' => $row['id']]);
            audit('odontograma-rezolvat', "dinte {$row['tooth']}: " . (TOOTH_KINDS[$row['kind']] ?? $row['kind']), null, $pid);
            flash('Constatarea a fost trecută în istoric.');
        }
        redirect(admin_url($base, ['dinte' => $row['tooth'] ?? $sel]) . '#dinte');
    }
    if ($op === 'in-plan' && $sel !== null && can('plans.manage', $user)) {
        $svc = db_one('SELECT * FROM services WHERE id = ?', [(int) post('service_id')]);
        $planId = post('plan_id');
        if ($svc === null) {
            $errors['service_id'] = 'Alegeți lucrarea din lista de prețuri.';
        } else {
            $plan = $planId === 'nou' ? null : find_plan((int) $planId, $pid);
            if ($plan === null || !plan_open($plan['status'])) {
                $newId = db_insert('treatment_plans', ['patient_id' => $pid, 'doctor_id' => $user['doctor_id'] ?: $p['primary_doctor_id'], 'location_id' => $p['preferred_location_id'] ?? current_clinic_id($user), 'title' => 'Plan de tratament ' . date('d.m.Y'), 'status' => 'ciorna', 'valid_until' => date('Y-m-d', strtotime('+60 days')), 'created_by' => $user['id'], 'created_at' => now_sql(), 'updated_at' => now_sql()]);
                $plan = find_plan($newId, $pid);
                audit('plan-nou', $plan['title'], null, $pid);
            }
            $order = (int) db_value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM treatment_plan_items WHERE plan_id = ?', [$plan['id']]);
            db_insert('treatment_plan_items', [
                'plan_id' => $plan['id'], 'service_id' => (int) $svc['id'], 'tooth' => $sel, 'description' => $svc['name'], 'phase' => 1, 'quantity' => 1,
                'unit_price' => (int) ($svc['price_min'] ?? 0), 'discount' => 0, 'status' => in_array($plan['status'], ['acceptat', 'in-curs'], true) ? 'acceptat' : 'propus', 'sort_order' => $order,
            ]);
            audit('plan-linie-noua', "{$svc['name']} (dinte {$sel})", null, $pid);
            flash("„{$svc['name']}” pentru dintele {$sel} a fost adăugată în „{$plan['title']}”.");
            redirect(admin_url($base, ['dinte' => $sel]) . '#dinte');
        }
    }
}

$rows = db_all('SELECT c.*, u.name AS author FROM tooth_conditions c LEFT JOIN users u ON u.id = c.created_by WHERE c.patient_id = ? ORDER BY c.created_at DESC, c.id DESC', [$pid]);
$byTooth = [];
foreach ($rows as $r) {
    if ($r['resolved_at'] === null) {
        $byTooth[(int) $r['tooth']][] = $r;
    }
}
$age = $p['birth_date'] ? (new DateTimeImmutable($p['birth_date']))->diff(new DateTimeImmutable())->y : null;
$hasMilk = array_filter(array_keys($byTooth), static fn ($t) => intdiv($t, 10) >= 5) !== [];
$deciduous = query('temporari') !== '' ? query('temporari') === '1' : ($hasMilk || ($age !== null && $age < 13));
$href = static fn (int $t) => admin_url($base, ['dinte' => $t, 'temporari' => $deciduous ? '1' : '0']) . '#dinte';
$chart = '<div class="relative overflow-x-auto">' . odontogram_svg($byTooth, $sel, $href, $deciduous) . '</div>';

$legend = '<ul class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-mic text-discret">'
    . '<li class="flex items-center gap-2"><span class="inline-block size-3 rounded-sm bg-carmin"></span>Carie, fractură</li>'
    . '<li class="flex items-center gap-2"><span class="inline-block size-3 rounded-sm bg-actiune"></span>Obturație, fațetă</li>'
    . '<li class="flex items-center gap-2"><span class="inline-block size-3 rounded-sm border-2 border-actiune"></span>Coroană, punte, implant</li>'
    . '<li class="flex items-center gap-2"><span aria-hidden="true" class="font-semibold text-cerneala">✕</span>Extras sau lipsă</li>'
    . '<li>Literele: ' . e(implode(', ', array_map(static fn ($k) => TOOTH_LETTER[$k] . ' = ' . mb_strtolower(TOOTH_KINDS[$k]), ['carie', 'obturatie', 'endodontie', 'coroana', 'implant', 'extras', 'radacina']))) . '</li></ul>';

// The selected tooth.
$panel = '';
if ($sel !== null) {
    $active = $byTooth[$sel] ?? [];
    $list = '';
    foreach ($active as $r) {
        $list .= '<li class="flex flex-wrap items-center justify-between gap-2 border-t border-linie py-2 first:border-t-0"><span><span class="font-semibold">' . e(TOOTH_KINDS[$r['kind']] ?? $r['kind']) . '</span>'
            . ($r['surfaces'] ? ' <span class="cifre">' . e($r['surfaces']) . '</span>' : '') . ($r['note'] ? '<span class="block text-mic text-discret">' . e($r['note']) . '</span>' : '')
            . '<span class="block text-mic text-discret">' . e(format_date($r['created_at']) . ($r['author'] ? ', ' . $r['author'] : '')) . '</span></span>'
            . ($writable ? '<form method="post">' . csrf_field() . '<input type="hidden" name="op" value="rezolva"><input type="hidden" name="id" value="' . (int) $r['id'] . '"><input type="hidden" name="tooth" value="' . $sel . '"><button type="submit" class="' . e(btn('text', 's')) . '">Trecut în istoric</button></form>' : '')
            . '</li>';
    }
    $surfaceBoxes = '';
    foreach (SURFACES as $k => $label) {
        $surfaceBoxes .= checkbox_field('surfaces[]', '<span class="font-semibold">' . $k . '</span> <span class="text-discret">' . e($label) . '</span>', ['id' => "suprafata-{$k}", 'value' => $k, 'class' => 'py-0']);
    }
    $kindOptions = ['' => 'Alegeți'] + TOOTH_KINDS;
    $planOptions = ['nou' => 'Un plan nou'];
    foreach (db_all("SELECT id, title, status FROM treatment_plans WHERE patient_id = ? AND status IN ('ciorna', 'prezentat', 'acceptat', 'in-curs') ORDER BY created_at DESC", [$pid]) as $pl) {
        $planOptions[(string) $pl['id']] = $pl['title'] . ' (' . mb_strtolower(PLAN_STATUS[$pl['status']]) . ')';
    }
    $panel = '<section id="dinte" tabindex="-1" aria-labelledby="dinte-titlu" class="rounded-panou border-2 border-actiune bg-suprafata p-4 outline-none md:p-6">'
        . '<div class="flex items-center justify-between gap-3"><h2 id="dinte-titlu" class="font-display text-h2">Dintele ' . $sel . '</h2><a href="' . e(admin_url($base, ['temporari' => $deciduous ? '1' : '0'])) . '" class="' . e(btn('text', 's')) . '">' . icon('x', 16) . 'Închideți</a></div>'
        . ($list !== '' ? '<ul class="mt-2">' . $list . '</ul>' : '<p class="mt-2 text-corp text-discret">Nimic notat la acest dinte.</p>')
        . ($writable ? '<form method="post" novalidate class="mt-5 flex flex-col gap-4 border-t border-linie pt-5">' . csrf_field() . '<input type="hidden" name="op" value="adauga"><input type="hidden" name="tooth" value="' . $sel . '">'
            . '<h3 class="text-h3 font-semibold">Constatare nouă</h3>'
            . select_field('kind', 'Ce ați constatat sau ce s-a făcut', $kindOptions, ['value' => post('kind'), 'error' => $errors['kind'] ?? null])
            . '<fieldset><legend class="mb-1 text-control font-medium">Suprafețele <span class="font-normal text-discret">(pentru carie, obturație, fractură, sigilare, fațetă)</span></legend><div class="grid sm:grid-cols-2">' . $surfaceBoxes . '</div></fieldset>'
            . text_field('note', 'Notă', ['optional' => true, 'value' => post('note')])
            . checkbox_field('inlocuieste', 'Înlocuiește tot ce e notat la acest dinte', ['description' => 'De exemplu, după o extracție sau o reabilitare completă.'])
            . '<div><button type="submit" class="' . e(btn('primary')) . '">Notați</button></div></form>' : '')
        . ($writable && can('plans.manage', $user) ? '<form method="post" novalidate class="mt-5 flex flex-col gap-4 border-t border-linie pt-5">' . csrf_field() . '<input type="hidden" name="op" value="in-plan"><input type="hidden" name="tooth" value="' . $sel . '">'
            . '<h3 class="text-h3 font-semibold">Adăugați în plan</h3>'
            . service_select('service_id', 'Lucrarea', null)
            . (isset($errors['service_id']) ? field_error('field-service_id-error', $errors['service_id']) : '')
            . select_field('plan_id', 'În planul', $planOptions, ['value' => (string) (array_keys($planOptions)[1] ?? 'nou')])
            . '<div><button type="submit" class="' . e(btn('secondary')) . '">' . icon('plus', 18) . 'Adăugați în plan</button></div></form>' : '')
        . '</section>';
}

// All active findings and, on request, the history.
$summary = '';
ksort($byTooth);
foreach ($byTooth as $tooth => $list) {
    $summary .= '<li class="flex gap-3 border-t border-linie py-2 first:border-t-0"><a href="' . e($href($tooth)) . '" class="w-10 shrink-0 font-semibold text-link underline cifre">' . $tooth . '</a><span>'
        . e(implode(', ', array_map(static fn ($r) => (TOOTH_KINDS[$r['kind']] ?? $r['kind']) . ($r['surfaces'] ? ' ' . $r['surfaces'] : ''), $list))) . '</span></li>';
}
$history = '';
if (query('istoric') === '1') {
    foreach ($rows as $r) {
        if ($r['resolved_at'] === null) {
            continue;
        }
        $history .= '<li class="border-t border-linie py-2 text-mic first:border-t-0"><span class="font-semibold cifre">' . (int) $r['tooth'] . '</span> · ' . e(TOOTH_KINDS[$r['kind']] ?? $r['kind']) . ($r['surfaces'] ? ' ' . e($r['surfaces']) : '')
            . ' <span class="text-discret">· ' . e(format_date($r['created_at'])) . ' → ' . e(format_date($r['resolved_at'])) . '</span></li>';
    }
}

$toggle = '<a href="' . e(admin_url($base, ['dinte' => $sel, 'temporari' => $deciduous ? '0' : '1'])) . '" class="' . e(btn('secondary', 's')) . '">' . ($deciduous ? 'Ascundeți dinții temporari' : 'Arătați dinții temporari') . '</a>';
$body = patient_header($p, $user, 'odontograma')
    . '<section aria-labelledby="schema" class="rounded-panou border border-linie bg-suprafata p-4 md:p-6">'
    . '<div class="flex flex-wrap items-center justify-between gap-3"><h2 id="schema" class="text-h3 font-semibold">Odontograma</h2>' . $toggle . '</div>'
    . '<p class="mt-1 text-mic text-discret">Apăsați pe un dinte ca să notați ce ați găsit sau ce ați făcut. Sus: arcada superioară; dreapta pacientului e în stânga ecranului.</p>'
    . '<div class="mt-4">' . $chart . '</div>' . $legend . '</section>'
    . '<div class="mt-8 grid gap-8 lg:grid-cols-12">'
    . ($panel !== '' ? '<div class="lg:col-span-7">' . $panel . '</div>' : '')
    . '<div class="' . ($panel !== '' ? 'lg:col-span-5' : 'lg:col-span-12') . '">' . admin_section_open('Ce este notat acum', 'constatari')
    . ($summary !== '' ? '<ul class="mt-2">' . $summary . '</ul>' : '<p class="mt-2 text-corp text-discret">Nimic notat încă.</p>')
    . '<p class="mt-4"><a href="' . e(admin_url($base, ['dinte' => $sel, 'temporari' => $deciduous ? '1' : '0', 'istoric' => query('istoric') === '1' ? '' : '1'])) . '" class="text-link underline">' . (query('istoric') === '1' ? 'Ascundeți istoricul' : 'Arătați istoricul') . '</a></p>'
    . ($history !== '' ? '<ul class="mt-2">' . $history . '</ul>' : '')
    . '</section></div></div>';
admin_page('Odontogramă: ' . patient_name($p), $body, $user);
