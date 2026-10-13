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
            if (trim((string) ($r['legal_name'] ?? '')) !== '') {
                $c['company'] = ['legalName' => (string) $r['legal_name'], 'cui' => (string) $r['cui']];
            }
        }
        $cache[$slug] = $c;
    }
    return $cache;
}

/** The clinic's Facebook page (Setări → Site; until then the one in the content). */
function facebook_url(): string
{
    $url = trim((string) (setting('facebook')['url'] ?? ''));
    return $url !== '' ? $url : (string) content('site.facebookUrl');
}

/** The Facebook Page Plugin of the home page, or null when it is turned off. */
function facebook_posts_src(): ?string
{
    if (empty(setting('facebook')['show_posts'])) {
        return null;
    }
    return 'https://www.facebook.com/plugins/page.php?' . http_build_query([
        'href' => facebook_url(), 'tabs' => 'timeline', 'height' => 640, 'small_header' => 'true',
        'adapt_container_width' => 'true', 'hide_cover' => 'false', 'show_facepile' => 'false', 'locale' => 'ro_RO',
    ]);
}

/** „str. Principală 536J/1, Cristești, Mureș” */
function clinic_address(array $c): string
{
    return "{$c['street']}, {$c['city']}, {$c['county']}";
}

// ── Settings (key → JSON value) ───────────────────────────────────────────────

const SETTING_DEFAULTS = [
    'company' => ['legalName' => '', 'cui' => '', 'regCom' => '', 'registeredAddress' => '', 'bank' => '', 'iban' => ''],
    // The Facebook page: its posts on the home page (after consent) and the link in the footer.
    'facebook' => ['url' => '', 'show_posts' => true],
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

/**
 * The company that owns a clinic (each clinic is its own company: Cristești and Luduș). A clinic
 * without its own company data falls back to the company in Setări.
 *
 * @return array{legalName:string,cui:string,regCom:string,registeredAddress:string,bank:string,iban:string}
 */
function location_company(?int $locationId): array
{
    $c = array_merge(SETTING_DEFAULTS['company'], (array) setting('company'));
    $l = $locationId ? db_one('SELECT legal_name, cui, reg_com, registered_address, bank, iban FROM locations WHERE id = ?', [$locationId]) : null;
    if ($l === null || trim((string) $l['legal_name']) === '') {
        return $c;
    }
    return ['legalName' => (string) $l['legal_name'], 'cui' => (string) $l['cui'], 'regCom' => (string) $l['reg_com'], 'registeredAddress' => (string) $l['registered_address'], 'bank' => (string) $l['bank'], 'iban' => (string) $l['iban']];
}

/** Every clinic's company, in words, for the legal pages: „S.C. … S.R.L. (CUI …), pentru clinica din Cristești, și …”. */
function companies_text(): string
{
    $parts = [];
    try {
        foreach (db_all('SELECT id, short_name FROM locations ORDER BY sort_order, id') as $l) {
            $c = location_company((int) $l['id']);
            $missing = static fn (string $v) => trim($v) !== '' ? $v : '[de completat]';
            $parts[] = $missing($c['legalName']) . ' (CUI ' . $missing($c['cui']) . ($c['regCom'] !== '' ? ', Reg. Com. ' . $c['regCom'] : '') . ($c['registeredAddress'] !== '' ? ', sediul în ' . $c['registeredAddress'] : '') . '), pentru clinica din ' . $l['short_name'];
        }
    } catch (Throwable $e) {
        app_log('warning', 'companies_text: ' . $e->getMessage());
    }
    return $parts === [] ? '[de completat]' : (count($parts) > 1 ? implode(', ', array_slice($parts, 0, -1)) . ' și ' . end($parts) : $parts[0]);
}

/** The values the legal pages fill in ({{operatori}}, {{legalName}}, {{cui}}, …). */
function legal_values(): array
{
    // {{legalName}} and the rest: the company of the first clinic (the texts now use {{operatori}}).
    $first = INSTALLED ? db_value('SELECT id FROM locations ORDER BY sort_order, id LIMIT 1') : null;
    $c = location_company($first !== null ? (int) $first : null);
    $days = (string) setting('lead_retention_days');
    return [
        'operatori' => companies_text(),
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

/** The AI chat bubble on the site: switched on, with an API key (Panou → Setări → Chatul). */
function chat_on(): bool
{
    if (!INSTALLED) {
        return false;
    }
    try {
        $c = setting('chat');
        $ai = setting('ai');
        return is_array($c) && !empty($c['enabled']) && is_array($ai) && ($ai['api_key'] ?? '') !== '';
    } catch (Throwable $e) {
        return false;
    }
}
