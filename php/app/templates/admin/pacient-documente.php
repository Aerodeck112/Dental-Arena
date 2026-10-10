<?php
/**
 * /admin/pacienti/{id}/documente: the consents (print the form, record the signature, withdraw)
 * and the patient's files (X-rays, photos, signed papers), kept outside public_html.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$base = "/admin/pacienti/{$pid}/documente";
$writable = $p['anonymized_at'] === null;
$errors = [];

if (is_post() && $writable) {
    csrf_check();
    $op = post('op');
    try {
        if ($op === 'incarca') {
            save_document($_FILES['fisier'] ?? [], $pid, post('kind'), trim(post('title')), $user);
            flash('Documentul a fost încărcat.');
            redirect($base . '#documente');
        }
        if ($op === 'acord') {
            $type = post('type');
            $day = post('signed_on');
            if (!isset(CONSENT_TYPES[$type]) || !isset(CONSENT_METHODS[post('method')])) {
                throw new DomainException('Alegeți acordul și cum a fost dat.');
            }
            if (DateTimeImmutable::createFromFormat('!Y-m-d', $day) === false || $day > date('Y-m-d')) {
                throw new DomainException('Data semnării este azi sau în trecut.');
            }
            $docId = null;
            if (($_FILES['scan']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $docId = save_document($_FILES['scan'], $pid, 'consimtamant', CONSENT_TYPES[$type] . ' (semnat ' . date('d.m.Y', strtotime($day)) . ')', $user);
            }
            db_insert('consents', ['patient_id' => $pid, 'type' => $type, 'method' => post('method'), 'signed_on' => $day, 'text_version' => consent_version(), 'document_id' => $docId, 'recorded_by' => $user['id'], 'created_at' => now_sql()]);
            audit('acord', CONSENT_TYPES[$type] . ', ' . CONSENT_METHODS[post('method')], null, $pid);
            flash('Acordul a fost înregistrat.');
            redirect($base);
        }
        if ($op === 'retrage') {
            $c = db_one('SELECT * FROM consents WHERE id = ? AND patient_id = ? AND withdrawn_at IS NULL', [(int) post('id'), $pid]);
            if ($c) {
                db_update('consents', ['withdrawn_at' => now_sql(), 'withdrawn_by' => $user['id']], 'id = :id', ['id' => $c['id']]);
                audit('acord-retras', CONSENT_TYPES[$c['type']] ?? $c['type'], null, $pid);
                flash('Acordul a fost trecut ca retras.');
            }
            redirect($base);
        }
        if ($op === 'sterge' && can('documents.delete', $user)) {
            $d = db_one('SELECT * FROM patient_documents WHERE id = ? AND patient_id = ? AND deleted_at IS NULL', [(int) post('id'), $pid]);
            if ($d) {
                db_update('patient_documents', ['deleted_at' => now_sql(), 'deleted_by' => $user['id']], 'id = :id', ['id' => $d['id']]);
                @unlink(documents_dir() . '/' . basename($d['stored_name']));
                audit('document-sters', $d['title'], null, $pid);
                flash('Documentul a fost șters.');
            }
            redirect($base . '#documente');
        }
    } catch (DomainException $e) {
        $errors[$op === 'incarca' ? 'fisier' : 'acord'] = $e->getMessage();
    }
}

// Consents: the latest record of each type.
$consents = db_all('SELECT c.*, u.name AS recorder FROM consents c LEFT JOIN users u ON u.id = c.recorded_by WHERE c.patient_id = ? ORDER BY c.signed_on DESC, c.id DESC', [$pid]);
$latest = [];
foreach ($consents as $c) {
    $latest[$c['type']] ??= $c;
}
$consentRows = '';
foreach (CONSENT_TYPES as $type => $label) {
    $c = $latest[$type] ?? null;
    $state = $c === null ? '<span class="text-mustar-text">Nesemnat</span>'
        : ($c['withdrawn_at'] !== null ? '<span class="text-carmin">Retras ' . e(format_date($c['withdrawn_at'])) . '</span>'
            : '<span class="text-actiune">' . icon('check', 16, 'inline') . ' ' . e(CONSENT_METHODS[$c['method']] ?? $c['method']) . ', ' . e(format_date($c['signed_on'])) . '</span>'
                . ($c['document_id'] ? ' · <a class="text-link underline" href="/admin/documente/' . (int) $c['document_id'] . '">copia scanată</a>' : ''));
    $consentRows .= '<li class="flex flex-wrap items-center justify-between gap-3 border-t border-linie py-3 first:border-t-0">'
        . '<div class="min-w-0"><p class="font-semibold">' . e($label) . '</p><p class="text-mic">' . $state . '</p></div>'
        . '<div class="flex flex-wrap items-center gap-2"><a href="/admin/pacienti/' . $pid . '/acord/' . $type . '" class="' . e(btn('secondary', 's')) . '">' . icon('printer', 16) . 'Formularul</a>'
        . ($c !== null && $c['withdrawn_at'] === null && $writable ? '<form method="post" data-confirma="Pacientul își retrage acordul?">' . csrf_field() . '<input type="hidden" name="op" value="retrage"><input type="hidden" name="id" value="' . (int) $c['id'] . '"><button type="submit" class="' . e(btn('text', 's')) . '">Retras</button></form>' : '')
        . '</div></li>';
}
$consentForm = $writable ? '<details class="mt-4 rounded-panou border border-linie p-4"' . (isset($errors['acord']) ? ' open' : '') . '><summary class="cursor-pointer font-semibold">Înregistrați un acord semnat</summary>'
    . '<form method="post" enctype="multipart/form-data" novalidate class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="acord">'
    . (isset($errors['acord']) ? field_error('acord-eroare', $errors['acord']) : '')
    . select_field('type', 'Acordul', CONSENT_TYPES, ['value' => post('type')])
    . '<div class="grid gap-4 sm:grid-cols-2">' . select_field('method', 'Cum', CONSENT_METHODS, ['value' => post('method') ?: 'hartie'])
    . text_field('signed_on', 'Data', ['type' => 'date', 'value' => post('signed_on') ?: date('Y-m-d'), 'max' => date('Y-m-d')]) . '</div>'
    . '<div class="flex flex-col gap-1.5">' . field_label('field-scan', 'Copia scanată sau fotografiată', true) . '<input id="field-scan" type="file" name="scan" accept="application/pdf,image/jpeg,image/png,image/webp" class="w-full min-w-0 max-w-full text-corp file:mr-3 file:rounded-control file:border file:border-linie-control file:bg-suprafata file:px-3 file:py-2"></div>'
    . '<div><button type="submit" class="' . e(btn('primary')) . '">Înregistrați acordul</button></div></form></details>' : '';

// Documents.
$docs = db_all('SELECT d.*, u.name AS author FROM patient_documents d LEFT JOIN users u ON u.id = d.created_by WHERE d.patient_id = ? AND d.deleted_at IS NULL ORDER BY d.created_at DESC', [$pid]);
$docRows = '';
foreach ($docs as $d) {
    $isImage = str_starts_with($d['mime'], 'image/');
    $docRows .= '<li class="flex flex-wrap items-center gap-4 border-t border-linie py-3 first:border-t-0">'
        . '<a href="/admin/documente/' . (int) $d['id'] . '" class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-control border border-linie bg-fundal">'
        . ($isImage ? '<img src="/admin/documente/' . (int) $d['id'] . '" alt="" loading="lazy" class="size-full object-cover">' : icon('file', 28, 'text-discret')) . '</a>'
        . '<div class="min-w-0 flex-1"><a href="/admin/documente/' . (int) $d['id'] . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e($d['title']) . '</a>'
        . '<p class="text-mic text-discret">' . e(implode(' · ', array_filter([DOC_KINDS[$d['kind']] ?? $d['kind'], format_date($d['created_at']), $d['author'], format_size((int) $d['size'])]))) . '</p></div>'
        . '<div class="flex items-center gap-2"><a href="/admin/documente/' . (int) $d['id'] . '?descarca=1" class="' . e(btn('text', 's')) . '">' . icon('download', 16) . 'Descărcați</a>'
        . (can('documents.delete', $user) ? '<form method="post" data-confirma="Ștergeți documentul „' . e($d['title']) . '”?">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><input type="hidden" name="id" value="' . (int) $d['id'] . '"><button type="submit" class="' . e(btn('text', 's')) . '" aria-label="Ștergeți ' . e($d['title']) . '">' . icon('trash-2', 16) . '</button></form>' : '')
        . '</div></li>';
}
$uploadForm = $writable ? '<form method="post" enctype="multipart/form-data" novalidate class="mt-4 grid gap-4 rounded-panou border border-dashed border-linie-control p-4 md:grid-cols-12 md:items-end">' . csrf_field() . '<input type="hidden" name="op" value="incarca">'
    . '<div class="flex min-w-0 flex-col gap-1.5 md:col-span-5">' . field_label('field-fisier', 'Fișierul (PDF, JPG, PNG, WebP; cel mult ' . min(DOC_MAX_MB, upload_limit_mb()) . ' MB)')
    . '<input id="field-fisier" type="file" name="fisier" required accept="application/pdf,image/jpeg,image/png,image/webp"' . (isset($errors['fisier']) ? ' aria-invalid="true" aria-describedby="fisier-eroare"' : '') . ' class="w-full min-w-0 max-w-full text-corp file:mr-3 file:rounded-control file:border file:border-linie-control file:bg-suprafata file:px-3 file:py-2">'
    . field_error('fisier-eroare', $errors['fisier'] ?? null) . '</div>'
    . select_field('kind', 'Tipul', DOC_KINDS, ['value' => post('kind') ?: 'radiografie-panoramica', 'class' => 'min-w-0 md:col-span-3'])
    . text_field('title', 'Titlul', ['optional' => true, 'value' => post('title'), 'class' => 'min-w-0 md:col-span-4'])
    . '<div class="md:col-span-12"><button type="submit" class="' . e(btn('primary')) . '">' . icon('upload', 18) . 'Încărcați</button></div></form>' : '';

$body = patient_header($p, $user, 'documente')
    . '<div class="flex flex-col gap-8">'
    . admin_section_open('Acorduri', 'acorduri', 'Tipăriți formularul, dați-l pacientului să-l semneze, apoi înregistrați-l aici (eventual cu copia scanată).')
    . '<ul class="mt-3">' . $consentRows . '</ul>' . $consentForm . '</section>'
    . admin_section_open('Documente', 'documente', 'Radiografii, fotografii, documente semnate. Se păstrează în afara site-ului și se deschid doar din panou.')
    . $uploadForm . ($docRows !== '' ? '<ul class="mt-4">' . $docRows . '</ul>' : '<p class="mt-4 text-corp text-discret">Niciun document.</p>') . '</section>'
    . '</div>';
admin_page('Documente: ' . patient_name($p), $body, $user);
