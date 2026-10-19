<?php
/**
 * /incarca/<code>: the page a phone opens from the QR code on the patient's „Sterilizare” tab (photos)
 * or „Documente și acorduri” (photos and any file). No sign-in: the code is the key, for one patient,
 * for an hour, only to add files (it shows nothing
 * of the file but the initial and the file number). The photos are made smaller on the phone
 * (assets/incarca.js) and sent one by one, so the hosting's upload limit is not a problem.
 */
declare(strict_types=1);

require APP_DIR . '/src/admin/lib.php';
require APP_DIR . '/src/admin/crm.php';
require APP_DIR . '/src/admin/billing.php';
require APP_DIR . '/src/admin/clinical.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

$token = (string) ($uploadToken ?? '');
$link = upload_link_find($token);
$wantsJson = str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');

/** The phone page: the logo and the content, large enough for a thumb. */
function upload_page(string $title, string $body): never
{
    header('Content-Type: text/html; charset=utf-8');
    $script = is_file(PUBLIC_DIR . '/assets/incarca.min.js') ? '/assets/incarca.min.js' : '/assets/incarca.js';
    echo '<!DOCTYPE html><html lang="ro" data-theme="light"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow">'
        . '<meta name="theme-color" content="#F4F7F5"><title>' . e($title) . ' · Dental Arena</title>'
        . '<link rel="stylesheet" href="' . e(asset('/assets/site.css')) . '"><link rel="icon" href="/favicon.ico" sizes="any">'
        . '<script src="' . e(asset($script)) . '" defer></script></head>'
        . '<body class="min-h-dvh bg-fundal font-sans text-cerneala"><div class="mx-auto flex min-h-dvh max-w-[32rem] flex-col px-4 pb-10 pt-5">'
        . '<header class="mb-6">' . logo('h-10 w-auto', true, '140px', 'Dental Arena') . '</header>'
        . '<main id="continut" class="flex flex-1 flex-col">' . $body . '</main></div></body></html>';
    exit;
}

if ($link === null) {
    if (is_post() && $wantsJson) {
        http_response_code(410);
        header('Content-Type: application/json');
        exit(json_encode(['ok' => false, 'error' => 'Codul nu mai este valabil. Cereți un cod nou din panou.'], JSON_UNESCAPED_UNICODE));
    }
    http_response_code(410);
    upload_page('Cod expirat', '<h1 class="font-display text-[2rem] leading-tight">Codul nu mai este valabil</h1>'
        . '<p class="mt-3 text-corp">A expirat, a fost oprit sau s-au trimis deja toate pozele. Deschideți din nou, în panou, fișa pacientului → <strong>Sterilizare</strong> → <strong>Cod QR pentru telefon</strong> și scanați codul nou.</p>');
}

$pid = (int) $link['patient_id'];
$p = db_one('SELECT id, first_name, last_name, file_number, anonymized_at FROM patients WHERE id = ?', [$pid]);
$by = ['id' => $link['created_by'] !== null ? (int) $link['created_by'] : null];

if (is_post()) {
    // One file from the script („poza”), or several from the form without it („poze[]”).
    $files = isset($_FILES['poza']) ? uploaded_files('poza') : uploaded_files('poze');
    $isDoc = $link['kind'] === 'document';
    $note = mb_substr(trim((string) ($_POST['note'] ?? '')), 0, 120);
    $saved = 0;
    $error = null;
    try {
        if ($p === null || $p['anonymized_at'] !== null) {
            throw new DomainException('Fișa pacientului nu mai primește documente.');
        }
        if ($files === []) {
            throw new DomainException(($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 ? 'Fișierul este prea mare pentru server (cel mult ' . upload_limit_mb() . ' MB).' : 'Alegeți sau faceți o poză.');
        }
        foreach ($files as $file) {
            if ((int) $link['uploads'] + $saved >= UPLOAD_LINK_MAX_PHOTOS) {
                throw new DomainException('S-au trimis deja ' . UPLOAD_LINK_MAX_PHOTOS . ' fișiere cu acest cod. Cereți un cod nou din panou.');
            }
            // A photo from the script is „poza.jpg” (or .png, .webp): it gets the date; any other file keeps its name.
            $photo = !$isDoc || preg_match('/^poza\.(jpg|png|webp)$/', (string) ($file['name'] ?? '')) === 1;
            $title = ($photo ? ($isDoc ? 'Fotografie' : (DOC_KINDS[$link['kind']] ?? 'Poză')) . ' ' . date('d.m.Y') : pathinfo((string) $file['name'], PATHINFO_FILENAME)) . ' (telefon)' . ($note !== '' ? ': ' . $note : '');
            save_document($file, $pid, $isDoc ? 'auto' : $link['kind'], $title, $by);
            $saved++;
        }
    } catch (DomainException $e) {
        $error = $e->getMessage();
    }
    if ($saved > 0) {
        db_run('UPDATE upload_links SET uploads = uploads + ?, last_upload_at = ? WHERE id = ?', [$saved, now_sql(), $link['id']]);
    }
    if ($wantsJson) {
        http_response_code($error !== null && $saved === 0 ? 422 : 200);
        header('Content-Type: application/json');
        exit(json_encode(['ok' => $error === null, 'saved' => $saved, 'error' => $error], JSON_UNESCAPED_UNICODE));
    }
    redirect('/incarca/' . $token . '?trimise=' . $saved . ($error !== null ? '&eroare=' . rawurlencode($error) : ''));
}

$accept = 'image/jpeg,image/png,image/webp';
$isDoc = $link['kind'] === 'document';
$what = UPLOAD_LINK_KINDS[$link['kind']] ?? 'Poze';
$who = $p !== null ? trim($p['last_name'] . ' ' . mb_substr((string) $p['first_name'], 0, 1) . '.') : '';
$sent = (int) ($_GET['trimise'] ?? 0);
$err = trim((string) ($_GET['eroare'] ?? ''));
$big = 'flex min-h-[3.5rem] w-full cursor-pointer items-center justify-center gap-2 rounded-control px-4 text-[1.125rem] font-semibold';
$body = '<h1 class="font-display text-[2rem] leading-tight">' . e($what) . '</h1>'
    . '<p class="mt-1 text-corp text-discret">Pacientul: <strong class="text-cerneala">' . e($who) . '</strong>' . ($p !== null ? ' · fișa ' . (int) $p['file_number'] : '') . '</p>'
    . ($sent > 0 ? '<p role="status" class="mt-4 rounded-control bg-menta-pal px-4 py-3 font-semibold">' . e($sent === 1 ? 'Fișierul a fost trimis.' : "Au fost trimise {$sent} fișiere.") . '</p>' : '')
    . ($err !== '' ? '<p role="alert" class="mt-4 rounded-control bg-carmin-pal px-4 py-3 font-semibold text-carmin">' . e(mb_substr($err, 0, 200)) . '</p>' : '')
    . '<form method="post" enctype="multipart/form-data" data-incarca class="mt-6 flex flex-col gap-4">'
    . '<div class="flex flex-col gap-1.5"><label for="note" class="text-control font-medium">Notă <span class="font-normal text-discret">(opțional' . ($isDoc ? '' : ': lotul, autoclavul') . ')</span></label>'
    . '<input id="note" name="note" type="text" maxlength="120" autocomplete="off" class="' . e(input_classes('h-control')) . '"></div>'
    . '<input id="camera" type="file" name="poze[]" accept="' . $accept . '" capture="environment" class="peer/camera sr-only">'
    . '<label for="camera" class="' . e(cn($big, 'bg-actiune text-pe-actiune peer-focus-visible/camera:outline peer-focus-visible/camera:outline-2 peer-focus-visible/camera:outline-offset-2 peer-focus-visible/camera:outline-focus')) . '">' . admin_icon('camera', 24) . 'Faceți o poză</label>'
    . '<input id="galerie" type="file" name="poze[]"' . ($isDoc ? '' : ' accept="' . $accept . '"') . ' multiple class="peer/galerie sr-only">'
    . '<label for="galerie" class="' . e(cn($big, 'border border-linie-control bg-suprafata text-cerneala peer-focus-visible/galerie:outline peer-focus-visible/galerie:outline-2 peer-focus-visible/galerie:outline-offset-2 peer-focus-visible/galerie:outline-focus')) . '">' . icon('upload', 22) . ($isDoc ? 'Alegeți fișiere' : 'Alegeți din galerie') . '</label>'
    . '<noscript><button type="submit" class="' . e(btn('secondary')) . '">Trimiteți pozele alese</button></noscript>'
    . '</form>'
    . '<ul data-trimise class="mt-6 grid grid-cols-3 gap-2" aria-live="polite"></ul>'
    . '<p class="mt-auto pt-8 text-mic text-discret">' . ($isDoc ? 'Pozele și fișierele (PDF, Word, video, STL…) apar' : 'Pozele apar') . ' imediat în fișa pacientului, în panou. Codul e valabil până la ' . e(hm($link['expires_at'])) . '. Pe acest telefon nu rămâne nimic salvat.</p>';
upload_page($what, $body);
