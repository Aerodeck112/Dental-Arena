<?php
/**
 * /admin/facturi/{id}/tipar: the invoice on A4, for printing or saving as PDF.
 */
declare(strict_types=1);

$inv = db_one('SELECT * FROM invoices WHERE id = ?', [(int) $param]);
if ($inv === null || !can_see_invoice($inv, $user)) {
    admin_not_found($user);
}
$id = (int) $inv['id'];
$number = doc_number($inv['series'], (int) $inv['number']);
$items = db_all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order, id', [$id]);
$clinic = db_one('SELECT * FROM locations WHERE id = ?', [(int) $inv['location_id']]);
$cfg = invoicing();
audit('factura-tiparita', $number, null, (int) $inv['patient_id']);

$td = 'border-b border-linie px-2 py-1.5 align-top';
$rows = '';
foreach ($items as $n => $it) {
    $rows .= '<tr><td class="' . $td . ' cifre">' . ($n + 1) . '</td>'
        . '<td class="' . $td . '">' . e($it['description']) . ($it['tooth'] ? ' (dinte ' . (int) $it['tooth'] . ')' : '') . '</td>'
        . '<td class="' . $td . ' text-center">buc.</td>'
        . '<td class="' . $td . ' cifre text-right">' . (int) $it['quantity'] . '</td>'
        . '<td class="' . $td . ' cifre text-right">' . e(amount_2d((int) $it['unit_price'])) . '</td>'
        . '<td class="' . $td . ' cifre text-right">' . ((int) $it['discount'] > 0 ? '−' . e(amount_2d((int) $it['discount'])) : '') . '</td>'
        . ((int) $inv['vat_total'] > 0 ? '<td class="' . $td . ' cifre text-right">' . (int) $it['vat_rate'] . '%</td>' : '')
        . '<td class="' . $td . ' cifre text-right">' . e(amount_2d((int) $it['total'])) . '</td></tr>';
}
$th = 'border-b-2 border-cerneala px-2 py-1.5 text-left text-mic font-semibold';
$buyer = '<p class="font-semibold">' . e($inv['buyer_name']) . '</p>'
    . ($inv['buyer_cui'] ? '<p>CUI ' . e($inv['buyer_cui']) . ($inv['buyer_reg_com'] ? ' · Reg. Com. ' . e($inv['buyer_reg_com']) : '') . '</p>' : '')
    . ($inv['buyer_address'] ? '<p>' . e($inv['buyer_address']) . '</p>' : '');

$body = ($inv['status'] === 'anulata' ? '<p class="mb-6 rounded-panou border-2 border-carmin p-3 text-center text-h3 font-semibold text-carmin">FACTURĂ ANULATĂ · ' . e((string) $inv['cancel_reason']) . '</p>' : '')
    . '<div class="flex flex-wrap items-start justify-between gap-6 border-b border-linie pb-6">'
    . '<div>' . logo('h-12 w-auto', true, '160px', 'Dental Arena') . '</div>'
    . '<div class="text-right"><h1 class="font-display text-[2rem] leading-none">Factură</h1>'
    . '<p class="mt-2">Seria <strong>' . e($inv['series']) . '</strong> nr. <strong class="cifre">' . e(str_pad((string) $inv['number'], 6, '0', STR_PAD_LEFT)) . '</strong></p>'
    . '<p>Data emiterii: <span class="cifre">' . e(date('d.m.Y', strtotime($inv['issued_at']))) . '</span></p>'
    . ($inv['due_date'] ? '<p>Scadența: <span class="cifre">' . e(date('d.m.Y', strtotime($inv['due_date']))) . '</span></p>' : '')
    . '</div></div>'
    . '<div class="grid gap-6 py-6 sm:grid-cols-2 print:grid-cols-2">'
    . '<div><p class="mb-1 text-mic font-semibold uppercase tracking-wide text-discret">Furnizor</p>' . seller_block($clinic) . '</div>'
    . '<div><p class="mb-1 text-mic font-semibold uppercase tracking-wide text-discret">Cumpărător</p>' . $buyer . '</div>'
    . '</div>'
    . '<div class="relative overflow-x-auto print:overflow-visible"><table class="w-full min-w-[34rem] border-collapse print:min-w-0"><thead><tr><th class="' . $th . '">Nr.</th><th class="' . $th . '">Denumirea serviciului</th><th class="' . $th . ' text-center">U.M.</th><th class="' . $th . ' text-right">Cant.</th><th class="' . $th . ' text-right">Preț unitar</th><th class="' . $th . ' text-right">Reducere</th>'
    . ((int) $inv['vat_total'] > 0 ? '<th class="' . $th . ' text-right">TVA</th>' : '') . '<th class="' . $th . ' text-right">Valoare (lei)</th></tr></thead><tbody>' . $rows . '</tbody></table></div>'
    . '<dl class="ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1">'
    . ((int) $inv['discount_total'] > 0 ? '<dt>Valoare</dt><dd class="cifre text-right">' . e(lei((int) $inv['subtotal'])) . '</dd><dt>Reduceri</dt><dd class="cifre text-right">−' . e(lei((int) $inv['discount_total'])) . '</dd>' : '')
    . ((int) $inv['vat_total'] > 0 ? '<dt>TVA</dt><dd class="cifre text-right">' . e(lei((int) $inv['vat_total'])) . '</dd>' : '')
    . '<dt class="border-t-2 border-cerneala pt-1 font-semibold">Total de plată</dt><dd class="cifre border-t-2 border-cerneala pt-1 text-right text-h3 font-semibold">' . e(lei((int) $inv['total'])) . '</dd>'
    . ($inv['status'] === 'emisa' && (int) $inv['amount_paid'] > 0 ? '<dt>Achitat</dt><dd class="cifre text-right">' . e(lei((int) $inv['amount_paid'])) . '</dd><dt>Rest de plată</dt><dd class="cifre text-right">' . e(lei(open_amount($inv))) . '</dd>' : '')
    . '</dl>'
    . '<div class="mt-8 space-y-1 text-mic">'
    . ((int) $inv['vat_total'] === 0 && trim($cfg['vatNote']) !== '' ? '<p>' . e($cfg['vatNote']) . '</p>' : '')
    . ($inv['notes'] ? '<p class="whitespace-pre-line">' . e($inv['notes']) . '</p>' : '')
    . '<p>Factura circulă fără semnătură și ștampilă, conform art. 319 alin. (29) din Codul fiscal.</p>'
    . '</div>';
print_page('Factura ' . $number, $body, "/admin/facturi/{$id}");
