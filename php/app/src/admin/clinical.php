<?php
/**
 * Stage 3, the patient's file beyond the basics: treatment plans, the odontogram, documents,
 * consents, data-protection rights (export, anonymisation) and the tabs of the file.
 */
declare(strict_types=1);

// ── Treatment plans ──────────────────────────────────────────────────────────

const PLAN_STATUS = ['ciorna' => 'Ciornă', 'prezentat' => 'Prezentat', 'acceptat' => 'Acceptat', 'in-curs' => 'În curs', 'finalizat' => 'Finalizat', 'respins' => 'Respins', 'anulat' => 'Anulat'];
/** Ciornă → Prezentat → Acceptat → În curs → Finalizat, with Respins and Anulat on the side. */
const PLAN_TRANSITIONS = [
    'ciorna' => ['prezentat', 'anulat'],
    'prezentat' => ['acceptat', 'respins', 'ciorna', 'anulat'],
    'acceptat' => ['in-curs', 'anulat'],
    'in-curs' => ['finalizat', 'anulat'],
    'finalizat' => [],
    'respins' => ['ciorna'],
    'anulat' => [],
];
const PLAN_ACTION = [
    'ciorna' => 'Readuceți la ciornă',
    'prezentat' => 'L-am prezentat pacientului',
    'acceptat' => 'Pacientul a acceptat',
    'in-curs' => 'Începem tratamentul',
    'finalizat' => 'Finalizați planul',
    'respins' => 'Pacientul a refuzat',
    'anulat' => 'Anulați planul',
];
const ITEM_STATUS = ['propus' => 'Propus', 'acceptat' => 'Acceptat', 'programat' => 'Programat', 'efectuat' => 'Efectuat', 'anulat' => 'Anulat'];
const ITEM_TRANSITIONS = [
    'propus' => ['acceptat', 'programat', 'efectuat', 'anulat'],
    'acceptat' => ['programat', 'efectuat', 'anulat', 'propus'],
    'programat' => ['efectuat', 'acceptat', 'anulat'],
    'efectuat' => [],
    'anulat' => ['propus'],
];

/** Prices and lines change only before the patient accepts; new lines until the plan closes. */
function plan_prices_editable(string $status): bool
{
    return in_array($status, ['ciorna', 'prezentat'], true);
}

function plan_open(string $status): bool
{
    return in_array($status, ['ciorna', 'prezentat', 'acceptat', 'in-curs'], true);
}

/** @return array{subtotal:int,line_discounts:int,plan_discount:int,total:int,done:int,count:int,done_count:int} */
function plan_totals(array $items, int $planDiscount): array
{
    $t = ['subtotal' => 0, 'line_discounts' => 0, 'plan_discount' => 0, 'total' => 0, 'done' => 0, 'count' => 0, 'done_count' => 0];
    $active = 0;
    foreach ($items as $it) {
        if ($it['status'] === 'anulat') {
            continue;
        }
        $gross = (int) $it['quantity'] * (int) $it['unit_price'];
        $disc = min((int) $it['discount'], $gross);
        $t['subtotal'] += $gross;
        $t['line_discounts'] += $disc;
        $active += $gross - $disc;
        $t['count']++;
        if ($it['status'] === 'efectuat') {
            $t['done'] += $gross - $disc;
            $t['done_count']++;
        }
    }
    $t['plan_discount'] = max(0, min($planDiscount, $active));
    $t['total'] = $active - $t['plan_discount'];
    return $t;
}

function plan_status_chip(string $s): string
{
    $cls = match ($s) {
        'ciorna' => 'border border-dashed border-linie-control text-discret',
        'prezentat' => 'bg-mustar-pal text-mustar-text',
        'acceptat', 'in-curs' => 'bg-menta-pal text-cerneala',
        'finalizat' => 'bg-adancit text-cerneala',
        default => 'bg-adancit text-discret line-through',
    };
    return '<span class="' . e(cn('inline-flex items-center whitespace-nowrap rounded-chip px-2.5 py-0.5 text-mic font-medium', $cls)) . '">' . e(PLAN_STATUS[$s] ?? $s) . '</span>';
}

function item_status_chip(string $s): string
{
    $cls = match ($s) {
        'efectuat' => 'bg-menta-pal text-cerneala',
        'programat' => 'border border-actiune text-actiune',
        'acceptat' => 'bg-adancit text-cerneala',
        'anulat' => 'bg-adancit text-discret line-through',
        default => 'border border-dashed border-linie-control text-discret',
    };
    return '<span class="' . e(cn('inline-flex items-center whitespace-nowrap rounded-chip px-2 py-0.5 text-mic font-medium', $cls)) . '">' . e(ITEM_STATUS[$s] ?? $s) . '</span>';
}

/** The services of the price list, grouped by category, for the selects of plans and invoices. */
function service_catalog(): array
{
    static $rows = null;
    return $rows ??= db_all('SELECT s.id, s.name, s.code, s.price_min, s.price_max, s.unit, c.name AS category FROM services s JOIN categories c ON c.id = s.category_id ORDER BY c.sort_order, s.sort_order, s.id');
}

/** A <select> of services with <optgroup> per category; each option carries its price (data-pret). */
function service_select(string $name, string $label, ?int $value, array $o = []): string
{
    $id = $o['id'] ?? "field-{$name}";
    $groups = [];
    foreach (service_catalog() as $s) {
        $groups[$s['category']][] = $s;
    }
    $html = '<option value="">' . e($o['empty'] ?? 'Alegeți din lista de prețuri') . '</option>';
    foreach ($groups as $cat => $list) {
        $html .= '<optgroup label="' . e($cat) . '">';
        foreach ($list as $s) {
            $price = $s['price_min'] !== null ? (int) $s['price_min'] : null;
            $html .= '<option value="' . (int) $s['id'] . '" data-pret="' . e(lei_input($price)) . '" data-denumire="' . e($s['name']) . '"' . ((int) $s['id'] === $value ? ' selected' : '') . '>'
                . e($s['name'] . ($price !== null ? ' · ' . format_amount($price) . ' lei' : '')) . '</option>';
        }
        $html .= '</optgroup>';
    }
    return '<div class="' . e(cn('flex flex-col gap-1.5', $o['class'] ?? '')) . '">' . field_label($id, $label, !empty($o['optional']))
        . '<span class="relative block"><select id="' . e($id) . '" name="' . e($name) . '" data-serviciu' . (isset($o['target']) ? ' data-pret-in="' . e($o['target']) . '"' : '') . (isset($o['nameTarget']) ? ' data-denumire-in="' . e($o['nameTarget']) . '"' : '')
        . ' class="' . e(input_classes('h-control cursor-pointer appearance-none pr-11')) . '">' . $html . '</select>'
        . icon('chevron-down', 20, 'pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-discret') . '</span></div>';
}

function find_plan(int $planId, int $patientId): ?array
{
    return db_one('SELECT * FROM treatment_plans WHERE id = ? AND patient_id = ?', [$planId, $patientId]);
}

function plan_items(int $planId): array
{
    return db_all('SELECT i.*, s.code AS service_code FROM treatment_plan_items i LEFT JOIN services s ON s.id = i.service_id WHERE i.plan_id = ? ORDER BY i.phase, i.sort_order, i.id', [$planId]);
}

/** The plan line ids already on an issued invoice. */
function invoiced_item_ids(int $planId): array
{
    return array_map('intval', array_column(db_all(
        "SELECT ii.plan_item_id FROM invoice_items ii JOIN invoices v ON v.id = ii.invoice_id JOIN treatment_plan_items i ON i.id = ii.plan_item_id
         WHERE v.status = 'emisa' AND i.plan_id = ?",
        [$planId],
    ), 'plan_item_id'));
}

// ── The odontogram (FDI numbering) ───────────────────────────────────────────

const TOOTH_KINDS = [
    'carie' => 'Carie',
    'obturatie' => 'Obturație',
    'endodontie' => 'Tratament de canal',
    'coroana' => 'Coroană',
    'punte' => 'Element de punte',
    'implant' => 'Implant',
    'extras' => 'Extras',
    'lipsa' => 'Lipsă',
    'fractura' => 'Fractură',
    'radacina' => 'Rădăcină restantă',
    'fateta' => 'Fațetă',
    'sigilare' => 'Sigilare',
    'mobilitate' => 'Mobilitate',
    'parodontopatie' => 'Parodontopatie',
    'proteza' => 'Proteză',
    'inclus' => 'Dinte inclus',
    'alta' => 'Altă constatare',
];
const TOOTH_LETTER = [
    'carie' => 'C', 'obturatie' => 'O', 'endodontie' => 'E', 'coroana' => 'Cr', 'punte' => 'Pt', 'implant' => 'I', 'extras' => 'X', 'lipsa' => 'L',
    'fractura' => 'F', 'radacina' => 'R', 'fateta' => 'Ft', 'sigilare' => 'S', 'mobilitate' => 'M', 'parodontopatie' => 'P', 'proteza' => 'Pr', 'inclus' => 'In', 'alta' => '?',
];
/** Findings that describe the whole tooth and replace each other. */
const WHOLE_TOOTH = ['extras', 'lipsa', 'implant', 'radacina', 'inclus'];
/** Findings drawn on the surfaces they touch. */
const SURFACE_KINDS = ['carie', 'obturatie', 'fractura', 'sigilare', 'fateta'];
const SURFACES = ['M' => 'Mezial', 'O' => 'Ocluzal / incizal', 'D' => 'Distal', 'V' => 'Vestibular', 'L' => 'Oral (lingual / palatinal)'];
const PERMANENT_ROWS = [[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]];
const DECIDUOUS_ROWS = [[55, 54, 53, 52, 51, 61, 62, 63, 64, 65], [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]];

function is_fdi_tooth(int $t): bool
{
    $q = intdiv($t, 10);
    $n = $t % 10;
    return ($q >= 1 && $q <= 4 && $n >= 1 && $n <= 8) || ($q >= 5 && $q <= 8 && $n >= 1 && $n <= 5);
}

/** „MOD” in the canonical order, only valid letters. */
function canonical_surfaces(string $s): string
{
    $out = '';
    foreach (array_keys(SURFACES) as $k) {
        if (str_contains(strtoupper($s), $k)) {
            $out .= $k;
        }
    }
    return $out;
}

/**
 * The active findings a new one replaces: with $replaceAll every finding of the tooth; otherwise
 * the same finding on overlapping surfaces and the other whole-tooth states.
 */
function superseded_ids(array $active, int $tooth, string $kind, ?string $surfaces, bool $replaceAll): array
{
    $out = [];
    foreach ($active as $r) {
        if ((int) $r['tooth'] !== $tooth) {
            continue;
        }
        $hit = $replaceAll
            || (in_array($kind, WHOLE_TOOTH, true) && in_array($r['kind'], WHOLE_TOOTH, true))
            || ($r['kind'] === $kind && (!$r['surfaces'] || !$surfaces || array_intersect(str_split($surfaces), str_split($r['surfaces'])) !== []));
        if ($hit) {
            $out[] = (int) $r['id'];
        }
    }
    return $out;
}

function tooth_surface_fill(string $kind): string
{
    return match ($kind) {
        'carie', 'fractura' => 'fill-carmin',
        'obturatie', 'fateta' => 'fill-actiune',
        'sigilare' => 'fill-menta',
        default => 'fill-suprafata',
    };
}

/** One tooth as SVG: five surfaces, the number, the letters of its findings; a link to select it. */
function tooth_svg(int $tooth, array $rows, float $x, float $y, bool $selected, string $href): string
{
    $s = 40;
    $q = intdiv($tooth, 10);
    $upper = in_array($q, [1, 2, 5, 6], true);
    $mesialRight = in_array($q, [1, 4, 5, 8], true);
    $fills = ['M' => 'fill-suprafata', 'O' => 'fill-suprafata', 'D' => 'fill-suprafata', 'V' => 'fill-suprafata', 'L' => 'fill-suprafata'];
    $letters = [];
    $gone = false;
    $crown = false;
    foreach ($rows as $r) {
        $letters[] = TOOTH_LETTER[$r['kind']] ?? '?';
        if (in_array($r['kind'], SURFACE_KINDS, true)) {
            foreach (str_split($r['surfaces'] ?: 'O') as $sf) {
                if (isset($fills[$sf]) && ($fills[$sf] === 'fill-suprafata' || $r['kind'] === 'carie')) {
                    $fills[$sf] = tooth_surface_fill($r['kind']);
                }
            }
        }
        $gone = $gone || in_array($r['kind'], ['extras', 'lipsa'], true);
        $crown = $crown || in_array($r['kind'], ['coroana', 'punte', 'implant'], true);
    }
    $top = $upper ? 'V' : 'L';
    $bottom = $upper ? 'L' : 'V';
    $left = $mesialRight ? 'D' : 'M';
    $right = $mesialRight ? 'M' : 'D';
    $p = static fn (array $pts) => implode(' ', array_map(static fn ($pt) => round($x + $pt[0], 1) . ',' . round($y + $pt[1], 1), $pts));
    $a = 12;
    $b = 28;
    $poly = static fn (string $sf, array $pts) => '<polygon points="' . $p($pts) . '" class="' . $fills[$sf] . ' stroke-linie-control" stroke-width="1"/>';
    $label = 'Dintele ' . $tooth . ': ' . ($rows === [] ? 'nimic notat' : implode(', ', array_map(static fn ($r) => (TOOTH_KINDS[$r['kind']] ?? $r['kind']) . ($r['surfaces'] ? ' ' . $r['surfaces'] : ''), $rows)));
    $numY = $upper ? $y - 8 : $y + $s + 16;
    $letY = $upper ? $y + $s + 15 : $y - 6;
    $svg = '<a href="' . e($href) . '" aria-label="' . e($label) . '"' . ($selected ? ' aria-current="true"' : '') . ' class="dinte">'
        . '<title>' . e($label) . '</title>'
        . '<rect x="' . ($x - 4) . '" y="' . ($y - 22) . '" width="' . ($s + 8) . '" height="' . ($s + 44) . '" rx="6" class="' . ($selected ? 'fill-menta-pal stroke-actiune' : 'fill-transparent stroke-transparent') . '" stroke-width="2"/>'
        . '<g' . ($gone ? ' opacity="0.35"' : '') . '>'
        . $poly($top, [[0, 0], [$s, 0], [$b, $a], [$a, $a]])
        . $poly($bottom, [[0, $s], [$s, $s], [$b, $b], [$a, $b]])
        . $poly($left, [[0, 0], [$a, $a], [$a, $b], [0, $s]])
        . $poly($right, [[$s, 0], [$b, $a], [$b, $b], [$s, $s]])
        . '<rect x="' . ($x + $a) . '" y="' . ($y + $a) . '" width="16" height="16" class="' . $fills['O'] . ' stroke-linie-control" stroke-width="1"/>'
        . '</g>'
        . ($crown ? '<rect x="' . ($x - 1.5) . '" y="' . ($y - 1.5) . '" width="' . ($s + 3) . '" height="' . ($s + 3) . '" rx="4" class="fill-none stroke-actiune" stroke-width="2.5"/>' : '')
        . ($gone ? '<path d="M' . $x . ' ' . $y . 'L' . ($x + $s) . ' ' . ($y + $s) . 'M' . ($x + $s) . ' ' . $y . 'L' . $x . ' ' . ($y + $s) . '" class="stroke-cerneala" stroke-width="2.5"/>' : '')
        . '<text x="' . ($x + $s / 2) . '" y="' . $numY . '" text-anchor="middle" class="fill-cerneala text-[13px] font-semibold">' . $tooth . '</text>'
        . ($letters !== [] ? '<text x="' . ($x + $s / 2) . '" y="' . $letY . '" text-anchor="middle" class="fill-carmin text-[11px] font-semibold">' . e(implode(' ', array_unique($letters))) . '</text>' : '')
        . '</a>';
    return $svg;
}

/** The whole chart: the upper and lower arch (and the milk teeth when asked). */
function odontogram_svg(array $byTooth, ?int $selected, callable $href, bool $deciduous): string
{
    $rows = $deciduous ? array_merge([PERMANENT_ROWS[0]], DECIDUOUS_ROWS, [PERMANENT_ROWS[1]]) : PERMANENT_ROWS;
    $step = 46;
    $width = 16 * $step + 24;
    $rowH = 104;
    $out = '';
    foreach ($rows as $ri => $row) {
        $offset = (16 - count($row)) / 2 * $step;
        $y = 30 + $ri * $rowH;
        foreach ($row as $i => $tooth) {
            $x = 8 + $offset + $i * $step + ($i >= count($row) / 2 ? 8 : 0);
            $out .= tooth_svg($tooth, $byTooth[$tooth] ?? [], $x, $y, $selected === $tooth, $href($tooth));
        }
    }
    $height = count($rows) * $rowH + 10;
    $mid = $width / 2;
    $out .= '<line x1="' . $mid . '" y1="6" x2="' . $mid . '" y2="' . ($height - 6) . '" class="stroke-linie" stroke-dasharray="4 4"/>'
        . '<line x1="8" y1="' . (count($rows) / 2 * $rowH + 4) . '" x2="' . ($width - 8) . '" y2="' . (count($rows) / 2 * $rowH + 4) . '" class="stroke-linie" stroke-dasharray="4 4"/>';
    return '<svg viewBox="0 0 ' . $width . ' ' . $height . '" role="group" aria-label="Odontograma: dinții de sus, apoi cei de jos, din partea dreaptă a pacientului spre stânga" class="block h-auto w-full min-w-[40rem] font-sans">' . $out . '</svg>';
}

// ── Documents ────────────────────────────────────────────────────────────────

const DOC_KINDS = [
    'radiografie-panoramica' => 'Radiografie panoramică',
    'radiografie-retroalveolara' => 'Radiografie retroalveolară',
    'cbct' => 'CBCT',
    'fotografie' => 'Fotografie',
    'consimtamant' => 'Consimțământ semnat',
    'deviz' => 'Deviz / plan semnat',
    'scrisoare-medicala' => 'Scrisoare medicală',
    'alt' => 'Alt document',
];
const DOC_MIME = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
const DOC_MAX_MB = 25;

function documents_dir(): string
{
    $dir = APP_DIR . '/storage/documente';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        @file_put_contents($dir . '/index.html', '');
    }
    return $dir;
}

/** Saves an uploaded file of a patient; returns the document id. Throws with a Romanian message. */
function save_document(array $file, int $patientId, string $kind, string $title, array $user): int
{
    $err = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($err === UPLOAD_ERR_NO_FILE) {
        throw new DomainException('Alegeți fișierul.');
    }
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
        throw new DomainException('Fișierul este prea mare pentru server (cel mult ' . upload_limit_mb() . ' MB).');
    }
    if ($err !== UPLOAD_ERR_OK || !is_uploaded_file((string) $file['tmp_name'])) {
        throw new DomainException('Fișierul nu a putut fi încărcat. Încercați din nou.');
    }
    $size = (int) filesize($file['tmp_name']);
    if ($size > DOC_MAX_MB * 1024 * 1024) {
        throw new DomainException('Fișierul are peste ' . DOC_MAX_MB . ' MB.');
    }
    $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset(DOC_MIME[$mime])) {
        throw new DomainException('Se pot încărca doar PDF, JPG, PNG sau WebP.');
    }
    $stored = bin2hex(random_bytes(16)) . '.' . DOC_MIME[$mime];
    if (!move_uploaded_file($file['tmp_name'], documents_dir() . '/' . $stored)) {
        throw new DomainException('Fișierul nu a putut fi salvat pe server.');
    }
    $original = mb_substr(preg_replace('/[\x00-\x1f\/\\\\]+/u', '', (string) ($file['name'] ?? 'document')) ?: 'document', 0, 190);
    $id = db_insert('patient_documents', [
        'patient_id' => $patientId,
        'kind' => isset(DOC_KINDS[$kind]) ? $kind : 'alt',
        'title' => mb_substr($title !== '' ? $title : $original, 0, 190),
        'original_name' => $original,
        'stored_name' => $stored,
        'mime' => $mime,
        'size' => $size,
        'created_by' => $user['id'],
        'created_at' => now_sql(),
    ]);
    audit('document-incarcat', DOC_KINDS[$kind] ?? $kind, null, $patientId);
    return $id;
}

function format_size(int $bytes): string
{
    return $bytes >= 1048576 ? number_format($bytes / 1048576, 1, ',', '.') . ' MB' : max(1, (int) round($bytes / 1024)) . ' KB';
}

// ── Consents ─────────────────────────────────────────────────────────────────

const CONSENT_TYPES = [
    'gdpr' => 'Prelucrarea datelor personale și de sănătate',
    'tratament' => 'Consimțământ informat pentru tratament',
    'inhalosedare' => 'Consimțământ pentru inhalosedare',
    'foto' => 'Fotografii și radiografii',
];
const CONSENT_METHODS = ['hartie' => 'Semnat pe hârtie', 'verbal' => 'Acord verbal, notat de personal'];

/** The default texts; {{pacient}}, {{firma}}, {{clinica}} and {{email}} are filled when printing. */
const CONSENT_DEFAULTS = [
    'gdpr' => "Subsemnatul/Subsemnata {{pacient}} sunt de acord ca {{firma}} să prelucreze datele mele de identificare și de contact și datele privind sănătatea mea (anamneza, investigațiile, radiografiile, tratamentele efectuate), pentru acordarea îngrijirilor stomatologice, pentru evidența medicală prevăzută de lege și pentru facturare.\n\nAm fost informat(ă) că:\n– la date au acces doar persoanele din clinică ce au nevoie de ele pentru tratament sau facturare;\n– datele medicale și cele financiare se păstrează cât prevede legea;\n– pot cere oricând accesul la date, corectarea, restricționarea, portabilitatea sau ștergerea lor, în limitele legii, la {{email}};\n– pot depune plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (www.dataprotection.ro).",
    'tratament' => "Subsemnatul/Subsemnata {{pacient}} declar că medicul mi-a explicat, pe înțelesul meu: diagnosticul, tratamentul propus, alternativele, beneficiile, riscurile și complicațiile posibile (de exemplu durere, sângerare, umflătură, reacții la anestezic), durata și costul estimat, precum și ce se poate întâmpla dacă nu fac tratamentul.\n\nAm putut pune întrebări și am primit răspunsuri. Am declarat corect bolile, alergiile și medicamentele mele.\n\nSunt de acord cu tratamentul de mai jos și cu anestezia locală necesară. Știu că îmi pot retrage acordul înainte de începerea oricărei proceduri.\n\nTratamentul: ______________________________________________",
    'inhalosedare' => "Subsemnatul/Subsemnata {{pacient}} sunt de acord cu sedarea conștientă prin inhalare (protoxid de azot și oxigen) în timpul tratamentului stomatologic.\n\nMedicul mi-a explicat că rămân conștient(ă) și pot comunica, că efectul trece la scurt timp după oprirea gazului, ce efecte neplăcute pot apărea (de exemplu greață sau amețeală) și în ce situații sedarea nu se face. Am declarat corect bolile, medicamentele și, după caz, o posibilă sarcină.\n\nVoi respecta indicațiile primite înainte și după procedură.",
    'foto' => "Subsemnatul/Subsemnata {{pacient}} sunt de acord ca {{firma}} să realizeze fotografii și radiografii ale dinților și feței mele, pentru diagnostic și pentru documentarea tratamentului în fișa mea.\n\n[  ] Sunt de acord și ca imaginile, fără numele meu și fără elemente după care pot fi recunoscut(ă), să fie folosite în prezentări profesionale.\n\nPot retrage oricând acest acord, fără ca tratamentul să fie afectat.",
];

function consent_text(string $type): string
{
    $custom = setting('consent_texts')[$type] ?? null;
    return is_string($custom) && trim($custom) !== '' ? $custom : (CONSENT_DEFAULTS[$type] ?? '');
}

/** The version printed under a consent (the date its text last changed). */
function consent_version(): string
{
    return (string) (setting('consent_version') ?? '2026-10');
}

// ── Data-protection rights (administrators) ──────────────────────────────────

const DATA_REQUEST_TYPES = ['acces' => 'Acces la date (copie)', 'rectificare' => 'Corectarea datelor', 'stergere' => 'Ștergerea datelor', 'portabilitate' => 'Portabilitate', 'restrictionare' => 'Restricționare', 'opozitie' => 'Opoziție'];
const DATA_REQUEST_STATUS = ['primita' => 'Primită', 'in-lucru' => 'În lucru', 'rezolvata' => 'Rezolvată', 'respinsa' => 'Respinsă'];
const DATA_REQUEST_DAYS = 30;

/** Everything the clinic keeps about a patient, as one array (for the JSON export). */
function patient_export(int $id): array
{
    $p = db_one('SELECT * FROM patients WHERE id = ?', [$id]);
    $p['cnp'] = cnp_decrypt($p['cnp_enc']);
    unset($p['cnp_enc'], $p['cnp_hash'], $p['search_text']);
    $names = admin_clinic_names();
    $docs = doctor_short_names();
    $clean = static function (array $rows, array $drop = []) use ($names, $docs): array {
        return array_map(static function ($r) use ($drop, $names, $docs) {
            foreach ($drop as $k) {
                unset($r[$k]);
            }
            if (isset($r['location_id'])) {
                $r['clinica'] = $names[(int) $r['location_id']] ?? null;
            }
            if (isset($r['doctor_id'])) {
                $r['medic'] = $docs[(int) $r['doctor_id']] ?? null;
            }
            return $r;
        }, $rows);
    };
    return [
        'exportat_la' => date('c'),
        'exportat_de' => 'Dental Arena',
        'pacient' => $p,
        'anamneza' => db_one('SELECT * FROM medical_histories WHERE patient_id = ?', [$id]),
        'programari' => $clean(db_all('SELECT * FROM appointments WHERE patient_id = ? ORDER BY starts_at', [$id]), ['created_by', 'updated_by']),
        'note' => db_all('SELECT n.created_at, n.clinical, n.body, u.name AS autor FROM patient_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.patient_id = ? ORDER BY n.created_at', [$id]),
        'rechemari' => $clean(db_all('SELECT * FROM recalls WHERE patient_id = ? ORDER BY due_date', [$id]), ['created_by']),
        'odontograma' => db_all('SELECT tooth AS dinte, kind AS constatare, surfaces AS suprafete, note AS nota, created_at, resolved_at FROM tooth_conditions WHERE patient_id = ? ORDER BY created_at', [$id]),
        'planuri_de_tratament' => array_map(static function ($pl) {
            $pl['linii'] = db_all('SELECT tooth AS dinte, description AS descriere, phase AS faza, quantity AS cantitate, unit_price AS pret_bani, discount AS reducere_bani, status AS stare, performed_at FROM treatment_plan_items WHERE plan_id = ? ORDER BY phase, sort_order', [$pl['id']]);
            return $pl;
        }, $clean(db_all('SELECT * FROM treatment_plans WHERE patient_id = ? ORDER BY created_at', [$id]), ['created_by'])),
        'facturi' => array_map(static function ($inv) {
            $inv['numar'] = doc_number($inv['series'], (int) $inv['number']);
            $inv['linii'] = db_all('SELECT description AS descriere, tooth AS dinte, quantity AS cantitate, unit_price AS pret_bani, discount AS reducere_bani, vat_rate AS tva, total AS total_bani FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order', [$inv['id']]);
            return $inv;
        }, $clean(db_all('SELECT * FROM invoices WHERE patient_id = ? ORDER BY issued_at', [$id]), ['created_by', 'cancelled_by'])),
        'incasari' => $clean(db_all('SELECT * FROM payments WHERE patient_id = ? ORDER BY paid_at', [$id]), ['received_by', 'cancelled_by']),
        'consimtaminte' => db_all('SELECT type AS tip, method AS modalitate, signed_on AS semnat_la, text_version AS versiune_text, withdrawn_at AS retras_la FROM consents WHERE patient_id = ? ORDER BY signed_on', [$id]),
        'documente' => db_all('SELECT kind AS tip, title AS titlu, original_name AS fisier, mime, size AS marime, created_at FROM patient_documents WHERE patient_id = ? AND deleted_at IS NULL ORDER BY created_at', [$id]),
        'cereri_de_pe_site' => db_all('SELECT kind, created_at, name, phone, email, message, status FROM leads WHERE patient_id = ? ORDER BY created_at', [$id]),
        'nota' => 'Sumele sunt în bani (1 leu = 100 de bani). Documentele (radiografii, fotografii) se predau separat, la cerere.',
    ];
}

/**
 * Erasure: the identity is removed (name, CNP, phone, e-mail, address, administrative notes, the
 * requests from the site, documents); the medical and financial records stay, as the law requires,
 * under the anonymous name „Pacient anonimizat #<fișa>”.
 */
function anonymize_patient(int $id, array $user): int
{
    $files = db_tx(static function () use ($id, $user): array {
        $p = db_one('SELECT id, file_number, anonymized_at FROM patients WHERE id = ? FOR UPDATE', [$id]);
        if ($p === null || $p['anonymized_at'] !== null) {
            throw new DomainException('Fișa este deja anonimizată.');
        }
        $fn = (int) $p['file_number'];
        db_update('patients', [
            'first_name' => 'Pacient', 'last_name' => "anonimizat #{$fn}", 'search_text' => "pacient anonimizat {$fn}",
            'cnp_enc' => null, 'cnp_hash' => null, 'phone' => '', 'email' => null, 'street' => null, 'city' => null, 'county' => null,
            'guardian_name' => null, 'notes' => null, 'email_reminders' => 0, 'active' => 0, 'anonymized_at' => now_sql(), 'updated_at' => now_sql(),
        ], 'id = :id', ['id' => $id]);
        db_run("UPDATE leads SET name = 'Cerere anonimizată', phone = '', email = NULL, message = NULL, note = NULL WHERE patient_id = ?", [$id]);
        db_run("UPDATE patient_notes SET body = '[anonimizat]' WHERE patient_id = ? AND clinical = 0", [$id]);
        db_run('UPDATE appointments SET notes = NULL WHERE patient_id = ?', [$id]);
        $docs = db_all('SELECT stored_name FROM patient_documents WHERE patient_id = ? AND deleted_at IS NULL', [$id]);
        db_run('UPDATE patient_documents SET deleted_at = ?, deleted_by = ? WHERE patient_id = ? AND deleted_at IS NULL', [now_sql(), $user['id'], $id]);
        db_run("UPDATE invoices SET buyer_email = NULL WHERE patient_id = ?", [$id]);
        audit('pacient-anonimizat', "fișa nr. {$fn}", null, $id);
        return array_column($docs, 'stored_name');
    });
    foreach ($files as $f) {
        @unlink(documents_dir() . '/' . basename($f));
    }
    return count($files);
}

// ── The patient's file: header and tabs ──────────────────────────────────────

/** The tabs of a patient's file the user may open. */
function patient_tabs(array $user): array
{
    $tabs = ['' => 'Fișa'];
    if (can('medical', $user)) {
        $tabs['odontograma'] = 'Odontogramă';
    }
    $tabs['planuri'] = 'Planuri de tratament';
    if (can('billing', $user)) {
        $tabs['financiar'] = 'Facturi și plăți';
    }
    $tabs['documente'] = 'Documente și acorduri';
    if (can('gdpr', $user)) {
        $tabs['gdpr'] = 'GDPR';
    }
    return $tabs;
}

/** The back link, the name with the file number, the alerts, the actions and the tabs. */
function patient_header(array $p, array $user, string $active, string $extraActions = ''): string
{
    $id = (int) $p['id'];
    $alerts = medical_alerts($id);
    $age = $p['birth_date'] ? (new DateTimeImmutable($p['birth_date']))->diff(new DateTimeImmutable())->y : null;
    $lead = 'Fișa nr. ' . (int) $p['file_number'] . ($age !== null ? " · {$age} ani" : '') . ($p['phone'] !== '' ? ' · ' . format_phone($p['phone']) : '');
    $actions = $extraActions;
    if ($p['anonymized_at'] === null) {
        $actions .= '<a href="/admin/programari/noua?pacient=' . $id . '" class="' . e(btn($extraActions === '' ? 'primary' : 'secondary')) . '">' . icon('calendar-plus', 18) . 'Programare nouă</a>'
            . ($p['phone'] !== '' ? '<a href="' . e(tel_href($p['phone'])) . '" class="' . e(btn('secondary')) . '">' . icon('phone', 18) . 'Sunați</a>' : '');
    }
    $nav = '';
    foreach (patient_tabs($user) as $slug => $label) {
        $href = '/admin/pacienti/' . $id . ($slug !== '' ? '/' . $slug : '');
        $on = $slug === $active;
        $nav .= '<a href="' . e($href) . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control shrink-0 items-center border-b-2 px-3 text-control', $on ? 'border-actiune font-semibold text-cerneala' : 'border-transparent text-discret hover:text-cerneala')) . '">' . e($label) . '</a>';
    }
    $chips = alert_chips($alerts, 'text-corp') . comfort_chip($p['comfort'], (bool) $p['prefers_sedation']);
    return '<p class="mb-4"><a href="/admin/pacienti" class="inline-flex min-h-control items-center gap-1 text-link underline underline-offset-4">' . icon('chevron-left', 18) . 'Pacienți</a></p>'
        . admin_header(patient_name($p), $lead, $actions)
        . ($p['anonymized_at'] !== null ? '<p class="-mt-4 mb-6 rounded-panou bg-adancit p-4 text-corp">Fișă anonimizată la ' . e(format_datetime($p['anonymized_at'])) . '. Datele medicale și financiare se păstrează, fără datele de identificare.</p>' : '')
        . ($chips !== '' ? '<div class="-mt-4 mb-6 flex flex-wrap gap-2">' . $chips . '</div>' : '')
        . '<nav aria-label="Fișa pacientului" class="mb-8 flex relative overflow-x-auto border-b border-linie">' . $nav . '</nav>';
}

/** A patient the user may see, or the 404 page. */
function patient_or_404(string $param, array $user): array
{
    $p = find_patient((int) $param, $user);
    if ($p === null) {
        admin_not_found($user);
    }
    return $p;
}

/** The access log: one line per user, patient and day when a file is opened. */
function log_file_view(int $patientId): void
{
    session_begin();
    $key = date('Y-m-d') . ':' . $patientId;
    if (!isset($_SESSION['fise_vazute'][$key])) {
        $_SESSION['fise_vazute'] = array_slice(($_SESSION['fise_vazute'] ?? []) + [$key => 1], -200, null, true);
        audit('fisa-deschisa', '', null, $patientId);
    }
}

/** A page for printing (invoice, receipt, plan, consent): A4, no panel menu. */
function print_page(string $title, string $body, string $back): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    header('X-Frame-Options: DENY');
    ?>
<!DOCTYPE html>
<html lang="ro" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?></title>
<link rel="stylesheet" href="<?= e(asset('/assets/site.css')) ?>">
<script src="<?= e(asset(is_file(PUBLIC_DIR . '/assets/admin.min.js') ? '/assets/admin.min.js' : '/assets/admin.js')) ?>" defer></script>
<style>@page { size: A4; margin: 14mm; } @media print { body { background: #fff; } .foaie { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; } }</style>
</head>
<body class="bg-fundal font-sans text-cerneala print:bg-white">
<div class="mx-auto flex max-w-[52rem] flex-wrap items-center gap-3 px-4 py-4 print:hidden">
  <a href="<?= e($back) ?>" class="<?= e(btn('secondary', 's')) ?>"><?= icon('chevron-left', 16) ?>Înapoi</a>
  <button type="button" data-tipareste class="<?= e(btn('primary', 's')) ?>">Tipăriți</button>
  <span class="text-mic text-discret">Sau salvați ca PDF din fereastra de tipărire.</span>
</div>
<main class="foaie mx-auto mb-10 max-w-[52rem] rounded-panou border border-linie bg-white p-8 text-[15px] leading-relaxed shadow-sm md:p-12"><?= $body ?></main>
</body>
</html>
    <?php
}

/** The seller block of the printed documents. */
function seller_block(?array $clinic = null): string
{
    $c = setting('company');
    $missing = static fn (string $v) => trim($v) !== '' ? e($v) : '<span class="text-carmin print:text-cerneala">[de completat în Setări]</span>';
    return '<p class="font-semibold">' . $missing($c['legalName']) . '</p>'
        . '<p>CUI ' . $missing($c['cui']) . ' · Reg. Com. ' . $missing($c['regCom']) . '</p>'
        . '<p>Sediul: ' . $missing($c['registeredAddress']) . '</p>'
        . ($c['iban'] !== '' ? '<p>IBAN ' . e($c['iban']) . ($c['bank'] !== '' ? ', ' . e($c['bank']) : '') . '</p>' : '')
        . ($clinic ? '<p>Punct de lucru: ' . e(trim($clinic['street'] . ', ' . $clinic['city'])) . ' · ' . e(format_phone($clinic['phone'])) . '</p>' : '');
}

// ── The audit log, in words ──────────────────────────────────────────────────

const AUDIT_LABELS = [
    'autentificare' => 'Intrare în panou',
    'iesire' => 'Ieșire din panou',
    'parola-schimbata' => 'Parolă schimbată',
    'stergere-cereri-vechi' => 'Cereri vechi șterse automat',
    'stergere-cerere' => 'Cerere ștearsă',
    'stare-cerere' => 'Cerere: stare schimbată',
    'programare-noua' => 'Programare nouă',
    'programare' => 'Programare modificată',
    'rechemare-noua' => 'Rechemare nouă',
    'rechemare' => 'Rechemare actualizată',
    'preturi' => 'Prețuri modificate',
    'setari' => 'Setări modificate',
    'utilizator-nou' => 'Utilizator nou',
    'utilizator' => 'Utilizator modificat',
    'medic-nou' => 'Medic nou',
    'medic' => 'Medic modificat',
    'medic-foto-sters' => 'Fotografia medicului ștearsă',
    'fotografie' => 'Fotografie schimbată pe site',
    'fotografie-initiala' => 'Fotografie inițială pusă înapoi',
    'fisa-deschisa' => 'Fișa deschisă',
    'pacient-nou' => 'Pacient nou',
    'pacient' => 'Datele pacientului modificate',
    'pacient-dezactivat' => 'Fișa scoasă din liste',
    'anamneza' => 'Anamneză salvată',
    'factura-emisa' => 'Factură emisă',
    'factura-anulata' => 'Factură anulată',
    'factura-tiparita' => 'Factură tipărită',
    'incasare' => 'Încasare',
    'incasare-anulata' => 'Încasare anulată',
    'chitanta-tiparita' => 'Chitanță tipărită',
    'export-facturi' => 'Export facturi',
    'export-incasari' => 'Export încasări',
    'export-raport' => 'Export raport',
    'plan-nou' => 'Plan de tratament nou',
    'plan' => 'Plan de tratament modificat',
    'plan-tiparit' => 'Plan de tratament tipărit',
    'plan-linie-noua' => 'Lucrare adăugată în plan',
    'plan-linie' => 'Lucrare din plan modificată',
    'plan-linie-stearsa' => 'Lucrare ștearsă din plan',
    'odontograma' => 'Odontogramă: constatare nouă',
    'odontograma-rezolvat' => 'Odontogramă: constatare trecută în istoric',
    'document-incarcat' => 'Document încărcat',
    'document-deschis' => 'Document deschis',
    'document-sters' => 'Document șters',
    'acord' => 'Acord înregistrat',
    'acord-retras' => 'Acord retras',
    'acord-tiparit' => 'Formular de acord tipărit',
    'gdpr-export' => 'GDPR: date exportate',
    'pacient-anonimizat' => 'GDPR: fișă anonimizată',
    'cerere-gdpr' => 'GDPR: cerere în registru',
];

function audit_label(string $action): string
{
    if (isset(AUDIT_LABELS[$action])) {
        return AUDIT_LABELS[$action];
    }
    if (str_starts_with($action, 'plan-linie-') && isset(ITEM_STATUS[substr($action, 11)])) {
        return 'Lucrare din plan: ' . mb_strtolower(ITEM_STATUS[substr($action, 11)]);
    }
    if (str_starts_with($action, 'plan-') && isset(PLAN_STATUS[substr($action, 5)])) {
        return 'Plan de tratament: ' . mb_strtolower(PLAN_STATUS[substr($action, 5)]);
    }
    if (str_starts_with($action, 'programare-') && isset(APPT_STATUS[substr($action, 11)])) {
        return 'Programare: ' . mb_strtolower(APPT_STATUS[substr($action, 11)]);
    }
    return ucfirst(str_replace('-', ' ', $action));
}
