<?php
/**
 * /admin/setari/ai (administrators): turn the AI consultation on, the Anthropic API key (stored
 * encrypted, never shown back), the model and how carefully it works, and a connection test.
 */
declare(strict_types=1);

$s = ai_settings();
$errors = [];
if (is_post()) {
    csrf_check();
    if (post('op') === 'test') {
        $r = ai_ready() || ($s['api_key'] !== '' && is_file(APP_DIR . '/vendor/autoload.php')) ? ai_ping() : ['ok' => false, 'error' => 'Salvați întâi cheia API.'];
        flash($r['ok'] ? 'Conexiunea merge (model ' . $r['model'] . ').' : 'Nu merge: ' . $r['error'], $r['ok'] ? 'succes' : 'eroare');
        redirect('/admin/setari/ai');
    }
    $s['enabled'] = post('enabled') === '1';
    $key = trim(post('api_key'));
    if ($key !== '') {
        if (!str_starts_with($key, 'sk-ant-')) {
            $errors['api_key'] = 'Cheia Anthropic începe cu sk-ant-.';
        } else {
            $s['api_key'] = secret_seal($key);
        }
    }
    $s['model'] = isset(AI_MODELS[post('model')]) ? post('model') : AI_DEFAULTS['model'];
    $s['effort'] = isset(AI_EFFORT[post('effort')]) ? post('effort') : AI_DEFAULTS['effort'];
    if ($s['enabled'] && $s['api_key'] === '') {
        $errors['api_key'] = 'Pentru a porni asistentul, scrieți cheia API.';
    }
    if ($errors === []) {
        setting_save('ai', $s);
        audit('setari-ai', $s['enabled'] ? 'pornit, ' . $s['model'] : 'oprit');
        flash('Setările asistentului AI au fost salvate.');
        redirect('/admin/setari/ai');
    }
}

$vendor = is_file(APP_DIR . '/vendor/autoload.php');
$body = '<p class="mb-4"><a href="/admin/setari" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Setări</a></p>'
    . admin_header('Asistentul AI', 'Medicul dictează consultația; AI-ul propune nota clinică, anamneza, constatările pe dinți și lucrările pentru plan. Nimic nu intră în fișă fără verificarea medicului.')
    . ($vendor ? '' : '<p class="mb-6 rounded-panou border-2 border-carmin bg-carmin-pal p-4 text-corp">Lipsește folderul dentalarena/vendor (biblioteca Anthropic). Încărcați din nou arhiva completă.</p>')
    . '<div class="grid max-w-5xl gap-8 lg:grid-cols-12"><div class="min-w-0 lg:col-span-7">'
    . '<form method="post" novalidate class="flex flex-col gap-5 rounded-panou border border-linie bg-suprafata p-6">' . csrf_field() . error_summary($errors)
    . checkbox_field('enabled', 'Asistentul AI este pornit', ['checked' => (bool) $s['enabled'], 'description' => 'Butonul „Consultație cu AI” apare în fișa pacientului pentru medici și administratori.'])
    . text_field('api_key', 'Cheia API Anthropic', ['type' => 'password', 'autocomplete' => 'new-password', 'error' => $errors['api_key'] ?? null, 'hint' => $s['api_key'] !== '' ? 'Salvată (criptat). Scrieți alta doar ca să o schimbați.' : 'Din console.anthropic.com → API Keys. Începe cu sk-ant-.'])
    . select_field('model', 'Modelul', AI_MODELS, ['value' => $s['model']])
    . select_field('effort', 'Cât de atent lucrează', AI_EFFORT, ['value' => $s['effort'], 'hint' => '„Atent” durează și costă mai mult; „Rapid” e bun pentru dictări scurte.'])
    . '<div class="flex flex-wrap gap-3"><button type="submit" class="' . e(btn('primary')) . '">Salvați</button></div></form>'
    . '<form method="post" class="mt-4">' . csrf_field() . '<input type="hidden" name="op" value="test"><button type="submit" class="' . e(btn('secondary')) . '">Testați conexiunea</button></form>'
    . '</div><div class="min-w-0 lg:col-span-5">'
    . admin_section_open('Date personale (GDPR)', 'gdpr')
    . '<ul class="mt-3 list-disc pl-5 text-corp">'
    . '<li>La Anthropic pleacă doar textul consultației, vârsta, sexul, alertele medicale și odontograma. Numele pacientului, CNP-ul și numerele de telefon sunt scoase din text.</li>'
    . '<li>Textul dictat e totuși o informație despre sănătate: acceptați termenii comerciali Anthropic (care includ acordul de prelucrare a datelor, DPA) și menționați furnizorul în Politica de confidențialitate.</li>'
    . '<li>Dictarea în browser (Chrome, Edge, Safari) trimite sunetul la serviciul de recunoaștere vocală al browserului (Google sau Apple). Spuneți-i pacientului când înregistrați discuția.</li>'
    . '</ul></section>'
    . admin_section_open('Cost', 'cost') . '<p class="mt-3 text-corp">O consultație obișnuită folosește câteva mii de tokeni: de regulă câțiva cenți pe analiză. Consumul se vede în console.anthropic.com.</p></section>'
    . '</div></div>';
admin_page('Asistentul AI', $body, $user);
