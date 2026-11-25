<?php
/**
 * /admin/pacienti/{id}/gdpr (administrators): the patient's data rights: export everything as a
 * file, anonymise the file (with the file number typed as confirmation), and who opened or
 * changed the file.
 */
declare(strict_types=1);

$p = patient_or_404($param, $user);
$pid = (int) $p['id'];
$errors = [];

if (is_post()) {
    csrf_check();
    if (post('op') === 'export') {
        $data = patient_export($pid);
        audit('gdpr-export', 'fișa nr. ' . (int) $p['file_number'], null, $pid);
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="pacient-' . (int) $p['file_number'] . '-' . date('Y-m-d') . '.json"');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    if (post('op') === 'anonimizeaza') {
        if (post('confirmare') !== (string) (int) $p['file_number']) {
            $errors['confirmare'] = 'Tastați numărul fișei, ' . (int) $p['file_number'] . ', pentru confirmare.';
        } else {
            try {
                $n = anonymize_patient($pid, $user);
                flash('Fișa a fost anonimizată' . ($n > 0 ? "; {$n} documente au fost șterse" : '') . '.');
                redirect("/admin/pacienti/{$pid}/gdpr");
            } catch (DomainException $e) {
                $errors['confirmare'] = $e->getMessage();
            }
        }
    }
}

$trail = db_all('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.patient_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 300', [$pid]);
$rows = '';
foreach ($trail as $a) {
    $rows .= '<tr class="border-t border-linie"><td class="cifre whitespace-nowrap px-3 py-2">' . e(date('d.m.Y H:i', strtotime($a['created_at']))) . '</td><td class="px-3 py-2">' . e($a['user_name'] ?? '—') . '</td><td class="px-3 py-2">' . e(audit_label($a['action'])) . '</td><td class="px-3 py-2 text-discret">' . e((string) $a['detail']) . '</td></tr>';
}
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$requests = db_all('SELECT * FROM data_requests WHERE patient_id = ? ORDER BY received_on DESC', [$pid]);
$reqList = '';
foreach ($requests as $r) {
    $reqList .= '<li class="border-t border-linie py-2 first:border-t-0">' . e(DATA_REQUEST_TYPES[$r['type']] ?? $r['type']) . ' · ' . e(format_date($r['received_on'])) . ' · <strong>' . e(DATA_REQUEST_STATUS[$r['status']] ?? $r['status']) . '</strong></li>';
}

$anonymized = $p['anonymized_at'] !== null;
$body = patient_header($p, $user, 'gdpr')
    . '<div class="grid gap-8 lg:grid-cols-2">'
    . admin_section_open('Copia datelor (dreptul de acces)', 'export', 'Un fișier cu tot ce păstrează clinica despre pacient: datele personale (cu CNP), anamneza, programările, planurile, odontograma, facturile, plățile, acordurile și lista documentelor. Radiografiile și fotografiile le descărcați separat, din „Documente”.')
    . '<form method="post" class="mt-4">' . csrf_field() . '<input type="hidden" name="op" value="export"><button type="submit" class="' . e(btn('primary')) . '">' . icon('download', 18) . 'Descărcați datele (JSON)</button></form>'
    . '<p class="mt-3 text-mic text-discret">Fișierul conține date medicale: trimiteți-l doar pacientului, pe o cale sigură.</p></section>'
    . admin_section_open('Anonimizare (dreptul la ștergere)', 'anonimizare', 'Se șterg numele, CNP-ul, telefonul, e-mailul, adresa, observațiile administrative, cererile de pe site și documentele. Datele medicale și facturile rămân, cum cere legea, sub numele „Pacient anonimizat”. Nu se poate anula.')
    . ($anonymized ? '<p class="mt-4 text-corp">Fișa a fost anonimizată la ' . e(format_datetime($p['anonymized_at'])) . '.</p>'
        : '<form method="post" novalidate class="mt-4 flex flex-col gap-4" data-confirma="Anonimizați definitiv fișa? Nu se poate anula.">' . csrf_field() . '<input type="hidden" name="op" value="anonimizeaza">'
        . text_field('confirmare', 'Tastați numărul fișei (' . (int) $p['file_number'] . ')', ['inputmode' => 'numeric', 'autocomplete' => 'off', 'error' => $errors['confirmare'] ?? null])
        . '<div><button type="submit" class="' . e(btn('secondary')) . '">' . icon('user-x', 18) . 'Anonimizați fișa</button></div></form>')
    . '</section></div>'
    . ($reqList !== '' ? '<div class="mt-8">' . admin_section_open('Cereri GDPR ale pacientului', 'cereri') . '<ul class="mt-2">' . $reqList . '</ul><p class="mt-3"><a class="text-link underline" href="/admin/gdpr">Registrul cererilor</a></p></section></div>' : '')
    . '<div class="mt-8">' . admin_section_open('Cine a deschis sau a modificat fișa', 'jurnal', 'Ultimele 300 de acțiuni. O deschidere a fișei se notează o dată pe zi pentru fiecare utilizator.')
    . ($rows !== '' ? '<div class="mt-3 relative overflow-x-auto"><table class="w-full min-w-[40rem] border-collapse text-corp"><thead><tr><th scope="col" class="' . $th . '">Când</th><th scope="col" class="' . $th . '">Cine</th><th scope="col" class="' . $th . '">Ce</th><th scope="col" class="' . $th . '">Detalii</th></tr></thead><tbody>' . $rows . '</tbody></table></div>' : '<p class="mt-3 text-corp text-discret">Nimic încă.</p>')
    . '</section></div>';
admin_page('GDPR: ' . patient_name($p), $body, $user);
