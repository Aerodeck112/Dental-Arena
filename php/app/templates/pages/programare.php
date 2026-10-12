<?php
/**
 * /programare: online booking on real free times, as in the first version. Four steps: the
 * reason and the clinic → the day and the hour (any doctor or a chosen one) → how the patient
 * feels → their details; then the appointment is in the calendar and the patient gets the
 * confirmation with a link (confirm, cancel, add to calendar). „Prefer să mă sunați” leaves a
 * request instead. Without JavaScript, or with online booking switched off (Setări → Programări
 * online), the page is the request form (the clinic calls back).
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/lib.php';
require_once APP_DIR . '/src/admin/crm.php';
require_once APP_DIR . '/src/booking.php';

$cfg = booking_settings();
$reasons = booking_reasons();
$bookable = $cfg['enabled'] && $reasons !== [] && (bool) db_value('SELECT 1 FROM doctor_locations dl JOIN doctors d ON d.id = dl.doctor_id WHERE dl.schedule IS NOT NULL AND d.accepts_online = 1 LIMIT 1');
$wizardErrors = [];
$wizardValues = [];

// The confirmation: the appointment of the link in the address.
if (query('confirmare') !== '') {
    $a = appointment_from_token(query('confirmare'));
    require APP_DIR . '/templates/pages/programare-confirmare.php';
    exit;
}

if (is_post() && in_array(post('op'), ['rezerva', 'apel'], true)) {
    csrf_check();
    $op = post('op');
    $wizardValues = array_map('strval', array_intersect_key($_POST, array_flip(['serviciu', 'clinica', 'medic', 'slot', 'confort', 'confort_nota', 'sedare', 'name', 'phone', 'email', 'pentru', 'copil', 'varsta', 'message', 'consent', 'marketing', 'cheie', 'interval'])));
    $v = static fn (string $k) => trim((string) ($wizardValues[$k] ?? ''));
    if (looks_like_bot()) {
        // A bot sees the same thank-you and nothing is saved.
        redirect('/programare?trimisa=1');
    }
    if (mb_strlen($v('name')) < 2 || mb_strlen($v('name')) > 80) {
        $wizardErrors['name'] = 'Scrieți numele și prenumele.';
    }
    if (national_digits($v('phone')) === null) {
        $wizardErrors['phone'] = 'Scrieți un număr de telefon românesc, de exemplu 0744 123 456.';
    }
    if ($v('email') !== '' && !filter_var($v('email'), FILTER_VALIDATE_EMAIL)) {
        $wizardErrors['email'] = 'Adresa de e-mail nu pare corectă.';
    }
    if ($v('consent') !== '1') {
        $wizardErrors['consent'] = 'Bifați acordul pentru folosirea datelor, ca să vă putem programa.';
    }
    $clinic = null;
    foreach (clinics() as $c) {
        if ($c['id'] !== null && (string) $c['id'] === $v('clinica')) {
            $clinic = $c;
        }
    }
    $reason = null;
    foreach ($reasons as $r) {
        if ((string) $r['id'] === $v('serviciu')) {
            $reason ??= $r;
        }
    }
    if ($op === 'apel') {
        if ($wizardErrors === [] && !rate_hit('apel:' . client_ip_hash(), 5, 600)) {
            $wizardErrors['form'] = 'Ați trimis deja mai multe cereri. Sunați-ne, vă rugăm.';
        }
        if ($wizardErrors === []) {
            $id = db_insert('leads', [
                'kind' => 'programare', 'location_id' => $clinic['id'] ?? null, 'category_slug' => $reason['category'] ?? null, 'preferred_time' => isset(TIME_WINDOWS[$v('interval')]) ? $v('interval') : 'oricand',
                'comfort' => isset(COMFORT_LABELS[$v('confort')]) ? $v('confort') : null, 'marketing_ok' => $v('marketing') === '1' ? 1 : 0,
                'name' => mb_substr($v('name'), 0, 120), 'phone' => format_phone($v('phone')), 'email' => $v('email') ?: null,
                'message' => mb_substr('Nu a găsit online o oră potrivită și vrea să fie sunat.' . ($reason ? ' Motiv: ' . $reason['label'] . '.' : '') . ($v('message') !== '' ? "\n" . $v('message') : ''), 0, 2000),
                'status' => 'nou', 'ip_hash' => client_ip_hash(), 'created_at' => now_sql(),
            ]);
            notify_new_lead($id);
            session_begin();
            $_SESSION['programare_trimisa'] = 'Am primit rugămintea. Vă sunăm în cel mult o zi lucrătoare, în intervalul ales.';
            redirect('/programare#cerere');
        }
    } else {
        if ($reason === null) {
            $wizardErrors['serviciu'] = 'Alegeți motivul programării.';
        }
        if ($clinic === null) {
            $wizardErrors['clinica'] = 'Alegeți clinica.';
        }
        if (!preg_match('/^(\d{12})-(\d+)-(\d+)-(\d{1,3})$/', $v('slot'), $sm) || ($clinic !== null && (int) $sm[2] !== $clinic['id'])) {
            $wizardErrors['slot'] = 'Alegeți ziua și ora.';
        }
        $child = null;
        if ($v('pentru') === 'copil') {
            $age = $v('varsta');
            if (mb_strlen($v('copil')) < 2) {
                $wizardErrors['copil'] = 'Scrieți prenumele copilului.';
            } elseif (!preg_match('/^\d{1,2}$/', $age) || (int) $age > 17) {
                $wizardErrors['varsta'] = 'Scrieți vârsta copilului (0–17 ani).';
            } else {
                $child = ['first' => mb_substr($v('copil'), 0, 80), 'age' => (int) $age];
            }
        }
        $key = preg_match('/^[a-f0-9]{32}$/', $v('cheie')) ? $v('cheie') : null;
        if ($wizardErrors === [] && $key !== null && ($prev = db_one('SELECT appointment_id FROM leads WHERE idempotency_key = ?', [$key])) !== null && $prev['appointment_id']) {
            // The same booking sent again (double click, reload): its confirmation.
            redirect('/programare?confirmare=' . appointment_token(db_one('SELECT * FROM appointments WHERE id = ?', [(int) $prev['appointment_id']])));
        }
        if ($wizardErrors === [] && (!rate_hit('rezerva:' . client_ip_hash(), 5, 600) || !rate_hit('rezerva-tel:' . national_digits($v('phone')), 3, 86400))) {
            $wizardErrors['form'] = 'Din această conexiune sau pentru acest telefon s-au făcut deja mai multe programări. Pentru altele, sunați-ne.';
        }
        if ($wizardErrors === []) {
            $comfort = isset(COMFORT_LABELS[$v('confort')]) ? $v('confort') : null;
            $notes = array_filter([
                $child ? "Pentru copil: {$child['first']}, {$child['age']} ani. Părintele: " . $v('name') . '.' : null,
                $comfort ? 'Cum se simte: ' . COMFORT_LABELS[$comfort] . ($v('confort_nota') !== '' ? ' (' . mb_substr($v('confort_nota'), 0, 500) . ')' : '') . '.' : null,
                $v('sedare') === '1' ? 'Ar vrea inhalosedare.' : null,
                $v('message') !== '' ? 'Mesaj: ' . mb_substr($v('message'), 0, 2000) : null,
            ]);
            try {
                $ids = book_slot($v('slot'), ['name' => $v('name'), 'phone' => $v('phone'), 'email' => $v('email') ?: null], $reason['label'], $reason['category'], null, [
                    'source' => 'online', 'service_id' => $reason['id'], 'comfort' => $comfort, 'sedation' => $v('sedare') === '1', 'notes' => implode("\n", $notes),
                    'marketing' => $v('marketing') === '1', 'child' => $child, 'idempotency_key' => $key,
                ]);
                $a = db_one('SELECT * FROM appointments WHERE id = ?', [$ids['appointment_id']]);
                $to = $clinic['email'] ?: (string) setting('notify_email');
                @send_mail($to, 'Programare nouă pe site: ' . $v('name'), "O programare nouă, făcută de pacient pe site:\n\n" . $v('name') . ', ' . format_phone($v('phone')) . "\n" . slot_label(['start' => $a['starts_at'], 'location_id' => (int) $a['location_id'], 'doctor_id' => (int) $a['doctor_id']]) . "\nMotiv: {$reason['label']}\n" . ($notes ? implode("\n", $notes) . "\n" : '') . "\nÎn calendar: " . absolute_url('/admin/programari/' . $ids['appointment_id']) . "\n", $v('email') ?: null);
                send_queue_after_response();
                redirect('/programare?confirmare=' . appointment_token($a));
            } catch (DomainException $e) {
                $wizardErrors['slot'] = 'Ora aleasă tocmai a fost ocupată. Alegeți alta, vă rugăm: celelalte date au rămas completate.';
                $wizardValues['slot'] = '';
            }
        }
    }
}

$clinics = clinics();
$errors = [];
$values = [
    'location' => array_key_exists(query('clinica'), $clinics) ? query('clinica') : '',
    'serviciu' => in_array(query('serviciu'), service_slugs(), true) ? query('serviciu') : '',
    'confort' => array_key_exists(query('confort'), COMFORT_LABELS) ? query('confort') : '',
    'interval' => 'oricand',
];
$sentMessage = null;

if (is_post() && !in_array(post('op'), ['rezerva', 'apel'], true)) {
    csrf_check();
    $r = submit_lead('programare');
    if ($r['ok']) {
        $_SESSION['programare_trimisa'] = $r['message'];
        redirect('/programare#cerere', 303);
    }
    $errors = $r['errors'];
    $values = $r['values'] + $values;
} elseif (isset($_COOKIE['da_sesiune']) || query('trimisa') === '1') {
    session_begin();
    $sentMessage = $_SESSION['programare_trimisa'] ?? (query('trimisa') === '1' ? 'Am primit programarea. Vă mulțumim!' : null);
    unset($_SESSION['programare_trimisa']);
}

/** The four steps (shown by assets/programare.js; without it the request form stays). */
function booking_wizard(array $cfg, array $reasons, array $values, array $errors): string
{
    $clinicsData = [];
    $doctors = [];
    $consult = null;
    foreach ($reasons as $r) {
        if (!empty($r['unsure'])) {
            $consult = $r;
        }
    }
    foreach (clinics() as $c) {
        if ($c['id'] === null) {
            continue;
        }
        $first = $consult ? (free_slots(['location_id' => $c['id'], 'service_id' => $consult['id'], 'limit' => 1, 'per_day' => 1])[0] ?? null) : null;
        $clinicsData[] = ['id' => $c['id'], 'slug' => $c['slug'], 'name' => $c['shortName'], 'address' => clinic_address($c), 'phone' => format_phone($c['phone']), 'tel' => tel_href($c['phone']),
            'first' => $first ? day_label($first['start']) . ', ' . substr($first['start'], 11, 5) : null];
        $doctors[$c['id']] = booking_doctors($c['id']);
    }
    $doers = [];
    foreach (db_all('SELECT c.slug, dc.doctor_id FROM doctor_categories dc JOIN categories c ON c.id = dc.category_id') as $r) {
        $doers[$r['slug']][] = (int) $r['doctor_id'];
    }
    // Prefill from the service pages (?serviciu=<page>), the clinic and the doctor (?clinica=, ?medic=), the comfort question (?confort=).
    $pre = $values;
    if (!isset($pre['serviciu']) && query('serviciu') !== '') {
        foreach ($reasons as $r) {
            if ((string) $r['id'] === query('serviciu') || ($r['category'] === query('serviciu') && empty($r['unsure']))) {
                $pre['serviciu'] ??= (string) $r['id'];
            }
        }
        $pre['serviciu'] ??= $consult ? (string) $consult['id'] : null;
    }
    foreach (clinics() as $c) {
        if (!isset($pre['clinica']) && $c['id'] !== null && $c['slug'] === query('clinica')) {
            $pre['clinica'] = (string) $c['id'];
        }
    }
    if (!isset($pre['medic']) && ($slug = query('medic')) !== '') {
        $pre['medic'] = (string) (db_value('SELECT id FROM doctors WHERE slug = ?', [$slug]) ?: '');
    }
    if (!isset($pre['confort']) && isset(COMFORT_LABELS[query('confort')])) {
        $pre['confort'] = query('confort');
    }
    $sedation = db_one("SELECT * FROM services WHERE code = 'INH-ORA'");
    $data = ['reasons' => $reasons, 'clinics' => $clinicsData, 'doctors' => $doctors, 'doers' => $doers, 'morning' => $cfg['morning_until'], 'days' => (int) $cfg['days_ahead'],
        'initial' => array_filter($pre, static fn ($x) => $x !== null && $x !== ''), 'errors' => $errors];
    $err = static fn (string $k) => $errors[$k] ?? null;
    $card = 'flex cursor-pointer items-start gap-3 rounded-panou border-2 border-linie bg-fundal p-4 transition-colors hover:border-linie-control has-[:checked]:border-actiune has-[:checked]:bg-menta-pal has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-actiune';
    $radio = 'mt-1 size-5 shrink-0 accent-[var(--da-actiune)]';
    $reasonCards = '';
    foreach ($reasons as $i => $r) {
        $reasonCards .= '<label class="' . $card . '"><input type="radio" name="motiv" value="' . $i . '" class="' . $radio . '"><span class="min-w-0"><span class="block font-semibold">' . e($r['label']) . '</span>' . ($r['hint'] !== '' ? '<span class="block text-mic text-discret">' . e($r['hint']) . '</span>' : '') . '</span></label>';
    }
    $clinicCards = '';
    foreach ($clinicsData as $c) {
        $clinicCards .= '<label class="' . $card . '"><input type="radio" name="clinica_r" value="' . (int) $c['id'] . '" class="' . $radio . '"><span class="min-w-0"><span class="block font-semibold">' . e($c['name']) . '</span><span class="block text-mic text-discret">' . e($c['address']) . '</span>'
            . '<span class="mt-1 block text-mic font-medium text-actiune">' . ($c['first'] ? 'Prima oră liberă: <span class="first-letter:uppercase">' . e($c['first']) . '</span>' : 'Nicio oră liberă online acum') . '</span></span></label>';
    }
    $phones = implode('', array_map(static fn ($c) => '<a href="' . e($c['tel']) . '" class="' . e(btn('secondary', 's')) . '">' . icon('phone', 16) . e($c['name'] . ' ' . $c['phone']) . '</a>', $clinicsData));
    $step = static fn (int $n, string $title, string $inner) => '<section data-pas="' . $n . '" aria-labelledby="pas-' . $n . '" class="rounded-[1.5rem] border border-linie bg-suprafata p-5 shadow-sm md:p-7">'
        . '<div class="flex items-center gap-3"><span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-adancit font-semibold text-discret" data-pas-nr>' . $n . '</span>'
        . '<h2 id="pas-' . $n . '" class="min-w-0 flex-1 text-h3 font-semibold">' . e($title) . '</h2><button type="button" data-schimba hidden class="' . e(btn('text', 's')) . '">Schimbați</button></div>'
        . '<p data-pas-rezumat hidden class="mt-2 pl-12 text-corp text-discret"></p><div data-pas-continut class="mt-5 flex flex-col gap-5">' . $inner . '</div></section>';
    $next = '<div><button type="button" data-inainte class="' . e(btn('primary', 'l')) . '">Continuați' . icon('chevron-right', 18) . '</button></div>';
    $comfortCards = '';
    foreach (['fara-emotii' => ['Fără emoții', 'Mă simt bine la dentist.'], 'emotii' => ['Am emoții', 'Mă liniștește să știu ce urmează.'], 'frica' => ['Mi-e frică', 'Am nevoie de răbdare (și poate de inhalosedare).']] as $k => [$t, $h]) {
        $comfortCards .= '<label class="' . $card . '"><input type="radio" name="confort" value="' . $k . '" class="' . $radio . '"' . (($values['confort'] ?? '') === $k ? ' checked' : '') . '><span><span class="block font-semibold">' . e($t) . '</span><span class="block text-mic text-discret">' . e($h) . '</span></span></label>';
    }
    $s1 = '<fieldset><legend class="mb-3 text-control font-medium">Pentru ce veniți?</legend><div class="grid gap-3 sm:grid-cols-2">' . $reasonCards . '</div>' . field_error('serviciu-eroare', $err('serviciu')) . '</fieldset>'
        . '<div data-urgent hidden class="rounded-panou border-2 border-carmin bg-carmin-pal p-4"><p class="font-semibold text-carmin">Vă doare tare? Sunați-ne acum, căutăm împreună cea mai apropiată oră:</p><div class="mt-3 flex flex-wrap gap-2">' . $phones . '</div><p class="mt-2 text-mic">Sau continuați și alegeți prima oră liberă.</p></div>'
        . '<fieldset><legend class="mb-3 text-control font-medium">La ce clinică?</legend><div class="grid gap-3 sm:grid-cols-2">' . $clinicCards . '</div>' . field_error('clinica-eroare', $err('clinica')) . '</fieldset>' . $next;
    $s2 = '<div><p class="mb-2 text-control font-medium">Medicul</p><div data-medici class="flex flex-wrap gap-2"></div></div>'
        . '<div><div class="mb-2 flex items-center justify-between gap-3"><p class="text-control font-medium" data-luna>Ziua</p><div class="flex gap-2"><button type="button" data-zile-inapoi class="' . e(btn('secondary', 's')) . '" aria-label="Zilele de dinainte">' . icon('chevron-left', 18) . '</button><button type="button" data-zile-inainte class="' . e(btn('secondary', 's')) . '" aria-label="Zilele următoare">' . icon('chevron-right', 18) . '</button></div></div>'
        . '<div data-zile class="grid grid-cols-4 gap-2 sm:grid-cols-7"></div></div>'
        . '<div data-ore aria-live="polite" class="flex flex-col gap-4"></div>' . field_error('slot-eroare', $err('slot'))
        . '<p><button type="button" data-vreau-apel class="inline-flex min-h-control items-center text-left font-medium text-link underline underline-offset-4">Nu găsesc o oră potrivită. Prefer să mă sunați.</button></p>' . $next;
    $s3 = '<fieldset><legend class="mb-3 text-control font-medium">Cum vă simțiți când vă gândiți la dentist?</legend><div class="grid gap-3 sm:grid-cols-3">' . $comfortCards . '</div></fieldset>'
        . '<div data-nota hidden>' . text_area('confort_nota', 'Ce vă îngrijorează? (opțional)', ['id' => 'p-confort_nota', 'value' => $values['confort_nota'] ?? '', 'rows' => 2, 'maxlength' => 500, 'hint' => 'Medicul citește înainte să intrați.']) . '</div>'
        . checkbox_field('sedare', 'Aș vrea inhalosedare' . ($sedation && $sedation['price_min'] ? ' (' . e(format_lei((int) $sedation['price_min'], false, null, null)) . ' / oră)' : ''), ['id' => 'p-sedare', 'checked' => ($values['sedare'] ?? '') === '1', 'description' => 'Rămâneți treaz, doar mult mai relaxat.']) . $next;
    $s4 = '<div class="grid gap-5 sm:grid-cols-2">' . text_field('name', 'Nume și prenume', ['id' => 'p-name', 'value' => $values['name'] ?? '', 'required' => true, 'autocomplete' => 'name', 'maxlength' => 80, 'error' => $err('name')])
        . text_field('phone', 'Telefon', ['id' => 'p-phone', 'type' => 'tel', 'value' => $values['phone'] ?? '', 'required' => true, 'autocomplete' => 'tel', 'maxlength' => 20, 'error' => $err('phone'), 'hint' => 'Aici primiți confirmarea.']) . '</div>'
        . text_field('email', 'E-mail', ['id' => 'p-email', 'type' => 'email', 'value' => $values['email'] ?? '', 'optional' => true, 'autocomplete' => 'email', 'maxlength' => 190, 'error' => $err('email'), 'hint' => 'Pentru confirmarea scrisă.'])
        . radio_group('pentru', 'Programarea este pentru', ['id' => 'p-pentru', 'eu' => 'Mine', 'copil' => 'Copilul meu'], ['inline' => true, 'value' => $values['pentru'] ?? 'eu'])
        . '<div data-copil hidden class="grid gap-5 sm:grid-cols-2">' . text_field('copil', 'Prenumele copilului', ['id' => 'p-copil', 'value' => $values['copil'] ?? '', 'maxlength' => 80, 'error' => $err('copil')]) . text_field('varsta', 'Vârsta', ['id' => 'p-varsta', 'type' => 'number', 'min' => 0, 'max' => 17, 'value' => $values['varsta'] ?? '', 'error' => $err('varsta')]) . '</div>'
        . text_area('message', 'Ceva ce ar trebui să știm', ['id' => 'p-message', 'value' => $values['message'] ?? '', 'optional' => true, 'rows' => 3, 'maxlength' => 2000])
        . checkbox_field('consent', 'Sunt de acord ca Dental Arena să folosească aceste date pentru programare, conform <a href="/politica-de-confidentialitate" class="text-link underline underline-offset-4">Politicii de confidențialitate</a>', ['id' => 'p-consent', 'required' => true, 'checked' => ($values['consent'] ?? '') === '1', 'error' => $err('consent')])
        . checkbox_field('marketing', 'Vreau să primesc oferte și noutăți prin SMS. Mă pot dezabona oricând.', ['id' => 'p-marketing', 'checked' => ($values['marketing'] ?? '') === '1'])
        . '<div><button type="submit" data-trimite class="' . e(btn('primary', 'l')) . '">Rezervați ora</button></div>';
    $hidden = '';
    foreach (['serviciu', 'clinica', 'medic', 'slot'] as $k) {
        $hidden .= '<input type="hidden" name="' . $k . '" value="' . e($values[$k] ?? '') . '">';
    }
    $apel = '<form method="post" action="/programare#cerere" novalidate data-apel hidden class="flex flex-col gap-5 rounded-[1.5rem] border-2 border-actiune bg-suprafata p-5 md:p-7">' . csrf_field() . bot_fields() . '<input type="hidden" name="op" value="apel"><input type="hidden" name="serviciu" value=""><input type="hidden" name="clinica" value="">'
        . '<h2 class="text-h3 font-semibold">Vă sunăm noi</h2><p class="-mt-3 text-corp text-discret">Lăsați-ne numele și telefonul; vă sunăm în cel mult o zi lucrătoare.</p>'
        . '<div class="grid gap-5 sm:grid-cols-2">' . text_field('name', 'Nume și prenume', ['id' => 'apel-name', 'required' => true, 'autocomplete' => 'name']) . text_field('phone', 'Telefon', ['id' => 'apel-phone', 'type' => 'tel', 'required' => true, 'autocomplete' => 'tel']) . '</div>'
        . radio_group('interval', 'Când vă convine să vă sunăm?', TIME_WINDOWS, ['id' => 'apel-interval', 'inline' => true, 'value' => 'oricand'])
        . checkbox_field('consent', 'Sunt de acord ca Dental Arena să folosească aceste date ca să mă sune, conform <a href="/politica-de-confidentialitate" class="text-link underline">Politicii de confidențialitate</a>', ['id' => 'apel-consent', 'required' => true])
        . '<div class="flex flex-wrap gap-3"><button type="submit" class="' . e(btn('primary', 'l')) . '">' . icon('phone', 18) . 'Sunați-mă</button><button type="button" data-inapoi-ore class="' . e(btn('text')) . '">Înapoi la ore</button></div></form>';
    return '<div data-programare hidden><script type="application/json" data-programare-date>' . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) . '</script>'
        . ($err('form') ? error_summary(['form' => $err('form')], 'Programarea nu s-a făcut') : '')
        . '<form method="post" action="/programare" novalidate data-programare-form class="flex flex-col gap-4">' . csrf_field() . bot_fields() . '<input type="hidden" name="op" value="rezerva"><input type="hidden" name="cheie" value="' . e($values['cheie'] ?? bin2hex(random_bytes(16))) . '">' . $hidden
        . $step(1, 'Motivul și clinica', $s1) . $step(2, 'Ziua și ora', $s2) . $step(3, 'Cum vă simțiți', $s3) . $step(4, 'Datele dumneavoastră', $s4) . '</form>' . $apel . '</div>';
}

$body = capture(function () use ($clinics, $errors, $values, $sentMessage, $bookable, $cfg, $reasons, $wizardValues, $wizardErrors): void {
    $err = static fn (string $k): ?string => $errors[$k] ?? null;
    $services = ['' => 'Nu știu încă: o consultație'];
    foreach (content('services') as $s) {
        $services[$s['slug']] = $s['title'];
    }
    $clinicOptions = [];
    foreach ($clinics as $slug => $c) {
        $clinicOptions[$slug] = ['label' => $c['shortName'], 'description' => clinic_address($c)];
    }
    $comfort = ['' => 'Nu vreau să spun'] + array_map(static fn ($l) => $l, COMFORT_LABELS);
    $comfort['frica'] = 'Mi-e frică';
    ?>
<div class="<?= CONTAINER ?> pt-6 pb-sectiune md:pt-10">
  <nav aria-label="Cale de navigare" class="text-mic text-discret">
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <li class="inline-flex items-center gap-2"><a class="text-discret underline underline-offset-4 hover:text-link hover:decoration-2" href="/">Acasă</a><span aria-hidden="true" class="text-linie-control">/</span></li>
      <li class="inline-flex items-center gap-2"><span aria-current="page" class="text-cerneala">Programare</span></li>
    </ol>
  </nav>
  <div class="mt-8 grid grid-cols-1 gap-x-gutter gap-y-12 lg:mt-12 lg:grid-cols-12">
    <div class="lg:col-span-7">
      <h1 class="font-display text-h1 text-cerneala">Programare online</h1>
      <?php if ($bookable && $sentMessage === null) { ?>
      <p class="mt-5 text-lead text-discret masura-lead">Alegeți motivul, clinica și ora liberă care vă convine. Programarea intră direct în calendarul clinicii.</p>
      <div class="mt-10"><?= booking_wizard($cfg, $reasons, $wizardValues, $wizardErrors) ?></div>
      <?php } else { ?>
      <p class="mt-5 text-lead text-discret masura-lead">Lăsați-ne datele și vă sunăm în cel mult o zi lucrătoare ca să stabilim ora.</p>
      <?php } ?>
      <div id="cerere" class="mt-10 scroll-mt-28"<?= $bookable && $sentMessage === null ? ' data-fara-js' : '' ?>>
        <?php if ($sentMessage !== null) { ?>
        <?= success_panel($sentMessage, 'Dacă vă grăbiți, sunați direct la clinică.') ?>
        <p class="mt-6"><a href="/" class="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">Înapoi la prima pagină</a></p>
        <?php } else { ?>
        <form method="post" action="/programare#cerere" novalidate class="flex flex-col gap-8">
          <?= error_summary($errors) ?>
          <?= csrf_field() ?>
          <?= bot_fields() ?>
          <?= radio_group('location', 'La ce clinică veniți?', $clinicOptions, ['required' => true, 'value' => $values['location'] ?? '', 'error' => $err('location')]) ?>
          <?= select_field('serviciu', 'Pentru ce veniți?', $services, ['value' => $values['serviciu'] ?? '', 'hint' => 'Dacă nu știți sigur, alegeți consultația: medicul vă spune ce e de făcut.']) ?>
          <div class="grid gap-6 sm:grid-cols-2">
            <?= text_field('data', 'Ziua dorită', ['type' => 'date', 'value' => $values['data'] ?? '', 'optional' => true, 'min' => date('Y-m-d'), 'max' => date('Y-m-d', strtotime('+6 months')), 'error' => $err('data')]) ?>
          </div>
          <?= radio_group('interval', 'Când vă convine?', TIME_WINDOWS, ['inline' => true, 'value' => $values['interval'] ?? 'oricand']) ?>
          <?= radio_group('confort', 'Cum vă simțiți când vă gândiți la dentist?', $comfort, ['inline' => true, 'optional' => true, 'value' => $values['confort'] ?? '', 'hint' => 'Medicul vede răspunsul înainte să intrați. Dacă vă e frică, putem lucra sub inhalosedare.']) ?>
          <fieldset class="flex flex-col gap-6">
            <legend class="mb-1 text-h3 font-semibold text-cerneala">Datele dumneavoastră</legend>
            <?= text_field('name', 'Nume și prenume', ['value' => $values['name'] ?? '', 'required' => true, 'autocomplete' => 'name', 'maxlength' => 80, 'error' => $err('name')]) ?>
            <div class="grid gap-6 sm:grid-cols-2">
              <?= text_field('phone', 'Telefon', ['type' => 'tel', 'value' => $values['phone'] ?? '', 'required' => true, 'autocomplete' => 'tel', 'maxlength' => 20, 'error' => $err('phone'), 'hint' => 'Vă sunăm la acest număr.']) ?>
              <?= text_field('email', 'E-mail', ['type' => 'email', 'value' => $values['email'] ?? '', 'optional' => true, 'autocomplete' => 'email', 'maxlength' => 190, 'error' => $err('email'), 'hint' => 'Vă trimitem confirmarea cererii.']) ?>
            </div>
            <?= text_area('message', 'Ceva ce ar trebui să știm', ['value' => $values['message'] ?? '', 'optional' => true, 'rows' => 4, 'maxlength' => 2000]) ?>
          </fieldset>
          <?= checkbox_field('consent', 'Sunt de acord ca Dental Arena să folosească aceste date ca să mă contacteze pentru programare, conform <a href="/politica-de-confidentialitate" class="text-link underline underline-offset-4">Politicii de confidențialitate</a>', [
              'required' => true,
              'checked' => ($values['consent'] ?? '') === '1',
              'error' => $err('consent'),
          ]) ?>
          <?= checkbox_field('marketing', 'Vreau să primesc de la Dental Arena, prin SMS și e-mail, oferte și noutăți. Mă pot dezabona oricând.', [
              'checked' => ($values['marketing'] ?? '') === '1',
          ]) ?>
          <div><?= submit_button('Trimiteți cererea') ?></div>
        </form>
        <?php } ?>
      </div>
    </div>
    <aside aria-labelledby="sunati-direct" class="lg:col-span-4 lg:col-start-9">
      <div class="flex flex-col gap-6 lg:sticky lg:top-28">
        <?php if ($bookable && $sentMessage === null) { ?>
        <section data-rezumat hidden aria-label="Programarea dumneavoastră" class="rounded-panou border-2 border-actiune bg-suprafata p-6">
          <h2 class="text-h3 font-semibold text-cerneala">Programarea dumneavoastră</h2>
          <dl class="mt-4 grid grid-cols-[6rem_1fr] gap-y-2 text-corp">
            <dt class="text-discret">Motivul</dt><dd data-r-motiv>—</dd>
            <dt class="text-discret">Clinica</dt><dd data-r-clinica>—</dd>
            <dt class="text-discret">Ziua, ora</dt><dd data-r-ora class="first-letter:uppercase">—</dd>
            <dt class="text-discret">Medicul</dt><dd data-r-medic>Oricare medic</dd>
          </dl>
        </section>
        <?php } ?>
        <section class="rounded-panou bg-suprafata p-6">
          <h2 id="sunati-direct" class="text-h3 font-semibold text-cerneala">Vă grăbiți? Sunați direct</h2>
          <ul class="mt-4 flex flex-col gap-3">
            <?php foreach ($clinics as $c) { ?>
            <li>
              <p class="text-mic text-discret"><?= e($c['shortName']) ?></p>
              <?= phone_link_full($c, false, true, 'text-h3', 'font-semibold') ?>
              <?php if ($c['hoursText']) { ?><p class="text-mic text-discret cifre"><?= e(strtok($c['hoursText'], "\n")) ?></p><?php } ?>
            </li>
            <?php } ?>
          </ul>
        </section>
        <section aria-labelledby="ce-urmeaza" class="rounded-panou border border-linie p-6">
          <h2 id="ce-urmeaza" class="text-h3 font-semibold text-cerneala">Ce urmează</h2>
          <ol class="mt-4 flex flex-col gap-3 text-corp text-cerneala">
            <?php if ($bookable && $sentMessage === null) { ?>
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">1</span>Ora aleasă intră direct în calendarul clinicii.</li>
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">2</span>Primiți confirmarea pe telefon, cu un link de unde puteți confirma sau anula.</li>
            <?php } else { ?>
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">1</span>Vă sunăm în cel mult o zi lucrătoare.</li>
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">2</span>Stabilim împreună ziua și ora.</li>
            <?php } ?>
            <li class="grid grid-cols-[1.75rem_1fr]"><span aria-hidden="true" class="font-display text-[1.5rem] leading-none text-menta cifre">3</span>Vă așteptăm la clinică. Prima vizită începe cu o consultație.</li>
          </ol>
        </section>
        <?= comfort_note('Vă e teamă?', 'Spuneți-ne în formular. Putem lucra sub inhalosedare: rămâneți conștient, doar mult mai relaxat.') ?>
      </div>
    </aside>
  </div>
</div>
    <?php
});

if ($bookable) {
    $body .= '<script src="' . e(asset(is_file(PUBLIC_DIR . '/assets/programare.min.js') ? '/assets/programare.min.js' : '/assets/programare.js')) . '" defer></script>';
}
render_page($body, page_meta([
    'title' => 'Programare online',
    'description' => 'Programați-vă online la Dental Arena Cristești, lângă Târgu Mureș, sau Luduș: alegeți motivul, clinica și o oră liberă din calendar.',
    'path' => '/programare',
]), json_ld(breadcrumb_ld([['name' => 'Programare', 'path' => '/programare']])));
