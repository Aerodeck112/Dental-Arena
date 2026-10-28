<?php
/**
 * /admin/marketing/{noua|id} (administrators): a campaign: who gets it (segment), on which
 * channel, the text, how many recipients and SMS it means, a test to yourself, then send now or
 * at a set time. Once sent, a campaign shows its delivery numbers and cannot be sent again.
 */
declare(strict_types=1);

$isNew = $param === 'noua';
$c = $isNew ? null : db_one('SELECT * FROM campaigns WHERE id = ?', [(int) $param]);
if (!$isNew && $c === null) {
    admin_not_found($user);
}
$editable = $c === null || $c['status'] === 'ciorna';
$seg = $c ? (json_decode((string) $c['segment'], true) ?: []) : [];
$v = [
    'name' => $c['name'] ?? '',
    'channel' => $c['channel'] ?? 'sms',
    'subject' => $c['subject'] ?? '',
    'body' => $c['body'] ?? 'Dental Arena: {prenume}, ',
    'template' => $c['template'] ?? '',
    'clinica' => (string) ($seg['clinica'] ?? ''),
    'inactiv_luni' => (string) ($seg['inactiv_luni'] ?? ''),
    'plan_deschis' => !empty($seg['plan_deschis']) ? '1' : '',
    'luna_nasterii' => !empty($seg['luna_nasterii']) ? '1' : '',
    'serviciu' => (string) ($seg['serviciu'] ?? ''),
    'when' => $c && $c['scheduled_at'] ? date('Y-m-d\TH:i', strtotime($c['scheduled_at'])) : '',
];
$errors = [];

if (is_post() && $editable) {
    csrf_check();
    foreach (array_keys($v) as $k) {
        $v[$k] = post($k);
    }
    if (mb_strlen($v['name']) < 3) {
        $errors['name'] = 'Dați campaniei un nume, de exemplu „Igienizare toamnă 2026”.';
    }
    if (!isset(MSG_CHANNELS[$v['channel']])) {
        $errors['channel'] = 'Alegeți canalul.';
    }
    if (mb_strlen(trim($v['body'])) < 10) {
        $errors['body'] = 'Scrieți mesajul.';
    }
    if ($v['channel'] === 'email' && mb_strlen($v['subject']) < 3) {
        $errors['subject'] = 'Scrieți subiectul e-mailului.';
    }
    if ($v['channel'] === 'whatsapp' && !preg_match('/^[a-z0-9_]{2,80}$/', $v['template'])) {
        $errors['template'] = 'WhatsApp cere un șablon de marketing aprobat de Meta: scrieți-i numele (parametrul {{1}} = prenumele).';
    }
    $segment = array_filter([
        'clinica' => admin_int($v['clinica']),
        'inactiv_luni' => admin_int($v['inactiv_luni']),
        'plan_deschis' => $v['plan_deschis'] === '1',
        'luna_nasterii' => $v['luna_nasterii'] === '1',
        'serviciu' => in_array($v['serviciu'], service_slugs(), true) ? $v['serviciu'] : null,
    ]);
    $row = ['name' => mb_substr($v['name'], 0, 190), 'channel' => $v['channel'], 'subject' => $v['channel'] === 'email' ? mb_substr($v['subject'], 0, 190) : null, 'body' => mb_substr(str_replace("\r\n", "\n", trim($v['body'])), 0, 4000), 'template' => $v['channel'] === 'whatsapp' ? $v['template'] : null, 'segment' => json_encode($segment)];
    $op = post('op');
    if ($op === 'trimite' || $op === 'programeaza') {
        $when = $op === 'programeaza' ? $v['when'] : date('Y-m-d\TH:i');
        if ($op === 'programeaza' && (DateTimeImmutable::createFromFormat('Y-m-d\TH:i', $when) === false || strtotime($when) < time())) {
            $errors['when'] = 'Alegeți o zi și o oră din viitor.';
        }
    }
    if ($errors === []) {
        $id = $c ? (int) $c['id'] : db_insert('campaigns', $row + ['status' => 'ciorna', 'created_by' => $user['id'], 'created_at' => now_sql()]);
        if ($c) {
            db_update('campaigns', $row, 'id = :id', ['id' => $id]);
        }
        if ($op === 'test') {
            $me = db_one('SELECT * FROM users WHERE id = ?', [$user['id']]);
            $text = fill_template($row['body'], ['prenume' => explode(' ', $user['name'])[0]]);
            $to = match ($row['channel']) { 'sms' => phone_ro_mobile((string) $me['phone']), 'whatsapp' => phone_e164((string) $me['phone']), default => $me['email'] };
            if ($to === null) {
                flash('Scrieți-vă telefonul în „Contul meu” ca să primiți proba.', 'eroare');
            } else {
                queue_message(['channel' => $row['channel'], 'event' => 'campanie', 'user_id' => $user['id'], 'to_address' => $to, 'subject' => $row['subject'], 'body' => $text, 'template' => $row['template'], 'template_params' => $row['template'] ? json_encode([explode(' ', $user['name'])[0]]) : null]);
                flash(messaging_live() ? 'Proba pleacă acum către dumneavoastră.' : 'Proba a fost pusă în jurnal (mod de probă: nu pleacă).');
            }
        } elseif ($op === 'trimite' || $op === 'programeaza') {
            $fresh = db_one('SELECT * FROM campaigns WHERE id = ?', [$id]);
            $n = queue_campaign($fresh, str_replace('T', ' ', $when) . ':00');
            db_update('campaigns', ['status' => $op === 'trimite' ? 'trimisa' : 'programata', 'recipients' => $n, 'scheduled_at' => str_replace('T', ' ', $when) . ':00', 'sent_at' => $op === 'trimite' ? now_sql() : null], 'id = :id', ['id' => $id]);
            audit('campanie', "{$row['name']}: {$n} destinatari, " . MSG_CHANNELS[$row['channel']]);
            flash($op === 'trimite' ? "Campania pleacă acum către {$n} pacienți (ofertele pleacă între 10 și 20)." : "Campania este programată pentru {$n} pacienți.");
        } else {
            flash('Ciorna a fost salvată.');
        }
        redirect("/admin/marketing/{$id}");
    }
}

// Preview: who and how much.
$segNow = array_filter(['clinica' => admin_int($v['clinica']), 'inactiv_luni' => admin_int($v['inactiv_luni']), 'plan_deschis' => $v['plan_deschis'] === '1', 'luna_nasterii' => $v['luna_nasterii'] === '1', 'serviciu' => $v['serviciu'] ?: null]);
$recipients = isset(MSG_CHANNELS[$v['channel']]) ? campaign_recipients($segNow, $v['channel']) : [];
$sample = $recipients[0] ?? null;
$sampleText = fill_template($v['body'], ['prenume' => $sample['first_name'] ?? 'Maria']) . ($v['channel'] === 'sms' ? ' Dezabonare: ' . absolute_url('/d/xxxxxxxxxxxx') : '');
$m = messaging();
$parts = $v['channel'] === 'sms' ? sms_parts($m['sms_ascii'] ? strip_diacritics($sampleText) : $sampleText) : 0;

$names = admin_clinic_names();
$clinicOptions = ['' => 'Ambele clinici'];
foreach ($names as $lid => $n) {
    $clinicOptions[(string) $lid] = $n;
}
$serviceOptions = ['' => 'Oricare'];
foreach (site_services() as $s) {
    $serviceOptions[$s['slug']] = $s['title'];
}
$err = static fn (string $k): ?string => $errors[$k] ?? null;

$preview = '<div class="rounded-panou border-2 border-actiune bg-suprafata p-4 md:p-6" aria-live="polite">'
    . '<p class="text-mic text-discret">Destinatari acum</p><p class="font-display text-[2rem] leading-tight cifre">' . count($recipients) . '</p>'
    . '<p class="text-mic text-discret">pacienți cu acord pentru ' . e(MSG_CHANNELS[$v['channel']] ?? '') . ', care se potrivesc filtrelor.</p>'
    . ($v['channel'] === 'sms' ? '<p class="mt-3 text-corp">' . $parts . ($parts === 1 ? ' SMS' : ' SMS-uri') . ' de pacient · <strong class="cifre">' . ($parts * count($recipients)) . '</strong> în total</p>' : '')
    . '<p class="mt-4 text-mic font-semibold">Cum arată' . ($sample ? ' (pentru ' . e($sample['first_name']) . ')' : '') . ':</p>'
    . '<p class="mt-1 whitespace-pre-line rounded-control bg-fundal p-3 text-corp">' . e($v['channel'] === 'sms' && $m['sms_ascii'] ? strip_diacritics($sampleText) : $sampleText) . '</p>'
    . ($recipients !== [] ? '<details class="mt-3"><summary class="cursor-pointer text-mic text-link underline">Lista destinatarilor</summary><ul class="mt-2 max-h-64 overflow-auto text-mic">' . implode('', array_map(static fn ($r) => '<li>' . e(trim($r['last_name'] . ' ' . $r['first_name'])) . '</li>', array_slice($recipients, 0, 500))) . '</ul></details>' : '')
    . '</div>';

$stats = '';
if (!$editable) {
    $byStatus = db_all('SELECT status, COUNT(*) AS n FROM messages WHERE campaign_id = ? GROUP BY status', [$c['id']]);
    $stats = admin_section_open('Rezultate', 'rezultate') . '<ul class="mt-3 flex flex-wrap gap-3">' . implode('', array_map(static fn ($r) => '<li class="flex items-center gap-2">' . msg_status_chip($r['status']) . '<span class="cifre font-semibold">' . (int) $r['n'] . '</span></li>', $byStatus)) . '</ul>'
        . '<p class="mt-3 text-mic text-discret">Fiecare mesaj e și în <a class="text-link underline" href="/admin/mesaje">jurnalul mesajelor</a>.</p></section>';
}

$form = '<form method="post" novalidate class="flex flex-col gap-6">' . csrf_field() . error_summary($errors)
    . admin_section_open('Campania', 'campania')
    . '<div class="mt-4 flex flex-col gap-4">'
    . text_field('name', 'Numele (doar pentru dumneavoastră)', ['value' => $v['name'], 'error' => $err('name')])
    . radio_group('channel', 'Canalul', MSG_CHANNELS, ['inline' => true, 'value' => $v['channel'], 'error' => $err('channel')])
    . '</div></section>'
    . admin_section_open('Cui', 'cui', 'Doar pacienții activi care au acceptat oferte pe canalul ales.')
    . '<div class="mt-4 grid gap-4 md:grid-cols-2">'
    . select_field('clinica', 'Clinica', $clinicOptions, ['value' => $v['clinica']])
    . text_field('inactiv_luni', 'Fără vizită de cel puțin (luni)', ['value' => $v['inactiv_luni'], 'inputmode' => 'numeric', 'optional' => true, 'hint' => 'De exemplu 6: cei care n-au mai venit de 6 luni.'])
    . select_field('serviciu', 'Au făcut deja', $serviceOptions, ['value' => $v['serviciu']])
    . '<div class="flex flex-col justify-end">'
    . checkbox_field('plan_deschis', 'Au un plan de tratament neterminat', ['checked' => $v['plan_deschis'] === '1'])
    . checkbox_field('luna_nasterii', 'Își serbează ziua luna aceasta', ['checked' => $v['luna_nasterii'] === '1'])
    . '</div></div>'
    . '<p class="mt-3"><button type="submit" name="op" value="salveaza" class="' . e(btn('text', 's')) . '">Actualizați numărul de destinatari</button></p></section>'
    . admin_section_open('Mesajul', 'mesajul', '{prenume} se înlocuiește cu prenumele pacientului. La SMS și e-mail se adaugă singur linkul de dezabonare.')
    . '<div class="mt-4 flex flex-col gap-4">'
    . text_field('subject', 'Subiectul (pentru e-mail)', ['value' => $v['subject'], 'optional' => $v['channel'] !== 'email', 'error' => $err('subject')])
    . text_field('template', 'Șablonul WhatsApp de marketing (aprobat de Meta)', ['value' => $v['template'], 'optional' => $v['channel'] !== 'whatsapp', 'error' => $err('template'), 'hint' => 'Doar pentru WhatsApp. Textul de mai jos e doar pentru jurnal; pacientul primește textul șablonului.'])
    . text_area('body', 'Textul', ['value' => $v['body'], 'rows' => 5, 'error' => $err('body'), 'maxlength' => 4000])
    . '</div></section>'
    . ($editable ? '<div class="flex flex-wrap items-end gap-3 rounded-panou border border-linie bg-suprafata p-4">'
        . '<button type="submit" name="op" value="salveaza" class="' . e(btn('secondary')) . '">Salvați ciorna</button>'
        . '<button type="submit" name="op" value="test" class="' . e(btn('secondary')) . '">Trimiteți-mi o probă</button>'
        . '<span class="flex-1"></span>'
        . text_field('when', 'Sau programați la', ['type' => 'datetime-local', 'value' => $v['when'], 'optional' => true, 'error' => $err('when')])
        . '<button type="submit" name="op" value="programeaza" class="' . e(btn('secondary')) . '" data-confirma="Programați campania pentru ' . count($recipients) . ' pacienți?">Programați</button>'
        . '<button type="submit" name="op" value="trimite" class="' . e(btn('primary')) . '" data-confirma="Trimiteți acum campania către ' . count($recipients) . ' pacienți? Nu se poate opri după ce pleacă.">' . admin_icon('megaphone', 18) . 'Trimiteți acum</button>'
        . '</div>' : '')
    . '</form>';

$body = '<p class="mb-4"><a href="/admin/marketing" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Marketing</a></p>'
    . admin_header($c ? $c['name'] : 'Campanie nouă', $c ? (CAMPAIGN_STATUS[$c['status']] ?? '') . ($c['sent_at'] ? ' · trimisă ' . format_datetime($c['sent_at']) : '') : 'Alegeți cui, pe ce canal și ce scrieți. Vedeți în dreapta câți pacienți o primesc.')
    . (!messaging_live() ? '<p class="mb-6 rounded-panou border border-mustar bg-mustar-pal p-4 text-corp">Mod de probă: campania apare în jurnal, dar nu pleacă. Trimiterea reală se pornește din Setări → Mesaje.</p>' : '')
    . '<div class="grid gap-8 lg:grid-cols-12"><div class="min-w-0 lg:col-span-8">' . ($editable ? $form : $stats . '<div class="mt-8 rounded-panou border border-linie bg-suprafata p-4"><p class="text-mic text-discret">Textul trimis</p><p class="mt-1 whitespace-pre-line">' . e($c['body']) . '</p></div>') . '</div>'
    . '<div class="min-w-0 lg:col-span-4">' . ($editable ? $preview : '') . '</div></div>';
admin_page($c ? $c['name'] : 'Campanie nouă', $body, $user);
