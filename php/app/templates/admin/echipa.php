<?php
/**
 * /admin/echipa: the doctors shown on the site. The arrows change their order, which is the same
 * everywhere: the team on the site, the calendar columns, the doctors offered at booking.
 */
declare(strict_types=1);

if (is_post() && post('op') === 'ordine') {
    csrf_check();
    $ids = array_map('intval', array_column(db_all('SELECT id FROM doctors ORDER BY sort_order, last_name, id'), 'id'));
    $at = array_search((int) post('id'), $ids, true);
    $to = $at === false ? false : $at + (post('dir') === 'sus' ? -1 : 1);
    if ($at !== false && $to >= 0 && $to < count($ids)) {
        [$ids[$at], $ids[$to]] = [$ids[$to], $ids[$at]];
        db_tx(static function () use ($ids): void {
            foreach ($ids as $i => $id) {
                db_run('UPDATE doctors SET sort_order = ? WHERE id = ?', [$i + 1, $id]);
            }
        });
        $names = array_column(db_all('SELECT id, public_name FROM doctors'), 'public_name', 'id');
        audit('echipa-ordine', implode(', ', array_map(static fn ($id) => $names[$id] ?? '', $ids)));
    }
    redirect('/admin/echipa#medic-' . (int) post('id'));
}

$rows = db_all('SELECT * FROM doctors ORDER BY sort_order, last_name, id');
$last = count($rows) - 1;
$arrow = static fn (int $id, string $dir, string $label, string $icon, bool $off) => '<form method="post">' . csrf_field()
    . '<input type="hidden" name="op" value="ordine"><input type="hidden" name="id" value="' . $id . '"><input type="hidden" name="dir" value="' . $dir . '">'
    . '<button type="submit" class="' . e(btn('secondary', 's', 'px-2')) . '" aria-label="' . e($label) . '"' . ($off ? ' disabled' : '') . '>' . icon($icon, 18) . '</button></form>';
$items = '';
foreach ($rows as $i => $r) {
    $d = public_doctor($r);
    $id = (int) $r['id'];
    $items .= '<li id="medic-' . $id . '" class="flex items-center gap-3 rounded-panou border border-linie bg-suprafata p-3">'
        . '<span class="w-8 shrink-0 text-center font-display text-h3 text-discret cifre">' . ($i + 1) . '</span>'
        . '<a href="/admin/echipa/' . $id . '" class="flex min-w-0 flex-1 items-center gap-4 rounded-control hover:underline">'
        . '<span class="w-16 shrink-0">' . doctor_portrait($d, '64px') . '</span>'
        . '<span class="min-w-0"><span class="block text-h3 font-semibold">' . e($r['public_name']) . '</span><span class="block text-mic text-discret">' . e($r['role_line']) . '</span>'
        . ((int) $r['public_visible'] === 0 ? '<span class="mt-1 inline-block rounded-chip bg-adancit px-2 text-mic">Nu apare pe site</span>' : '') . '</span></a>'
        . '<div class="flex shrink-0 flex-col gap-1">'
        . $arrow($id, 'sus', 'Mai sus: ' . $r['public_name'], 'chevron-up', $i === 0)
        . $arrow($id, 'jos', 'Mai jos: ' . $r['public_name'], 'chevron-down', $i === $last) . '</div></li>';
}
// The assistants: on the site's team page (when shown), not in the calendar or at booking.
$assistantItems = '';
foreach (db_all('SELECT * FROM team_assistants ORDER BY sort_order, last_name, id') as $a) {
    $assistantItems .= '<li><a href="/admin/echipa/asistent/' . (int) $a['id'] . '" class="flex items-center gap-4 rounded-panou border border-linie bg-suprafata p-3 hover:underline">'
        . '<span class="relative block aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-foto bg-menta-pal">' . ($a['photo_path'] ? '<img src="' . e((string) $a['photo_path']) . '" alt="" class="absolute inset-0 size-full object-cover">' : '<span class="flex size-full items-center justify-center font-display text-h3">' . e(mb_substr($a['first_name'], 0, 1) . mb_substr($a['last_name'], 0, 1)) . '</span>') . '</span>'
        . '<span class="min-w-0"><span class="block text-h3 font-semibold">' . e(trim($a['first_name'] . ' ' . $a['last_name'])) . '</span><span class="block text-mic text-discret">' . e($a['role_line']) . '</span>'
        . ((int) $a['public_visible'] === 0 ? '<span class="mt-1 inline-block rounded-chip bg-adancit px-2 text-mic">Nu apare pe site</span>' : '') . '</span></a></li>';
}
$assistantsBox = '<div class="mt-10 max-w-3xl"><div class="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 class="text-h3 font-semibold">Asistentele</h2>'
    . '<p class="text-mic text-discret">Apar pe pagina Echipa a site-ului, sub medici (dacă e bifat). Nu apar în calendar și la programare. Contul lor de panou îl face VITIM la Utilizatori, cu rolul „Asistent(ă) medical(ă)”.</p></div>'
    . '<a href="/admin/echipa/asistent/nou" class="' . e(btn('secondary')) . '">' . icon('plus', 18) . 'Asistentă nouă</a></div>'
    . ($assistantItems !== '' ? '<ul class="grid gap-3">' . $assistantItems . '</ul>' : '<p class="rounded-panou border border-dashed border-linie p-4 text-corp text-discret">Nicio asistentă încă.</p>') . '</div>';
$body = admin_header('Echipa', 'Medicii de pe site: portretul, numele, specialitatea, descrierea și serviciile fiecăruia. Cu săgețile schimbați ordinea: așa apar pe site, în calendar și la programare.', '<a href="/admin/echipa/nou" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Adăugați un medic</a>')
    . '<ol class="grid max-w-3xl gap-3">' . $items . '</ol>'
    . $assistantsBox;
admin_page('Echipa', $body, $user);
