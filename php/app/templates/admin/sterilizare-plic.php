<?php
/**
 * /admin/sterilizare/plic/{code}: where the label's QR leads (scanned with the phone): the pouch,
 * its cycle, whether it is still good, and the patient it was used for; or the patient's file
 * number to note it now.
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/sterilization.php';

$code = steril_code_from((string) $param) ?? '';
$k = $code !== '' ? steril_pack($code) : null;
if ($k === null || !in_array((int) $k['location_id'], allowed_location_ids($user), true)) {
    admin_not_found($user);
}
$error = null;
if (is_post() && $k['patient_id'] === null) {
    csrf_check();
    $fn = admin_int(post('fisa'));
    $pid = $fn !== null ? db_value('SELECT id FROM patients WHERE file_number = ?', [$fn]) : null;
    $patient = $pid ? find_patient((int) $pid, $user) : null;
    if ($patient === null) {
        $error = 'Nu găsesc pacientul cu fișa nr. ' . e(post('fisa')) . '.';
    } else {
        [$ok, $msg] = steril_use($code, $patient, $user);
        if ($ok) {
            flash($msg);
            redirect('/admin/pacienti/' . (int) $patient['id'] . '/sterilizare#plicuri');
        }
        $error = $msg;
    }
}
$expired = $k['expires_on'] < date('Y-m-d');
$patient = $k['patient_id'] !== null ? find_patient((int) $k['patient_id'], $user) : null;
$row = static fn (string $l, string $v) => '<div class="flex justify-between gap-4 border-t border-linie py-2 first:border-t-0"><dt class="text-discret">' . e($l) . '</dt><dd class="text-right font-medium">' . $v . '</dd></div>';
$state = $k['patient_id'] !== null
    ? '<p class="rounded-panou bg-adancit p-3 text-corp">Folosit pe ' . e(format_datetime((string) $k['used_at'])) . ($patient ? ', la <a class="font-semibold text-link underline" href="/admin/pacienti/' . (int) $patient['id'] . '/sterilizare#plicuri">' . e(patient_name($patient)) . '</a>' : '') . '.</p>'
    : ($expired ? '<p class="rounded-panou border-2 border-carmin bg-carmin-pal p-3 text-corp font-semibold">Expirat pe ' . e(format_date($k['expires_on'])) . ': nu se folosește, se resterilizează.</p>'
        : '<p class="rounded-panou bg-menta-pal p-3 text-corp font-semibold">Steril, bun de folosit până pe ' . e(format_date($k['expires_on'])) . '.</p>'
        . '<form method="post" novalidate class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">' . csrf_field()
        . text_field('fisa', 'Folosit la pacientul cu fișa nr.', ['inputmode' => 'numeric', 'value' => post('fisa'), 'error' => $error, 'class' => 'min-w-0 sm:flex-1'])
        . '<button type="submit" class="' . e(btn('primary')) . '">Treceți la pacient</button></form>');
$body = '<p class="mb-4"><a href="/admin/sterilizare" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Sterilizare</a></p>'
    . admin_header($k['content'], 'Plicul ' . $code)
    . '<div class="max-w-xl">' . $state
    . '<dl class="mt-6 rounded-panou border border-linie bg-suprafata px-4 py-2 text-corp">'
    . $row('Sterilizat', e(format_date($k['sterilized_on'])))
    . $row('Expiră', e(format_date($k['expires_on'])))
    . $row('Ciclul', (string) (int) $k['cycle_no'] . ($k['autoclave'] !== '' ? ' · ' . e($k['autoclave']) : ''))
    . ($k['program'] !== '' ? $row('Programul', e($k['program'])) : '')
    . ($k['operator'] ? $row('Operator', e($k['operator'])) : '')
    . '</dl>'
    . '<p class="mt-4"><a class="text-link underline" href="/admin/sterilizare/' . (int) $k['cycle_id'] . '/etichete?plic=' . (int) $k['pack_no'] . '">Tipăriți din nou eticheta</a></p></div>';
admin_page('Plicul ' . $code, $body, $user);
