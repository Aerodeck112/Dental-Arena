<?php
/**
 * /admin/cereri: the requests from the site, filtered by status, kind, clinic and who takes care
 * of them; as a list (newest first) or a board with a column per status, where a card moves on.
 */
declare(strict_types=1);

$board = query('vizualizare') === 'tablou';
// Administrators delete requests: one (from the board) or the ones ticked in the list.
if (is_post() && in_array(post('op'), ['sterge', 'sterge-multe'], true) && is_admin($user)) {
    csrf_check();
    $ids = post('op') === 'sterge' ? [(int) post('id')] : array_map('intval', array_filter((array) ($_POST['ids'] ?? []), 'is_numeric'));
    $n = 0;
    foreach (array_unique($ids) as $lid) {
        $l = db_one('SELECT * FROM leads WHERE id = ?', [$lid]);
        if ($l !== null && can_see_lead($l, $user)) {
            db_run('DELETE FROM leads WHERE id = ?', [$lid]);
            audit('stergere-cerere', "#{$lid} {$l['name']}");
            $n++;
        }
    }
    flash($n === 0 ? 'Nu ați bifat nicio cerere.' : ($n === 1 ? 'Cererea a fost ștearsă.' : "Au fost șterse {$n} cereri."), $n === 0 ? 'info' : 'ok');
    redirect(admin_safe_return(post('inapoi')) ?? '/admin/cereri');
}
if (is_post() && post('op') === 'muta') {
    csrf_check();
    $l = db_one('SELECT * FROM leads WHERE id = ?', [(int) post('id')]);
    $to = post('status');
    if ($l !== null && can_see_lead($l, $user) && in_array($to, ['nou', 'in-lucru', 'programat'], true) && $to !== $l['status']) {
        db_update('leads', ['status' => $to, 'assigned_to' => $l['assigned_to'] ?? ($to === 'in-lucru' && in_array($user['role'], ['admin', 'admin-medic', 'receptie'], true) ? $user['id'] : null), 'updated_at' => now_sql(), 'updated_by' => $user['id']], 'id = :id', ['id' => $l['id']]);
        lead_log((int) $l['id'], 'stare', $to, null, $user);
        audit('stare-cerere', "#{$l['id']}: {$l['status']} → {$to}");
    }
    redirect(admin_safe_return(post('inapoi')) ?? '/admin/cereri?vizualizare=tablou');
}

[$scope, $params] = lead_scope_sql($user);
$where = [$scope];
$stare = query('stare');
$tip = query('tip');
$clinica = query('clinica');
if (in_array($tip, ['programare', 'contact', 'chat'], true)) {
    $where[] = 'kind = ?';
    $params[] = $tip;
}
$cine = query('cine');
if ($cine === 'eu') {
    $where[] = 'assigned_to = ?';
    $params[] = $user['id'];
} elseif ($cine === 'nimeni') {
    $where[] = 'assigned_to IS NULL';
}
$names = admin_clinic_names();
$allowed = allowed_location_ids($user);
if ($clinica === 'fara') {
    $where[] = 'location_id IS NULL';
} elseif (($cid = admin_int($clinica)) !== null && in_array($cid, $allowed, true)) {
    $where[] = 'location_id = ?';
    $params[] = $cid;
}
// The board shows every status; the list may keep one.
$baseSql = implode(' AND ', $where);
$baseParams = $params;
if (!$board && isset(LEAD_STATUS[$stare])) {
    $where[] = 'status = ?';
    $params[] = $stare;
}
$sql = implode(' AND ', $where);
$total = (int) db_value("SELECT COUNT(*) FROM leads WHERE {$sql}", $params);
$pages = max(1, (int) ceil($total / ADMIN_PER_PAGE));
$pagina = min($pages, max(1, (int) query('pagina', '1')));
$leads = db_all("SELECT * FROM leads WHERE {$sql} ORDER BY created_at DESC, id DESC LIMIT " . ADMIN_PER_PAGE . ' OFFSET ' . (($pagina - 1) * ADMIN_PER_PAGE), $params);

$clinicOptions = ['' => 'Toate clinicile'];
foreach ($allowed as $id) {
    if (isset($names[$id])) {
        $clinicOptions[(string) $id] = $names[$id];
    }
}
$clinicOptions['fara'] = 'Fără clinică';
$filters = '<form method="get" action="/admin/cereri" class="mb-6 grid gap-4 rounded-panou border border-linie bg-suprafata p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">'
    . ($board ? '<input type="hidden" name="vizualizare" value="tablou">' : select_field('stare', 'Starea', ['' => 'Toate'] + LEAD_STATUS, ['value' => $stare]))
    . select_field('cine', 'Se ocupă', ['' => 'Oricine', 'eu' => 'Eu', 'nimeni' => 'Nimeni încă'], ['value' => $cine])
    . select_field('tip', 'Tipul', ['' => 'Toate', 'programare' => 'Cereri de programare', 'chat' => 'Din chatul de pe site', 'contact' => 'Mesaje'], ['value' => $tip])
    . select_field('clinica', 'Clinica', $clinicOptions, ['value' => $clinica])
    . '<div class="flex gap-3"><button type="submit" class="' . e(btn('primary')) . '">' . icon('filter', 18) . 'Filtrați</button>'
    . '<a href="' . ($board ? '/admin/cereri?vizualizare=tablou' : '/admin/cereri') . '" class="' . e(btn('text')) . '">Toate</a></div></form>';

$nav = '';
if ($pages > 1) {
    $q = ['stare' => $stare, 'tip' => $tip, 'clinica' => $clinica, 'cine' => $cine];
    $nav = '<nav aria-label="Pagini" class="mt-6 flex items-center gap-4">'
        . ($pagina > 1 ? '<a href="' . e(admin_url('/admin/cereri', $q + ['pagina' => $pagina - 1])) . '" class="' . e(btn('secondary', 's')) . '">' . icon('chevron-left', 16) . 'Înapoi</a>' : '')
        . '<span class="text-mic text-discret cifre">Pagina ' . $pagina . ' din ' . $pages . '</span>'
        . ($pagina < $pages ? '<a href="' . e(admin_url('/admin/cereri', $q + ['pagina' => $pagina + 1])) . '" class="' . e(btn('secondary', 's')) . '">Înainte' . icon('chevron-right', 16) . '</a>' : '')
        . '</nav>';
}

// The board: a column per status (the closed ones of the last 30 days).
$boardHtml = '';
if ($board) {
    $all = db_all("SELECT * FROM leads WHERE {$baseSql} AND (status <> 'inchis' OR updated_at > ?) ORDER BY created_at DESC LIMIT 400", array_merge($baseParams, [date('Y-m-d H:i:s', strtotime('-30 days'))]));
    $handlers = lead_handlers();
    $last = [];
    if ($all !== []) {
        foreach (db_all('SELECT lead_id, kind, outcome, created_at FROM lead_activities WHERE lead_id IN (' . implode(',', array_map(static fn ($l) => (int) $l['id'], $all)) . ') ORDER BY id') as $a) {
            $last[(int) $a['lead_id']] = $a;
        }
    }
    $here = '/admin/cereri?' . http_build_query(array_filter(['vizualizare' => 'tablou', 'tip' => $tip, 'clinica' => $clinica, 'cine' => $cine]));
    $boardHtml = '<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">';
    foreach (LEAD_STATUS as $st => $label) {
        $cards = '';
        $n = 0;
        foreach ($all as $l) {
            if ($l['status'] !== $st) {
                continue;
            }
            $n++;
            $a = $last[(int) $l['id']] ?? null;
            $move = '';
            foreach (['nou' => 'Nouă', 'in-lucru' => 'În lucru', 'programat' => 'Programat'] as $to => $tl) {
                if ($to !== $st) {
                    $move .= '<button type="submit" name="status" value="' . $to . '" class="rounded-chip border border-linie-control px-2 py-0.5 text-mic hover:bg-adancit">→ ' . e($tl) . '</button>';
                }
            }
            $cards .= '<li class="rounded-panou border border-linie bg-suprafata p-3 shadow-sm">'
                . '<a href="/admin/cereri/' . (int) $l['id'] . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e($l['name']) . '</a>'
                . '<p class="text-mic text-discret">' . e(lead_kind_label($l['kind']) . ($l['location_id'] ? ' · ' . ($names[(int) $l['location_id']] ?? '') : '') . ' · ' . format_datetime($l['created_at'])) . '</p>'
                . ($l['phone'] !== '' ? '<p class="telefon text-mic">' . e(format_phone($l['phone'])) . '</p>' : '')
                . '<p class="mt-1 text-mic">' . ($l['assigned_to'] && isset($handlers[(int) $l['assigned_to']]) ? e($handlers[(int) $l['assigned_to']]) : '<span class="text-mustar-text">nepreluată</span>')
                . ($a ? ' · <span class="text-discret">' . e($a['kind'] === 'apel' ? 'apel: ' . mb_strtolower(CALL_OUTCOMES[$a['outcome']] ?? '') : (LEAD_ACTIVITY[$a['kind']] ?? '')) . ', ' . e(short_day($a['created_at'])) . '</span>' : '')
                . ($st === 'inchis' && $l['lost_reason'] ? ' · ' . e(LEAD_LOST_REASONS[$l['lost_reason']] ?? '') : '') . '</p>'
                . ($st !== 'inchis' ? '<form method="post" class="mt-2 flex flex-wrap gap-1">' . csrf_field() . '<input type="hidden" name="op" value="muta"><input type="hidden" name="id" value="' . (int) $l['id'] . '"><input type="hidden" name="inapoi" value="' . e($here) . '">' . $move
                    . '<a href="/admin/cereri/' . (int) $l['id'] . '#urmarire" class="rounded-chip border border-linie-control px-2 py-0.5 text-mic hover:bg-adancit">Închideți…</a></form>' : '')
                . (is_admin($user) ? '<form method="post" class="mt-1" data-confirma="' . e('Ștergeți definitiv cererea lui ' . $l['name'] . '?') . '">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><input type="hidden" name="id" value="' . (int) $l['id'] . '"><input type="hidden" name="inapoi" value="' . e($here) . '"><button type="submit" class="inline-flex items-center gap-1 text-mic text-carmin underline-offset-4 hover:underline">' . icon('trash-2', 14) . 'Ștergeți</button></form>' : '')
                . '</li>';
        }
        $boardHtml .= '<section aria-label="' . e($label) . '" class="flex min-w-0 flex-col rounded-panou bg-adancit/60 p-3"><h2 class="mb-3 flex items-center justify-between gap-2 px-1 text-control font-semibold">' . e($label) . '<span class="rounded-full bg-suprafata px-2 text-mic cifre">' . $n . '</span></h2>'
            . ($cards !== '' ? '<ul class="flex flex-col gap-2">' . $cards . '</ul>' : '<p class="px-1 text-mic text-discret">Niciuna.</p>')
            . ($st === 'inchis' ? '<p class="mt-2 px-1 text-mic text-discret">Ultimele 30 de zile.</p>' : '') . '</section>';
    }
    $boardHtml .= '</div>';
}
$viewSwitch = '<nav aria-label="Vizualizare" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">'
    . '<a href="' . e(admin_url('/admin/cereri', ['tip' => $tip, 'clinica' => $clinica, 'cine' => $cine])) . '"' . (!$board ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center gap-1 rounded-[calc(var(--radius-control)-2px)] px-3 text-control', !$board ? 'bg-menta-pal font-semibold' : 'hover:bg-adancit')) . '">' . icon('list', 16) . 'Listă</a>'
    . '<a href="' . e(admin_url('/admin/cereri', ['vizualizare' => 'tablou', 'tip' => $tip, 'clinica' => $clinica, 'cine' => $cine])) . '"' . ($board ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center gap-1 rounded-[calc(var(--radius-control)-2px)] px-3 text-control', $board ? 'bg-menta-pal font-semibold' : 'hover:bg-adancit')) . '">' . admin_icon('coloane', 16) . 'Tablou</a></nav>';

$body = admin_header('Cereri', 'Cererile de programare și mesajele trimise de pe site. Sunați pacientul, notați apelul, apoi faceți programarea sau închideți cererea cu motivul.', $viewSwitch)
    . $filters
    . ($board ? $boardHtml : '<div class="mb-3 flex flex-wrap items-center justify-between gap-3"><p class="text-mic text-discret cifre">' . $total . ($total === 1 ? ' cerere' : ' cereri') . '</p>'
        . (is_admin($user) && $leads !== [] ? '<form id="sterge-cereri" method="post" data-confirma="Ștergeți definitiv cererile bifate? Nu se poate anula.">' . csrf_field() . '<input type="hidden" name="op" value="sterge-multe"><input type="hidden" name="inapoi" value="' . e($_SERVER['REQUEST_URI'] ?? '/admin/cereri') . '"><button type="submit" class="' . e(btn('secondary', 's', 'text-carmin')) . '">' . icon('trash-2', 16) . 'Ștergeți cererile bifate</button></form>' : '') . '</div>'
        . leads_table($leads, is_admin($user)) . $nav);
admin_page('Cereri', $body, $user);
