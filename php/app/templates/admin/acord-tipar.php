<?php
/**
 * /admin/pacienti/{id}/acord/{tip}: a consent form on A4, filled with the patient's name, for
 * signing. The texts can be changed in Setări.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$type = (string) $param2;
if (!isset(CONSENT_TYPES[$type])) {
    admin_not_found($user);
}
$clinic = $p['preferred_location_id'] ? db_one('SELECT * FROM locations WHERE id = ?', [(int) $p['preferred_location_id']]) : db_one('SELECT * FROM locations ORDER BY sort_order LIMIT 1');
$company = setting('company');
$text = strtr(consent_text($type), [
    '{{pacient}}' => patient_name($p),
    '{{firma}}' => $company['legalName'] !== '' ? $company['legalName'] : 'Dental Arena',
    '{{clinica}}' => 'Dental Arena ' . ($clinic['short_name'] ?? ''),
    '{{email}}' => content('site.email'),
]);
$paras = '';
foreach (preg_split('/\n{2,}/', trim($text)) ?: [] as $para) {
    $paras .= '<p class="mt-4 whitespace-pre-line">' . e($para) . '</p>';
}
$guardian = $p['guardian_name'] ? '<p class="mt-4">Pentru minor / persoana reprezentată, semnează: <strong>' . e($p['guardian_name']) . '</strong>, în calitate de părinte / reprezentant legal.</p>' : '';
audit('acord-tiparit', CONSENT_TYPES[$type], null, (int) $p['id']);

$body = '<div class="flex flex-wrap items-start justify-between gap-6 border-b border-linie pb-6">'
    . '<div>' . logo('h-12 w-auto', true, '160px', 'Dental Arena') . '<div class="mt-3 text-mic">' . seller_block($clinic) . '</div></div>'
    . '<div class="text-right text-mic"><p>Fișa nr. <span class="cifre">' . (int) $p['file_number'] . '</span></p><p>Versiunea textului: ' . e(consent_version()) . '</p></div></div>'
    . '<h1 class="mt-6 font-display text-[1.6rem] leading-tight">' . e(CONSENT_TYPES[$type]) . '</h1>'
    . '<p class="mt-4">Pacient: <strong>' . e(patient_name($p)) . '</strong>' . ($p['birth_date'] ? ', născut(ă) la ' . e(date('d.m.Y', strtotime($p['birth_date']))) : '') . '</p>'
    . $paras . $guardian
    . '<div class="mt-14 grid grid-cols-2 gap-12"><p class="border-t border-cerneala pt-1 text-center text-mic">Data</p><p class="border-t border-cerneala pt-1 text-center text-mic">Semnătura pacientului / reprezentantului legal</p></div>'
    . ($type === 'tratament' || $type === 'inhalosedare' ? '<div class="mt-10 grid grid-cols-2 gap-12"><span></span><p class="border-t border-cerneala pt-1 text-center text-mic">Medicul (semnătura și parafa)</p></div>' : '');
print_page(CONSENT_TYPES[$type] . ': ' . patient_name($p), $body, '/admin/pacienti/' . (int) $p['id'] . '/documente');
