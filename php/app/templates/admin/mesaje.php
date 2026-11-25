<?php
/**
 * /admin/mesaje: the WhatsApp conversations (the patients' replies first) and the log of every
 * message the panel sent or queued, with retry for failed ones and cancel for waiting ones.
 */
declare(strict_types=1);

[$scope, $sp] = patient_scope_sql($user);
if (is_post()) {
    csrf_check();
    $msg = db_one("SELECT m.* FROM messages m LEFT JOIN patients p ON p.id = m.patient_id WHERE m.id = ? AND (m.patient_id IS NULL OR {$scope})", array_merge([(int) post('id')], $sp));
    if ($msg !== null && post('op') === 'reincearca' && $msg['status'] === 'esuat') {
        db_update('messages', ['status' => 'in-asteptare', 'attempts' => 0, 'error' => null, 'send_after' => now_sql(), 'updated_at' => now_sql()], 'id = :id', ['id' => $msg['id']]);
        [$sent, $note] = send_message_now((int) $msg['id']);
        flash($note, $sent ? 'succes' : 'eroare');
    } elseif ($msg !== null && post('op') === 'trimite-acum' && $msg['status'] === 'in-asteptare') {
        // A message waiting for the morning (or for a retry) leaves now.
        [$sent, $note] = send_message_now((int) $msg['id']);
        flash($note, $sent ? 'succes' : 'eroare');
    } elseif ($msg !== null && post('op') === 'anuleaza' && $msg['status'] === 'in-asteptare') {
        db_update('messages', ['status' => 'anulat', 'updated_at' => now_sql()], 'id = :id', ['id' => $msg['id']]);
        flash('Mesajul nu mai pleacă.');
    }
    redirect(admin_safe_return(post('inapoi')) ?? '/admin/mesaje');
}

// WhatsApp conversations: the last message from each number that wrote to the clinic.
$threads = db_all("SELECT m.*, p.first_name, p.last_name, (SELECT COUNT(*) FROM messages u WHERE u.direction = 'in' AND u.status = 'primit' AND u.to_address = m.to_address) AS unread
    FROM messages m LEFT JOIN patients p ON p.id = m.patient_id
    WHERE m.id IN (SELECT MAX(id) FROM messages WHERE direction = 'in' GROUP BY to_address) AND (m.patient_id IS NULL OR {$scope})
    ORDER BY m.created_at DESC LIMIT 50", $sp);
$threadList = '';
foreach ($threads as $t) {
    $name = $t['last_name'] ? trim($t['last_name'] . ' ' . $t['first_name']) : '+' . $t['to_address'] . ' (nu e în fișe)';
    $href = $t['patient_id'] ? '/admin/pacienti/' . (int) $t['patient_id'] . '/mesaje' : null;
    $threadList .= '<li class="border-t border-linie first:border-t-0">' . ($href ? '<a href="' . e($href) . '" class="flex items-start gap-3 py-3 hover:bg-fundal">' : '<div class="flex items-start gap-3 py-3">')
        . '<span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="font-semibold ' . ($href ? 'text-link' : '') . '">' . e($name) . '</span>' . ((int) $t['unread'] > 0 ? '<span class="rounded-chip bg-mustar px-2 text-mic font-semibold text-pe-menta">' . (int) $t['unread'] . ' nou</span>' : '') . '</span>'
        . '<span class="block truncate text-mic text-discret">' . e(mb_substr($t['body'], 0, 120)) . '</span></span>'
        . '<span class="cifre text-mic text-discret">' . e(date('d.m H:i', strtotime($t['created_at']))) . '</span>' . ($href ? '</a>' : '</div>') . '</li>';
}

// The log.
$channel = query('canal');
$status = query('stare');
$where = ['(m.patient_id IS NULL OR ' . $scope . ')'];
$params = $sp;
if (!is_admin($user)) {
    $where[] = 'm.user_id IS NULL';
}
if (isset(MSG_CHANNELS[$channel])) {
    $where[] = 'm.channel = ?';
    $params[] = $channel;
}
if (isset(MSG_STATUS[$status])) {
    $where[] = 'm.status = ?';
    $params[] = $status;
}
$log = db_all('SELECT m.*, p.first_name, p.last_name, u.name AS staff FROM messages m LEFT JOIN patients p ON p.id = m.patient_id LEFT JOIN users u ON u.id = m.user_id WHERE ' . implode(' AND ', $where) . ' ORDER BY m.id DESC LIMIT 200', $params);
$th = 'px-3 py-2 text-left text-mic font-semibold text-discret';
$rows = '';
foreach ($log as $m) {
    $who = $m['patient_id'] ? '<a class="text-link underline-offset-4 hover:underline" href="/admin/pacienti/' . (int) $m['patient_id'] . '/mesaje">' . e(trim($m['last_name'] . ' ' . $m['first_name'])) . '</a>' : ($m['staff'] ? e($m['staff']) . ' <span class="text-discret">(echipă)</span>' : e($m['to_address']));
    $act = '';
    if (in_array($m['status'], ['esuat', 'in-asteptare'], true) && $m['direction'] === 'out') {
        $hidden = csrf_field() . '<input type="hidden" name="id" value="' . (int) $m['id'] . '"><input type="hidden" name="inapoi" value="' . e($_SERVER['REQUEST_URI'] ?? '/admin/mesaje') . '">';
        $act = $m['status'] === 'esuat'
            ? '<form method="post">' . $hidden . '<button type="submit" name="op" value="reincearca" class="' . e(btn('secondary', 's')) . '">Reîncercați acum</button></form>'
            : '<form method="post" class="flex flex-col items-start gap-1">' . $hidden . '<button type="submit" name="op" value="trimite-acum" class="' . e(btn('secondary', 's')) . '">' . admin_icon('send', 16) . 'Trimiteți acum</button>'
                . '<button type="submit" name="op" value="anuleaza" class="' . e(btn('text', 's')) . '">Nu mai trimiteți</button></form>';
    }
    $rows .= '<tr class="border-t border-linie align-top"><td class="cifre whitespace-nowrap px-3 py-2">' . e(date('d.m.Y H:i', strtotime($m['sent_at'] ?? $m['send_after']))) . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . $who . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . e(($m['direction'] === 'in' ? '← ' : '') . (MSG_CHANNELS[$m['channel']] ?? $m['channel'])) . '<span class="block text-mic text-discret">' . e(message_event_label($m['event'])) . '</span></td>'
        . '<td class="max-w-[24rem] px-3 py-2"><span class="line-clamp-2 text-mic">' . e($m['body']) . '</span>' . ($m['error'] ? '<span class="block text-mic text-carmin">' . e($m['error']) . '</span>' : '') . '</td>'
        . '<td class="whitespace-nowrap px-3 py-2">' . msg_status_chip($m['status']) . '</td><td class="px-3 py-2">' . $act . '</td></tr>';
}
$today = db_one("SELECT SUM(status IN ('trimis', 'livrat', 'citit')) AS sent, SUM(status = 'esuat') AS failed, SUM(status = 'in-asteptare') AS waiting, SUM(status = 'proba') AS test FROM messages WHERE direction = 'out' AND created_at >= ?", [date('Y-m-d 00:00:00')]);
$filters = '<form method="get" class="mt-4 flex flex-wrap items-end gap-3">'
    . select_field('canal', 'Canal', ['' => 'Toate'] + MSG_CHANNELS, ['value' => $channel])
    . select_field('stare', 'Stare', ['' => 'Toate'] + MSG_STATUS, ['value' => $status])
    . '<button type="submit" class="' . e(btn('secondary')) . '">' . icon('filter', 18) . 'Filtrați</button></form>';
$mode = messaging_live() ? '' : '<p class="mb-6 flex items-start gap-3 rounded-panou border border-mustar bg-mustar-pal p-4 text-corp">' . icon('info', 20, 'mt-0.5') . '<span>Mod de probă: mesajele nu pleacă, apar doar aici ca „Probă”.' . (can_configure($user) ? ' Trimiterea reală se pornește din <a class="text-link underline" href="/admin/setari/mesaje">Setări → Mesaje</a>.' : '') . '</span></p>';

// „Verificare”: why a patient got no message (administrators; open when something is wrong).
$diagnosis = '';
if (is_admin($user)) {
    $checks = messages_diagnosis();
    $bad = array_filter($checks, static fn ($c) => $c['ok'] === false);
    $diagnosis = '<details class="mb-8 rounded-panou border ' . ($bad !== [] ? 'border-2 border-mustar bg-mustar-pal/40' : 'border-linie bg-suprafata') . ' p-4"' . ($bad !== [] ? ' open' : '') . '>'
        . '<summary class="cursor-pointer text-h3 font-semibold">Verificare: de ce nu primesc pacienții mesaje?' . ($bad !== [] ? ' <span class="text-mic font-medium text-carmin">(' . count_ro(count($bad), 'o problemă', 'probleme') . ')</span>' : ' <span class="text-mic font-medium text-actiune">(totul pare în regulă)</span>') . '</summary>'
        . '<ul class="mt-3 flex flex-col">' . implode('', array_map(static fn ($c) => '<li class="flex items-start gap-3 border-t border-linie py-2 first:border-t-0">'
            . '<span aria-hidden="true" class="' . e(cn('mt-1 inline-block size-3 shrink-0 rounded-full', $c['ok'] === true ? 'bg-actiune' : ($c['ok'] === false ? 'bg-carmin' : 'bg-mustar'))) . '"></span>'
            . '<span class="min-w-0"><span class="block text-corp font-medium">' . e($c['title']) . '</span>' . ($c['detail'] !== '' ? '<span class="block break-words text-mic text-discret">' . e($c['detail']) . '</span>' : '') . '</span></li>', $checks)) . '</ul></details>';
}
$body = admin_header('Mesaje', 'Azi: ' . (int) $today['sent'] . ' trimise, ' . (int) $today['waiting'] . ' în așteptare, ' . (int) $today['failed'] . ' eșuate' . ((int) $today['test'] > 0 ? ', ' . (int) $today['test'] . ' de probă' : '') . '.', can_configure($user) ? '<a href="/admin/setari/mesaje" class="' . e(btn('secondary')) . '">' . icon('settings', 18) . 'Setări mesaje</a>' : '')
    . $mode
    . $diagnosis
    . '<div class="flex flex-col gap-8">'
    . admin_section_open('WhatsApp: mesajele pacienților', 'whatsapp', 'Răspundeți din fișa pacientului, fila Mesaje.') . ($threadList !== '' ? '<ul class="mt-2">' . $threadList . '</ul>' : '<p class="mt-3 text-corp text-discret">Niciun mesaj primit.</p>') . '</section>'
    . admin_section_open('Toate mesajele', 'jurnal') . $filters
    . ($rows !== '' ? '<div class="relative mt-4 overflow-x-auto"><table class="w-full min-w-[48rem] border-collapse text-corp"><thead><tr><th scope="col" class="' . $th . '">Când</th><th scope="col" class="' . $th . '">Către</th><th scope="col" class="' . $th . '">Canal</th><th scope="col" class="' . $th . '">Text</th><th scope="col" class="' . $th . '">Stare</th><th scope="col" class="' . $th . '"><span class="sr-only">Acțiuni</span></th></tr></thead><tbody>' . $rows . '</tbody></table></div>' : '<p class="mt-3 text-corp text-discret">Niciun mesaj.</p>')
    . '</section></div>';
admin_page('Mesaje', $body, $user);
