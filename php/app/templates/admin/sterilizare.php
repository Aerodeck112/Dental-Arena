<?php
/**
 * /admin/sterilizare: a new cycle of the autoclave (the day, the clinic, the autoclave, the program,
 * the pouches and their content) and its 62 mm labels; the latest cycles, with what was used from
 * each; the lists (autoclaves, programs, contents) and how long a pouch keeps.
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/sterilization.php';

$s = steril_settings();
$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($l) => isset($names[$l])));
$autoclaves = steril_lines((string) $s['autoclaves']) ?: ['Autoclav 1'];
$programs = steril_lines((string) $s['programs']) ?: [''];
$contents = steril_lines((string) $s['contents']);
$errors = [];
$today = date('Y-m-d');
$v = ['location' => (string) (current_clinic_id($user) ?? ($allowed[0] ?? '')), 'day' => $today, 'autoclave' => $autoclaves[0], 'program' => $programs[0], 'notes' => ''];

if (is_post()) {
    csrf_check();
    if (post('op') === 'setari' && is_admin($user)) {
        setting_save('sterilizare', [
            'autoclaves' => mb_substr(trim(post('autoclaves')), 0, 1000), 'programs' => mb_substr(trim(post('programs')), 0, 1000),
            'contents' => mb_substr(trim(post('contents')), 0, 3000), 'days' => (int) post('days'), 'label_height' => (int) post('label_height'),
        ]);
        flash('Setările sterilizării au fost salvate.');
        redirect('/admin/sterilizare#setari-steril');
    }
    if (post('op') === 'ciclu') {
        foreach (array_keys($v) as $k) {
            $v[$k] = post($k);
        }
        $loc = admin_int($v['location']);
        if ($loc === null || !in_array($loc, $allowed, true)) {
            $errors['location'] = 'Alegeți clinica.';
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v['day']) || $v['day'] > $today) {
            $errors['day'] = 'Alegeți ziua sterilizării (nu în viitor).';
        }
        // The pouches: a content and how many, on each line of the form.
        $packs = [];
        foreach ((array) ($_POST['plic'] ?? []) as $row) {
            $c = mb_substr(trim((string) ($row['continut'] ?? '')), 0, 120);
            $n = (int) ($row['nr'] ?? 0);
            if ($c !== '' && $n > 0) {
                $packs[$c] = min(50, ($packs[$c] ?? 0) + $n);
            }
        }
        if ($packs === []) {
            $errors['plic'] = 'Scrieți ce plicuri intră (conținutul și câte).';
        } elseif (array_sum($packs) > 100) {
            $errors['plic'] = 'Cel mult 100 de plicuri într-un ciclu.';
        }
        if ($errors === []) {
            $id = steril_new_cycle($loc, $v['day'], mb_substr(trim($v['autoclave']), 0, 80), mb_substr(trim($v['program']), 0, 80), $packs, (int) $user['id'], mb_substr(trim($v['notes']), 0, 255) ?: null);
            audit('sterilizare-ciclu', ($names[$loc] ?? '') . ', ' . array_sum($packs) . ' plicuri');
            flash('Ciclul a fost înregistrat, cu ' . count_ro(array_sum($packs), 'un plic', 'plicuri') . '. Tipăriți etichetele.');
            redirect("/admin/sterilizare/{$id}/etichete");
        }
    }
}

// ── A new cycle ──
$opt = static fn (array $list) => array_combine($list, $list);
$clinicOptions = [];
foreach ($allowed as $l) {
    $clinicOptions[(string) $l] = $names[$l];
}
$rows = '';
$posted = (array) ($_POST['plic'] ?? []);
for ($i = 0; $i < 6; $i++) {
    $c = (string) ($posted[$i]['continut'] ?? ($i === 0 ? ($contents[0] ?? '') : ''));
    $rows .= '<div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">'
        . '<input name="plic[' . $i . '][continut]" value="' . e($c) . '" list="continuturi" maxlength="120" aria-label="Conținutul plicului ' . ($i + 1) . '" placeholder="Conținutul (de exemplu Set extracție)" class="' . e(input_classes('h-control')) . '">'
        . '<input name="plic[' . $i . '][nr]" value="' . e((string) ($posted[$i]['nr'] ?? ($i === 0 ? '1' : ''))) . '" inputmode="numeric" aria-label="Câte plicuri" placeholder="Câte" class="' . e(input_classes('h-control')) . ' cifre"></div>';
}
$form = admin_section_open('Ciclu nou', 'ciclu-nou', 'După fiecare ciclu al autoclavului: ce plicuri au intrat. Se face câte o etichetă pe plic, de tipărit pe imprimanta de etichete (62 mm).')
    . '<form method="post" novalidate class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="ciclu">' . error_summary($errors)
    . '<div class="grid gap-4 sm:grid-cols-2">'
    . (count($clinicOptions) > 1 ? select_field('location', 'Clinica', $clinicOptions, ['value' => $v['location'], 'error' => $errors['location'] ?? null]) : '<input type="hidden" name="location" value="' . e($v['location']) . '">')
    . text_field('day', 'Ziua sterilizării', ['type' => 'date', 'value' => $v['day'], 'max' => $today, 'error' => $errors['day'] ?? null])
    . select_field('autoclave', 'Autoclavul', $opt($autoclaves), ['value' => $v['autoclave']])
    . select_field('program', 'Programul', $opt($programs), ['value' => $v['program']])
    . '</div>'
    . '<fieldset id="field-plic" tabindex="-1" class="flex flex-col gap-2"><legend class="mb-1 text-control font-medium">Plicurile</legend>'
    . '<datalist id="continuturi">' . implode('', array_map(static fn ($c) => '<option value="' . e($c) . '">', $contents)) . '</datalist>'
    . $rows . field_error('field-plic-error', $errors['plic'] ?? null) . '</fieldset>'
    . text_field('notes', 'Observații', ['value' => $v['notes'], 'optional' => true, 'maxlength' => 255, 'hint' => 'De exemplu indicatorul chimic: virat corect.'])
    . '<p class="text-mic text-discret">Expiră după ' . count_ro((int) $s['days'], 'o zi', 'zile') . ' (se schimbă mai jos). Operatorul: ' . e($user['name']) . '.</p>'
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . icon('printer', 18) . 'Înregistrați și tipăriți etichetele</button></div></form></section>';

// ── The latest cycles ──
$in = implode(',', array_map('intval', $allowed ?: [0]));
$cycles = db_all("SELECT c.*, u.name AS operator, (SELECT COUNT(*) FROM sterilization_packs k WHERE k.cycle_id = c.id) AS packs, (SELECT COUNT(*) FROM sterilization_packs k WHERE k.cycle_id = c.id AND k.patient_id IS NOT NULL) AS used
    FROM sterilization_cycles c LEFT JOIN users u ON u.id = c.operator_id WHERE c.location_id IN ({$in}) ORDER BY c.sterilized_on DESC, c.id DESC LIMIT 40");
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$list = '';
foreach ($cycles as $c) {
    $expired = $c['expires_on'] < $today;
    $list .= '<tr class="border-t border-linie align-top">'
        . '<td class="whitespace-nowrap px-3 py-2 cifre">' . e(format_date($c['sterilized_on'])) . '<span class="block text-mic text-discret">ciclul ' . (int) $c['cycle_no'] . '</span></td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . e($names[(int) $c['location_id']] ?? '') . '<span class="block text-mic text-discret">' . e(trim($c['autoclave'] . ' · ' . $c['program'], ' ·')) . '</span></td>'
        . '<td class="whitespace-nowrap px-3 py-2 cifre">' . (int) $c['used'] . ' / ' . (int) $c['packs'] . '</td>'
        . '<td class="' . e(cn('whitespace-nowrap px-3 py-2 cifre', $expired ? 'font-semibold text-carmin' : '')) . '">' . e(format_date($c['expires_on'])) . ($expired ? '<span class="block text-mic">expirat</span>' : '') . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . e((string) $c['operator']) . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2"><a href="/admin/sterilizare/' . (int) $c['id'] . '/etichete" class="' . e(btn('secondary', 's')) . '">' . icon('printer', 16) . 'Etichetele</a></td></tr>';
}
$table = $list !== '' ? '<div class="relative overflow-x-auto rounded-panou border border-linie bg-suprafata"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead class="bg-fundal"><tr>'
    . '<th scope="col" class="' . $th . '">Ziua</th><th scope="col" class="' . $th . '">Clinica, autoclavul</th><th scope="col" class="' . $th . '">Folosite / plicuri</th><th scope="col" class="' . $th . '">Expiră</th><th scope="col" class="' . $th . '">Operator</th><th scope="col" class="' . $th . '"></th></tr></thead><tbody>' . $list . '</tbody></table></div>'
    : '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Niciun ciclu încă.</p>';

$settingsBox = is_admin($user) ? '<details id="setari-steril" class="mt-8 rounded-panou border border-linie bg-suprafata p-4"><summary class="cursor-pointer font-semibold">Setări: autoclave, programe, conținuturi, valabilitate, eticheta</summary>'
    . '<form method="post" class="mt-4 grid gap-4 md:grid-cols-2">' . csrf_field() . '<input type="hidden" name="op" value="setari">'
    . text_area('autoclaves', 'Autoclavele (câte unul pe rând)', ['value' => (string) $s['autoclaves'], 'rows' => 3])
    . text_area('programs', 'Programele (câte unul pe rând)', ['value' => (string) $s['programs'], 'rows' => 3])
    . text_area('contents', 'Conținuturile obișnuite ale plicurilor (câte unul pe rând)', ['value' => (string) $s['contents'], 'rows' => 6, 'class' => 'md:col-span-2'])
    . text_field('days', 'Valabilitatea plicului (zile)', ['type' => 'number', 'value' => (string) $s['days'], 'min' => 1, 'max' => 730, 'hint' => 'De obicei 180 de zile pentru plicurile sigilate, după procedura clinicii.'])
    . select_field('label_height', 'Înălțimea etichetei', ['29' => '62 × 29 mm', '40' => '62 × 40 mm', '50' => '62 × 50 mm', '62' => '62 × 62 mm'], ['value' => (string) $s['label_height'], 'hint' => 'Pe rola continuă de 62 mm se tipărește cât alegeți aici.'])
    . '<div class="md:col-span-2"><button type="submit" class="' . e(btn('secondary')) . '">Salvați</button></div></form></details>' : '';

$body = admin_header('Sterilizare', 'Ciclurile autoclavului și etichetele plicurilor (62 mm). Plicul deschis la un pacient se trece în fișa lui, la Sterilizare, cu codul de pe etichetă.')
    . '<div class="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"><div>' . $form . '</div><div class="min-w-0"><h2 class="mb-3 text-h3 font-semibold">Ciclurile</h2>' . $table . $settingsBox . '</div></div>';
admin_page('Sterilizare', $body, $user);
