<?php
/**
 * Social media: the panel's AI (Setări → Asistentul AI) writes three posts every two days for the
 * clinic's Facebook and Instagram pages, with the day and hour to post each, the text, the
 * hashtags and a photo of the clinic or the team for the image (composed in the browser:
 * admin.js, 1080 × 1350). Reception or the administrator copies them and posts them by hand.
 * Nothing about patients goes to the AI: only the clinic's public information.
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/ai.php';

/** The kinds of post, in turn, so the page does not repeat itself. */
const SOCIAL_THEMES = [
    'sfat' => 'Sfat de îngrijire',
    'serviciu' => 'Un serviciu explicat',
    'echipa' => 'Echipa și clinica',
    'mit' => 'Mit sau adevăr',
    'intrebare' => 'Întrebare de la pacienți',
    'copii' => 'Copiii la dentist',
    'programare' => 'Programare și confort',
];

/** When the three posts of a batch go out: two on the first day, one on the second (Meta's good hours). */
const SOCIAL_SLOTS = [[0, '11:00'], [0, '19:00'], [1, '13:00']];

const SOCIAL_STATUS = ['propus' => 'De postat', 'postat' => 'Postat', 'renuntat' => 'Renunțat'];

function social_settings(): array
{
    $s = setting('social');
    return array_merge(['auto' => true, 'focus' => ''], is_array($s) ? $s : []);
}

/** The photos the posts can use: the site's (clinic, team) and those uploaded in Fotografii site. @return array<string,string> url → label */
function social_photos(): array
{
    $out = [];
    foreach (array_keys((array) data_file('images')) as $src) {
        if (!str_contains($src, '/legal/')) {
            $out[$src] = ucfirst(str_replace(['-', '.jpg', '.png'], [' ', '', ''], basename($src))) . (str_contains($src, '/echipa/') ? ' (echipa)' : ' (clinica)');
        }
    }
    try {
        foreach (db_all('SELECT slot, path FROM site_images ORDER BY slot') as $r) {
            if (str_starts_with((string) $r['path'], '/')) {
                $out[$r['path']] = 'Încărcată: ' . $r['slot'];
            }
        }
    } catch (Throwable $e) {
        // No uploaded photos yet.
    }
    return $out;
}

/**
 * The first day of the next two days without posts: right after the last batch, or today when
 * the plan stopped (a batch is two days).
 */
function social_next_batch(DateTimeImmutable $now): DateTimeImmutable
{
    $today = $now->setTime(0, 0);
    $last = db_value("SELECT MAX(batch_date) FROM social_posts WHERE status <> 'renuntat'");
    $next = is_string($last) ? (new DateTimeImmutable($last))->modify('+2 days') : $today;
    return $next < $today ? $today : $next;
}

/** The answer's shape: three posts. */
function social_schema(array $photos): array
{
    $str = ['type' => 'string'];
    return [
        'type' => 'object',
        'properties' => [
            'posts' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'theme' => ['type' => 'string', 'enum' => array_keys(SOCIAL_THEMES)],
                        'headline' => $str,
                        'caption' => $str,
                        'hashtags' => ['type' => 'array', 'items' => $str],
                        'photo' => ['type' => 'string', 'enum' => array_keys($photos)],
                        'photo_note' => $str,
                    ],
                    'required' => ['theme', 'headline', 'caption', 'hashtags', 'photo', 'photo_note'],
                    'additionalProperties' => false,
                ],
            ],
        ],
        'required' => ['posts'],
        'additionalProperties' => false,
    ];
}

/** What the AI knows: the clinic's public information, the season, what was posted lately. */
function social_context(DateTimeImmutable $batch, array $photos): string
{
    $clinics = implode("\n", array_map(static fn ($c) => "- Dental Arena {$c['shortName']}: " . clinic_address($c) . ', telefon ' . format_phone((string) $c['phone']), clinics()));
    $services = implode("\n", array_map(static fn ($s) => '- ' . $s['title'] . ($s['summary'] ? ': ' . mb_strimwidth(strip_tags((string) $s['summary']), 0, 160, '…') : ''), site_services()));
    $team = implode(', ', array_column(db_all('SELECT public_name FROM doctors WHERE public_visible = 1 ORDER BY sort_order'), 'public_name'));
    $recent = array_map(static fn ($r) => "- {$r['batch_date']}: [{$r['theme']}] {$r['headline']}", db_all('SELECT batch_date, theme, headline FROM social_posts ORDER BY publish_at DESC LIMIT 30'));
    $days = [];
    foreach ([0, 1] as $i) {
        $d = $batch->modify("+{$i} day");
        $days[] = RO_WEEKDAYS[(int) $d->format('N') - 1] . ' ' . format_date($d->format('Y-m-d'));
    }
    $focus = trim((string) social_settings()['focus']);
    return "Zilele postărilor: " . implode(' și ', $days) . ".\n\n"
        . "Clinicile:\n{$clinics}\nSite: " . absolute_url('/') . ', programare online: ' . absolute_url('/programare') . "\n"
        . 'Facebook: ' . content('site.facebookUrl') . ', Instagram: ' . content('site.instagramUrl') . "\n"
        . 'Motto: ' . content('site.tagline') . " Clinica are peste 15 ani.\n\n"
        . "Serviciile:\n{$services}\n\nMedicii: {$team}.\n\n"
        . ($focus !== '' ? "Ce vrea clinica să promoveze acum: {$focus}\n\n" : '')
        . "Fotografiile disponibile (alegeți una potrivită pentru fiecare postare):\n" . implode("\n", array_map(static fn ($u, $l) => "- {$u}: {$l}", array_keys($photos), $photos)) . "\n\n"
        . ($recent !== [] ? "Postările din ultima vreme (nu le repetați temele și titlurile):\n" . implode("\n", $recent) : 'Nu s-a postat încă nimic.');
}

function social_system_prompt(): string
{
    return <<<TXT
Sunteți responsabilul de social media al clinicii stomatologice Dental Arena (Cristești, lângă Târgu Mureș, și Luduș). Scrieți exact 3 postări pentru Facebook și Instagram (Meta), pentru două zile, în limba română, cu diacritice.

Pentru fiecare postare:
- theme: alegeți teme diferite între ele și față de postările recente.
- headline: titlul scris pe imagine, scurt și puternic (cel mult 7 cuvinte, fără hashtag, fără emoji).
- caption: textul postării, cald și profesionist, 450–900 de caractere, paragrafe scurte, 1–3 emoji potrivite (nu mai multe), un îndemn clar la final (programare online pe site sau telefonul clinicii). Poate fi o întrebare pentru comentarii.
- hashtags: 6–9 hashtag-uri, fără #, relevante și locale (de exemplu stomatologie, dentist, TarguMures, Ludus, Cristesti, zambetsanatos, DentalArena).
- photo: fotografia din listă cea mai potrivită subiectului; photo_note: de ce, sau ce fotografie proprie ar merge și mai bine (de exemplu un detaliu din cabinet).

Reguli (publicitate medicală):
- Fără promisiuni de rezultat, fără „garantat”, „fără durere 100%”, fără superlative absolute („cel mai bun”).
- Fără recenzii, citate sau povești de pacienți inventate; fără nume de pacienți; fără fotografii „înainte/după”.
- Prețuri doar dacă sunt date mai sus; altfel „prețurile sunt pe site”.
- Sfaturile de sănătate sunt generale și corecte, cu îndemnul de a veni la control; nu puneți diagnostice.
- Nu inventați oferte, reduceri sau evenimente care nu sunt date mai sus.
TXT;
}

/**
 * Writes the three posts of the two days from $batch, unless they have posts already.
 * @return array{ok:bool,error:?string,added:int}
 */
function social_generate(DateTimeImmutable $batch, ?int $userId = null): array
{
    if (!ai_ready()) {
        return ['ok' => false, 'error' => 'Asistentul AI nu este pornit: Setări → Asistentul AI (cheia Anthropic).', 'added' => 0];
    }
    $day = $batch->format('Y-m-d');
    if (db_value("SELECT 1 FROM social_posts WHERE batch_date = ? AND status <> 'renuntat'", [$day])) {
        return ['ok' => false, 'error' => 'Zilele acestea au deja postări.', 'added' => 0];
    }
    $photos = social_photos();
    $s = ai_settings();
    @set_time_limit(180);
    try {
        $message = ai_client()->messages->create(
            maxTokens: 8000,
            model: $s['model'],
            system: [['type' => 'text', 'text' => social_system_prompt(), 'cacheControl' => ['type' => 'ephemeral']]],
            messages: [['role' => 'user', 'content' => social_context($batch, $photos)]],
            outputConfig: ['effort' => 'medium', 'format' => ['type' => 'json_schema', 'schema' => social_schema($photos)]],
        );
    } catch (\Anthropic\Core\Exceptions\AuthenticationException $e) {
        return ['ok' => false, 'error' => 'Cheia API nu este acceptată de Anthropic (Setări → Asistentul AI).', 'added' => 0];
    } catch (Throwable $e) {
        app_log('error', 'social: ' . $e->getMessage());
        return ['ok' => false, 'error' => 'Asistentul AI nu a răspuns acum. Încercați din nou peste câteva minute.', 'added' => 0];
    }
    $data = null;
    foreach ($message->content as $block) {
        if ($block->type === 'text') {
            $data = json_decode($block->text, true);
        }
    }
    $posts = is_array($data['posts'] ?? null) ? array_slice($data['posts'], 0, 3) : [];
    if ($posts === [] || $message->stopReason === 'refusal') {
        return ['ok' => false, 'error' => 'Răspunsul AI nu a putut fi citit. Încercați din nou.', 'added' => 0];
    }
    foreach ($posts as $i => $p) {
        [$plus, $hm] = SOCIAL_SLOTS[$i] ?? SOCIAL_SLOTS[0];
        $tags = array_values(array_filter(array_map(static fn ($t) => preg_replace('/[^\p{L}\p{N}_]/u', '', (string) $t), (array) ($p['hashtags'] ?? []))));
        db_insert('social_posts', [
            'batch_date' => $day,
            'publish_at' => $batch->modify("+{$plus} day")->format('Y-m-d') . " {$hm}:00",
            'theme' => isset(SOCIAL_THEMES[$p['theme'] ?? '']) ? $p['theme'] : 'sfat',
            'headline' => mb_substr(trim((string) ($p['headline'] ?? '')), 0, 140),
            'caption' => trim((string) ($p['caption'] ?? '')),
            'hashtags' => mb_substr(implode(' ', array_map(static fn ($t) => '#' . $t, $tags)), 0, 400),
            'image' => isset($photos[$p['photo'] ?? '']) ? $p['photo'] : (array_key_first($photos) ?? null),
            'image_hint' => mb_substr(trim((string) ($p['photo_note'] ?? '')), 0, 255) ?: null,
            'created_by' => $userId, 'created_at' => now_sql(),
        ]);
    }
    audit('social-postari', count($posts) . ' postări pentru ' . format_date($day));
    return ['ok' => true, 'error' => null, 'added' => count($posts)];
}

/** Every day (cron.php or the panel): the next batch is written a day ahead, when „auto” is on. */
function social_auto(DateTimeImmutable $now): void
{
    if (!social_settings()['auto'] || !ai_ready()) {
        return;
    }
    // Written a day ahead: when the posts planned so far end today (or ended before).
    $next = social_next_batch($now);
    if ($next <= $now->setTime(0, 0)->modify('+1 day')) {
        social_generate($next);
    }
}
