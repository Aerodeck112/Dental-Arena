<?php
/**
 * /admin/pacienti/{id}/sterilizare: the photos of the sterilization (the pouch label, the indicator,
 * the autoclave ticket) for the instruments used on the patient. „Încarcă poză” takes one or more
 * photos, straight from the phone's camera too; they are kept with the patient's documents, outside
 * public_html, and open only from the panel. „Cod QR pentru telefon” shows a code: any phone that
 * scans it sends photos here for an hour (/incarca/<code>, src/upload.php), and this page shows them
 * as they arrive.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$base = "/admin/pacienti/{$pid}/sterilizare";
$writable = $p['anonymized_at'] === null;
$error = null;

// The page asks every few seconds whether photos arrived from the phone (admin.js).
if (query('numar') === '1') {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode(['n' => (int) db_value("SELECT COUNT(*) FROM patient_documents WHERE patient_id = ? AND kind = 'sterilizare' AND deleted_at IS NULL", [$pid])]);
    exit;
}

// The code shown on this computer: the database keeps only its hash, the session the code itself.
session_begin();
$qr = $_SESSION['qr_poze'][$pid] ?? null;
$qrLink = is_array($qr) ? db_one('SELECT * FROM upload_links WHERE id = ? AND patient_id = ?', [(int) $qr['id'], $pid]) : null;
if ($qrLink === null || $qrLink['revoked_at'] !== null || $qrLink['expires_at'] <= now_sql() || (int) $qrLink['uploads'] >= UPLOAD_LINK_MAX_PHOTOS) {
    unset($_SESSION['qr_poze'][$pid]);
    $qr = $qrLink = null;
}

if (is_post() && $writable) {
    csrf_check();
    $op = post('op');
    if ($op === 'qr') {
        $link = upload_link_create($pid, 'sterilizare', $user);
        $_SESSION['qr_poze'][$pid] = ['id' => $link['id'], 'token' => $link['token']];
        redirect($base . '#telefon');
    }
    if ($op === 'opreste-qr' && $qrLink !== null) {
        db_update('upload_links', ['revoked_at' => now_sql()], 'id = :id', ['id' => $qrLink['id']]);
        unset($_SESSION['qr_poze'][$pid]);
        flash('Codul QR a fost oprit; telefonul nu mai poate trimite poze.', 'info');
        redirect($base);
    }
    if ($op === 'incarca') {
        // One or more photos: $_FILES['poze'] holds a list of each field.
        $f = $_FILES['poze'] ?? [];
        $files = [];
        foreach ((array) ($f['error'] ?? []) as $i => $err) {
            $files[] = ['name' => $f['name'][$i] ?? '', 'type' => $f['type'][$i] ?? '', 'tmp_name' => $f['tmp_name'][$i] ?? '', 'error' => $err, 'size' => $f['size'][$i] ?? 0];
        }
        $files = array_values(array_filter($files, static fn ($x) => (int) $x['error'] !== UPLOAD_ERR_NO_FILE));
        $note = mb_substr(trim(post('note')), 0, 120);
        $saved = 0;
        try {
            if ($files === []) {
                throw new DomainException('Alegeți sau faceți o poză.');
            }
            foreach ($files as $file) {
                save_document($file, $pid, 'sterilizare', 'Sterilizare ' . date('d.m.Y') . ($note !== '' ? ': ' . $note : ''), $user);
                $saved++;
            }
            flash($saved === 1 ? 'Poza a fost încărcată.' : "Au fost încărcate {$saved} poze.");
            redirect($base);
        } catch (DomainException $e) {
            $error = ($saved > 0 ? count_ro($saved, 'o poză s-a încărcat', 'poze s-au încărcat') . '; ' : '') . $e->getMessage();
        }
    }
    if ($op === 'sterge' && can('documents.delete', $user)) {
        $d = db_one("SELECT * FROM patient_documents WHERE id = ? AND patient_id = ? AND kind = 'sterilizare' AND deleted_at IS NULL", [(int) post('id'), $pid]);
        if ($d) {
            db_update('patient_documents', ['deleted_at' => now_sql(), 'deleted_by' => $user['id']], 'id = :id', ['id' => $d['id']]);
            @unlink(documents_dir() . '/' . basename($d['stored_name']));
            audit('document-sters', $d['title'], null, $pid);
            flash('Poza a fost ștearsă.');
        }
        redirect($base);
    }
}

$photos = db_all("SELECT d.*, u.name AS author FROM patient_documents d LEFT JOIN users u ON u.id = d.created_by WHERE d.patient_id = ? AND d.kind = 'sterilizare' AND d.deleted_at IS NULL ORDER BY d.created_at DESC, d.id DESC", [$pid]);
$grid = '';
foreach ($photos as $d) {
    $url = '/admin/documente/' . (int) $d['id'];
    $isImage = str_starts_with($d['mime'], 'image/');
    // The title is „Sterilizare 19.10.2026 (telefon): Lot 7”; the card shows what follows the date.
    $extra = (string) preg_replace('/^Sterilizare \d\d\.\d\d\.\d{4}/u', '', $d['title']);
    $grid .= '<li class="flex flex-col overflow-hidden rounded-panou border border-linie bg-suprafata">'
        . '<a href="' . $url . '" target="_blank" rel="noopener" class="relative block aspect-[4/3] overflow-hidden bg-fundal">'
        . ($isImage ? '<img src="' . $url . '" alt="' . e($d['title']) . '" loading="lazy" class="absolute inset-0 size-full object-cover">' : '<span class="absolute inset-0 flex items-center justify-center">' . icon('file', 32, 'text-discret') . '</span>') . '</a>'
        . '<div class="flex items-start justify-between gap-2 p-3"><div class="min-w-0"><p class="text-mic font-semibold cifre">' . e(date('d.m.Y H:i', strtotime($d['created_at']))) . '</p>'
        . '<p class="text-mic text-discret">' . e(implode(' · ', array_filter([str_contains($extra, '(telefon)') ? 'de pe telefon' : '', trim(str_replace('(telefon)', '', $extra), ' :'), $d['author']]))) . '</p></div>'
        . (can('documents.delete', $user) && $writable ? '<form method="post" data-confirma="Ștergeți poza?">' . csrf_field() . '<input type="hidden" name="op" value="sterge"><input type="hidden" name="id" value="' . (int) $d['id'] . '"><button type="submit" class="' . e(btn('text', 's')) . '" aria-label="Ștergeți poza din ' . e(date('d.m.Y H:i', strtotime($d['created_at']))) . '">' . icon('trash-2', 16) . '</button></form>' : '')
        . '</div></li>';
}

// „Încarcă poză” opens the camera or the gallery; the photos go up as soon as they are chosen.
$upload = $writable ? '<form method="post" enctype="multipart/form-data" novalidate class="mt-4 flex flex-col gap-4 rounded-panou border border-dashed border-linie-control p-4 sm:flex-row sm:items-end">' . csrf_field() . '<input type="hidden" name="op" value="incarca">'
    . text_field('note', 'Notă', ['optional' => true, 'value' => post('note'), 'hint' => 'De exemplu lotul sau autoclavul. Se scrie înainte de poză.', 'class' => 'min-w-0 sm:flex-1'])
    . '<div class="flex flex-col gap-1.5"><input id="field-poze" type="file" name="poze[]" multiple accept="image/jpeg,image/png,image/webp" data-trimite-la-schimbare class="peer sr-only"' . ($error !== null ? ' aria-invalid="true" aria-describedby="poze-eroare"' : '') . '>'
    . '<label for="field-poze" class="' . e(cn(btn('primary'), 'cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus')) . '">' . admin_icon('camera', 18) . 'Încarcă poză</label>'
    . '<noscript><button type="submit" class="' . e(btn('secondary')) . '">Trimiteți</button></noscript></div></form>'
    . field_error('poze-eroare', $error) : '';

// From the phone: the QR code, or the button that makes one.
$phone = '';
if ($writable) {
    if ($qr !== null) {
        $url = absolute_url('/incarca/' . $qr['token']);
        $svg = qr_svg($url);
        $phone = '<div id="telefon" class="mt-4 flex flex-col gap-5 rounded-panou border-2 border-actiune bg-menta-pal p-4 sm:flex-row sm:items-center" data-poze-noi="' . e($base . '?numar=1') . '" data-poze-numar="' . count($photos) . '">'
            . ($svg !== null ? '<div class="w-[15rem] max-w-full shrink-0 self-center rounded-control bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label="Cod QR pentru telefon">' . $svg . '</div>' : '')
            . '<div class="min-w-0 flex-1"><p class="flex items-center gap-2 text-h3 font-semibold">' . admin_icon('camera', 20) . 'Scanați codul cu telefonul</p>'
            . '<p class="mt-1 text-corp">Se deschide o pagină unde faceți poza sau o alegeți din galerie; apare aici imediat. Nu trebuie să intrați în panou pe telefon.</p>'
            . '<p class="mt-2 text-mic text-discret">Valabil până la ' . e(hm($qrLink['expires_at'])) . ', doar pentru acest pacient, cel mult ' . UPLOAD_LINK_MAX_PHOTOS . ' poze' . ((int) $qrLink['uploads'] > 0 ? '; trimise până acum: ' . (int) $qrLink['uploads'] : '') . '.</p>'
            . '<p class="mt-2 break-all text-mic"><a class="text-link underline underline-offset-4" href="' . e($url) . '" target="_blank" rel="noopener">' . e($url) . '</a></p>'
            . '<form method="post" class="mt-3">' . csrf_field() . '<input type="hidden" name="op" value="opreste-qr"><button type="submit" class="' . e(btn('secondary', 's')) . '">Opriți codul</button></form></div></div>';
    } else {
        $phone = '<form method="post" class="mt-4">' . csrf_field() . '<input type="hidden" name="op" value="qr"><button type="submit" class="' . e(btn('secondary')) . '">' . admin_icon('qr', 18) . 'Cod QR pentru telefon</button>'
            . '<span class="ml-3 text-mic text-discret">Scanați-l și trimiteți pozele direct de pe telefon.</span></form>';
    }
}

$body = patient_header($p, $user, 'sterilizare')
    . admin_section_open('Sterilizare', 'sterilizare', 'Pozele cu eticheta pungii, indicatorul sau bonul autoclavului pentru instrumentele folosite la pacient. Pe telefon, butonul deschide camera.')
    . $phone . $upload
    . ($grid !== '' ? '<ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">' . $grid . '</ul>' : '<p class="mt-4 text-corp text-discret">Nicio poză încă.</p>')
    . '</section>';
admin_page('Sterilizare: ' . patient_name($p), $body, $user);
