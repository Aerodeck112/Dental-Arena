<?php
/**
 * Titles, descriptions, canonical URLs, Open Graph and schema.org data: the same rules as
 * src/server/public/seo.ts in the Next.js version, so the PHP site keeps its SEO score.
 */
declare(strict_types=1);

/**
 * @param array{title:string,description:string,path:string,image?:array,absoluteTitle?:bool,noindex?:bool} $p
 */
function page_meta(array $p): array
{
    $name = content('site.name');
    $absolute = !empty($p['absoluteTitle']) || str_contains($p['title'], $name);
    return [
        'title' => $absolute ? $p['title'] : "{$p['title']} | {$name}",
        'description' => $p['description'],
        'path' => $p['path'],
        'image' => $p['image'] ?? content('site.ogImage'),
        'noindex' => !empty($p['noindex']),
    ];
}

function render_head_meta(array $m): string
{
    $title = e($m['title']);
    $desc = e($m['description']);
    $url = e($m['path'] === '/' ? site_url() : absolute_url($m['path']));
    $img = $m['image'];
    $imgUrl = e(absolute_url($img['src']));
    $out = "<title>{$title}</title>\n"
        . "<meta name=\"description\" content=\"{$desc}\">\n"
        . "<meta name=\"application-name\" content=\"Dental Arena\">\n";
    if ($m['noindex'] || is_test_site()) {
        $out .= "<meta name=\"robots\" content=\"noindex, nofollow\">\n";
    }
    $out .= "<link rel=\"canonical\" href=\"{$url}\">\n"
        . "<meta name=\"format-detection\" content=\"telephone=no, address=no, email=no\">\n"
        . "<meta property=\"og:title\" content=\"{$title}\">\n"
        . "<meta property=\"og:description\" content=\"{$desc}\">\n"
        . "<meta property=\"og:url\" content=\"{$url}\">\n"
        . "<meta property=\"og:site_name\" content=\"Dental Arena\">\n"
        . "<meta property=\"og:locale\" content=\"ro_RO\">\n"
        . "<meta property=\"og:image\" content=\"{$imgUrl}\">\n"
        . '<meta property="og:image:width" content="' . e($img['width'] ?? '') . "\">\n"
        . '<meta property="og:image:height" content="' . e($img['height'] ?? '') . "\">\n"
        . '<meta property="og:image:alt" content="' . e($img['alt'] ?? '') . "\">\n"
        . "<meta property=\"og:type\" content=\"website\">\n"
        . "<meta name=\"twitter:card\" content=\"summary_large_image\">\n";
    return $out;
}

function json_ld(array|null ...$blocks): string
{
    $out = '';
    foreach ($blocks as $b) {
        if ($b === null || $b === []) {
            continue;
        }
        $json = json_encode($b, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);
        $out .= "<script type=\"application/ld+json\">{$json}</script>\n";
    }
    return $out;
}

function breadcrumb_ld(array $items): array
{
    $all = array_merge([['name' => 'Acasă', 'path' => '/']], $items);
    $list = [];
    foreach ($all as $i => $it) {
        $list[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $it['name'], 'item' => absolute_url($it['path'])];
    }
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $list];
}

function dentist_ld(array $c): array
{
    $base = site_url();
    $data = [
        '@context' => 'https://schema.org',
        '@type' => 'Dentist',
        '@id' => "{$base}/contact#{$c['slug']}",
        'name' => $c['name'],
        'url' => "{$base}/contact#{$c['slug']}",
        'telephone' => substr(tel_href($c['phone']), 4),
        'email' => $c['email'],
        'image' => $base . $c['photo']['src'],
        'address' => array_filter([
            '@type' => 'PostalAddress',
            'streetAddress' => $c['street'],
            'addressLocality' => $c['city'],
            'addressRegion' => $c['county'],
            'postalCode' => $c['postalCode'] ?: null,
            'addressCountry' => 'RO',
        ]),
        'hasMap' => $c['mapsLink'],
        'parentOrganization' => ['@type' => 'MedicalOrganization', 'name' => content('site.brandName'), 'url' => $base],
        'sameAs' => [content('site.facebookUrl'), content('site.instagramUrl')],
    ];
    if (!empty($c['area'])) {
        $data['areaServed'] = [['@type' => 'City', 'name' => 'Târgu Mureș'], ['@type' => 'City', 'name' => $c['city']]];
    }
    return $data;
}

/** @return list<array> the organisation and the website (home page). */
function organization_ld(): array
{
    $base = site_url();
    $first = array_values(clinics())[0];
    return [
        [
            '@context' => 'https://schema.org',
            '@type' => ['MedicalOrganization', 'Dentist'],
            '@id' => "{$base}/#organizatie",
            'name' => content('site.brandName'),
            'alternateName' => content('site.name'),
            'url' => "{$base}/",
            'logo' => "{$base}/brand/logo-dental-arena.png",
            'image' => $base . content('site.ogImage.src'),
            'email' => content('site.email'),
            'telephone' => substr(tel_href($first['phone']), 4),
            'medicalSpecialty' => 'Dentistry',
            'areaServed' => array_map(static fn ($n) => ['@type' => 'Place', 'name' => $n], ['Cristești', 'Luduș', 'Târgu Mureș', 'Județul Mureș']),
            'department' => array_map(static fn ($c) => ['@id' => "{$base}/contact#{$c['slug']}"], array_values(clinics())),
            'sameAs' => [content('site.facebookUrl'), content('site.instagramUrl')],
        ],
        [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            '@id' => "{$base}/#site",
            'name' => content('site.name'),
            'url' => "{$base}/",
            'inLanguage' => 'ro-RO',
            'publisher' => ['@id' => "{$base}/#organizatie"],
        ],
    ];
}

function service_ld(string $name, string $description, string $path, array $prices): array
{
    $base = site_url();
    $offers = [];
    foreach ($prices as $p) {
        if ($p['onRequest']) {
            continue;
        }
        $min = $p['min'] / 100;
        $max = $p['max'] !== null ? $p['max'] / 100 : $min;
        $offer = ['@type' => 'Offer', 'name' => $p['name'], 'priceCurrency' => 'RON'];
        if ($min === $max && !$p['from']) {
            $offer['price'] = $min;
        } else {
            $spec = ['@type' => 'PriceSpecification', 'priceCurrency' => 'RON', 'minPrice' => $min];
            if ($max > $min) {
                $spec['maxPrice'] = $max;
            }
            $offer['priceSpecification'] = $spec;
        }
        $offers[] = $offer;
    }
    $data = [
        '@context' => 'https://schema.org',
        '@type' => 'Service',
        '@id' => "{$base}{$path}#serviciu",
        'name' => $name,
        'serviceType' => $name,
        'description' => $description,
        'url' => absolute_url($path),
        'provider' => ['@id' => "{$base}/#organizatie"],
        'areaServed' => array_map(static fn ($n) => ['@type' => 'City', 'name' => $n], ['Cristești', 'Luduș', 'Târgu Mureș']),
    ];
    if ($offers !== []) {
        $data['hasOfferCatalog'] = ['@type' => 'OfferCatalog', 'name' => "Prețuri: {$name}", 'itemListElement' => $offers];
    }
    return $data;
}

function faq_ld(array $faqs): ?array
{
    if ($faqs === []) {
        return null;
    }
    return [
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => array_map(static fn ($f) => ['@type' => 'Question', 'name' => $f['question'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['answer']]], $faqs),
    ];
}

function physician_ld(array $d): array
{
    $base = site_url();
    return array_filter([
        '@context' => 'https://schema.org',
        '@type' => 'Person',
        '@id' => "{$base}/echipa/{$d['slug']}#medic",
        'name' => $d['publicName'],
        'jobTitle' => $d['roleLine'],
        'description' => $d['bio'],
        'url' => absolute_url("/echipa/{$d['slug']}"),
        'image' => $d['photoPath'] ? $base . $d['photoPath'] : null,
        'worksFor' => ['@id' => "{$base}/#organizatie"],
        'knowsAbout' => 'Stomatologie',
    ], static fn ($v) => $v !== null);
}
