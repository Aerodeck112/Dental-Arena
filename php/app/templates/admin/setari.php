<?php
/**
 * /admin/setari: where the requests are e-mailed, how long closed requests are kept, and each
 * clinic's address, phone, e-mail, hours and company (each clinic is its own company: it signs the
 * consents, issues the invoices with its own series and is named in the legal pages).
 */
declare(strict_types=1);

$notify = (string) setting('notify_email');
$facebook = setting('facebook');
$retention = (string) setting('lead_retention_days');
$locations = db_all('SELECT * FROM locations ORDER BY sort_order, id');
$errors = [];
$inv = invoicing();
$finance = finance_on();
$before = ['facebook' => $facebook, 'notify' => $notify, 'retention' => $retention, 'inv' => $inv, 'locations' => $locations];
$consentTexts = [];
foreach (array_keys(CONSENT_TYPES) as $t) {
    $consentTexts[$t] = consent_text($t);
}

if (is_post()) {
    csrf_check();
    $facebook = ['url' => trim(post('facebook_url')), 'show_posts' => post('facebook_show_posts') === '1'];
    if ($facebook['url'] !== '' && !preg_match('~^https://(www\.|m\.)?facebook\.com/[^\s?#]+$~i', $facebook['url'])) {
        $errors['facebook_url'] = 'Scrieți adresa paginii, de exemplu https://www.facebook.com/www.dentalarena.ro';
    }
    $facebook['url'] = preg_replace('#^https://(www\.|m\.)?facebook\.com/#i', 'https://www.facebook.com/', $facebook['url']) ?? $facebook['url'];
    $notify = mb_strtolower(post('notify_email'));
    if (!filter_var($notify, FILTER_VALIDATE_EMAIL)) {
        $errors['notify_email'] = 'Scrieți adresa care primește cererile.';
    }
    $retention = post('lead_retention_days');
    if (!preg_match('/^\d+$/', $retention) || (int) $retention < 30 || (int) $retention > 3650) {
        $errors['lead_retention_days'] = 'Alegeți între 30 și 3650 de zile.';
    }
    // The invoicing fields are on the page only with the money part switched on.
    $numbers = [];
    $wasFinance = $finance;
    $finance = post('modul_financiar') === '1';
    if ($wasFinance) {
        $inv['vatNote'] = trim(post('inv_vatNote'));
        $inv['vatRate'] = post('inv_vatRate');
        if (!ctype_digit($inv['vatRate']) || (int) $inv['vatRate'] > 100) {
            $errors['inv_vatRate'] = 'Cota TVA este între 0 și 100.';
        }
        $inv['vatRate'] = (int) $inv['vatRate'];
        $inv['paymentTermDays'] = post('inv_paymentTermDays');
        if (!ctype_digit($inv['paymentTermDays']) || (int) $inv['paymentTermDays'] > 365) {
            $errors['inv_paymentTermDays'] = 'Termenul este între 0 și 365 de zile.';
        }
        $inv['paymentTermDays'] = (int) $inv['paymentTermDays'];
        $inv['vatNote'] = mb_substr($inv['vatNote'], 0, 300);
    }
    $consentChanged = false;
    foreach (array_keys(CONSENT_TYPES) as $t) {
        $text = str_replace("\r\n", "\n", trim(post("consent_{$t}")));
        if ($text !== $consentTexts[$t]) {
            $consentChanged = true;
        }
        $consentTexts[$t] = $text;
    }
    $locIn = [];
    foreach ($locations as $l) {
        $id = (int) $l['id'];
        $r = [];
        foreach (['name', 'short_name', 'street', 'city', 'county', 'postal_code', 'phone', 'email', 'hours_text'] as $k) {
            $raw = $_POST['loc'][$id][$k] ?? '';
            $r[$k] = is_string($raw) ? mb_substr(trim($raw), 0, $k === 'hours_text' ? 1000 : 190) : '';
        }
        $r['publish_hours'] = !empty($_POST['loc'][$id]['publish_hours']) ? 1 : 0;
        // Opening hours by weekday: they cut the doctors' hours for online booking.
        $problem = null;
        $hours = week_schedule_parse($_POST['hours'][$id] ?? [], " la {$l['short_name']}", $problem);
        if ($problem !== null) {
            $errors["loc_{$id}_hours"] = $problem;
        }
        $r['hours_json'] = $hours !== [] ? json_encode($hours) : null;
        if ($r['hours_text'] === '' && $hours !== []) {
            $r['hours_text'] = str_replace(', ', "\n", schedule_text($hours));
        }
        $r['cabinets'] = max(1, min(20, (int) ($_POST['loc'][$id]['cabinets'] ?? 1)));
        // The clinic's company: it signs the consents and issues the invoices.
        foreach (['legal_name' => 190, 'cui' => 20, 'reg_com' => 40, 'registered_address' => 255, 'bank' => 120, 'iban' => 34] as $k => $max) {
            $raw = $_POST['loc'][$id][$k] ?? '';
            $r[$k] = is_string($raw) ? mb_substr(trim($raw), 0, $max) : '';
        }
        $r['cui'] = strtoupper(str_replace(' ', '', $r['cui']));
        $r['iban'] = strtoupper(str_replace(' ', '', $r['iban']));
        if ($r['legal_name'] === '') {
            $errors["loc_{$id}_legal_name"] = "{$l['short_name']}: scrieți denumirea firmei, de exemplu S.C. Dental Arena S.R.L.";
        }
        if ($r['cui'] !== '' && !preg_match('/^(RO)?\d{2,10}$/', $r['cui'])) {
            $errors["loc_{$id}_cui"] = "{$l['short_name']}: CUI-ul are doar cifre, eventual cu RO în față.";
        }
        if ($r['iban'] !== '' && !preg_match('/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/', $r['iban'])) {
            $errors["loc_{$id}_iban"] = "{$l['short_name']}: IBAN-ul românesc are 24 de caractere și începe cu RO, de exemplu RO49AAAA1B31007593840000.";
        }
        foreach (['legal_name', 'cui', 'reg_com', 'registered_address', 'bank', 'iban'] as $k) {
            $r[$k] = $r[$k] !== '' ? $r[$k] : null;
        }
        // Each company numbers its own invoices and receipts (only with the money part on).
        if ($wasFinance) {
            foreach (['invoice_series' => ['factura', 'Seria facturilor', 'next_invoice'], 'receipt_series' => ['chitanta', 'Seria chitanțelor', 'next_receipt']] as $k => [$seq, $label, $nextField]) {
                $r[$k] = strtoupper(trim((string) ($_POST['loc'][$id][$k] ?? '')));
                if (!preg_match('/^[A-Z]{1,8}$/', $r[$k])) {
                    $errors["loc_{$id}_{$k}"] = "{$l['short_name']}: {$label} are doar litere mari, de exemplu DA.";
                    continue;
                }
                $want = (string) ($_POST['loc'][$id][$nextField] ?? '');
                $current = peek_sequence("{$seq}:{$r[$k]}");
                if (!ctype_digit($want) || (int) $want < 1) {
                    $errors["loc_{$id}_{$nextField}"] = "{$l['short_name']}: scrieți următorul număr.";
                } elseif ((int) $want < $current) {
                    $errors["loc_{$id}_{$nextField}"] = "{$l['short_name']}: numărul nu poate coborî sub {$current}, numerele sunt deja folosite.";
                } else {
                    $numbers["{$seq}:{$r[$k]}"] = (int) $want;
                }
            }
            if (($r['invoice_series'] ?? '') !== '' && $r['invoice_series'] === ($r['receipt_series'] ?? '')) {
                $errors["loc_{$id}_receipt_series"] = "{$l['short_name']}: chitanțele au altă serie decât facturile.";
            }
        }
        foreach (['name' => 'numele', 'short_name' => 'numele scurt', 'street' => 'strada', 'city' => 'localitatea', 'phone' => 'telefonul'] as $k => $label) {
            if ($r[$k] === '') {
                $errors["loc_{$id}_{$k}"] = "{$l['short_name']}: scrieți {$label}.";
            }
        }
        if ($r['email'] !== '' && !filter_var($r['email'], FILTER_VALIDATE_EMAIL)) {
            $errors["loc_{$id}_email"] = "{$l['short_name']}: e-mailul nu este corect.";
        }
        if ($r['phone'] !== '' && national_digits($r['phone']) === null) {
            $errors["loc_{$id}_phone"] = "{$l['short_name']}: scrieți telefonul ca 0265 326 316.";
        }
        $locIn[$id] = $r;
    }
    if ($errors === []) {
        $seriesSeen = [];
        foreach ($locIn as $id => $r) {
            foreach (['invoice_series', 'receipt_series'] as $k) {
                if (isset($r[$k]) && isset($seriesSeen[$r[$k]])) {
                    $errors["loc_{$id}_{$k}"] = 'Fiecare firmă are seriile ei: seria ' . $r[$k] . ' este deja folosită mai sus.';
                }
                if (isset($r[$k])) {
                    $seriesSeen[$r[$k]] = true;
                }
            }
        }
    }
    if ($errors === []) {
        db_tx(static function () use ($facebook, $notify, $retention, $locIn, $inv, $numbers, $consentTexts, $consentChanged, $finance, $wasFinance): void {
            if ($wasFinance) {
                setting_save('invoicing', $inv);
            }
            setting_save('modul_financiar', $finance);
            foreach ($numbers as $key => $next) {
                db_run('INSERT INTO number_sequences (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = GREATEST(v, VALUES(v))', [$key, $next - 1]);
            }
            if ($consentChanged) {
                $store = [];
                foreach ($consentTexts as $k => $text) {
                    $store[$k] = $text === '' || $text === CONSENT_DEFAULTS[$k] ? null : $text;
                }
                setting_save('consent_texts', $store);
                setting_save('consent_version', date('Y-m-d'));
            }
            setting_save('facebook', $facebook);
            setting_save('notify_email', $notify);
            setting_save('lead_retention_days', (int) $retention);
            foreach ($locIn as $id => $r) {
                db_update('locations', $r, 'id = :id', ['id' => $id]);
            }
        });
        $what = array_filter([
            $finance !== $wasFinance ? ($finance ? 'partea financiară pornită' : 'partea financiară oprită') : null,
            changes_text($before['facebook'], $facebook, ['url' => 'pagina de Facebook', 'show_posts' => 'postările Facebook pe prima pagină']),
            changes_text(['n' => $before['notify'], 'r' => (string) $before['retention']], ['n' => $notify, 'r' => (string) $retention], ['n' => 'e-mailul pentru cereri', 'r' => 'păstrarea cererilor (zile)']),
            $wasFinance ? changes_text($before['inv'], $inv, ['vatRate' => 'TVA', 'paymentTermDays' => 'termen de plată', 'vatNote' => 'mențiunea TVA']) : null,
            $consentChanged ? 'textele acordurilor' : null,
        ], static fn ($x) => $x !== null && $x !== 'nicio schimbare');
        foreach ($before['locations'] as $l) {
            $c = changes_text($l, $locIn[(int) $l['id']] + $l, ['name' => 'numele', 'short_name' => 'numele scurt', 'street' => 'strada', 'city' => 'localitatea', 'county' => 'județul', 'postal_code' => 'codul poștal', 'phone' => 'telefonul', 'email' => 'e-mailul', 'hours_text' => 'programul', 'publish_hours' => 'programul pe site', 'hours_json' => 'orele pe zile', 'cabinets' => 'cabinete', 'legal_name' => 'firma', 'cui' => 'CUI', 'reg_com' => 'Reg. Com.', 'registered_address' => 'sediul firmei', 'bank' => 'banca', 'iban' => 'IBAN', 'invoice_series' => 'seria facturilor', 'receipt_series' => 'seria chitanțelor']);
            if ($c !== 'nicio schimbare') {
                $what[] = "{$l['short_name']}: {$c}";
            }
        }
        audit('setari', $what !== [] ? implode('; ', $what) : 'salvate, fără schimbări');
        flash('Setările au fost salvate. Sunt deja pe site.');
        redirect('/admin/setari');
    }
    foreach ($locations as &$l) {
        $l = $locIn[(int) $l['id']] + $l;
    }
    unset($l);
}

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$seriesRows = '';
$clinicSections = '';
foreach ($locations as $l) {
    $id = (int) $l['id'];
    $f = static fn (string $k, string $label, array $o = []) => text_field("loc[{$id}][{$k}]", $label, $o + ['id' => "field-loc_{$id}_{$k}", 'value' => (string) ($l[$k] ?? ''), 'error' => $errors["loc_{$id}_{$k}"] ?? null]);
    if ($finance) {
        // Back from a failed save: what was typed; otherwise the series in use and their next numbers.
        $typed = isset($_POST['loc'][$id]['invoice_series']);
        $ser = $typed ? ['invoice' => (string) ($l['invoice_series'] ?? ''), 'receipt' => (string) ($l['receipt_series'] ?? '')] : location_series($id);
        $nextOf = static fn (string $seq, string $series, string $field) => $typed ? (string) ($_POST['loc'][$id][$field] ?? '') : (string) peek_sequence("{$seq}:{$series}");
        $seriesRows .= '<fieldset class="min-w-0 border-t border-linie pt-4 first:border-t-0 first:pt-0"><legend class="text-control font-semibold">' . e($l['short_name']) . ' · ' . e((string) ($l['legal_name'] ?? '')) . '</legend>'
            . '<div class="mt-3 grid gap-5 md:grid-cols-2">'
            . $f('invoice_series', 'Seria facturilor', ['value' => $ser['invoice'], 'maxlength' => 8])
            . $f('next_invoice', 'Următorul număr de factură', ['value' => $nextOf('factura', $ser['invoice'], 'next_invoice'), 'inputmode' => 'numeric'])
            . $f('receipt_series', 'Seria chitanțelor', ['value' => $ser['receipt'], 'maxlength' => 8])
            . $f('next_receipt', 'Următorul număr de chitanță', ['value' => $nextOf('chitanta', $ser['receipt'], 'next_receipt'), 'inputmode' => 'numeric'])
            . '</div></fieldset>';
    }
    $clinicSections .= admin_section_open('Clinica din ' . $l['short_name'], "clinica-{$id}")
        . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
        . $f('name', 'Numele complet') . $f('short_name', 'Numele scurt', ['hint' => 'Cum apare în meniuri: Cristești'])
        . $f('street', 'Strada și numărul') . $f('city', 'Localitatea') . $f('county', 'Județul') . $f('postal_code', 'Codul poștal', ['optional' => true])
        . $f('phone', 'Telefonul', ['type' => 'tel']) . $f('email', 'E-mailul clinicii', ['type' => 'email', 'optional' => true, 'hint' => 'Primește cererile pentru această clinică.'])
        . '</div><div class="mt-5 grid gap-4">'
        . text_area("loc[{$id}][hours_text]", 'Programul', ['id' => "field-loc_{$id}_hours_text", 'value' => (string) $l['hours_text'], 'rows' => 3, 'optional' => true, 'hint' => 'Câte un rând, de exemplu: Luni–Vineri: 09:00–19:00'])
        . '<fieldset id="field-loc_' . $id . '_hours" tabindex="-1" class="min-w-0"><legend class="text-control font-medium">Orele clinicii, pe zile</legend>'
        . '<p class="text-mic text-discret">Opțional. Completate, taie programul medicilor: pe site nu apar ore în care clinica e închisă. Dacă textul de mai sus e gol, se scrie din ele.</p>'
        . week_schedule_fields("hours[{$id}]", schedule_decode($l['hours_json'] ?? null), ", {$l['short_name']}") . field_error("field-loc_{$id}_hours-error", $errors["loc_{$id}_hours"] ?? null) . '</fieldset>'
        . '<div class="grid gap-5 sm:grid-cols-2">'
        . text_field("loc[{$id}][cabinets]", 'Câte cabinete (scaune) are', ['id' => "field-loc_{$id}_cabinets", 'type' => 'number', 'min' => 1, 'max' => 20, 'value' => (string) ($l['cabinets'] ?? 1), 'hint' => 'Cu mai multe, calendarul se poate vedea și pe cabinete.'])
        . '</div>'
        . checkbox_field("loc[{$id}][publish_hours]", 'Programul apare pe site', ['id' => "field-loc_{$id}_publish_hours", 'checked' => (int) $l['publish_hours'] === 1, 'description' => 'Bifați după ce ați verificat orele.'])
        . '</div>'
        . '<h3 class="mt-6 text-h3 font-semibold">Firma clinicii</h3>'
        . '<p class="text-mic text-discret">Apare pe acordurile semnate aici (și pe tabletă), pe facturi și în paginile legale de pe site.</p>'
        . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
        . $f('legal_name', 'Denumirea firmei', ['hint' => 'De exemplu S.C. Dental Arena S.R.L.'])
        . $f('cui', 'CUI', ['optional' => true, 'hint' => 'Cu RO în față dacă firma plătește TVA.'])
        . $f('reg_com', 'Nr. Reg. Com.', ['optional' => true, 'hint' => 'De exemplu J26/123/2010'])
        . $f('registered_address', 'Sediul social', ['optional' => true])
        . $f('bank', 'Banca', ['optional' => true])
        . $f('iban', 'IBAN', ['optional' => true])
        . '</div></section>';
}

$body = admin_header('Setări', 'Unde ajung cererile, datele clinicilor și firma fiecărei clinici. Se văd pe site imediat după salvare.', '<a href="/admin/setari/mesaje" class="' . e(btn('secondary')) . '">' . icon('message-square', 18) . 'Mesaje: SMS, WhatsApp, e-mail</a><a href="/admin/setari/ai" class="' . e(btn('secondary')) . '">' . admin_icon('sparkles', 18) . 'Asistentul AI</a><a href="/admin/tablete" class="' . e(btn('secondary')) . '">' . admin_icon('tablet', 18) . 'Tablete de semnare</a><a href="/admin/setari/programari" class="' . e(btn('secondary')) . '">' . icon('calendar', 18) . 'Programări online</a><a href="/admin/setari/chat" class="' . e(btn('secondary')) . '">' . admin_icon('bot', 18) . 'Chatul de pe site</a><a href="/admin/actualizare" class="' . e(btn('secondary')) . '">' . icon('refresh-cw', 18) . 'Actualizare</a>')
    . '<form method="post" novalidate class="flex max-w-4xl flex-col gap-8">' . csrf_field() . error_summary($errors)
    . admin_section_open('Pagina de Facebook', 'facebook', 'Postările ei apar pe prima pagină a site-ului, în „Ce mai facem”, după ce vizitatorul acceptă cookie-urile Facebook. Linkul din subsolul site-ului duce tot aici.')
    . '<div class="mt-4 flex flex-col gap-5">'
    . text_field('facebook_url', 'Adresa paginii de Facebook', ['type' => 'url', 'value' => $facebook['url'], 'optional' => true, 'placeholder' => content('site.facebookUrl'), 'error' => $err('facebook_url'), 'hint' => 'Goală: ' . content('site.facebookUrl') . '. Pagina trebuie să fie publică, altfel Facebook nu arată postările.'])
    . checkbox_field('facebook_show_posts', 'Postările apar pe prima pagină', ['checked' => (bool) $facebook['show_posts']])
    . '</div></section>'
    . admin_section_open('Cererile de pe site', 'cereri-setari')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . text_field('notify_email', 'E-mailul care primește cererile', ['type' => 'email', 'value' => $notify, 'required' => true, 'error' => $err('notify_email'), 'hint' => 'Folosit când clinica nu are e-mailul ei sau mesajul nu e pentru o clinică.'])
    . text_field('lead_retention_days', 'Câte zile păstrăm cererile închise', ['type' => 'number', 'value' => $retention, 'min' => 30, 'max' => 3650, 'error' => $err('lead_retention_days'), 'hint' => 'Apoi se șterg singure (GDPR). Recomandat: 365.'])
    . '</div></section>'
    . admin_section_open('Module', 'module', 'Părțile panoului care se pornesc pe rând.')
    . '<div class="mt-4">' . checkbox_field('modul_financiar', 'Partea financiară: facturi, încasări, sold pacient, venituri în rapoarte', ['checked' => $finance, 'description' => 'Etapa 2: se pornește după perioada de probă. Oprită, nimeni din clinică nu vede meniurile Facturi și Încasări; ce s-a emis deja rămâne în baza de date.']) . '</div></section>'
    . ($finance ? admin_section_open('Facturare', 'facturare', 'Fiecare clinică este o firmă și își numerotează singură facturile și chitanțele. Dacă ați emis deja facturi din alt program, continuați numerotarea de acolo.')
    . '<div class="mt-4 flex flex-col gap-5">' . $seriesRows . '</div>'
    . '<div class="mt-5 grid gap-5 md:grid-cols-2">'
    . text_field('inv_vatRate', 'Cota TVA implicită (%)', ['value' => (string) $inv['vatRate'], 'inputmode' => 'numeric', 'error' => $err('inv_vatRate'), 'hint' => 'Serviciile stomatologice sunt de regulă scutite: 0.'])
    . text_field('inv_paymentTermDays', 'Termen de plată (zile)', ['value' => (string) $inv['paymentTermDays'], 'inputmode' => 'numeric', 'error' => $err('inv_paymentTermDays'), 'hint' => '0 = fără scadență pe factură.'])
    . text_field('inv_vatNote', 'Mențiunea despre TVA pe factură', ['value' => $inv['vatNote'], 'class' => 'md:col-span-2', 'hint' => 'Verificați formularea cu contabilul.'])
    . '</div></section>' : '')
    . admin_section_open('Textele acordurilor', 'acorduri', 'Ce scrie pe formularele tipărite din fișa pacientului. {{pacient}}, {{firma}}, {{clinica}}, {{email}}, {{telefon}} și {{adresa}} se completează singure; {{medic}} și {{interventie}} se aleg la codul pentru tabletă (pe hârtie rămâne loc de scris). Lăsați gol ca să reveniți la textul inițial.')
    . '<div class="mt-4 flex flex-col gap-5">' . implode('', array_map(static fn ($t) => text_area("consent_{$t}", CONSENT_TYPES[$t], ['value' => $consentTexts[$t], 'rows' => 8]), array_keys(CONSENT_TYPES))) . '</div>'
    . '<p class="mt-3 text-mic text-discret">Versiunea textelor: ' . e(consent_version()) . '. Se schimbă singură când modificați un text, iar fiecare acord semnat păstrează versiunea de atunci.</p></section>'
    . $clinicSections
    . '<div class="sticky bottom-0 -mx-4 border-t border-linie bg-fundal/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-panou md:border"><button type="submit" class="' . e(btn('primary', 'l')) . '">Salvați setările</button></div>'
    . '</form>';
admin_page('Setări', $body, $user);
