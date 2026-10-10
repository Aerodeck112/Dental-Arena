<?php
/**
 * What the public pages read from the database: the price list, the team and the photos.
 * Everything the clinic changes in the panel shows on the site at the next page view.
 */
declare(strict_types=1);

/** One price row as the pages show it. */
function public_price(array $s): array
{
    $min = $s['price_min'] === null ? null : (int) $s['price_min'];
    return [
        'id' => (int) $s['id'],
        'name' => $s['name'],
        'price' => format_lei($min, (bool) $s['price_from'], $s['price_max'] === null ? null : (int) $s['price_max'], $s['unit']),
        'onRequest' => $min === null,
        'min' => $min,
        'max' => $s['price_max'] === null ? null : (int) $s['price_max'],
        'from' => (bool) $s['price_from'],
    ];
}

/**
 * The service categories with their visible prices, in the clinic's order.
 *
 * @return array<string,array{slug:string,name:string,summary:string,prices:list<array>,representative:?array}>
 */
function catalog(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $cache = [];
    foreach (db_all('SELECT * FROM categories ORDER BY sort_order, name') as $c) {
        $cache[$c['slug']] = ['id' => (int) $c['id'], 'slug' => $c['slug'], 'name' => $c['name'], 'summary' => $c['summary'], 'prices' => [], 'representative' => null];
    }
    $bySlugId = array_column($cache, 'slug', 'id');
    foreach (db_all('SELECT * FROM services WHERE public_visible = 1 ORDER BY sort_order, id') as $s) {
        $slug = $bySlugId[(int) $s['category_id']] ?? null;
        if ($slug === null) {
            continue;
        }
        $p = public_price($s);
        $cache[$slug]['prices'][] = $p;
        if ((int) $s['representative'] === 1 && $cache[$slug]['representative'] === null) {
            $cache[$slug]['representative'] = $p;
        }
    }
    // A category without a marked price shows its first priced row.
    foreach ($cache as &$c) {
        if ($c['representative'] === null) {
            foreach ($c['prices'] as $p) {
                if (!$p['onRequest']) {
                    $c['representative'] = $p;
                    break;
                }
            }
        }
    }
    unset($c);
    return $cache;
}

/** @return array<string,array> prices by service code (home page: children's prices, sedation). */
function prices_by_code(array $codes): array
{
    if ($codes === []) {
        return [];
    }
    $in = implode(',', array_fill(0, count($codes), '?'));
    $out = [];
    foreach (db_all("SELECT * FROM services WHERE public_visible = 1 AND code IN ({$in})", array_values($codes)) as $s) {
        $out[$s['code']] = public_price($s);
    }
    return $out;
}

function monogram_of(string $first, string $last): string
{
    return mb_strtoupper(mb_substr(trim($first), 0, 1) . mb_substr(trim($last), 0, 1));
}

function public_doctor(array $d): array
{
    $cats = db_all(
        'SELECT c.slug, c.name, dc.show_on_site FROM doctor_categories dc JOIN categories c ON c.id = dc.category_id WHERE dc.doctor_id = ? ORDER BY c.sort_order',
        [$d['id']],
    );
    return [
        'id' => (int) $d['id'],
        'slug' => $d['slug'],
        'firstName' => $d['first_name'],
        'lastName' => $d['last_name'],
        'publicName' => $d['public_name'],
        'roleLine' => $d['role_line'],
        'bio' => trim((string) $d['bio']) !== '' ? trim((string) $d['bio']) : null,
        'photoPath' => $d['photo_path'],
        'monogram' => trim((string) $d['monogram']) !== '' ? trim((string) $d['monogram']) : monogram_of($d['first_name'], $d['last_name']),
        'services' => array_map(static fn ($c) => ['slug' => $c['slug'], 'name' => $c['name'], 'showOnSite' => (bool) $c['show_on_site']], $cats),
    ];
}

/** @return list<array> the team, in the clinic's order. */
function public_doctors(): array
{
    static $cache = null;
    return $cache ??= array_map('public_doctor', db_all('SELECT * FROM doctors WHERE public_visible = 1 ORDER BY sort_order, last_name'));
}

function public_doctor_by_slug(string $slug): ?array
{
    foreach (public_doctors() as $d) {
        if ($d['slug'] === $slug) {
            return $d;
        }
    }
    return null;
}

/** „Cine vă tratează” on a service page: the doctors marked for it, else everyone who does it. */
function doctors_for_category(string $slug): array
{
    $all = array_values(array_filter(public_doctors(), static fn ($d) => in_array($slug, array_column($d['services'], 'slug'), true)));
    $shown = array_values(array_filter($all, static function ($d) use ($slug) {
        foreach ($d['services'] as $s) {
            if ($s['slug'] === $slug && $s['showOnSite']) {
                return true;
            }
        }
        return false;
    }));
    return $shown !== [] ? $shown : $all;
}

/**
 * The photo of a place on the site: the one uploaded in the panel, or the default.
 *
 * @return array{src:string,alt:string,width:int,height:int}
 */
function site_image(string $slot): array
{
    static $rows = null;
    if ($rows === null) {
        $rows = [];
        if (INSTALLED) {
            try {
                foreach (db_all('SELECT * FROM site_images') as $r) {
                    $rows[$r['slot']] = $r;
                }
            } catch (Throwable $e) {
                app_log('warning', 'site_image: ' . $e->getMessage());
            }
        }
    }
    $default = null;
    foreach (content('siteImageSlots') as $s) {
        if ($s['key'] === $slot) {
            $default = $s['default'];
        }
    }
    if ($default === null) {
        throw new InvalidArgumentException("Loc de fotografie necunoscut: {$slot}");
    }
    if (isset($rows[$slot])) {
        return ['src' => $rows[$slot]['path'], 'alt' => $default['alt'], 'width' => (int) $rows[$slot]['width'], 'height' => (int) $rows[$slot]['height']];
    }
    return $default;
}

/** A doctor's portrait as an image array, or null (monogram plate). */
function doctor_photo(array $d): ?array
{
    if (empty($d['photoPath'])) {
        return null;
    }
    $alt = "{$d['publicName']}, {$d['roleLine']}";
    $manifest = data_file('images');
    if (isset($manifest[$d['photoPath']])) {
        return ['src' => $d['photoPath'], 'alt' => $alt, 'width' => $manifest[$d['photoPath']]['width'], 'height' => $manifest[$d['photoPath']]['height']];
    }
    return ['src' => $d['photoPath'], 'alt' => $alt];
}
