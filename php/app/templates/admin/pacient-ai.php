<?php
/**
 * /admin/pacienti/{id}/consultatie-ai (doctors, administrators): dictate or record the
 * consultation (the browser turns speech into text), send it to the AI, then review the
 * proposals (clinical note, medical history, tooth findings, plan lines) and apply only what is
 * ticked. Nothing reaches the file without the doctor's review.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$base = "/admin/pacienti/{$pid}/consultatie-ai";
$errors = [];
$session = ($sid = admin_int(query('sesiune') ?: post('sesiune'))) !== null ? db_one('SELECT * FROM ai_sessions WHERE id = ? AND patient_id = ?', [$sid, $pid]) : null;
$result = $session && $session['result'] ? json_decode((string) $session['result'], true) : null;

if (is_post() && $p['anonymized_at'] === null) {
    csrf_check();
    if (post('op') === 'analizeaza') {
        $text = trim(str_replace("\r\n", "\n", post('transcript')));
        if (mb_strlen($text) < 20) {
            $errors['transcript'] = 'Dictați sau scrieți consultația (cel puțin o propoziție).';
        } elseif (!ai_ready()) {
            $errors['transcript'] = 'Asistentul AI nu este pornit. Un administrator îl configurează în Setări → Asistentul AI.';
        } else {
            $id = db_insert('ai_sessions', ['patient_id' => $pid, 'user_id' => $user['id'], 'transcript' => mb_substr($text, 0, 60000), 'status' => 'ciorna', 'created_at' => now_sql()]);
            $r = ai_analyze($text, $p);
            db_update('ai_sessions', ['result' => $r['ok'] ? json_encode($r['data'], JSON_UNESCAPED_UNICODE) : null, 'error' => $r['error'], 'model' => $r['model'], 'input_tokens' => $r['input_tokens'], 'output_tokens' => $r['output_tokens']], 'id = :id', ['id' => $id]);
            audit('consultatie-ai', $r['ok'] ? 'propuneri primite' : (string) $r['error'], null, $pid);
            if (!$r['ok']) {
                flash($r['error'], 'eroare');
            }
            redirect(admin_url($base, ['sesiune' => $id]));
        }
    }
    if (post('op') === 'aplica' && $session !== null && $result !== null && $session['status'] === 'ciorna') {
        $done = [];
        db_tx(static function () use ($pid, $p, $user, $result, &$done, $session): void {
            // Clinical note.
            if (post('nota') === '1' && trim(post('nota_text')) !== '') {
                db_insert('patient_notes', ['patient_id' => $pid, 'author_id' => $user['id'], 'body' => mb_substr(trim(str_replace("\r\n", "\n", post('nota_text'))), 0, 8000), 'clinical' => 1, 'created_at' => now_sql()]);
                $done[] = 'nota clinică';
            }
            // Medical history: allergies and medications are added to what is there; conditions are ticked.
            $h = db_one('SELECT * FROM medical_histories WHERE patient_id = ?', [$pid]) ?? [];
            $row = [];
            foreach (['alergii' => 'allergies', 'medicamente' => 'medications', 'alte_afectiuni' => 'other_conditions'] as $k => $col) {
                $new = trim((string) ($result['anamneza'][$k] ?? ''));
                if (post("an_{$k}") === '1' && $new !== '' && !str_contains(mb_strtolower((string) ($h[$col] ?? '')), mb_strtolower($new))) {
                    $row[$col] = trim(($h[$col] ?? '') !== '' ? $h[$col] . '; ' . $new : $new);
                }
            }
            foreach ((array) ($result['anamneza']['afectiuni'] ?? []) as $flag) {
                if (isset(HISTORY_FLAGS[$flag]) && post("af_{$flag}") === '1') {
                    $row[$flag] = 1;
                }
            }
            if ($row !== []) {
                $row += ['reviewed_at' => now_sql(), 'reviewed_by' => $user['id']];
                $cols = array_keys($row);
                db_run('INSERT INTO medical_histories (patient_id, ' . implode(', ', $cols) . ') VALUES (?, ' . implode(', ', array_fill(0, count($cols), '?')) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', array_map(static fn ($c) => "{$c} = VALUES({$c})", $cols)), array_merge([$pid], array_values($row)));
                $done[] = 'anamneza';
            }
            // Tooth findings.
            $n = 0;
            foreach ((array) ($result['constatari'] ?? []) as $i => $c) {
                $tooth = (int) ($c['dinte'] ?? 0);
                if (post("c_{$i}") !== '1' || !is_fdi_tooth($tooth) || !isset(TOOTH_KINDS[$c['tip'] ?? ''])) {
                    continue;
                }
                $surf = in_array($c['tip'], SURFACE_KINDS, true) ? (canonical_surfaces((string) ($c['suprafete'] ?? '')) ?: null) : null;
                $active = db_all('SELECT * FROM tooth_conditions WHERE patient_id = ? AND tooth = ? AND resolved_at IS NULL', [$pid, $tooth]);
                $old = superseded_ids($active, $tooth, $c['tip'], $surf, false);
                if ($c['tip'] === 'obturatie' && $surf) {
                    $old = array_merge($old, superseded_ids($active, $tooth, 'carie', $surf, false));
                }
                if ($old !== []) {
                    db_run('UPDATE tooth_conditions SET resolved_at = ?, resolved_by = ? WHERE id IN (' . implode(',', array_map('intval', $old)) . ')', [now_sql(), $user['id']]);
                }
                db_insert('tooth_conditions', ['patient_id' => $pid, 'tooth' => $tooth, 'kind' => $c['tip'], 'surfaces' => $surf, 'note' => mb_substr((string) ($c['nota'] ?? ''), 0, 255) ?: null, 'created_by' => $user['id'], 'created_at' => now_sql()]);
                $n++;
            }
            if ($n > 0) {
                $done[] = "{$n} constatări în odontogramă";
            }
            // Plan lines.
            $lines = array_filter((array) ($result['plan'] ?? []), static fn ($l, $i) => post("pl_{$i}") === '1', ARRAY_FILTER_USE_BOTH);
            if ($lines !== []) {
                $target = post('plan_id');
                $plan = $target !== 'nou' ? find_plan((int) $target, $pid) : null;
                if ($plan === null || !plan_open($plan['status'])) {
                    $planId = db_insert('treatment_plans', ['patient_id' => $pid, 'doctor_id' => $user['doctor_id'] ?: null, 'location_id' => $p['preferred_location_id'] ?? null, 'title' => 'Plan din consultația ' . date('d.m.Y'), 'status' => 'ciorna', 'valid_until' => date('Y-m-d', strtotime('+60 days')), 'created_by' => $user['id'], 'created_at' => now_sql(), 'updated_at' => now_sql()]);
                    $plan = find_plan($planId, $pid);
                }
                $order = (int) db_value('SELECT COALESCE(MAX(sort_order), 0) FROM treatment_plan_items WHERE plan_id = ?', [$plan['id']]);
                foreach ($lines as $l) {
                    $svc = isset($l['serviciu_id']) ? db_one('SELECT * FROM services WHERE id = ?', [(int) $l['serviciu_id']]) : null;
                    $tooth = isset($l['dinte']) && is_fdi_tooth((int) $l['dinte']) ? (int) $l['dinte'] : null;
                    db_insert('treatment_plan_items', [
                        'plan_id' => $plan['id'], 'service_id' => $svc['id'] ?? null, 'tooth' => $tooth, 'description' => mb_substr(trim((string) ($l['descriere'] ?? '')) ?: ($svc['name'] ?? 'Lucrare'), 0, 255),
                        'phase' => max(1, min(9, (int) ($l['faza'] ?? 1))), 'quantity' => 1, 'unit_price' => (int) ($svc['price_min'] ?? 0), 'discount' => 0,
                        'status' => in_array($plan['status'], ['acceptat', 'in-curs'], true) ? 'acceptat' : 'propus', 'sort_order' => ++$order,
                    ]);
                }
                $done[] = count($lines) . ' lucrări în „' . $plan['title'] . '”';
            }
            db_update('ai_sessions', ['status' => 'aplicat', 'applied_at' => now_sql()], 'id = :id', ['id' => $session['id']]);
        });
        audit('consultatie-ai-aplicata', implode(', ', $done) ?: 'nimic bifat', null, $pid);
        flash($done !== [] ? 'Am trecut în fișă: ' . implode(', ', $done) . '.' : 'Nu ați bifat nimic; consultația rămâne în istoric.');
        redirect($done !== [] ? "/admin/pacienti/{$pid}" : $base);
    }
    if (post('op') === 'renunta' && $session !== null) {
        db_update('ai_sessions', ['status' => 'renuntat'], 'id = :id', ['id' => $session['id']]);
        redirect($base);
    }
}

$ready = ai_ready();
$intro = $ready ? '' : '<p class="mb-6 flex items-start gap-3 rounded-panou border border-mustar bg-mustar-pal p-4 text-corp">' . icon('info', 20, 'mt-0.5') . '<span>Asistentul AI nu este pornit încă.' . (can_configure($user) ? ' Porniți-l din <a class="text-link underline" href="/admin/setari/ai">Setări → Asistentul AI</a> (cheia API Anthropic).' : ' Îl pornește suportul tehnic (VITIM) din Setări.') . '</span></p>';

// The dictation form.
$dictation = admin_section_open('Consultația', 'dictare', 'Apăsați „Dictați” și vorbiți (sau lăsați telefonul/calculatorul să asculte discuția cu pacientul). Puteți și scrie sau lipi text. Numele pacientului și numerele de telefon/CNP nu pleacă la AI.')
    . '<form method="post" novalidate class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="analizeaza">' . error_summary($errors)
    . '<div class="flex flex-wrap items-center gap-3" data-dictare-zona>'
    . '<button type="button" data-dictare="field-transcript" class="' . e(btn('secondary')) . '">' . admin_icon('mic', 18) . '<span data-dictare-eticheta>Dictați</span></button>'
    . '<span data-dictare-stare role="status" class="text-mic text-discret"></span>'
    . '<p data-dictare-lipsa hidden class="text-mic text-mustar-text">Dictarea merge în Chrome, Edge sau Safari, pe o adresă https. Puteți scrie textul.</p></div>'
    . text_area('transcript', 'Textul consultației', ['value' => post('transcript'), 'rows' => 12, 'error' => $errors['transcript'] ?? null, 'hint' => 'De exemplu: „Pacienta acuză durere la rece pe 36. Carie distală pe 36, profundă. Alergică la penicilină. Recomand obturație compozit pe 36 și igienizare.”'])
    . '<p data-dictare-interim aria-hidden="true" class="-mt-2 min-h-5 text-mic italic text-discret"></p>'
    . '<div><button type="submit" class="' . e(btn('primary')) . '"' . ($ready ? '' : ' disabled') . ' data-pending="Analizez (durează până la un minut)">' . admin_icon('sparkles', 18) . 'Analizați cu AI</button></div></form></section>';

// The review of a session.
$review = '';
if ($session !== null) {
    if ($result === null) {
        $review = admin_section_open('Analiza', 'analiza') . '<p class="mt-3 text-corp text-carmin">' . e((string) ($session['error'] ?: 'Analiza nu a reușit.')) . '</p><details class="mt-3"><summary class="cursor-pointer text-mic text-link underline">Textul trimis</summary><p class="mt-2 whitespace-pre-line text-mic">' . e($session['transcript']) . '</p></details></section>';
    } elseif ($session['status'] !== 'ciorna') {
        $review = admin_section_open('Analiza din ' . format_datetime($session['created_at']), 'analiza') . '<p class="mt-3 text-corp">' . ($session['status'] === 'aplicat' ? 'Propunerile au fost trecute în fișă ' . e(format_datetime((string) $session['applied_at'])) . '.' : 'Ați renunțat la aceste propuneri.') . '</p></section>';
    } else {
        $an = $result['anamneza'] ?? [];
        $anItems = '';
        foreach (['alergii' => 'Alergii', 'medicamente' => 'Medicamente', 'alte_afectiuni' => 'Alte afecțiuni'] as $k => $label) {
            if (trim((string) ($an[$k] ?? '')) !== '') {
                $anItems .= checkbox_field("an_{$k}", '<strong>' . e($label) . ':</strong> ' . e($an[$k]), ['checked' => true]);
            }
        }
        foreach ((array) ($an['afectiuni'] ?? []) as $flag) {
            if (isset(HISTORY_FLAGS[$flag])) {
                $anItems .= checkbox_field("af_{$flag}", '<strong>Afecțiune:</strong> ' . e(HISTORY_FLAGS[$flag]), ['checked' => true]);
            }
        }
        $finds = '';
        foreach ((array) ($result['constatari'] ?? []) as $i => $c) {
            $ok = is_fdi_tooth((int) ($c['dinte'] ?? 0)) && isset(TOOTH_KINDS[$c['tip'] ?? '']);
            $finds .= checkbox_field("c_{$i}", '<strong class="cifre">' . (int) ($c['dinte'] ?? 0) . '</strong> · ' . e(TOOTH_KINDS[$c['tip'] ?? ''] ?? (string) ($c['tip'] ?? '')) . (($c['suprafete'] ?? '') !== '' ? ' ' . e((string) $c['suprafete']) : '') . (($c['nota'] ?? '') !== '' ? ' <span class="text-discret">— ' . e((string) $c['nota']) . '</span>' : '') . ($ok ? '' : ' <span class="text-carmin">(dinte necunoscut, nu se trece)</span>'), ['checked' => $ok]);
        }
        $catalog = array_column(service_catalog(), null, 'id');
        $planRows = '';
        foreach ((array) ($result['plan'] ?? []) as $i => $l) {
            $svc = isset($l['serviciu_id']) ? ($catalog[(int) $l['serviciu_id']] ?? null) : null;
            $planRows .= checkbox_field("pl_{$i}", 'Faza ' . (int) ($l['faza'] ?? 1) . ' · ' . (isset($l['dinte']) && $l['dinte'] ? '<strong class="cifre">' . (int) $l['dinte'] . '</strong> · ' : '') . e((string) ($l['descriere'] ?? '')) . ($svc ? ' <span class="text-discret">(' . e($svc['name']) . ($svc['price_min'] !== null ? ', ' . e(format_amount((int) $svc['price_min'])) . ' lei' : '') . ')</span>' : ' <span class="text-discret">(fără preț din listă)</span>'), ['checked' => true]);
        }
        $planOptions = ['nou' => 'Un plan nou'];
        foreach (db_all("SELECT id, title, status FROM treatment_plans WHERE patient_id = ? AND status IN ('ciorna', 'prezentat', 'acceptat', 'in-curs') ORDER BY created_at DESC", [$pid]) as $pl) {
            $planOptions[(string) $pl['id']] = $pl['title'] . ' (' . mb_strtolower(PLAN_STATUS[$pl['status']]) . ')';
        }
        $note = trim((string) ($result['rezumat'] ?? '')) . (trim((string) ($result['recomandari'] ?? '')) !== '' ? "\n\nRecomandări: " . trim((string) $result['recomandari']) : '');
        $check = (array) ($result['de_verificat'] ?? []);
        $review = '<form method="post" class="flex flex-col gap-6">' . csrf_field() . '<input type="hidden" name="op" value="aplica"><input type="hidden" name="sesiune" value="' . (int) $session['id'] . '">'
            . ($check !== [] ? '<div class="rounded-panou border border-mustar bg-mustar-pal p-4"><p class="font-semibold">De verificat</p><ul class="mt-1 list-disc pl-5 text-corp">' . implode('', array_map(static fn ($t) => '<li>' . e((string) $t) . '</li>', $check)) . '</ul></div>' : '')
            . admin_section_open('Nota clinică', 'nota') . '<div class="mt-3 flex flex-col gap-3">' . checkbox_field('nota', 'Adăugați ca notă clinică', ['checked' => $note !== '']) . text_area('nota_text', 'Textul notei (îl puteți corecta)', ['value' => $note, 'rows' => 8]) . '</div></section>'
            . ($anItems !== '' ? admin_section_open('Anamneza', 'an', 'Se adaugă la ce e deja în fișă.') . '<div class="mt-3">' . $anItems . '</div></section>' : '')
            . ($finds !== '' ? admin_section_open('Odontograma', 'odonto', 'O obturație pe aceleași suprafețe închide caria de acolo.') . '<div class="mt-3">' . $finds . '</div></section>' : '')
            . ($planRows !== '' ? admin_section_open('Plan de tratament', 'plan', 'Prețurile se iau din lista de prețuri; le ajustați în plan.') . '<div class="mt-3">' . $planRows . '</div>' . select_field('plan_id', 'În planul', $planOptions, ['value' => (string) (array_keys($planOptions)[1] ?? 'nou'), 'class' => 'mt-3 max-w-md']) . '</section>' : '')
            . '<div class="sticky bottom-0 -mx-4 flex flex-wrap gap-3 border-t border-linie bg-fundal/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-panou md:border">'
            . '<button type="submit" class="' . e(btn('primary', 'l')) . '">' . icon('check', 20) . 'Treceți în fișă ce e bifat</button>'
            . '<button type="submit" name="op" value="renunta" class="' . e(btn('text')) . '" data-confirma="Renunțați la propuneri?">Renunțați</button></div>'
            . '<details class="rounded-panou border border-linie bg-suprafata p-4"><summary class="cursor-pointer text-mic text-link underline">Textul consultației</summary><p class="mt-2 whitespace-pre-line text-mic">' . e($session['transcript']) . '</p></details>'
            . '</form>';
    }
}

$history = db_all('SELECT s.*, u.name FROM ai_sessions s LEFT JOIN users u ON u.id = s.user_id WHERE s.patient_id = ? ORDER BY s.created_at DESC LIMIT 20', [$pid]);
$histList = implode('', array_map(static fn ($h) => '<li class="border-t border-linie py-2 first:border-t-0"><a class="text-link underline-offset-4 hover:underline" href="' . e(admin_url($base, ['sesiune' => (int) $h['id']])) . '">' . e(format_datetime($h['created_at'])) . '</a> <span class="text-mic text-discret">· ' . e((string) $h['name']) . ' · ' . e(['ciorna' => $h['result'] ? 'de verificat' : 'eșuată', 'aplicat' => 'trecută în fișă', 'renuntat' => 'renunțat'][$h['status']] ?? $h['status']) . '</span></li>', $history));

$body = patient_header($p, $user, '')
    . '<h2 class="mb-6 flex items-center gap-2 font-display text-h2">' . admin_icon('sparkles', 26, 'text-actiune') . 'Consultație cu AI</h2>'
    . $intro
    . '<div class="grid gap-8 lg:grid-cols-12"><div class="flex min-w-0 flex-col gap-8 lg:col-span-8">'
    . ($session !== null ? $review : $dictation)
    . '</div><div class="min-w-0 lg:col-span-4">'
    . ($session !== null ? '<p class="mb-4"><a href="' . e($base) . '" class="' . e(btn('secondary')) . '">' . admin_icon('mic', 18) . 'Consultație nouă</a></p>' : '')
    . admin_section_open('Consultațiile anterioare', 'istoric') . ($histList !== '' ? '<ul class="mt-2">' . $histList . '</ul>' : '<p class="mt-2 text-corp text-discret">Niciuna.</p>') . '</section>'
    . '<p class="mt-4 text-mic text-discret">AI-ul propune; medicul decide. Verificați fiecare propunere înainte să o treceți în fișă.</p>'
    . '</div></div>';
admin_page('Consultație cu AI: ' . patient_name($p), $body, $user);
