<?php
/**
 * The AI consultation: the doctor dictates (or the consultation is transcribed in the browser),
 * Claude turns the text into proposals: a clinical note, the medical history (allergies,
 * medications, conditions), tooth findings and treatment-plan lines matched to the price list.
 * Nothing is saved until the doctor reviews and ticks what to keep.
 *
 * Privacy: the patient's name, CNP-like and phone-like numbers are removed from the text before
 * it leaves the server; only the age, sex, current alerts and tooth findings go with it. The API
 * key is stored encrypted. Uses the official Anthropic PHP SDK (dentalarena/vendor).
 */
declare(strict_types=1);

const AI_DEFAULTS = ['enabled' => false, 'api_key' => '', 'model' => 'claude-opus-5-5', 'effort' => 'medium'];
const AI_MODELS = ['claude-opus-5-5' => 'Claude Opus 5.5 (recomandat)', 'claude-sonnet-5-5' => 'Claude Sonnet 5.5 (mai ieftin)'];
const AI_EFFORT = ['low' => 'Rapid', 'medium' => 'Echilibrat (recomandat)', 'high' => 'Atent'];

function ai_settings(): array
{
    $s = setting('ai');
    return array_merge(AI_DEFAULTS, is_array($s) ? $s : []);
}

function ai_ready(): bool
{
    $s = ai_settings();
    return $s['enabled'] && $s['api_key'] !== '' && is_file(APP_DIR . '/vendor/autoload.php');
}

function ai_client(): \Anthropic\Client
{
    require_once APP_DIR . '/vendor/autoload.php';
    return new \Anthropic\Client(
        apiKey: secret_open(ai_settings()['api_key']),
        requestOptions: ['timeout' => 120.0, 'maxRetries' => 1],
    );
}

/** The answer's shape: Claude must return exactly this JSON. */
function ai_schema(): array
{
    $nullable = static fn (array $t) => ['anyOf' => [$t, ['type' => 'null']]];
    return [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['rezumat', 'anamneza', 'constatari', 'plan', 'recomandari', 'de_verificat'],
        'properties' => [
            'rezumat' => ['type' => 'string', 'description' => 'Nota clinică a consultației, în română: motivul prezentării, examinarea, diagnosticul, ce s-a făcut.'],
            'anamneza' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['alergii', 'medicamente', 'afectiuni', 'alte_afectiuni'],
                'properties' => [
                    'alergii' => $nullable(['type' => 'string']),
                    'medicamente' => $nullable(['type' => 'string']),
                    'afectiuni' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => array_keys(HISTORY_FLAGS)]],
                    'alte_afectiuni' => $nullable(['type' => 'string']),
                ],
            ],
            'constatari' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['dinte', 'tip', 'suprafete', 'nota'],
                    'properties' => [
                        'dinte' => ['type' => 'integer', 'description' => 'Numărul FDI, de exemplu 36 sau 75.'],
                        'tip' => ['type' => 'string', 'enum' => array_keys(TOOTH_KINDS)],
                        'suprafete' => $nullable(['type' => 'string', 'description' => 'Literele M, O, D, V, L, de exemplu „MO”.']),
                        'nota' => $nullable(['type' => 'string']),
                    ],
                ],
            ],
            'plan' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['dinte', 'serviciu_id', 'descriere', 'faza'],
                    'properties' => [
                        'dinte' => $nullable(['type' => 'integer']),
                        'serviciu_id' => $nullable(['type' => 'integer', 'description' => 'ID-ul din lista de prețuri, doar dacă se potrivește clar.']),
                        'descriere' => ['type' => 'string'],
                        'faza' => ['type' => 'integer', 'description' => '1 pentru urgențe și igienizare, apoi în ordinea tratamentului.'],
                    ],
                ],
            ],
            'recomandari' => $nullable(['type' => 'string', 'description' => 'Recomandările pentru pacient, pe înțelesul lui.']),
            'de_verificat' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Ce lipsește sau e neclar și ar trebui întrebat ori verificat.'],
        ],
    ];
}

/** The instructions and the price list (stable, so the API can cache them between calls). */
function ai_system_prompt(): string
{
    $catalog = implode("\n", array_map(static fn ($s) => $s['id'] . ' | ' . $s['category'] . ' | ' . $s['name'], service_catalog()));
    $flags = implode(', ', array_map(static fn ($k, $v) => "{$k} = {$v}", array_keys(HISTORY_FLAGS), HISTORY_FLAGS));
    $kinds = implode(', ', array_map(static fn ($k, $v) => "{$k} = {$v}", array_keys(TOOTH_KINDS), TOOTH_KINDS));
    return <<<TXT
Ești asistentul unui medic stomatolog dintr-o clinică din România. Primești textul unei consultații: dictarea medicului sau transcrierea discuției dintre medic și pacient, în română, uneori cu greșeli de recunoaștere vocală. Numele pacientului a fost înlocuit cu „[pacient]”.

Din text, completezi propuneri pe care medicul le verifică înainte să intre în fișă:
- rezumat: nota clinică, scurtă și profesională, în română (motivul prezentării, ce s-a constatat, diagnosticul, ce s-a făcut azi).
- anamneza: doar ce spune textul despre alergii, medicamente și afecțiuni generale. Afecțiunile se aleg din lista: {$flags}. Ce nu e în listă merge la alte_afectiuni. Dacă textul nu spune nimic, lași null sau lista goală.
- constatari: ce s-a găsit sau s-a făcut pe fiecare dinte, cu numerotarea FDI (11–48, dinții temporari 51–85). Tipurile: {$kinds}. Suprafețele cu literele M (mezial), O (ocluzal/incizal), D (distal), V (vestibular), L (oral). Dacă medicul spune „6 jos stânga”, acesta este 36; „6 sus dreapta” este 16.
- plan: lucrările propuse pentru mai departe, în ordinea în care se fac (faza 1, 2, …). Pune serviciu_id doar când lucrarea se potrivește clar cu un rând din lista de prețuri de mai jos; altfel null și o descriere clară.
- recomandari: indicațiile pentru pacient, pe înțelesul lui, dacă există în text.
- de_verificat: ce e neclar, contradictoriu sau lipsește (de exemplu un dinte numit ambiguu, o alergie pomenită fără substanță).

Reguli: nu inventa nimic ce nu reiese din text; dacă nu ești sigur, pune la de_verificat. Nu pune diagnostice pe care medicul nu le-a spus. Scrie totul în română, cu diacritice.

Lista de prețuri (id | categorie | serviciu):
{$catalog}
TXT;
}

/** The text without the patient's name, CNP-like or phone-like numbers. */
function ai_pseudonymize(string $text, array $p): string
{
    foreach ([$p['first_name'], $p['last_name']] as $name) {
        foreach (preg_split('/[\s-]+/u', (string) $name) ?: [] as $part) {
            if (mb_strlen($part) >= 3) {
                $text = (string) preg_replace('/\b' . preg_quote($part, '/') . '\b/iu', '[pacient]', $text);
            }
        }
    }
    $text = (string) preg_replace('/\b[1-9]\d{12}\b/', '[număr]', $text);
    return (string) preg_replace('/(?:\+?40|0)\s?7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/', '[telefon]', $text);
}

/**
 * Sends the consultation to Claude and returns the proposals.
 *
 * @return array{ok:bool,data:?array,error:?string,input_tokens:?int,output_tokens:?int,model:?string}
 */
function ai_analyze(string $transcript, array $p): array
{
    $s = ai_settings();
    $age = $p['birth_date'] ? (new DateTimeImmutable($p['birth_date']))->diff(new DateTimeImmutable())->y : null;
    $teeth = db_all('SELECT tooth, kind, surfaces FROM tooth_conditions WHERE patient_id = ? AND resolved_at IS NULL ORDER BY tooth', [(int) $p['id']]);
    $context = "Pacient: " . ($age !== null ? "{$age} ani" : 'vârsta necunoscută') . ', ' . ($p['sex'] === 'F' ? 'femeie' : ($p['sex'] === 'M' ? 'bărbat' : 'sex nespecificat')) . ".\n"
        . 'Alerte deja în fișă: ' . (implode('; ', medical_alerts((int) $p['id'])) ?: 'niciuna') . ".\n"
        . 'Odontograma de acum: ' . (implode('; ', array_map(static fn ($t) => $t['tooth'] . ' ' . (TOOTH_KINDS[$t['kind']] ?? $t['kind']) . ($t['surfaces'] ? ' ' . $t['surfaces'] : ''), $teeth)) ?: 'nimic notat') . ".\n\n"
        . "Textul consultației:\n" . ai_pseudonymize($transcript, $p);
    @set_time_limit(180);
    try {
        $message = ai_client()->beta->messages->create(
            maxTokens: 16000,
            model: $s['model'],
            system: [['type' => 'text', 'text' => ai_system_prompt(), 'cacheControl' => ['type' => 'ephemeral']]],
            messages: [['role' => 'user', 'content' => $context]],
            outputConfig: ['effort' => $s['effort'], 'format' => ['type' => 'json_schema', 'schema' => ai_schema()]],
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );
    } catch (\Anthropic\Core\Exceptions\AuthenticationException $e) {
        return ai_failure('Cheia API nu este acceptată de Anthropic. Verificați-o în Setări → Asistentul AI.');
    } catch (\Anthropic\Core\Exceptions\PermissionDeniedException $e) {
        return ai_failure('Contul Anthropic nu are acces la acest model.');
    } catch (\Anthropic\Core\Exceptions\RateLimitException $e) {
        return ai_failure('Prea multe cereri către AI în acest moment. Încercați din nou peste un minut.');
    } catch (\Anthropic\Core\Exceptions\BadRequestException $e) {
        app_log('error', 'AI 400: ' . $e->getMessage());
        return ai_failure('Cererea către AI nu a fost acceptată. Detaliile sunt în jurnalul serverului.');
    } catch (\Anthropic\Core\Exceptions\APIStatusException $e) {
        app_log('error', 'AI: ' . $e->getMessage());
        return ai_failure('Serviciul AI nu răspunde acum. Încercați din nou puțin mai târziu.');
    } catch (\Anthropic\Core\Exceptions\APIConnectionException $e) {
        app_log('error', 'AI conexiune: ' . $e->getMessage());
        return ai_failure('Serverul nu se poate conecta la serviciul AI. Verificați conexiunea la internet a găzduirii.');
    }
    $usage = ['input_tokens' => $message->usage->inputTokens, 'output_tokens' => $message->usage->outputTokens, 'model' => $message->model];
    if ($message->stopReason === 'refusal') {
        return ai_failure('Asistentul AI nu a putut analiza acest text.') + $usage;
    }
    if ($message->stopReason === 'max_tokens') {
        return ai_failure('Textul este prea lung pentru o singură analiză. Împărțiți-l în două.') + $usage;
    }
    foreach ($message->content as $block) {
        if ($block->type === 'text') {
            $data = json_decode($block->text, true);
            if (is_array($data)) {
                return ['ok' => true, 'data' => $data, 'error' => null] + $usage;
            }
        }
    }
    return ai_failure('Răspunsul AI nu a putut fi citit. Încercați din nou.') + $usage;
}

function ai_failure(string $msg): array
{
    return ['ok' => false, 'data' => null, 'error' => $msg, 'input_tokens' => null, 'output_tokens' => null, 'model' => null];
}

/** A short call that checks the key and the model (Setări → Asistentul AI). */
function ai_ping(): array
{
    try {
        $message = ai_client()->messages->create(
            maxTokens: 64,
            model: ai_settings()['model'],
            messages: [['role' => 'user', 'content' => 'Răspunde doar cu: gata']],
            outputConfig: ['effort' => 'low'],
        );
        return ['ok' => true, 'model' => $message->model];
    } catch (\Anthropic\Core\Exceptions\AuthenticationException $e) {
        return ['ok' => false, 'error' => 'Cheia API nu este acceptată.'];
    } catch (\Anthropic\Core\Exceptions\APIStatusException $e) {
        return ['ok' => false, 'error' => 'Anthropic a răspuns cu o eroare: ' . mb_substr($e->getMessage(), 0, 160)];
    } catch (\Anthropic\Core\Exceptions\APIConnectionException $e) {
        return ['ok' => false, 'error' => 'Serverul nu se poate conecta la api.anthropic.com.'];
    }
}
