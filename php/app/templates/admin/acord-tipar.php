<?php
/**
 * /admin/pacienti/{id}/acord/{tip}: a consent form on A4, filled with the patient's name, for
 * signing. The texts can be changed in Setări.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$type = (string) $param2;
// A retired consent (inhalosedare) can still be seen as it was signed, not printed again.
$label = CONSENT_TYPES[$type] ?? (query('semnat') !== '' ? (CONSENT_RETIRED[$type] ?? null) : null);
if ($label === null) {
    admin_not_found($user);
}
// ?semnat={id}: the consent as it was signed on the tablet (the text of that moment, the
// signature, and whether the fingerprint still matches).
if (query('semnat') !== '') {
    $c = db_one('SELECT c.*, s.device_id, k.name AS tablet FROM consents c LEFT JOIN consent_sessions s ON s.id = c.session_id LEFT JOIN kiosk_devices k ON k.id = s.device_id WHERE c.id = ? AND c.patient_id = ? AND c.type = ? AND c.text_snapshot IS NOT NULL', [(int) query('semnat'), (int) $p['id'], $type]);
    if ($c === null) {
        admin_not_found($user);
    }
    $doc = $c['document_id'] ? db_one('SELECT * FROM patient_documents WHERE id = ?', [(int) $c['document_id']]) : null;
    $raw = $doc ? @file_get_contents(documents_dir() . '/' . basename($doc['stored_name'])) : false;
    $intact = $raw !== false && hash_equals((string) $c['integrity_hash'], hash('sha256', implode('|', [$p['id'], $type, $c['text_snapshot'], hash('sha256', $raw), $c['signed_at'], $c['device_id']])));
    $paras = '';
    foreach (preg_split('/\n{2,}/', trim($c['text_snapshot'])) ?: [] as $para) {
        $paras .= '<p class="mt-4 whitespace-pre-line">' . e($para) . '</p>';
    }
    audit('acord-semnat-vazut', $label, null, (int) $p['id']);
    $body = '<div class="flex flex-wrap items-start justify-between gap-6 border-b border-linie pb-6">'
        . '<div>' . logo('h-12 w-auto', true, '160px', 'Dental Arena') . '</div>'
        . '<div class="text-right text-mic"><p>Fișa nr. <span class="cifre">' . (int) $p['file_number'] . '</span></p><p>Versiunea textului: ' . e((string) $c['text_version']) . '</p></div></div>'
        . '<h1 class="mt-6 font-display text-[1.6rem] leading-tight">' . e($label) . '</h1>'
        . '<p class="mt-4">Pacient: <strong>' . e(patient_name($p)) . '</strong></p>' . $paras
        . '<div class="mt-10 grid gap-6 sm:grid-cols-2 sm:items-end"><div class="text-mic"><p>Semnat electronic pe tabletă' . ($c['tablet'] ? ' („' . e($c['tablet']) . '”)' : '') . '</p><p class="font-semibold cifre">' . e(format_datetime((string) $c['signed_at'])) . '</p>'
        . ($c['withdrawn_at'] ? '<p class="mt-2 font-semibold text-carmin">Retras ' . e(format_date($c['withdrawn_at'])) . '</p>' : '') . '</div>'
        . '<div class="text-center">' . ($doc ? '<img src="/admin/documente/' . (int) $doc['id'] . '" alt="Semnătura pacientului" class="mx-auto max-h-36 w-auto">' : '') . '<p class="border-t border-cerneala pt-1 text-mic">Semnătura pacientului</p></div></div>'
        . '<div class="mt-10 rounded-control border border-linie p-3 text-[12px] leading-snug text-discret"><p>Amprenta SHA-256 (textul, semnătura, ora, tableta): <span class="break-all font-mono">' . e((string) $c['integrity_hash']) . '</span></p>'
        . '<p class="mt-1 font-semibold ' . ($intact ? 'text-actiune' : 'text-carmin') . '">' . ($intact ? 'Verificată acum: textul și semnătura sunt cele semnate.' : 'Atenție: amprenta nu se mai potrivește cu fișierul semnăturii.') . '</p></div>';
    print_page($label . ' (semnat): ' . patient_name($p), $body, '/admin/pacienti/' . (int) $p['id'] . '/documente');
    exit;
}

// The clinic where it is signed: chosen in the address, else the clinic the user works at now, else the patient's.
$clinicId = admin_int(query('clinica')) ?? current_clinic_id($user) ?? ($p['preferred_location_id'] ? (int) $p['preferred_location_id'] : null);
$clinic = ($clinicId ? db_one('SELECT * FROM locations WHERE id = ?', [$clinicId]) : null) ?? db_one('SELECT * FROM locations ORDER BY sort_order LIMIT 1');
$text = consent_text_for($type, $p, (int) $clinic['id']);
$paras = '';
foreach (preg_split('/\n{2,}/', trim($text)) ?: [] as $para) {
    $paras .= '<p class="mt-4 whitespace-pre-line">' . e($para) . '</p>';
}
$guardian = $p['guardian_name'] ? '<p class="mt-4">Pentru minor / persoana reprezentată, semnează: <strong>' . e($p['guardian_name']) . '</strong>, în calitate de părinte / reprezentant legal.</p>' : '';
audit('acord-tiparit', $label, null, (int) $p['id']);

$body = '<div class="flex flex-wrap items-start justify-between gap-6 border-b border-linie pb-6">'
    . '<div>' . logo('h-12 w-auto', true, '160px', 'Dental Arena') . '<div class="mt-3 text-mic">' . seller_block($clinic) . '</div></div>'
    . '<div class="text-right text-mic"><p>Fișa nr. <span class="cifre">' . (int) $p['file_number'] . '</span></p><p>Versiunea textului: ' . e(consent_version()) . '</p></div></div>'
    . '<h1 class="mt-6 font-display text-[1.6rem] leading-tight">' . e($label) . '</h1>'
    . '<p class="mt-4">Pacient: <strong>' . e(patient_name($p)) . '</strong>' . ($p['birth_date'] ? ', născut(ă) la ' . e(date('d.m.Y', strtotime($p['birth_date']))) : '') . '</p>'
    . $paras . $guardian
    . '<div class="mt-14 grid grid-cols-2 gap-12"><p class="border-t border-cerneala pt-1 text-center text-mic">Data</p><p class="border-t border-cerneala pt-1 text-center text-mic">Semnătura pacientului / reprezentantului legal</p></div>'
    . ($type === 'tratament' ? '<div class="mt-10 grid grid-cols-2 gap-12"><span></span><p class="border-t border-cerneala pt-1 text-center text-mic">Medicul (semnătura și parafa)</p></div>' : '');
print_page($label . ': ' . patient_name($p), $body, '/admin/pacienti/' . (int) $p['id'] . '/documente');
