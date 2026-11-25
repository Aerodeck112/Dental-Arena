<?php
/**
 * /admin/marketing (administrators): the campaigns (SMS, WhatsApp, e-mail) with how many went
 * out, were delivered or failed, and how many patients agreed to receive offers.
 */
declare(strict_types=1);

$campaigns = db_all("SELECT c.*,
    (SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status IN ('trimis', 'livrat', 'citit', 'proba')) AS sent,
    (SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status = 'esuat') AS failed,
    (SELECT COUNT(*) FROM messages m WHERE m.campaign_id = c.id AND m.status = 'in-asteptare') AS waiting
    FROM campaigns c ORDER BY c.created_at DESC LIMIT 100");
$consent = db_one("SELECT SUM(marketing_sms) AS sms, SUM(marketing_whatsapp) AS wa, SUM(marketing_email) AS em, COUNT(*) AS total FROM patients WHERE active = 1 AND anonymized_at IS NULL");
$tile = static fn (string $label, string $value) => '<div class="rounded-panou border border-linie bg-suprafata p-4"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[1.6rem] leading-tight cifre">' . e($value) . '</p></div>';
$tiles = '<div class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">'
    . $tile('Pacienți activi', (string) (int) $consent['total'])
    . $tile('Acceptă oferte prin SMS', (string) (int) $consent['sms'])
    . $tile('Prin WhatsApp', (string) (int) $consent['wa'])
    . $tile('Prin e-mail', (string) (int) $consent['em']) . '</div>';
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$rows = '';
foreach ($campaigns as $c) {
    $rows .= '<tr class="border-t border-linie"><td class="px-3 py-2"><a class="font-semibold text-link underline-offset-4 hover:underline" href="/admin/marketing/' . (int) $c['id'] . '">' . e($c['name']) . '</a></td>'
        . '<td class="px-3 py-2">' . e(MSG_CHANNELS[$c['channel']] ?? $c['channel']) . '</td>'
        . '<td class="px-3 py-2">' . e(CAMPAIGN_STATUS[$c['status']] ?? $c['status']) . ($c['scheduled_at'] && $c['status'] === 'programata' ? '<span class="block text-mic text-discret">' . e(format_datetime($c['scheduled_at'])) . '</span>' : '') . '</td>'
        . '<td class="cifre px-3 py-2 text-right">' . (int) $c['recipients'] . '</td><td class="cifre px-3 py-2 text-right">' . (int) $c['sent'] . '</td><td class="cifre px-3 py-2 text-right">' . (int) $c['waiting'] . '</td><td class="cifre px-3 py-2 text-right">' . (int) $c['failed'] . '</td></tr>';
}
$body = admin_header('Marketing', 'Campanii prin SMS, WhatsApp și e-mail, doar către pacienții care și-au dat acordul. Fiecare mesaj are link de dezabonare.', '<a href="/admin/marketing/noua" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Campanie nouă</a>')
    . $tiles
    . admin_section_open('Campanii', 'campanii')
    . ($rows !== '' ? '<div class="relative mt-3 overflow-x-auto"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead><tr><th scope="col" class="' . $th . '">Campania</th><th scope="col" class="' . $th . '">Canal</th><th scope="col" class="' . $th . '">Stare</th><th scope="col" class="' . $th . ' text-right">Destinatari</th><th scope="col" class="' . $th . ' text-right">Trimise</th><th scope="col" class="' . $th . ' text-right">În așteptare</th><th scope="col" class="' . $th . ' text-right">Eșuate</th></tr></thead><tbody>' . $rows . '</tbody></table></div>'
        : '<p class="mt-3 text-corp text-discret">Nicio campanie încă. Acordul pentru oferte se bifează în fișa pacientului sau vine din formularul de pe site.</p>')
    . '</section>';
admin_page('Marketing', $body, $user);
