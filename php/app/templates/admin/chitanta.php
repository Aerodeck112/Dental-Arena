<?php
/**
 * /admin/incasari/{id}/chitanta: the cash receipt on A4 (two copies: the clinic's and the patient's).
 */
declare(strict_types=1);

$pay = db_one('SELECT y.*, p.first_name, p.last_name, p.street, p.city, p.county, v.series AS inv_series, v.number AS inv_number, v.buyer_name, v.buyer_address
    FROM payments y JOIN patients p ON p.id = y.patient_id LEFT JOIN invoices v ON v.id = y.invoice_id WHERE y.id = ?', [(int) $param]);
if ($pay === null || $pay['receipt_number'] === null || !can_see_invoice($pay, $user)) {
    admin_not_found($user);
}
$clinic = db_one('SELECT * FROM locations WHERE id = ?', [(int) $pay['location_id']]);
$number = doc_number($pay['receipt_series'], (int) $pay['receipt_number']);
$from = $pay['buyer_name'] ?: patient_name($pay);
$address = $pay['buyer_address'] ?: implode(', ', array_filter([$pay['street'], $pay['city'], $pay['county'] ? 'jud. ' . $pay['county'] : null]));
$for = $pay['invoice_id'] !== null ? 'contravaloarea facturii ' . doc_number($pay['inv_series'], (int) $pay['inv_number']) : 'avans pentru servicii stomatologice';
audit('chitanta-tiparita', $number, null, (int) $pay['patient_id']);

$copy = static function (string $which) use ($pay, $clinic, $number, $from, $address, $for): string {
    return '<section class="break-inside-avoid border-b border-dashed border-linie-control py-8 first:pt-0 last:border-b-0">'
        . '<div class="flex flex-wrap items-start justify-between gap-6"><div class="text-mic">' . seller_block($clinic) . '</div>'
        . '<div class="text-right"><h1 class="font-display text-[1.75rem] leading-none">Chitanță</h1>'
        . '<p class="mt-2">Seria <strong>' . e($pay['receipt_series']) . '</strong> nr. <strong class="cifre">' . e(str_pad((string) $pay['receipt_number'], 6, '0', STR_PAD_LEFT)) . '</strong></p>'
        . '<p>Data: <span class="cifre">' . e(date('d.m.Y', strtotime($pay['paid_at']))) . '</span></p><p class="text-mic text-discret">' . e($which) . '</p></div></div>'
        . ($pay['cancelled_at'] !== null ? '<p class="mt-4 font-semibold text-carmin">ANULATĂ: ' . e((string) $pay['cancel_reason']) . '</p>' : '')
        . '<p class="mt-6 leading-loose">Am primit de la <strong>' . e($from) . '</strong>' . ($address !== '' ? ', ' . e($address) : '')
        . ', suma de <strong class="cifre">' . e(lei((int) $pay['amount'])) . '</strong>, adică <em>' . e(lei_in_words((int) $pay['amount'])) . '</em>, reprezentând ' . e($for) . '.</p>'
        . '<div class="mt-8 flex justify-end"><p class="w-56 border-t border-cerneala pt-1 text-center text-mic">Casier (semnătura)</p></div>'
        . '</section>';
};
print_page('Chitanța ' . $number, $copy('Exemplarul clinicii') . $copy('Exemplarul pacientului'), $pay['invoice_id'] !== null ? '/admin/facturi/' . (int) $pay['invoice_id'] : '/admin/pacienti/' . (int) $pay['patient_id'] . '/financiar');
