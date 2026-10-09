<?php
/**
 * /admin („Azi”): the day at one clinic: the appointments in order, each with its next step
 * (Confirmat, A sosit, Începe tratamentul, Finalizat), the patient's alerts, the new requests
 * from the site and the recalls due.
 */
declare(strict_types=1);

purge_old_leads();
$names = admin_clinic_names();
$allowed = array_values(array_filter(allowed_location_ids($user), static fn ($id) => isset($names[$id])));
$clinicId = current_clinic_id($user);
if ($clinicId !== null) {
    remember_clinic($clinicId);
}
$today = date('Y-m-d');
$docs = doctor_short_names();
$appts = $clinicId === null ? [] : db_all(
    "SELECT a.*, p.first_name, p.last_name, p.phone, p.file_number FROM appointments a JOIN patients p ON p.id = a.patient_id
     WHERE a.location_id = ? AND a.starts_at >= ? AND a.starts_at < ? ORDER BY a.starts_at, a.id",
    [$clinicId, "{$today} 00:00:00", date('Y-m-d', strtotime('+1 day')) . ' 00:00:00'],
);
$newLeads = $clinicId === null ? [] : db_all("SELECT * FROM leads WHERE status = 'nou' AND (location_id = ? OR location_id IS NULL) ORDER BY created_at DESC LIMIT 6", [$clinicId]);
$recallsDue = $clinicId === null ? 0 : (int) db_value("SELECT COUNT(*) FROM recalls WHERE status IN ('de-facut', 'contactat') AND due_date <= ? AND (location_id = ? OR location_id IS NULL)", [date('Y-m-d', strtotime('+7 days')), $clinicId]);
$active = array_filter($appts, static fn ($a) => $a['status'] !== 'anulat');

$switch = '';
if (count($allowed) > 1) {
    $switch = '<nav aria-label="Clinica" class="inline-flex rounded-control border border-linie-control bg-suprafata p-1">';
    foreach ($allowed as $id) {
        $on = $id === $clinicId;
        $switch .= '<a href="/admin?clinica=' . $id . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control-s items-center rounded-[calc(var(--radius-control)-2px)] px-4 text-control', $on ? 'bg-actiune font-semibold text-pe-actiune' : 'hover:bg-adancit')) . '">' . e($names[$id]) . '</a>';
    }
    $switch .= '</nav>';
}

$rows = '';
foreach ($appts as $a) {
    $id = (int) $a['id'];
    $alerts = medical_alerts((int) $a['patient_id']);
    $buttons = '';
    foreach (APPT_NEXT[$a['status']] ?? [] as $st => $label) {
        $buttons .= '<button type="submit" name="stare" value="' . e($st) . '" class="' . e(btn($st === 'finalizat' || $st === 'in-tratament' ? 'primary' : 'secondary', 's')) . '">' . e($label) . '</button>';
    }
    if (in_array($a['status'], ['programat', 'confirmat'], true) && strtotime($a['starts_at']) < time()) {
        $buttons .= '<button type="submit" name="stare" value="neprezentat" class="' . e(btn('text', 's')) . '">Nu a venit</button>';
    }
    $muted = in_array($a['status'], ['anulat', 'neprezentat'], true);
    $rows .= '<li class="' . e(cn('grid gap-3 border-t border-linie py-4 first:border-t-0 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center', $muted ? 'opacity-60' : '')) . '">'
        . '<p class="font-display text-[1.75rem] leading-none cifre">' . e(hm($a['starts_at'])) . '<span class="block pt-1 font-sans text-mic text-discret">până la ' . e(hm($a['ends_at'])) . '</span></p>'
        . '<div class="min-w-0"><p><a href="/admin/pacienti/' . (int) $a['patient_id'] . '" class="text-h3 font-semibold text-cerneala underline-offset-4 hover:underline">' . e(patient_name($a)) . '</a></p>'
        . (($chips = alert_chips($alerts) . comfort_chip($a['comfort'], (bool) $a['wants_sedation'])) !== '' ? '<p class="mt-1 flex flex-wrap gap-1.5">' . $chips . '</p>' : '')
        . '<p class="mt-1 text-mic text-discret">' . e(implode(', ', array_filter([$docs[(int) $a['doctor_id']] ?? '', $a['reason'] ?: service_title($a['category_slug'])]))) . '</p></div>'
        . '<form method="post" action="/admin/programari/' . $id . '" class="flex flex-wrap items-center gap-2 sm:justify-end">' . csrf_field()
        . '<input type="hidden" name="op" value="stare"><input type="hidden" name="inapoi" value="/admin">'
        . appt_status_chip($a['status']) . $buttons
        . '<a href="/admin/programari/' . $id . '" class="' . e(btn('text', 's')) . '" aria-label="Deschideți programarea: ' . e(patient_name($a)) . '">' . icon('ellipsis', 18) . '</a></form>'
        . '</li>';
}
$leadItems = '';
foreach ($newLeads as $l) {
    $leadItems .= '<li class="border-t border-linie py-3 first:border-t-0"><a href="/admin/cereri/' . (int) $l['id'] . '" class="font-semibold text-link underline-offset-4 hover:underline">' . e($l['name']) . '</a>'
        . '<span class="block text-mic text-discret">' . e(lead_kind_label($l['kind']) . ($l['category_slug'] ? ' · ' . service_title($l['category_slug']) : '') . ' · ' . format_datetime($l['created_at'])) . '</span></li>';
}

$summary = count($active) . (count($active) === 1 ? ' programare' : ' programări') . ', ' . count($newLeads) . (count($newLeads) === 1 ? ' cerere nouă' : ' cereri noi') . ', ' . $recallsDue . ' de rechemat săptămâna aceasta.';
$body = admin_header('Azi, ' . format_date(new DateTimeImmutable(), true), $clinicId !== null ? ($names[$clinicId] ?? '') . ': ' . $summary : 'Contul nu are nicio clinică bifată.', $switch . '<a href="/admin/programari/noua' . ($clinicId ? '?clinica=' . $clinicId : '') . '" class="' . e(btn('primary')) . '">' . icon('plus', 18) . 'Programare nouă</a>')
    . '<div class="grid gap-8 lg:grid-cols-12">'
    . '<div class="lg:col-span-8">' . admin_section_open('Programările de azi', 'azi')
    . ($rows !== '' ? '<ul class="mt-2">' . $rows . '</ul>' : '<p class="mt-4 text-corp text-discret">Nicio programare azi. <a href="/admin/calendar" class="text-link underline">Deschideți calendarul</a>.</p>')
    . '</section></div>'
    . '<div class="flex flex-col gap-8 lg:col-span-4">'
    . admin_section_open('Cereri online noi', 'cereri-noi') . ($leadItems !== '' ? '<ul class="mt-2">' . $leadItems . '</ul>' : '<p class="mt-3 text-corp text-discret">Nicio cerere nouă.</p>')
    . '<a href="/admin/cereri" class="mt-3 inline-flex min-h-control items-center font-medium text-link underline underline-offset-4">Toate cererile</a></section>'
    . admin_section_open('Rechemări', 'rechemari-azi') . '<p class="mt-2 text-corp"><span class="font-display text-[2rem] cifre">' . $recallsDue . '</span> pacienți de sunat pentru control în următoarele 7 zile.</p>'
    . '<a href="/admin/rechemari" class="mt-2 inline-flex min-h-control items-center font-medium text-link underline underline-offset-4">Lista de rechemări</a></section>'
    . '</div></div>';
admin_page('Azi', $body, $user);
