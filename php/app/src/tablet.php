<?php
/**
 * /tableta, /tableta/semnare, /tableta/gata: the signing tablet at reception (src/admin/kiosk.php).
 * Full screen, large type, no menus: the patient types the code from reception, ticks the
 * consents, optionally fills in the questionnaire and the marketing choices, and signs with a
 * finger. After a few idle minutes, or after signing, the tablet goes back to the code screen.
 */
declare(strict_types=1);

require APP_DIR . '/src/admin/lib.php';
require APP_DIR . '/src/admin/crm.php';
require APP_DIR . '/src/admin/billing.php';
require APP_DIR . '/src/admin/clinical.php';
require APP_DIR . '/src/admin/kiosk.php';

const KIOSK_IDLE_SECONDS = 180;

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

/** The tablet's words in English, for a code given in English (the Romanian text is the key). */
const KIOSK_EN = [
    'Recepție' => 'Reception',
    'Bună ziua,' => 'Hello,',
    'Nu sunteți dumneavoastră? Ieșiți' => 'Not you? Exit',
    'Acordurile' => 'Consents',
    'Citiți fiecare text și bifați dacă sunteți de acord.' => 'Please read each text and tick it if you agree.',
    'Acordurile sunt date către' => 'The consents are given to',
    'Am citit și sunt de acord' => 'I have read it and I agree',
    'Bifați acordurile pe care le dați. Dacă nu sunteți de acord cu unul, întrebați recepția.' => 'Please tick the consents you give. If you do not agree with one, please ask at reception.',
    'Chestionarul medical' => 'Health questionnaire',
    'Medicul îl citește înainte de tratament. Răspunsurile rămân confidențiale.' => 'All the information you give us is confidential. The dentist reads it before your treatment.',
    'Aveți alergii?' => 'Are you allergic to any medicine or substance (antibiotic, anaesthetic)?',
    'De exemplu: penicilină, latex, anestezice. Lăsați gol dacă nu.' => 'For example: penicillin, latex, anaesthetics. Leave empty if not.',
    'Ce medicamente luați acum?' => 'Do you take any medication? If so, which?',
    'Numele lor, dacă știți. Lăsați gol dacă nu.' => 'Their names, if you know them. Leave empty if not.',
    'Bifați ce vi se potrivește' => 'Tick what applies to you',
    'Alte boli sau ceva ce ar trebui să știe medicul' => 'Other illnesses, or anything the dentist should know',
    'Opțional.' => 'Optional.',
    'Nu am nimic de declarat' => 'I have nothing to declare',
    'Completați chestionarul sau bifați „Nu am nimic de declarat”.' => 'Please fill in the questionnaire or tick “I have nothing to declare”.',
    'Câteva informații' => 'A few details',
    'Declarație' => 'Statement',
    'Oferte și noutăți' => 'Offers and news',
    'Doriți să primiți ofertele și noutățile Dental Arena? Bifați unde.' => 'Would you like to receive Dental Arena offers and news? Tick where.',
    'Opțional. Reamintirile programărilor le primiți oricum. Vă puteți dezabona oricând, din linkul din mesaj sau la recepție.' => 'Optional. You will receive appointment reminders anyway. You can unsubscribe at any time, from the link in the message or at reception.',
    'Semnătura' => 'Signature',
    'Semnați în chenar, ca pe hârtie. Semnătura se păstrează în fișa dumneavoastră, alături de textele de mai sus.' => 'Sign in the box, as on paper. Your signature is kept in your file, together with the texts above.',
    'Semnați aici cu degetul' => 'Sign here with your finger',
    'Ștergeți semnătura' => 'Clear the signature',
    'Semnez și trimit' => 'Sign and send',
    'Semnați în chenar cu degetul.' => 'Please sign in the box with your finger.',
    'Bifați acordurile pe care le dați.' => 'Please tick the consents you give.',
    'Semnați acordurile' => 'Sign the consents',
    'Mulțumim' => 'Thank you',
    'Am primit semnătura. Puteți preda tableta la recepție.' => 'We have received your signature. Please hand the tablet back at reception.',
    'Ecranul revine la început în câteva secunde.' => 'The screen goes back to the start in a few seconds.',
    'Gata' => 'Done',
    'Pentru că sunteți pacient nou, vă rugăm să completați chestionarul medical. Citiți și bifați acordurile (inclusiv cel pentru datele personale), apoi semnați. Dacă aveți întrebări, suntem la recepție. Mulțumim!' => 'Because you are a new patient, please fill in the health questionnaire. Read and tick the consents (including the one for your personal data), then sign. If you have any questions, we are here at reception. Thank you!',
];

/** A word of the tablet in the session's language. */
function kt(string $ro, string $lang): string
{
    return $lang === 'en' ? (KIOSK_EN[$ro] ?? $ro) : $ro;
}

/** The kiosk's HTML document: the logo, the clinic, the page, and the tablet script. */
function kiosk_page(string $title, string $body, ?array $device, int $idle = KIOSK_IDLE_SECONDS, string $head = '', string $lang = 'ro'): never
{
    header('Content-Type: text/html; charset=utf-8');
    $clinic = $device && $device['location_id'] ? db_value('SELECT short_name FROM locations WHERE id = ?', [(int) $device['location_id']]) : null;
    $script = is_file(PUBLIC_DIR . '/assets/tableta.min.js') ? '/assets/tableta.min.js' : '/assets/tableta.js';
    ?>
<!DOCTYPE html>
<html lang="<?= $lang === 'en' ? 'en' : 'ro' ?>" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F4F7F5">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title><?= e($title) ?> · Dental Arena</title>
<link rel="stylesheet" href="<?= e(asset('/assets/site.css')) ?>">
<link rel="icon" href="/favicon.ico" sizes="any">
<?= $head ?>
<script src="<?= e(asset($script)) ?>" defer></script>
</head>
<body class="min-h-dvh select-none bg-fundal font-sans text-cerneala [-webkit-tap-highlight-color:transparent]"<?= $idle > 0 ? ' data-inactiv="' . $idle . '"' : '' ?>>
<div class="flex min-h-dvh flex-col">
  <header class="flex items-center justify-between gap-4 px-6 pt-6 md:px-10">
    <?= logo('h-12 w-auto md:h-14', true, '180px', 'Dental Arena') ?>
    <p class="flex items-center gap-2 text-mic text-discret"><?= admin_icon('tablet', 18) ?><?= e(kt('Recepție', $lang) . ($clinic ? ' ' . $clinic : '')) ?></p>
  </header>
  <main id="continut" class="flex flex-1 flex-col px-6 pb-10 md:px-10"><?= $body ?></main>
</div>
<form method="post" action="/tableta/renunta" data-renunta hidden><?= csrf_field() ?></form>
</body>
</html>
    <?php
    exit;
}

$device = kiosk_device();
session_begin();

if ($device === null) {
    $body = '<div class="m-auto max-w-[36rem] text-center">'
        . '<span class="mx-auto flex size-20 items-center justify-center rounded-full bg-mustar-pal text-mustar-text">' . admin_icon('tablet', 36) . '</span>'
        . '<h1 class="mt-6 font-display text-h1">Tableta nu este asociată</h1>'
        . '<p class="mt-4 text-lead text-discret">Pe această tabletă, suportul tehnic (VITIM) intră în panou, la <strong class="text-cerneala">Setări → Tablete de semnare</strong>, și apasă „Asociați această tabletă”. După asta, pagina se deschide aici fără cont.</p>'
        . '<p class="mt-8"><a href="/admin/tablete" class="' . e(btn('primary', 'l')) . '">Intrați în panou</a></p></div>';
    http_response_code(403);
    kiosk_page('Tableta nu este asociată', $body, null, 0);
}

/** The signing session open on this tablet, or null (expired, cancelled, signed elsewhere). */
$current = static function () use ($device): ?array {
    $k = $_SESSION['tableta'] ?? null;
    if (!is_array($k) || (int) ($k['device'] ?? 0) !== (int) $device['id'] || (int) ($k['at'] ?? 0) < time() - KIOSK_CODE_MINUTES * 60) {
        return null;
    }
    return db_one("SELECT * FROM consent_sessions WHERE id = ? AND status = 'asteptare'", [(int) $k['sid']]);
};

if ($path === '/tableta/renunta') {
    if (is_post()) {
        csrf_check();
        unset($_SESSION['tableta']);
    }
    redirect('/tableta');
}

if ($path === '/tableta') {
    $error = null;
    if (is_post()) {
        csrf_check();
        $code = preg_replace('/\D/', '', post('code')) ?? '';
        if (kiosk_too_many_tries((int) $device['id'])) {
            $error = 'Prea multe încercări. Așteptați câteva minute sau chemați recepția. / Too many attempts: please wait a few minutes or ask at reception.';
        } elseif (($s = consent_session_open($code)) === null) {
            kiosk_wrong_code((int) $device['id']);
            $error = strlen($code) === 6 ? 'Codul nu este bun sau a expirat. Verificați-l sau cereți altul la recepție. / The code is wrong or has expired: check it or ask reception for a new one.' : 'Codul are 6 cifre. / The code has 6 digits.';
        } else {
            session_regenerate_id(true);
            $_SESSION['tableta'] = ['sid' => (int) $s['id'], 'device' => (int) $device['id'], 'at' => time()];
            db_run('UPDATE consent_sessions SET opened_at = COALESCE(opened_at, ?) WHERE id = ?', [now_sql(), $s['id']]);
            redirect('/tableta/semnare');
        }
    } elseif ($current() !== null) {
        redirect('/tableta/semnare');
    }
    $keys = '';
    foreach (['1', '2', '3', '4', '5', '6', '7', '8', '9', 'sterge', '0', 'ok'] as $k) {
        $keys .= match ($k) {
            'sterge' => '<button type="button" data-tasta="sterge" aria-label="Ștergeți ultima cifră" class="flex h-20 items-center justify-center rounded-panou bg-adancit text-cerneala active:scale-95 transition-transform">' . icon('undo-2', 28) . '</button>',
            'ok' => '<button type="submit" aria-label="Continuați" class="flex h-20 items-center justify-center rounded-panou bg-actiune text-pe-actiune active:scale-95 transition-transform">' . icon('check', 32) . '</button>',
            default => '<button type="button" data-tasta="' . $k . '" class="flex h-20 items-center justify-center rounded-panou border border-linie bg-suprafata font-display text-[2.2rem] shadow-sm active:scale-95 active:bg-adancit transition-transform cifre">' . $k . '</button>',
        };
    }
    $body = '<div class="m-auto grid w-full max-w-[60rem] items-center gap-10 md:grid-cols-2">'
        . '<div><h1 class="font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05]">Bine ați venit!</h1>'
        . '<p class="mt-4 text-lead text-discret">Introduceți codul de <strong class="text-cerneala">6 cifre</strong> primit de la recepție. Apoi citiți acordurile, bifați-le și semnați cu degetul pe ecran.</p>'
        . '<p class="mt-3 text-corp text-discret" lang="en"><strong class="text-cerneala">Welcome!</strong> Enter the 6-digit code from reception; the next screens are in English if reception chose it.</p>'
        . '<ol class="mt-8 flex flex-col gap-3 text-corp">'
        . '<li class="flex items-center gap-3"><span class="flex size-9 items-center justify-center rounded-full bg-menta-pal font-semibold text-actiune">1</span>Codul</li>'
        . '<li class="flex items-center gap-3"><span class="flex size-9 items-center justify-center rounded-full bg-menta-pal font-semibold text-actiune">2</span>Acordurile</li>'
        . '<li class="flex items-center gap-3"><span class="flex size-9 items-center justify-center rounded-full bg-menta-pal font-semibold text-actiune">3</span>Semnătura</li></ol></div>'
        . '<form method="post" action="/tableta" novalidate data-cod class="rounded-[1.75rem] border border-linie bg-suprafata p-6 shadow-float md:p-8">' . csrf_field()
        . '<label for="cod" class="block text-control font-medium">Codul primit <span class="font-normal text-discret" lang="en">/ Your code</span></label>'
        . '<input id="cod" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" autofocus' . ($error ? ' aria-invalid="true" aria-describedby="cod-eroare"' : '')
        . ' class="mt-2 h-24 w-full rounded-panou border-2 border-linie-control bg-fundal text-center font-display text-[3.2rem] tracking-[0.45em] outline-none focus:border-actiune aria-[invalid=true]:border-carmin cifre" placeholder="······">'
        . ($error ? '<p id="cod-eroare" role="alert" class="mt-3 flex items-start gap-2 text-corp font-medium text-carmin">' . icon('alert-triangle', 20, 'mt-0.5') . e($error) . '</p>' : '')
        . '<div class="mt-6 grid grid-cols-3 gap-3">' . $keys . '</div></form></div>';
    kiosk_page('Semnare acorduri', $body, $device, 0);
}

if ($path === '/tableta/semnare') {
    $s = $current();
    if ($s === null) {
        unset($_SESSION['tableta']);
        redirect('/tableta');
    }
    $p = db_one('SELECT * FROM patients WHERE id = ?', [(int) $s['patient_id']]);
    $lang = ($s['lang'] ?? 'ro') === 'en' ? 'en' : 'ro';
    $tr = static fn (string $ro) => kt($ro, $lang);
    $types = array_values(array_filter(explode(',', (string) $s['types']), static fn ($t) => isset(CONSENT_TYPES[$t])));
    $withHistory = (int) $s['with_history'] === 1;
    $withMarketing = (int) $s['with_marketing'] === 1;
    $errors = [];
    $accepted = is_post() ? array_values(array_filter((array) ($_POST['accept'] ?? []), 'is_string')) : [];
    $flagsIn = is_post() ? (array) ($_POST['flags'] ?? []) : [];
    if (is_post()) {
        csrf_check();
        $_SESSION['tableta']['at'] = time();
        $history = null;
        if ($withHistory) {
            $history = ['allergies' => mb_substr(trim(post('allergies')), 0, 1000), 'medications' => mb_substr(trim(post('medications')), 0, 1000), 'other_conditions' => mb_substr(trim(post('other_conditions')), 0, 1000), 'flags' => [], 'details' => [], 'lang' => $lang];
            foreach (array_merge(array_keys(HISTORY_FLAGS), array_keys(HISTORY_EXTRA)) as $k) {
                if (($flagsIn[$k] ?? '') === '1') {
                    $history['flags'][$k] = true;
                }
            }
            foreach (array_keys(HISTORY_DETAILS) as $k) {
                if (trim(post("d_{$k}")) !== '') {
                    $history['details'][$k] = mb_substr(trim(post("d_{$k}")), 0, 200);
                }
            }
            // The clinic's treatment sheet ends with this statement; the signature covers it.
            $history['statement'] = HISTORY_STATEMENT[$lang];
            if (post('nothing') !== '1' && $history['allergies'] === '' && $history['medications'] === '' && $history['other_conditions'] === '' && $history['flags'] === []) {
                $errors['chestionar'] = $tr('Completați chestionarul sau bifați „Nu am nimic de declarat”.');
            }
        }
        $marketing = $withMarketing ? ['sms' => post('m_sms') === '1', 'whatsapp' => post('m_whatsapp') === '1', 'email' => post('m_email') === '1'] : null;
        if ($types !== [] && array_intersect($types, $accepted) === []) {
            $errors['acorduri'] = $tr('Bifați acordurile pe care le dați. Dacă nu sunteți de acord cu unul, întrebați recepția.');
        }
        if ($errors === []) {
            try {
                consent_session_sign($s, $device, $accepted, post('signature'), $marketing, $history);
                $_SESSION['tableta_gata'] = ['name' => (string) $p['first_name'], 'n' => count(array_intersect($types, $accepted)), 'lang' => $lang];
                unset($_SESSION['tableta']);
                redirect('/tableta/gata');
            } catch (DomainException $e) {
                $errors['semnatura'] = $e->getMessage();
            }
        }
    }

    $n = 0;
    $section = static function (string $title, string $lead, string $inner, string $id) use (&$n): string {
        $n++;
        return '<section aria-labelledby="' . $id . '" class="rounded-[1.75rem] border border-linie bg-suprafata p-5 shadow-sm md:p-8">'
            . '<div class="flex items-start gap-4"><span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-actiune font-semibold text-pe-actiune">' . $n . '</span>'
            . '<div class="min-w-0"><h2 id="' . $id . '" class="font-display text-[1.75rem] leading-tight">' . e($title) . '</h2>' . ($lead !== '' ? '<p class="mt-1 text-corp text-discret">' . e($lead) . '</p>' : '') . '</div></div>'
            . '<div class="mt-5">' . $inner . '</div></section>';
    };
    // A large switch-like choice (a real checkbox, so it works without the script too).
    $toggle = static fn (string $name, string $label, bool $checked, string $value = '1') => '<label class="flex min-h-16 cursor-pointer items-center gap-4 rounded-panou border-2 border-linie bg-fundal px-4 py-3 text-corp transition-colors has-[:checked]:border-actiune has-[:checked]:bg-menta-pal">'
        . '<input type="checkbox" name="' . e($name) . '" value="' . e($value) . '"' . ($checked ? ' checked' : '') . ' class="peer sr-only">'
        . '<span class="flex size-8 shrink-0 items-center justify-center rounded-bloc border-2 border-linie-control bg-suprafata text-transparent peer-checked:border-actiune peer-checked:bg-actiune peer-checked:text-pe-actiune peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-actiune">' . icon('check', 20) . '</span>'
        . '<span class="min-w-0 select-none font-medium">' . $label . '</span></label>';

    $consents = '';
    foreach ($types as $t) {
        $paras = '';
        foreach (preg_split('/\n{2,}/', trim(consent_text_for($t, $p, $device && $device['location_id'] ? (int) $device['location_id'] : null, consent_session_details($s), $lang))) ?: [] as $para) {
            $paras .= '<p class="mt-3 whitespace-pre-line first:mt-0">' . e($para) . '</p>';
        }
        $consents .= '<article class="rounded-panou border border-linie">'
            . '<h3 class="border-b border-linie px-4 py-3 text-h3 font-semibold">' . e(consent_label($t, $lang)) . '</h3>'
            . '<div tabindex="0" class="max-h-[38vh] select-text overflow-y-auto px-4 py-4 text-[1.0625rem] leading-relaxed">' . $paras . '</div>'
            . '<div class="border-t border-linie p-3">' . $toggle('accept[]', e($tr('Am citit și sunt de acord')), in_array($t, $accepted, true), $t) . '</div></article>';
    }

    // Each clinic is its own company: the patient sees which one the consents are given to.
    $co = location_company($device && $device['location_id'] ? (int) $device['location_id'] : ($p['preferred_location_id'] ? (int) $p['preferred_location_id'] : null));
    $parts = $section($tr('Acordurile'), $tr('Citiți fiecare text și bifați dacă sunteți de acord.') . ($co['legalName'] !== '' ? ' ' . $tr('Acordurile sunt date către') . ' ' . $co['legalName'] . ($co['cui'] !== '' ? ($lang === 'en' ? ' (tax code ' : ' (CUI ') . $co['cui'] . ')' : '') . '.' : ''), ($errors['acorduri'] ?? null ? '<p role="alert" class="mb-4 rounded-panou bg-carmin-pal p-3 font-medium text-carmin">' . e($errors['acorduri']) . '</p>' : '') . '<div class="flex flex-col gap-5">' . $consents . '</div>', 'pas-acorduri');

    if ($withHistory) {
        // The clinic's „Fișa de tratament / Chestionar de sănătate”: the conditions of the medical
        // history, then its own questions, a few details and the statement at the end.
        $flags = '';
        foreach (HISTORY_FLAGS as $k => $label) {
            $flags .= $toggle("flags[{$k}]", e($lang === 'en' ? HISTORY_FLAGS_EN[$k] : $label), ($flagsIn[$k] ?? '') === '1');
        }
        foreach (HISTORY_EXTRA as $k => $l) {
            $flags .= $toggle("flags[{$k}]", e($lang === 'en' ? $l[1] : $l[0]), ($flagsIn[$k] ?? '') === '1');
        }
        $area = static fn (string $name, string $label, string $hint) => '<div class="flex flex-col gap-1.5"><label for="t-' . $name . '" class="text-control font-medium">' . e($label) . '</label>'
            . '<textarea id="t-' . $name . '" name="' . $name . '" rows="2" placeholder="' . e($hint) . '" class="select-text rounded-panou border-2 border-linie-control bg-fundal px-4 py-3 text-[1.125rem] outline-none focus:border-actiune">' . e(post($name)) . '</textarea></div>';
        $details = '';
        foreach (HISTORY_DETAILS as $k => $l) {
            $details .= '<div class="flex flex-col gap-1.5"><label for="t-d-' . $k . '" class="text-control font-medium">' . e($lang === 'en' ? $l[1] : $l[0]) . '</label>'
                . '<input id="t-d-' . $k . '" name="d_' . $k . '" maxlength="200" placeholder="' . e($lang === 'en' ? $l[3] : $l[2]) . '" value="' . e(post("d_{$k}")) . '" class="h-14 select-text rounded-panou border-2 border-linie-control bg-fundal px-4 text-[1.125rem] outline-none focus:border-actiune"></div>';
        }
        $inner = ($errors['chestionar'] ?? null ? '<p role="alert" class="mb-4 rounded-panou bg-carmin-pal p-3 font-medium text-carmin">' . e($errors['chestionar']) . '</p>' : '')
            . '<div class="flex flex-col gap-5">' . $area('allergies', $tr('Aveți alergii?'), $tr('De exemplu: penicilină, latex, anestezice. Lăsați gol dacă nu.'))
            . $area('medications', $tr('Ce medicamente luați acum?'), $tr('Numele lor, dacă știți. Lăsați gol dacă nu.'))
            . '<fieldset><legend class="mb-2 text-control font-medium">' . e($tr('Bifați ce vi se potrivește')) . '</legend><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">' . $flags . '</div></fieldset>'
            . $area('other_conditions', $tr('Alte boli sau ceva ce ar trebui să știe medicul'), $tr('Opțional.'))
            . $toggle('nothing', e($tr('Nu am nimic de declarat')), post('nothing') === '1')
            . '<fieldset><legend class="mb-2 text-control font-medium">' . e($tr('Câteva informații')) . ' <span class="font-normal text-discret">(' . e(mb_strtolower($tr('Opțional.'))) . ')</span></legend><div class="grid gap-4 sm:grid-cols-2">' . $details . '</div></fieldset>'
            . '<div class="rounded-panou border border-linie bg-fundal p-4"><p class="text-control font-medium">' . e($tr('Declarație')) . '</p><p class="mt-1 text-corp">' . e(HISTORY_STATEMENT[$lang]) . '</p></div></div>';
        $parts .= $section($tr('Chestionarul medical'), $tr('Medicul îl citește înainte de tratament. Răspunsurile rămân confidențiale.'), $inner, 'pas-chestionar');
    }
    if ($withMarketing) {
        $inner = '<div class="grid gap-3 sm:grid-cols-3">' . $toggle('m_sms', 'SMS', post('m_sms') === '1') . $toggle('m_whatsapp', 'WhatsApp', post('m_whatsapp') === '1') . $toggle('m_email', 'E-mail', post('m_email') === '1') . '</div>'
            . '<p class="mt-3 text-mic text-discret">' . e($tr('Opțional. Reamintirile programărilor le primiți oricum. Vă puteți dezabona oricând, din linkul din mesaj sau la recepție.')) . '</p>';
        $parts .= $section($tr('Oferte și noutăți'), $tr('Doriți să primiți ofertele și noutățile Dental Arena? Bifați unde.'), $inner, 'pas-marketing');
    }
    $sign = ($errors['semnatura'] ?? null ? '<p role="alert" class="mb-4 rounded-panou bg-carmin-pal p-3 font-medium text-carmin">' . e($errors['semnatura']) . '</p>' : '')
        . '<div class="relative rounded-panou border-2 border-dashed border-linie-control bg-white">'
        . '<canvas data-semnatura aria-label="Chenarul pentru semnătură" role="img" class="block h-[clamp(14rem,32vh,20rem)] w-full touch-none rounded-panou"></canvas>'
        . '<span aria-hidden="true" class="pointer-events-none absolute inset-x-8 bottom-[22%] border-b border-linie-control"></span>'
        . '<span data-semnatura-indiciu aria-hidden="true" class="pointer-events-none absolute inset-0 flex items-center justify-center text-lead text-discret">' . e($tr('Semnați aici cu degetul')) . '</span></div>'
        . '<input type="hidden" name="signature" value="" data-semnatura-valoare>'
        . '<div class="mt-3 flex flex-wrap items-center justify-between gap-3"><button type="button" data-semnatura-sterge class="' . e(btn('secondary')) . '">' . icon('undo-2', 18) . e($tr('Ștergeți semnătura')) . '</button>'
        . '<p class="text-mic text-discret">' . e(patient_name($p)) . ' · ' . e(date('d.m.Y')) . '</p></div>';
    $parts .= $section($tr('Semnătura'), $tr('Semnați în chenar, ca pe hârtie. Semnătura se păstrează în fișa dumneavoastră, alături de textele de mai sus.'), $sign, 'pas-semnatura');

    $body = '<div class="mx-auto w-full max-w-[56rem] pt-8">'
        . '<div class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-lead text-discret">' . e($tr('Bună ziua,')) . '</p><h1 class="font-display text-[clamp(2.2rem,4.5vw,3.2rem)] leading-[1.05]">' . e(trim($p['first_name'] . ' ' . $p['last_name'])) . '</h1></div>'
        . '<button type="button" data-renunta-acum class="' . e(btn('text')) . '">' . icon('x', 18) . e($tr('Nu sunteți dumneavoastră? Ieșiți')) . '</button></div>'
        // A new patient in English: what to do, as on the clinic's instruction sheet.
        . ($lang === 'en' && $withHistory ? '<p class="mt-6 rounded-panou border border-actiune bg-menta-pal p-4 text-lead">' . e($tr('Pentru că sunteți pacient nou, vă rugăm să completați chestionarul medical. Citiți și bifați acordurile (inclusiv cel pentru datele personale), apoi semnați. Dacă aveți întrebări, suntem la recepție. Mulțumim!')) . '</p>' : '')
        . '<form method="post" action="/tableta/semnare" novalidate data-semnare data-msg-acorduri="' . e($tr('Bifați acordurile pe care le dați.')) . '" data-msg-chestionar="' . e($tr('Completați chestionarul sau bifați „Nu am nimic de declarat”.')) . '" data-msg-semnatura="' . e($tr('Semnați în chenar cu degetul.')) . '" class="mt-8 flex flex-col gap-6">' . csrf_field() . $parts
        . '<div class="sticky bottom-4 z-10 rounded-[1.75rem] border border-linie bg-suprafata/95 p-4 shadow-float backdrop-blur">'
        . '<p data-semnare-eroare role="alert" class="mb-3 hidden font-medium text-carmin"></p>'
        . '<button type="submit" class="' . e(btn('primary', 'l', 'w-full text-[1.25rem]')) . '">' . admin_icon('signature', 22) . e($tr('Semnez și trimit')) . '</button></div>'
        . '</form></div>';
    kiosk_page($tr('Semnați acordurile'), $body, $device, KIOSK_IDLE_SECONDS, '', $lang);
}

if ($path === '/tableta/gata') {
    $g = $_SESSION['tableta_gata'] ?? null;
    unset($_SESSION['tableta_gata']);
    if (!is_array($g)) {
        redirect('/tableta');
    }
    $lang = ($g['lang'] ?? 'ro') === 'en' ? 'en' : 'ro';
    $body = '<div class="m-auto max-w-[40rem] text-center">'
        . '<span class="mx-auto flex size-24 items-center justify-center rounded-full bg-menta-pal text-actiune">' . icon('check-check', 44) . '</span>'
        . '<h1 class="mt-8 font-display text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05]">' . e(kt('Mulțumim', $lang)) . ', ' . e($g['name']) . '!</h1>'
        . '<p class="mt-4 text-lead text-discret">' . e(kt('Am primit semnătura. Puteți preda tableta la recepție.', $lang)) . '</p>'
        . '<p class="mt-10 text-mic text-discret" aria-hidden="true">' . e(kt('Ecranul revine la început în câteva secunde.', $lang)) . '</p>'
        . '<p class="mt-4"><a href="/tableta" class="' . e(btn('secondary', 'l')) . '">' . e(kt('Gata', $lang)) . '</a></p></div>';
    kiosk_page(kt('Mulțumim', $lang), $body, $device, 0, '<meta http-equiv="refresh" content="10;url=/tableta">', $lang);
}

http_response_code(404);
redirect('/tableta');
