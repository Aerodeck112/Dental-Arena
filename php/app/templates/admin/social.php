<?php
/**
 * /admin/social: the posts for Facebook and Instagram, three every two days, written by the
 * panel's AI: the plan (day and hour), the text to copy, the image to download (admin.js draws
 * it from a photo of the clinic, with the title and the logo), „Am postat”.
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/social.php';

$settings = social_settings();
$photos = social_photos();
$back = '/admin/social';
if (is_post()) {
    csrf_check();
    $op = post('op');
    $post = admin_int(post('id')) !== null ? db_one('SELECT * FROM social_posts WHERE id = ?', [(int) post('id')]) : null;
    if ($op === 'setari') {
        setting_save('social', ['auto' => post('auto') === '1', 'focus' => mb_substr(trim(post('focus')), 0, 600)]);
        flash('Setările postărilor au fost salvate.');
    } elseif ($op === 'genereaza') {
        // The next two days without posts: from today, or right after the last ones.
        $b = social_next_batch(new DateTimeImmutable());
        $r = social_generate($b, (int) $user['id']);
        flash($r['ok'] ? "Au fost scrise {$r['added']} postări pentru " . format_date($b->format('Y-m-d')) . ' și ziua următoare.' : $r['error'], $r['ok'] ? 'succes' : 'eroare');
    } elseif ($post !== null && $op === 'salveaza') {
        db_update('social_posts', [
            'headline' => mb_substr(trim(post('headline')), 0, 140) ?: $post['headline'],
            'caption' => trim(str_replace("\r\n", "\n", post('caption'))) ?: $post['caption'],
            'hashtags' => mb_substr(trim(post('hashtags')), 0, 400),
            'image' => isset($photos[post('image')]) ? post('image') : $post['image'],
        ], 'id = :id', ['id' => (int) $post['id']]);
        flash('Postarea a fost salvată.');
    } elseif ($post !== null && in_array($op, ['postat', 'renunta', 'reia'], true)) {
        $status = ['postat' => 'postat', 'renunta' => 'renuntat', 'reia' => 'propus'][$op];
        db_update('social_posts', ['status' => $status, 'posted_at' => $status === 'postat' ? now_sql() : null], 'id = :id', ['id' => (int) $post['id']]);
        audit('social-' . $status, $post['headline']);
        flash($status === 'postat' ? 'Bifată ca postată.' : ($status === 'renuntat' ? 'Postarea a fost lăsată deoparte.' : 'Postarea e din nou de postat.'));
    }
    redirect($back . ($post !== null ? '#postare-' . (int) $post['id'] : ''));
}

$upcoming = db_all("SELECT * FROM social_posts WHERE status = 'propus' OR (status = 'postat' AND publish_at >= ?) ORDER BY publish_at, id", [date('Y-m-d 00:00:00', strtotime('-2 days'))]);
$past = db_all("SELECT * FROM social_posts WHERE status <> 'propus' AND id NOT IN (" . (implode(',', array_map(static fn ($r) => (int) $r['id'], $upcoming)) ?: '0') . ') ORDER BY publish_at DESC LIMIT 30');

$photoOptions = implode('', array_map(static fn ($u, $l) => '<option value="' . e($u) . '">' . e($l) . '</option>', array_keys($photos), $photos));
$card = static function (array $r) use ($photos, $photoOptions): string {
    $id = (int) $r['id'];
    $late = $r['status'] === 'propus' && strtotime($r['publish_at']) < time();
    $text = $r['caption'] . ($r['hashtags'] !== '' ? "\n\n" . $r['hashtags'] : '');
    $status = $r['status'] === 'postat' ? '<span class="rounded-chip bg-menta-pal px-2.5 py-0.5 text-mic font-medium">Postat ' . e(format_datetime((string) $r['posted_at'])) . '</span>'
        : ($r['status'] === 'renuntat' ? '<span class="rounded-chip bg-adancit px-2.5 py-0.5 text-mic">Renunțat</span>'
        : '<span class="' . e(cn('rounded-chip px-2.5 py-0.5 text-mic font-medium', $late ? 'bg-carmin-pal text-carmin' : 'border border-linie-control')) . '">' . ($late ? 'Întârziată' : 'De postat') . '</span>');
    $form = static fn (string $op, string $label, string $style) => '<form method="post">' . csrf_field() . '<input type="hidden" name="op" value="' . $op . '"><input type="hidden" name="id" value="' . $id . '"><button type="submit" class="' . e(btn($style, 's')) . '">' . $label . '</button></form>';
    return '<article id="postare-' . $id . '" class="grid grid-cols-1 gap-5 rounded-panou border border-linie bg-suprafata p-4 md:p-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">'
        // The image: drawn by admin.js from the photo, the title and the logo.
        . '<div class="flex min-w-0 flex-col gap-2" data-social-imagine data-titlu="' . e($r['headline']) . '" data-tema="' . e(SOCIAL_THEMES[$r['theme']] ?? '') . '" data-fisier="dental-arena-' . e(substr($r['publish_at'], 0, 10)) . '-' . $id . '.jpg">'
        . '<canvas width="1080" height="1350" class="block h-auto w-full max-w-full rounded-control border border-linie bg-fundal" aria-label="' . e('Imaginea postării: ' . $r['headline']) . '"></canvas>'
        . '<label class="text-mic text-discret" for="foto-' . $id . '">Fotografia</label>'
        . '<select id="foto-' . $id . '" data-social-foto class="' . e(input_classes('h-control')) . '">' . str_replace('value="' . e((string) $r['image']) . '"', 'value="' . e((string) $r['image']) . '" selected', $photoOptions) . '</select>'
        . '<label class="text-mic text-link underline underline-offset-4"><input type="file" accept="image/*" data-social-fisier class="sr-only">Sau o fotografie de-a dumneavoastră (din calculator sau telefon)</label>'
        . ($r['image_hint'] ? '<p class="text-mic text-discret">Sugestie: ' . e($r['image_hint']) . '</p>' : '')
        . '<button type="button" data-social-descarca class="' . e(btn('primary')) . '">' . icon('download', 18) . 'Descărcați imaginea</button></div>'
        . '<div class="flex min-w-0 flex-col gap-3">'
        . '<div class="flex flex-wrap items-center gap-2"><span class="font-semibold cifre">' . e(ucfirst(RO_WEEKDAYS[(int) date('N', strtotime($r['publish_at'])) - 1]) . ', ' . format_date(substr($r['publish_at'], 0, 10)) . ', ora ' . substr($r['publish_at'], 11, 5)) . '</span>'
        . '<span class="rounded-chip bg-fundal px-2.5 py-0.5 text-mic">' . e(SOCIAL_THEMES[$r['theme']] ?? $r['theme']) . '</span>' . $status . '</div>'
        . '<form method="post" class="flex flex-col gap-3">' . csrf_field() . '<input type="hidden" name="op" value="salveaza"><input type="hidden" name="id" value="' . $id . '"><input type="hidden" name="image" value="' . e((string) $r['image']) . '" data-social-foto-ales>'
        . text_field('headline', 'Titlul de pe imagine', ['id' => "titlu-{$id}", 'value' => $r['headline'], 'maxlength' => 140, 'attrs' => ['data-social-titlu' => '']])
        . text_area('caption', 'Textul postării', ['id' => "text-{$id}", 'value' => $r['caption'], 'rows' => 9])
        . text_field('hashtags', 'Hashtag-uri', ['id' => "tag-{$id}", 'value' => $r['hashtags']])
        . '<textarea id="copie-' . $id . '" hidden readonly>' . e($text) . '</textarea>'
        . '<div class="flex flex-wrap gap-2"><button type="button" data-copiaza="#copie-' . $id . '" class="' . e(btn('primary')) . '">' . icon('copy', 18) . 'Copiați textul</button>'
        . '<button type="submit" class="' . e(btn('secondary')) . '">Salvați modificările</button></div></form>'
        . '<div class="flex flex-wrap gap-2 border-t border-linie pt-3">'
        . ($r['status'] === 'propus' ? $form('postat', icon('check', 16) . 'Am postat', 'secondary') . $form('renunta', 'Nu o postez', 'text') : $form('reia', 'Din nou de postat', 'text'))
        . '</div></div></article>';
};

$plan = '';
$batch = null;
foreach ($upcoming as $r) {
    if ($r['batch_date'] !== $batch) {
        $batch = $r['batch_date'];
        $d2 = date('Y-m-d', strtotime($batch . ' +1 day'));
        $plan .= '<h2 class="mt-8 text-h3 font-semibold first:mt-0">' . e(ucfirst(RO_WEEKDAYS[(int) date('N', strtotime($batch)) - 1]) . ' ' . format_date($batch) . ' și ' . RO_WEEKDAYS[(int) date('N', strtotime($d2)) - 1] . ' ' . format_date($d2)) . '</h2>';
    }
    $plan .= '<div class="mt-3">' . $card($r) . '</div>';
}
$ready = ai_ready();
$notice = $ready ? '' : '<p class="mb-6 rounded-panou border border-mustar bg-mustar-pal p-4 text-corp"><strong>Asistentul AI nu este pornit.</strong> Postările le scrie AI-ul panoului: Setări → Asistentul AI (cheia Anthropic, cea de la consultații).</p>';
$controls = admin_section_open('Cum se scriu', 'setari-social', 'Asistentul AI scrie câte 3 postări la 2 zile: două în prima zi (11:00 și 19:00), una a doua zi (13:00), orele bune pe Facebook și Instagram. Se scriu din timp, cu una-două zile înainte.')
    . '<form method="post" class="mt-4 flex flex-col gap-4">' . csrf_field() . '<input type="hidden" name="op" value="setari">'
    . checkbox_field('auto', 'Le scrie singur, câte 3 la 2 zile', ['checked' => (bool) $settings['auto'], 'description' => 'Cu Cron Job-ul pornit; fără el, la prima deschidere a panoului din zi.'])
    . text_area('focus', 'Ce promovăm acum (opțional)', ['value' => (string) $settings['focus'], 'rows' => 3, 'optional' => true, 'hint' => 'De exemplu: „implanturile la Luduș”, „controlul copiilor înainte de școală”, o ofertă reală a clinicii. AI-ul nu inventează oferte.'])
    . '<div class="flex flex-wrap gap-3"><button type="submit" class="' . e(btn('secondary')) . '">Salvați</button></div></form>'
    . ($ready ? '<form method="post" class="mt-4 border-t border-linie pt-4">' . csrf_field() . '<input type="hidden" name="op" value="genereaza"><button type="submit" class="' . e(btn('primary', 'm', 'h-auto min-h-control w-full whitespace-normal py-2 text-left')) . '">' . admin_icon('sparkles', 18) . 'Scrieți acum postările pentru următoarele 2 zile</button><p class="mt-1 text-mic text-discret">Durează cam un minut.</p></form>' : '')
    . '</section>';
$pastList = $past !== [] ? '<details class="mt-10 rounded-panou border border-linie bg-suprafata p-4"><summary class="cursor-pointer font-semibold">Postările de dinainte (' . count($past) . ')</summary><ul class="mt-3 flex flex-col gap-2">'
    . implode('', array_map(static fn ($r) => '<li class="flex flex-wrap items-center gap-2 border-t border-linie pt-2 text-corp"><span class="cifre text-discret">' . e(format_date(substr($r['publish_at'], 0, 10))) . '</span><span class="font-medium">' . e($r['headline']) . '</span><span class="text-mic text-discret">' . e(SOCIAL_STATUS[$r['status']] ?? $r['status']) . '</span></li>', $past))
    . '</ul></details>' : '';
$body = admin_header('Social media', 'Postările pentru Facebook și Instagram: copiați textul, descărcați imaginea și postați-le la ora din plan. Apoi apăsați „Am postat”.')
    . $notice
    . '<div class="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]"><div class="min-w-0">'
    . ($plan !== '' ? $plan : '<p class="rounded-panou border border-dashed border-linie p-6 text-corp text-discret">Nicio postare încă. ' . ($ready ? 'Apăsați „Scrieți acum postările” sau așteptați: le scrie singur.' : '') . '</p>')
    . $pastList . '</div><div class="xl:sticky xl:top-6 xl:self-start">' . $controls . '</div></div>';
admin_page('Social media', $body, $user);
