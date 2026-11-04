<?php
/**
 * /admin/gdpr (administrators): the register of data-protection requests (access, erasure, …),
 * with the 30-day deadline, and what the clinic did about each.
 */
declare(strict_types=1);

$errors = [];
$v = ['requester' => '', 'contact' => '', 'type' => 'acces', 'received_on' => date('Y-m-d'), 'file_number' => '', 'notes' => ''];

if (is_post()) {
    csrf_check();
    if (post('op') === 'nou') {
        foreach (array_keys($v) as $k) {
            $v[$k] = post($k);
        }
        if (mb_strlen($v['requester']) < 3) {
            $errors['requester'] = 'Scrieți cine a făcut cererea.';
        }
        if (!isset(DATA_REQUEST_TYPES[$v['type']])) {
            $errors['type'] = 'Alegeți tipul cererii.';
        }
        if (DateTimeImmutable::createFromFormat('!Y-m-d', $v['received_on']) === false || $v['received_on'] > date('Y-m-d')) {
            $errors['received_on'] = 'Data primirii este azi sau în trecut.';
        }
        $patientId = null;
        if ($v['file_number'] !== '') {
            $patientId = db_value('SELECT id FROM patients WHERE file_number = ?', [(int) $v['file_number']]);
            if ($patientId === null) {
                $errors['file_number'] = 'Nu există o fișă cu acest număr.';
            }
        }
        if ($errors === []) {
            db_insert('data_requests', [
                'patient_id' => $patientId !== null ? (int) $patientId : null, 'requester' => mb_substr($v['requester'], 0, 190), 'contact' => mb_substr($v['contact'], 0, 190) ?: null,
                'type' => $v['type'], 'received_on' => $v['received_on'], 'due_on' => date('Y-m-d', strtotime($v['received_on'] . ' +' . DATA_REQUEST_DAYS . ' days')),
                'status' => 'primita', 'notes' => mb_substr($v['notes'], 0, 4000) ?: null, 'created_by' => $user['id'], 'created_at' => now_sql(), 'updated_at' => now_sql(),
            ]);
            audit('cerere-gdpr', DATA_REQUEST_TYPES[$v['type']] . ': ' . $v['requester'], null, $patientId !== null ? (int) $patientId : null);
            flash('Cererea a fost trecută în registru. Termenul de răspuns: ' . format_date(date('Y-m-d', strtotime($v['received_on'] . ' +' . DATA_REQUEST_DAYS . ' days'))) . '.');
            redirect('/admin/gdpr');
        }
    }
    if (post('op') === 'actualizeaza') {
        $r = db_one('SELECT * FROM data_requests WHERE id = ?', [(int) post('id')]);
        $status = post('status');
        if ($r && isset(DATA_REQUEST_STATUS[$status])) {
            $note = trim(post('nota'));
            db_update('data_requests', [
                'status' => $status,
                'notes' => $note !== '' ? trim(($r['notes'] ? $r['notes'] . "\n" : '') . date('d.m.Y') . ': ' . mb_substr($note, 0, 1000)) : $r['notes'],
                'resolved_at' => in_array($status, ['rezolvata', 'respinsa'], true) ? ($r['resolved_at'] ?? now_sql()) : null,
                'updated_at' => now_sql(),
            ], 'id = :id', ['id' => $r['id']]);
            audit('cerere-gdpr', DATA_REQUEST_TYPES[$r['type']] . ': ' . DATA_REQUEST_STATUS[$status], null, $r['patient_id'] !== null ? (int) $r['patient_id'] : null);
            flash('Cererea a fost actualizată.');
        }
        redirect('/admin/gdpr');
    }
}

$open = db_all("SELECT r.*, p.first_name, p.last_name, p.file_number FROM data_requests r LEFT JOIN patients p ON p.id = r.patient_id WHERE r.status IN ('primita', 'in-lucru') ORDER BY r.due_on");
$closed = db_all("SELECT r.*, p.first_name, p.last_name, p.file_number FROM data_requests r LEFT JOIN patients p ON p.id = r.patient_id WHERE r.status NOT IN ('primita', 'in-lucru') ORDER BY r.resolved_at DESC LIMIT 100");
$card = static function (array $r, bool $isOpen): string {
    $days = (int) floor((strtotime($r['due_on']) - strtotime(date('Y-m-d'))) / 86400);
    $due = $isOpen ? ($days < 0 ? '<span class="font-semibold text-carmin">Termen depășit cu ' . abs($days) . ' zile</span>' : '<span class="' . ($days <= 7 ? 'font-semibold text-mustar-text' : 'text-discret') . '">Termen: ' . e(format_date($r['due_on'])) . " (încă {$days} zile)</span>") : '<span class="text-discret">Închisă ' . e(format_date((string) $r['resolved_at'])) . '</span>';
    return '<li class="border-t border-linie py-4 first:border-t-0"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0">'
        . '<p class="font-semibold">' . e(DATA_REQUEST_TYPES[$r['type']] ?? $r['type']) . ' · ' . e($r['requester']) . '</p>'
        . '<p class="text-mic">' . e(implode(' · ', array_filter(['Primită ' . format_date($r['received_on']), (string) $r['contact']]))) . ($r['patient_id'] ? ' · <a class="text-link underline" href="/admin/pacienti/' . (int) $r['patient_id'] . '/gdpr">' . e(patient_name($r)) . ', fișa ' . (int) $r['file_number'] . '</a>' : '') . '</p>'
        . '<p class="text-mic">' . $due . '</p>'
        . ($r['notes'] ? '<p class="mt-2 whitespace-pre-line text-mic text-discret">' . e($r['notes']) . '</p>' : '') . '</div>'
        . '<form method="post" class="flex flex-wrap items-end gap-2">' . csrf_field() . '<input type="hidden" name="op" value="actualizeaza"><input type="hidden" name="id" value="' . (int) $r['id'] . '">'
        . select_field('status', 'Starea', DATA_REQUEST_STATUS, ['id' => 'stare-' . (int) $r['id'], 'value' => $r['status']])
        . text_field('nota', 'Ce s-a făcut', ['id' => 'nota-' . (int) $r['id'], 'optional' => true])
        . '<button type="submit" class="' . e(btn('secondary')) . '">Salvați</button></form></div></li>';
};
$openList = implode('', array_map(static fn ($r) => $card($r, true), $open));
$closedList = implode('', array_map(static fn ($r) => $card($r, false), $closed));
$err = static fn (string $k): ?string => $errors[$k] ?? null;
$form = '<form method="post" novalidate class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="nou">' . error_summary($errors)
    . '<div class="grid gap-4 md:grid-cols-2">'
    . text_field('requester', 'Cine a cerut', ['value' => $v['requester'], 'required' => true, 'error' => $err('requester')])
    . text_field('contact', 'Telefon sau e-mail', ['value' => $v['contact'], 'optional' => true])
    . select_field('type', 'Ce cere', DATA_REQUEST_TYPES, ['value' => $v['type'], 'error' => $err('type')])
    . text_field('received_on', 'Primită la', ['type' => 'date', 'value' => $v['received_on'], 'max' => date('Y-m-d'), 'error' => $err('received_on')])
    . text_field('file_number', 'Nr. fișei pacientului', ['value' => $v['file_number'], 'inputmode' => 'numeric', 'optional' => true, 'error' => $err('file_number')])
    . '</div>'
    . text_area('notes', 'Detalii', ['value' => $v['notes'], 'rows' => 2, 'optional' => true])
    . '<div><button type="submit" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Treceți în registru</button></div></form>';

$body = admin_header('Cereri GDPR', 'Registrul cererilor privind datele personale. Legea dă ' . DATA_REQUEST_DAYS . ' de zile pentru răspuns. Exportul și anonimizarea se fac din fișa pacientului, fila GDPR.')
    . '<div class="grid gap-8 lg:grid-cols-12"><div class="flex min-w-0 flex-col gap-8 lg:col-span-8">'
    . admin_section_open('În lucru', 'deschise') . ($openList !== '' ? '<ul class="mt-2">' . $openList . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio cerere deschisă.</p>') . '</section>'
    . ($closedList !== '' ? admin_section_open('Închise', 'inchise') . '<ul class="mt-2">' . $closedList . '</ul></section>' : '')
    . '</div><div class="min-w-0 lg:col-span-4">' . admin_section_open('Cerere nouă', 'noua') . $form . '</section></div></div>';
admin_page('Cereri GDPR', $body, $user);
