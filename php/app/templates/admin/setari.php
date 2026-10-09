<?php
/**
 * /admin/setari: the company data (shown in the legal pages), where the requests are e-mailed,
 * how long closed requests are kept, and each clinic's address, phone, e-mail and hours.
 */
declare(strict_types=1);

$company = setting('company');
$notify = (string) setting('notify_email');
$retention = (string) setting('lead_retention_days');
$locations = db_all('SELECT * FROM locations ORDER BY sort_order, id');
$errors = [];

if (is_post()) {
    csrf_check();
    foreach (array_keys(SETTING_DEFAULTS['company']) as $k) {
        $company[$k] = mb_substr(post("company_{$k}"), 0, 255);
    }
    $company['iban'] = strtoupper(str_replace(' ', '', $company['iban']));
    if ($company['iban'] !== '' && !preg_match('/^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/', $company['iban'])) {
        $errors['company_iban'] = 'IBAN-ul românesc are 24 de caractere și începe cu RO, de exemplu RO49AAAA1B31007593840000.';
    }
    if ($company['cui'] !== '' && !preg_match('/^(RO)?\d{2,10}$/i', str_replace(' ', '', $company['cui']))) {
        $errors['company_cui'] = 'CUI-ul are doar cifre, eventual cu RO în față.';
    }
    $notify = mb_strtolower(post('notify_email'));
    if (!filter_var($notify, FILTER_VALIDATE_EMAIL)) {
        $errors['notify_email'] = 'Scrieți adresa care primește cererile.';
    }
    $retention = post('lead_retention_days');
    if (!preg_match('/^\d+$/', $retention) || (int) $retention < 30 || (int) $retention > 3650) {
        $errors['lead_retention_days'] = 'Alegeți între 30 și 3650 de zile.';
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
        db_tx(static function () use ($company, $notify, $retention, $locIn): void {
            setting_save('company', $company);
            setting_save('notify_email', $notify);
            setting_save('lead_retention_days', (int) $retention);
            foreach ($locIn as $id => $r) {
                db_update('locations', $r, 'id = :id', ['id' => $id]);
            }
        });
        audit('setari', 'datele firmei și ale clinicilor');
        flash('Setările au fost salvate. Sunt deja pe site.');
        redirect('/admin/setari');
    }
    foreach ($locations as &$l) {
        $l = $locIn[(int) $l['id']] + $l;
    }
    unset($l);
}

$err = static fn (string $k): ?string => $errors[$k] ?? null;
$companyFields = '';
foreach ([
    'legalName' => ['Denumirea firmei', 'Apare în paginile legale, de exemplu S.C. Dental Arena Clinic S.R.L.'],
    'cui' => ['CUI', ''],
    'regCom' => ['Nr. Reg. Com.', 'De exemplu J26/123/2010'],
    'registeredAddress' => ['Sediul social', ''],
    'bank' => ['Banca', ''],
    'iban' => ['IBAN', ''],
] as $k => [$label, $hint]) {
    $companyFields .= text_field("company_{$k}", $label, ['value' => $company[$k], 'optional' => true, 'hint' => $hint ?: null, 'error' => $err("company_{$k}")]);
}
$clinicSections = '';
foreach ($locations as $l) {
    $id = (int) $l['id'];
    $f = static fn (string $k, string $label, array $o = []) => text_field("loc[{$id}][{$k}]", $label, $o + ['id' => "field-loc_{$id}_{$k}", 'value' => (string) $l[$k], 'error' => $errors["loc_{$id}_{$k}"] ?? null]);
    $clinicSections .= admin_section_open('Clinica din ' . $l['short_name'], "clinica-{$id}")
        . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
        . $f('name', 'Numele complet') . $f('short_name', 'Numele scurt', ['hint' => 'Cum apare în meniuri: Cristești'])
        . $f('street', 'Strada și numărul') . $f('city', 'Localitatea') . $f('county', 'Județul') . $f('postal_code', 'Codul poștal', ['optional' => true])
        . $f('phone', 'Telefonul', ['type' => 'tel']) . $f('email', 'E-mailul clinicii', ['type' => 'email', 'optional' => true, 'hint' => 'Primește cererile pentru această clinică.'])
        . '</div><div class="mt-5 grid gap-4">'
        . text_area("loc[{$id}][hours_text]", 'Programul', ['id' => "field-loc_{$id}_hours_text", 'value' => (string) $l['hours_text'], 'rows' => 3, 'optional' => true, 'hint' => 'Câte un rând, de exemplu: Luni–Vineri: 09:00–19:00'])
        . checkbox_field("loc[{$id}][publish_hours]", 'Programul apare pe site', ['id' => "field-loc_{$id}_publish_hours", 'checked' => (int) $l['publish_hours'] === 1, 'description' => 'Bifați după ce ați verificat orele.'])
        . '</div></section>';
}

$body = admin_header('Setări', 'Datele firmei, unde ajung cererile și datele clinicilor. Se văd pe site imediat după salvare.')
    . '<form method="post" novalidate class="flex max-w-4xl flex-col gap-8">' . csrf_field() . error_summary($errors)
    . admin_section_open('Datele firmei', 'firma', 'Apar în Termeni și condiții și în Politica de confidențialitate. Cât timp lipsesc, acolo scrie „[de completat]”.')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">' . $companyFields . '</div></section>'
    . admin_section_open('Cererile de pe site', 'cereri-setari')
    . '<div class="mt-4 grid gap-5 md:grid-cols-2">'
    . text_field('notify_email', 'E-mailul care primește cererile', ['type' => 'email', 'value' => $notify, 'required' => true, 'error' => $err('notify_email'), 'hint' => 'Folosit când clinica nu are e-mailul ei sau mesajul nu e pentru o clinică.'])
    . text_field('lead_retention_days', 'Câte zile păstrăm cererile închise', ['type' => 'number', 'value' => $retention, 'min' => 30, 'max' => 3650, 'error' => $err('lead_retention_days'), 'hint' => 'Apoi se șterg singure (GDPR). Recomandat: 365.'])
    . '</div></section>'
    . $clinicSections
    . '<div class="sticky bottom-0 -mx-4 border-t border-linie bg-fundal/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-panou md:border"><button type="submit" class="' . e(btn('primary', 'l')) . '">Salvați setările</button></div>'
    . '</form>';
admin_page('Setări', $body, $user);
