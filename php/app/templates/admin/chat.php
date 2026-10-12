<?php
/** /admin/chat: the conversations of the assistant on the site, newest first, with what came of them. */
declare(strict_types=1);

const CHAT_STATUS = ['activ' => 'Doar întrebări', 'cerere' => 'Cerere pentru recepție', 'programat' => 'Programat'];

$filter = query('stare');
$where = isset(CHAT_STATUS[$filter]) ? 'WHERE c.status = ?' : '';
$params = $where !== '' ? [$filter] : [];
$total = (int) db_value("SELECT COUNT(*) FROM chat_conversations c {$where}", $params);
$pages = max(1, (int) ceil($total / ADMIN_PER_PAGE));
$pagina = min($pages, max(1, (int) query('pagina', '1')));
$rows = db_all(
    "SELECT c.*, (SELECT display FROM chat_messages m WHERE m.conversation_id = c.id AND m.role IN ('user', 'note') AND m.display IS NOT NULL ORDER BY m.id LIMIT 1) AS first_text
     FROM chat_conversations c {$where} ORDER BY c.last_at DESC LIMIT " . ADMIN_PER_PAGE . ' OFFSET ' . (($pagina - 1) * ADMIN_PER_PAGE),
    $params,
);
$since = date('Y-m-d H:i:s', time() - 30 * 86400);
$stats = db_one("SELECT COUNT(*) AS n, SUM(status = 'programat') AS booked, SUM(status = 'cerere') AS requests, SUM(input_tokens) AS tin, SUM(output_tokens) AS tout FROM chat_conversations WHERE started_at > ?", [$since]);

$chip = static fn (string $st) => '<span class="' . e(cn('inline-flex rounded-full px-2.5 py-0.5 text-mic font-medium', match ($st) { 'programat' => 'bg-menta-pal text-actiune', 'cerere' => 'bg-mustar-pal text-mustar-text', default => 'bg-adancit text-discret' })) . '">' . e(CHAT_STATUS[$st] ?? $st) . '</span>';
$list = '';
foreach ($rows as $r) {
    $list .= '<li class="border-t border-linie first:border-t-0"><a href="/admin/chat/' . (int) $r['id'] . '" class="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-fundal">'
        . '<span class="w-36 shrink-0 text-mic text-discret cifre">' . e(format_datetime($r['last_at'])) . '</span>'
        . '<span class="min-w-0 flex-1 truncate text-corp">' . e(mb_substr((string) $r['first_text'], 0, 120)) . '</span>'
        . '<span class="text-mic text-discret cifre">' . (int) $r['turns'] . ' mesaje</span>'
        . ($r['phone'] ? '<span class="text-mic telefon">' . e(format_phone((string) $r['phone'])) . '</span>' : '')
        . $chip((string) $r['status']) . '</a></li>';
}
$tabs = '<nav aria-label="Filtru" class="mb-4 flex flex-wrap gap-2">';
foreach (['' => 'Toate'] + CHAT_STATUS as $k => $label) {
    $tabs .= '<a href="' . e(admin_url('/admin/chat', ['stare' => $k])) . '"' . ($filter === $k ? ' aria-current="page"' : '') . ' class="' . e(cn('rounded-full border px-3 py-1.5 text-mic font-medium', $filter === $k ? 'border-actiune bg-menta-pal text-actiune' : 'border-linie bg-suprafata')) . '">' . e($label) . '</a>';
}
$tabs .= '</nav>';
$nav = $pages > 1 ? '<nav aria-label="Pagini" class="mt-6 flex items-center gap-4">'
    . ($pagina > 1 ? '<a href="' . e(admin_url('/admin/chat', ['stare' => $filter, 'pagina' => $pagina - 1])) . '" class="' . e(btn('secondary', 's')) . '">' . icon('chevron-left', 16) . 'Înapoi</a>' : '')
    . '<span class="text-mic text-discret cifre">Pagina ' . $pagina . ' din ' . $pages . '</span>'
    . ($pagina < $pages ? '<a href="' . e(admin_url('/admin/chat', ['stare' => $filter, 'pagina' => $pagina + 1])) . '" class="' . e(btn('secondary', 's')) . '">Înainte' . icon('chevron-right', 16) . '</a>' : '') . '</nav>' : '';

$tile = static fn (string $label, string $value) => '<div class="rounded-panou border border-linie bg-suprafata p-4"><p class="text-mic text-discret">' . e($label) . '</p><p class="mt-1 font-display text-[2rem] leading-none cifre">' . e($value) . '</p></div>';
$body = admin_header('Chat pe site', 'Ce au întrebat vizitatorii și ce s-a întâmplat: cereri pentru recepție și programări făcute direct.', is_admin($user) ? '<a href="/admin/setari/chat" class="' . e(btn('secondary')) . '">' . icon('settings', 18) . 'Setări</a>' : '')
    . (!chat_settings()['enabled'] ? '<p class="mb-6 rounded-panou border border-mustar bg-mustar-pal p-4 text-corp">Chatul este oprit pe site.' . (is_admin($user) ? ' Îl porniți din <a class="text-link underline" href="/admin/setari/chat">Setări → Chatul de pe site</a>.' : '') . '</p>' : '')
    . '<div class="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">' . $tile('Conversații, 30 de zile', (string) (int) $stats['n']) . $tile('Programări directe', (string) (int) $stats['booked']) . $tile('Cereri pentru recepție', (string) (int) $stats['requests'])
    . $tile('Tokeni (intrare / ieșire)', number_format((int) $stats['tin'], 0, ',', '.') . ' / ' . number_format((int) $stats['tout'], 0, ',', '.')) . '</div>'
    . $tabs
    . admin_section_open('Conversațiile', 'conversatii') . ($list !== '' ? '<ul class="mt-2">' . $list . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio conversație.</p>') . '</section>' . $nav;
admin_page('Chat pe site', $body, $user);
