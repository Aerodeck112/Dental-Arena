<?php
/**
 * The site's texts (data/content.json, exported from src/content) and the facts the clinic edits in
 * the panel (clinics, company data, photos), merged in one place for the templates.
 */
declare(strict_types=1);

/** A value from content.json by dot path, e.g. content('home.hero.lead'). */
function content(string $path = ''): mixed
{
    $node = data_file('content');
    if ($path === '') {
        return $node;
    }
    foreach (explode('.', $path) as $key) {
        if (!is_array($node) || !array_key_exists($key, $node)) {
            return null;
        }
        $node = $node[$key];
    }
    return $node;
}

/** @return array<string,mixed>|null the text of one service page. */
function service_content(string $slug): ?array
{
    foreach (content('services') as $s) {
        if ($s['slug'] === $slug) {
            return $s;
        }
    }
    return null;
}

/** @return list<string> */
function service_slugs(): array
{
    return array_column(content('services'), 'slug');
}

/**
 * The two clinics: the texts of content.json (photo, map links) with the address, phone, e-mail and
 * hours the clinic keeps up to date in the panel (Setări → Clinici).
 *
 * @return array<string,array<string,mixed>> by slug, Cristești first
 */
function clinics(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $base = content('clinics');
    $rows = [];
    if (INSTALLED) {
        try {
            foreach (db_all('SELECT * FROM locations ORDER BY sort_order') as $r) {
                $rows[$r['slug']] = $r;
            }
        } catch (Throwable $e) {
            app_log('warning', 'clinics(): ' . $e->getMessage());
        }
    }
    $cache = [];
    foreach (content('clinicOrder') as $slug) {
        $c = $base[$slug];
        $c['email'] = content('site.email');
        $c['hoursText'] = null;
        $c['id'] = null;
        if (isset($rows[$slug])) {
            $r = $rows[$slug];
            $c['id'] = (int) $r['id'];
            $c['name'] = $r['name'];
            $c['shortName'] = $r['short_name'];
            $c['street'] = $r['street'];
            $c['city'] = $r['city'];
            $c['county'] = $r['county'];
            $c['postalCode'] = $r['postal_code'];
            $c['phone'] = $r['phone'];
            $c['email'] = $r['email'] !== '' ? $r['email'] : $c['email'];
            $c['hoursText'] = ((int) $r['publish_hours'] === 1 && trim((string) $r['hours_text']) !== '') ? trim((string) $r['hours_text']) : null;
        }
        $cache[$slug] = $c;
    }
    return $cache;
}

/** „str. Principală 536J/1, Cristești, Mureș” */
function clinic_address(array $c): string
{
    return "{$c['street']}, {$c['city']}, {$c['county']}";
}

// ── Settings (key → JSON value) ───────────────────────────────────────────────

const SETTING_DEFAULTS = [
    'company' => ['legalName' => '', 'cui' => '', 'regCom' => '', 'registeredAddress' => '', 'bank' => '', 'iban' => ''],
    'notify_email' => 'office@dentalarena.ro',
    'lead_retention_days' => 365,
    'invoicing' => [
        'invoiceSeries' => 'DA',
        'receiptSeries' => 'DAC',
        'vatRate' => 0,
        'vatNote' => 'Scutit de TVA conform art. 292 din Codul fiscal.',
        'paymentTermDays' => 0,
    ],
    // Texts of the consent forms printed from the patient's file (null = the default in clinical.php).
    'consent_texts' => [],
];

function setting(string $key): mixed
{
    static $cache = [];
    if (!array_key_exists($key, $cache)) {
        $value = null;
        if (INSTALLED) {
            try {
                $raw = db_value('SELECT v FROM settings WHERE k = ?', [$key]);
                $value = $raw === null ? null : json_decode((string) $raw, true);
            } catch (Throwable $e) {
                app_log('warning', "setting({$key}): " . $e->getMessage());
            }
        }
        $default = SETTING_DEFAULTS[$key] ?? null;
        $cache[$key] = is_array($default) && is_array($value) ? array_merge($default, $value) : ($value ?? $default);
    }
    return $cache[$key];
}

function setting_save(string $key, mixed $value): void
{
    db_run('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
}

/** The values the legal pages fill in ({{legalName}}, {{cui}}, …). */
function legal_values(): array
{
    $c = setting('company');
    $days = (string) setting('lead_retention_days');
    return [
        'legalName' => $c['legalName'],
        'cui' => $c['cui'],
        'regCom' => $c['regCom'],
        'registeredAddress' => $c['registeredAddress'],
        'email' => content('site.email'),
        'dpoEmail' => content('site.email'),
        'leadRetentionDays' => $days,
        'messageBodyRetentionDays' => $days,
        'cancelCutoffHours' => '24',
        'consentTextVersion' => '2026-10',
    ];
}

/** Replaces {{token}}; an empty or unknown value reads „[de completat]”. */
function fill_legal(string $text, array $values): string
{
    return preg_replace_callback('/\{\{(\w+)\}\}/', static function (array $m) use ($values): string {
        $v = $values[$m[1]] ?? '';
        return trim((string) $v) !== '' ? (string) $v : '[de completat]';
    }, $text) ?? $text;
}
