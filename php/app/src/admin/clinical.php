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
    'sterilizare' => 'Sterilizare',
    'alt' => 'Alt document',
];
const DOC_MIME = [
    'application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
    'image/heic' => 'heic', 'image/heif' => 'heif', 'image/gif' => 'gif', 'image/tiff' => 'tif', 'image/bmp' => 'bmp',
    'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm',
    'application/msword' => 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
    'application/vnd.ms-excel' => 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
    'application/vnd.oasis.opendocument.text' => 'odt', 'text/plain' => 'txt', 'application/zip' => 'zip',
    'application/dicom' => 'dcm', 'model/stl' => 'stl',
];
/** Files the server cannot recognise by their content (3D scans, DICOM, Office): taken by their extension. */
const DOC_EXT_BY_NAME = ['stl', 'ply', 'obj', '3mf', 'dcm', 'doc', 'docx', 'xls', 'xlsx', 'pptx'];
/** Images the browser shows as a thumbnail. */
const DOC_PREVIEW = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_MAX_MB = 100;

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
    $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
    if (in_array($ext, DOC_EXT_BY_NAME, true) && in_array($mime, ['application/octet-stream', 'text/plain', 'application/zip', 'application/CDFV2'], true)) {
        $stored = $ext;
        // A .docx is a ZIP inside: it keeps the type of its extension, so it opens in Word.
        $mime = array_flip(DOC_MIME)[$ext] ?? 'application/octet-stream';
    } elseif (isset(DOC_MIME[$mime])) {
        $stored = DOC_MIME[$mime];
    } else {
        throw new DomainException('Fișierul acesta nu se poate încărca. Merg: poze, PDF, Word, Excel, video, scanări 3D (STL), DICOM, ZIP.');
    }
    $stored = bin2hex(random_bytes(16)) . '.' . $stored;
    if (!move_uploaded_file($file['tmp_name'], documents_dir() . '/' . $stored)) {
        throw new DomainException('Fișierul nu a putut fi salvat pe server.');
    }
    $original = mb_substr(preg_replace('/[\x00-\x1f\/\\\\]+/u', '', (string) ($file['name'] ?? 'document')) ?: 'document', 0, 190);
    if ($kind === 'auto') {
        // From the quick button or the phone: photos and videos are „Fotografie”, the rest „Alt document”.
        $kind = str_starts_with($mime, 'image/') || str_starts_with($mime, 'video/') ? 'fotografie' : 'alt';
    }
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
    audit('document-incarcat', DOC_KINDS[$kind] ?? $kind, isset($user['id']) ? (int) $user['id'] : null, $patientId);
    return $id;
}

// ── Photos from the phone (QR code) ──────────────────────────────────────────

const UPLOAD_LINK_MINUTES = 60;
const UPLOAD_LINK_MAX_PHOTOS = 40;
/** What a code adds: sterilization photos, or any file for „Documente și acorduri”. */
const UPLOAD_LINK_KINDS = ['sterilizare' => 'Sterilizare', 'document' => 'Documente și poze'];

/** A code for the phone: it adds photos of one kind to one patient, for an hour. */
function upload_link_create(int $patientId, string $kind, array $user): array
{
    $token = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    $expires = date('Y-m-d H:i:s', time() + UPLOAD_LINK_MINUTES * 60);
    $id = db_insert('upload_links', [
        'token_hash' => hash('sha256', $token), 'patient_id' => $patientId, 'kind' => $kind,
        'created_by' => $user['id'], 'created_at' => now_sql(), 'expires_at' => $expires,
    ]);
    audit('cod-qr-poze', (UPLOAD_LINK_KINDS[$kind] ?? $kind) . ', valabil până la ' . substr($expires, 11, 5), null, $patientId);
    return ['id' => $id, 'token' => $token, 'expires_at' => $expires];
}

/** The link of a code still valid (not stopped, not expired, photos left). */
function upload_link_find(string $token): ?array
{
    if (!preg_match('/^[A-Za-z0-9_-]{32}$/', $token)) {
        return null;
    }
    $l = db_one('SELECT * FROM upload_links WHERE token_hash = ?', [hash('sha256', $token)]);
    return $l !== null && $l['revoked_at'] === null && $l['expires_at'] > now_sql() && (int) $l['uploads'] < UPLOAD_LINK_MAX_PHOTOS ? $l : null;
}

/**
 * The QR code this computer shows for the patient, while still valid: the session keeps the code
 * (to draw it again after a reload), the database only its hash.
 *
 * @return array{token:string,link:array}|null
 */
function upload_qr_current(int $patientId, string $kind): ?array
{
    session_begin();
    $key = "{$kind}:{$patientId}";
    $qr = $_SESSION['qr_poze'][$key] ?? null;
    $link = is_array($qr) ? db_one('SELECT * FROM upload_links WHERE id = ? AND patient_id = ? AND kind = ?', [(int) $qr['id'], $patientId, $kind]) : null;
    if ($link === null || $link['revoked_at'] !== null || $link['expires_at'] <= now_sql() || (int) $link['uploads'] >= UPLOAD_LINK_MAX_PHOTOS) {
        unset($_SESSION['qr_poze'][$key]);
        return null;
    }
    return ['token' => (string) $qr['token'], 'link' => $link];
}

function upload_qr_start(int $patientId, string $kind, array $user): void
{
    session_begin();
    $link = upload_link_create($patientId, $kind, $user);
    $_SESSION['qr_poze']["{$kind}:{$patientId}"] = ['id' => $link['id'], 'token' => $link['token']];
}

function upload_qr_stop(int $patientId, string $kind): void
{
    if (($cur = upload_qr_current($patientId, $kind)) !== null) {
        db_update('upload_links', ['revoked_at' => now_sql()], 'id = :id', ['id' => $cur['link']['id']]);
    }
    unset($_SESSION['qr_poze']["{$kind}:{$patientId}"]);
}

/**
 * The QR code with what to do, or the button that makes one. $countUrl answers with the number of
 * files ({"n": …}); the page reloads when it changes, so what the phone sends shows at once.
 */
function upload_qr_panel(?array $cur, string $countUrl, int $count, string $hint): string
{
    if ($cur === null) {
        return '<form method="post">' . csrf_field() . '<input type="hidden" name="op" value="qr"><button type="submit" class="' . e(btn('secondary')) . '">' . admin_icon('qr', 18) . 'Cod QR pentru telefon</button></form>';
    }
    $url = absolute_url('/incarca/' . $cur['token']);
    $svg = qr_svg($url);
    $link = $cur['link'];
    return '<div id="telefon" class="flex flex-col gap-5 rounded-panou border-2 border-actiune bg-menta-pal p-4 sm:flex-row sm:items-center" data-poze-noi="' . e($countUrl) . '" data-poze-numar="' . $count . '">'
        . ($svg !== null ? '<div class="w-[15rem] max-w-full shrink-0 self-center rounded-control bg-white p-2 [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label="Cod QR pentru telefon">' . $svg . '</div>' : '')
        . '<div class="min-w-0 flex-1"><p class="flex items-center gap-2 text-h3 font-semibold">' . admin_icon('camera', 20) . 'Scanați codul cu telefonul</p>'
        . '<p class="mt-1 text-corp">' . e($hint) . ' Apare aici imediat; nu trebuie să intrați în panou pe telefon.</p>'
        . '<p class="mt-2 text-mic text-discret">Valabil până la ' . e(hm($link['expires_at'])) . ', doar pentru acest pacient, cel mult ' . UPLOAD_LINK_MAX_PHOTOS . ' fișiere' . ((int) $link['uploads'] > 0 ? '; trimise până acum: ' . (int) $link['uploads'] : '') . '.</p>'
        . '<p class="mt-2 break-all text-mic"><a class="text-link underline underline-offset-4" href="' . e($url) . '" target="_blank" rel="noopener">' . e($url) . '</a></p>'
        . '<form method="post" class="mt-3">' . csrf_field() . '<input type="hidden" name="op" value="opreste-qr"><button type="submit" class="' . e(btn('secondary', 's')) . '">Opriți codul</button></form></div></div>';
}

/** An SVG QR code (the panel draws it; nothing leaves the server), or null without the library. */
function qr_svg(string $text, int $size = 240): ?string
{
    if (!is_file(APP_DIR . '/vendor/autoload.php')) {
        return null;
    }
    require_once APP_DIR . '/vendor/autoload.php';
    try {
        $writer = new BaconQrCode\Writer(new BaconQrCode\Renderer\ImageRenderer(
            new BaconQrCode\Renderer\RendererStyle\RendererStyle($size, 2),
            new BaconQrCode\Renderer\Image\SvgImageBackEnd(),
        ));
        $svg = $writer->writeString($text);
        return preg_replace('/^<\?xml[^>]*>\s*/', '', $svg);
    } catch (Throwable $e) {
        app_log('error', 'cod QR: ' . $e->getMessage());
        return null;
    }
}

/** The files of an upload field, one or many („fisiere[]”), without the empty ones. */
function uploaded_files(string $field): array
{
    $f = $_FILES[$field] ?? [];
    if (!is_array($f['error'] ?? null)) {
        return isset($f['error']) && (int) $f['error'] !== UPLOAD_ERR_NO_FILE ? [$f] : [];
    }
    $out = [];
    foreach ($f['error'] as $i => $err) {
        if ((int) $err !== UPLOAD_ERR_NO_FILE) {
            $out[] = ['name' => $f['name'][$i] ?? '', 'type' => $f['type'][$i] ?? '', 'tmp_name' => $f['tmp_name'][$i] ?? '', 'error' => $err, 'size' => $f['size'][$i] ?? 0];
        }
    }
    return $out;
}

function format_size(int $bytes): string
{
    return $bytes >= 1048576 ? number_format($bytes / 1048576, 1, ',', '.') . ' MB' : max(1, (int) round($bytes / 1024)) . ' KB';
}

// ── Consents ─────────────────────────────────────────────────────────────────

const CONSENT_TYPES = [
    'gdpr' => 'Prelucrarea datelor personale și de sănătate',
    'tratament' => 'Consimțământ informat pentru tratament',
    'foto' => 'Fotografii și radiografii',
    'endodontic' => 'Consimțământ pentru tratamentul endodontic (de canal)',
    'chirurgie' => 'Consimțământ pentru tratamente chirurgicale',
    'implant' => 'Consimțământ pentru tratamentul pe implanturi',
];
/** The consents that name the doctor and the intervention (chosen when the tablet code is made). */
const CONSENT_WITH_DETAILS = ['endodontic', 'chirurgie', 'implant'];
/** Consents no longer asked for: the ones already signed stay in the patient's file and can be seen. */
const CONSENT_RETIRED = ['inhalosedare' => 'Consimțământ pentru inhalosedare (nu mai practicăm)'];
const CONSENT_METHODS = ['hartie' => 'Semnat pe hârtie', 'tableta' => 'Semnat pe tabletă', 'verbal' => 'Acord verbal, notat de personal'];

/**
 * The default texts; {{pacient}}, {{firma}}, {{clinica}}, {{email}}, {{telefon}}, {{adresa}} are
 * filled when printing or signing; {{medic}} and {{interventie}} when the tablet code is made (a line
 * to write on, on paper). The texts of endodontics, surgery and implants are the clinic's own forms.
 */
const CONSENT_DEFAULTS = [
    'gdpr' => "Subsemnatul/Subsemnata {{pacient}} sunt de acord ca {{firma}} să prelucreze datele mele de identificare și de contact și datele privind sănătatea mea (anamneza, investigațiile, radiografiile, tratamentele efectuate), pentru acordarea îngrijirilor stomatologice, pentru evidența medicală prevăzută de lege și pentru facturare.\n\nAm fost informat(ă) că:\n– la date au acces doar persoanele din clinică ce au nevoie de ele pentru tratament sau facturare;\n– datele medicale și cele financiare se păstrează cât prevede legea;\n– pot cere oricând accesul la date, corectarea, restricționarea, portabilitatea sau ștergerea lor, în limitele legii, la {{email}};\n– pot depune plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (www.dataprotection.ro).",
    'tratament' => "Subsemnatul/Subsemnata {{pacient}} declar că medicul mi-a explicat, pe înțelesul meu: diagnosticul, tratamentul propus, alternativele, beneficiile, riscurile și complicațiile posibile (de exemplu durere, sângerare, umflătură, reacții la anestezic), durata și costul estimat, precum și ce se poate întâmpla dacă nu fac tratamentul.\n\nAm putut pune întrebări și am primit răspunsuri. Am declarat corect bolile, alergiile și medicamentele mele.\n\nSunt de acord cu tratamentul de mai jos și cu anestezia locală necesară. Știu că îmi pot retrage acordul înainte de începerea oricărei proceduri.\n\nTratamentul: ______________________________________________",
    'foto' => "Subsemnatul/Subsemnata {{pacient}} sunt de acord ca {{firma}} să realizeze fotografii și radiografii ale dinților și feței mele, pentru diagnostic și pentru documentarea tratamentului în fișa mea.\n\n[  ] Sunt de acord și ca imaginile, fără numele meu și fără elemente după care pot fi recunoscut(ă), să fie folosite în prezentări profesionale.\n\nPot retrage oricând acest acord, fără ca tratamentul să fie afectat.",
    'endodontic' => "Subsemnatul/Subsemnata {{pacient}}, pentru tratamentul endodontic (de canal) efectuat de {{medic}} ({{interventie}}), declar următoarele.\n\nRiscurile tratamentului endodontic:\n– Înțeleg că mai mulți factori contribuie la succesul tratamentului de canal și nu toți factorii pot fi determinați în avans. Acești factori pot fi: rezistența mea la infecții, bacteriile care cauzează infecții, dimensiunea, forma și localizarea canalelor radiculare. Cazul meu ar putea fi mai dificil dacă dintele meu are sistemul de canale radiculare blocat, curbat sau îngustat.\n– Înțeleg că tratamentul de canal poate să nu amelioreze simptomele mele și poate uneori, din motive inexplicabile, să eșueze. În acest caz, alte proceduri (inclusiv retratament sau tratament chirurgical) pot fi necesare pentru păstrarea dintelui, sau acesta poate fi extras.\n– Am înțeles că în timpul și după tratament mă pot confrunta cu unele dureri sau disconfort, umflături, sângerări și deteriorarea sau pierderea restaurării dentare. De asemenea, pot avea nevoie de antibiotice pentru a trata infecțiile asociate.\n– Înțeleg că instrumentele de canal se pot separa (rupe) în canal, fapt care poate afecta sau nu prognosticul dintelui. Dacă fragmentul separat nu poate fi îndepărtat, poate fi sigilat în interiorul canalului radicular sau va necesita tratament adițional în viitor.\n– Am înțeles că alte riscuri ale tratamentului de canal includ perforări accidentale, perforația sinusurilor și/sau tulburări nervoase.\n– Înțeleg că se va administra anestezic local, prin infiltrație. Înțeleg că poate apărea un disconfort după tratament în zona puncției anestezice, precum și din cauza menținerii gurii deschise pe durata tratamentului.\n– Înțeleg că în maximum o lună de la finalizarea tratamentului de canal voi urma un tratament de restaurare de lungă durată a dintelui tratat (obturație, coroană), în cabinetul/clinica medicului meu dentist curant.\n\nÎn funcție de diagnostic, pot exista alternative la tratamentul endodontic. Acestea sunt:\n– extracția dintelui implicat;\n– netratarea dintelui: în absența tratamentului endodontic, situația mea inițială se poate înrăutăți, cu următoarele riscuri: dureri severe localizate, infecții localizate, infecții severe ale lojilor anatomice învecinate, pierderea dintelui implicat și posibil a altor dinți învecinați, precum și extinderea generalizată a infecției, care poate fi în rare cazuri fatală.\n\nConsimțământ pentru planul de tratament\nMenționez că mi-au fost explicate pe înțelesul meu diagnosticul, planul de tratament și costul estimativ, îmi asum și îmi însușesc tratamentele propuse și voi respecta indicațiile primite. Am luat la cunoștință eventualele riscuri, accidente și complicații care pot interveni pe parcursul tratamentului și după finalizarea lui și declar în deplină cunoștință de cauză că mi le însușesc în totalitate, așa cum mi-au fost explicate.",
    'chirurgie' => "Subsemnatul/Subsemnata {{pacient}}, domiciliat(ă) în {{adresa}}, telefon {{telefon}}, consimt să mi se efectueze intervenția chirurgicală următoare: {{interventie}}.\n\nToate procedurile de chirurgie dento-alveolară presupun o serie de complicații, unele inevitabile:\n– reacții alergice/toxice la medicamente și substanțe anestezice pre-, intra- și postoperator;\n– hemoragie intra- și postoperatorie;\n– hematoame, echimoze, edeme postoperatorii;\n– dureri în teritoriul oro-maxilo-facial;\n– dehiscența;\n– lezarea dinților învecinați;\n– hipoestezia/anestezia nervului alveolar inferior, mentonier, lingual, infraorbitar;\n– infecții ale spațiilor fasciale cervico-faciale;\n– osteita/osteomielita oaselor maxilare;\n– sinuzite maxilare;\n– comunicare oro-sinuzală sau oro-nazală;\n– fracturi ale oaselor maxilare;\n– accidente prin ruperea instrumentarului în timpul manevrelor chirurgicale;\n– escoriații, plăgi, ulcerații produse prin contactul mucoaselor cu instrumentarul chirurgical sau cu substanțe medicamentoase.\n\nNatura, scopul, beneficiile și riscurile neefectuării acestei intervenții chirurgicale și ale celorlalte opțiuni terapeutice mi-au fost explicate pe înțelesul meu de către {{medic}}, pe care îl/o desemnez pentru a efectua intervenția chirurgicală de mai sus.\n\nMi s-au prezentat riscurile asociate, accidentele și complicațiile posibile, precum și riscurile imprevizibile (inclusiv riscul de deces), consecințele pe care le presupune intervenția chirurgicală, cât și riscurile pe care le impun investigațiile necesare intervenției chirurgicale pe care urmează să o efectuez. De asemenea, înțeleg necesitatea consultului interdisciplinar însoțit de avizul de specialitate pentru efectuarea intervenției chirurgicale dento-alveolare.\n\nDeclar că sunt conștient(ă) de aceste riscuri, accidente și complicații și le accept fără a solicita ulterior daune materiale sau morale medicului curant sau cabinetului de medicină dentară.\n\nCa urmare, înțeleg necesitatea acestei intervenții chirurgicale pe care doresc să o efectuez și declar că nu am primit nicio garanție sau asigurare în ceea ce privește rezultatul final.\n\nÎn scopul realizării intervenției chirurgicale consimt la administrarea anesteziei loco-regionale, fiind informat(ă), pe înțelesul meu, asupra riscurilor administrării substanțelor anestezice în corelație cu starea generală, starea de graviditate, alergii etc., fiind conștient(ă) de riscurile pe care le presupune.\n\nPostoperator, mă angajez să respect cu strictețe toate recomandările indicate de medicul curant, să nu conduc autovehicule dacă am fost atenționat(ă) asupra administrării unor substanțe medicamentoase care pot afecta într-o oarecare măsură nivelul conștienței și să comunic medicului curant orice modificare ce ar putea sugera o evoluție postoperatorie nefavorabilă.\n\nÎn consecință și în condițiile precizate îmi dau liber și în cunoștință de cauză consimțământul pentru intervenția chirurgicală prezentată.\n\nÎn conformitate cu Legea nr. 46/2003 privind drepturile pacientului, articolele 19 și 20, îmi exprim acordul de a participa în calitate de pacient la învățământul medical și de cercetare științifică, precum și la fotografierea/filmarea mea pre-, intra- și postoperator, toate acestea putând fi folosite în scop didactic, medical și științific.\n\nCertific că am citit, am înțeles și accept pe deplin cele de mai sus și, ca urmare, semnez.",
    'implant' => "Subsemnatul/Subsemnata {{pacient}}, pentru tratamentul pe implanturi efectuat de {{medic}} ({{interventie}}), declar:\n\n1. Înțeleg pe deplin scopul și natura procedurilor pentru inserarea implanturilor dentare și reconstrucția protetică ulterioară pe implanturi. Am citit și am înțeles planul de tratament (inclusiv costurile aferente), care mi-au fost explicate clar, pe înțelesul meu. De asemenea, sunt de acord cu plata unui avans, dacă acesta este necesar.\nAm citit și am înțeles documentul cu alternativele de tratament, avantajele și dezavantajele acestora.\n\n2. Alternativele de tratament pentru înlocuirea dinților lipsă mi-au fost explicate, dar prefer implanturile dentare.\n\n3. Înțeleg că se vor avea în vedere toate măsurile de siguranță pentru succesul tratamentului și al procedurilor chirurgicale, dar rezultatul nu poate fi garantat, deși eșecul implanturilor nu este un eveniment frecvent. Accept și sunt de acord ca, în situația în care un implant cedează mai repede de 2 ani de la momentul inserării, acesta să fie înlocuit fără costuri, iar dacă nu poate fi înlocuit din orice motiv, să mi se returneze 50% din costul acelui implant.\n\n4. Înțeleg și accept faptul că, pentru a beneficia de garanția de 2 ani, sunt obligat(ă) să urmez ședințele de control periodic din 3 în 3 luni în primul an, apoi din 6 în 6 luni, sau altfel, la indicațiile medicului.\n\n5. Mi-a fost explicat clar că în timpul sau în urma procedurilor chirurgicale este posibilă apariția unor complicații, cum ar fi durere, disconfort, umflături sau vânătăi. De asemenea, este posibilă apariția anesteziei prelungite sau permanente la nivelul buzei, bărbiei sau limbii în cazul intervențiilor de la mandibulă. În cazul procedurilor chirurgicale la nivelul sinusului maxilar este posibilă apariția unei hemoragii nazale.\nAm citit și am înțeles documentul cu riscurile tratamentului cu implanturi dentare.\n\n6. Înțeleg că manopere suplimentare de tratament pot fi aplicate în interesul meu, dacă o anumită situație (în timpul sau după procedura chirurgicală) o impune și ea nu a putut fi depistată decât intraoperator sau ulterior.\n\n7. Sunt de acord cu faptul că ar putea fi necesară administrarea de antibiotice pentru prevenirea infecțiilor și înțeleg că renunțarea la alcool și tutun este obligatorie pentru succesul pe termen lung. În cazul în care aceste indicații nu sunt respectate, înțeleg că este posibil ca garanția de 2 ani să nu se mai aplice.\n\n8. Înțeleg că eșecul mecanic, cum ar fi fracturarea coroanelor și punților sau slăbirea protezelor pe implanturi, ar putea să apară și necesită atenție clinică, dar este un eveniment rar. Sunt de acord ca, în primii 2 ani de la data aplicării coroanelor, punților sau protezelor pe implanturi, acestea să fie rectificate, reparate sau schimbate fără costuri, doar în cazul în care au fost întrebuințate conform indicațiilor medicului. În cazul în care deteriorarea coroanelor, punților sau protezelor pe implanturi a survenit în urma utilizării neadecvate, inclusiv a lipsei igienei orale, sunt de acord cu achitarea a 50% din costul lucrării protetice pentru reparație, rectificare sau înlocuire.\n\n9. Am completat corect și precis fișa medicală, inclusiv bolile fizice și psihice, medicația curentă, alergiile și alte reacții, și am transmis medicului toate situațiile medicale patologice sau diagnosticele cunoscute. De asemenea, declar că am răspuns afirmativ sau negativ la întrebarea dacă sunt sau nu fumător.\n\n10. Accept fotografierea, filmarea intervențiilor chirurgicale și folosirea radiografiilor pentru: documentarea cazului, realizarea portofoliului de pacienți, postarea în cadrul clinicii sau pe rețele de socializare și web sau prezentarea la congrese și conferințe, atâta timp cât identitatea nu este divulgată.\n\n11. Înțeleg că succesul tratamentului depinde în cea mai mare parte de o igienă foarte bună a cavității bucale. Sunt de acord cu controalele periodice obligatorii pentru acordarea garanției, în care ar putea fi necesare examinarea clinică și radiologică, igienizarea și alte manopere de întreținere, precum și cu costurile acestora, care sunt trecute în lista de prețuri.\n\n12. Declar că am primit o copie a acestui consimțământ, împreună cu scrisoarea planului de tratament propus cu costurile aferente, alternativele la tratamentul pe implanturi, riscurile tratamentului pe implant și indicațiile postoperatorii.\n\nÎnțeleg pe deplin tratamentul propus și costurile acestuia și sunt de acord cu tratamentul pe implanturi.\n\nConfirmarea medicului: confirm că am explicat pe înțelesul pacientului planul de tratament cu toate etapele, costurile aferente, riscurile și alternativele de tratament, care în judecata mea reprezintă cea mai bună variantă de tratament pentru așteptările funcționale, estetice și financiare ale pacientului. {{medic}}",
];

/** The same consents in English, for foreign patients (the tablet in English). */
const CONSENT_TYPES_EN = [
    'gdpr' => 'Processing of personal and health data',
    'tratament' => 'Informed consent for treatment',
    'foto' => 'Photographs and X-rays',
    'endodontic' => 'Informed consent for endodontic (root canal) treatment',
    'chirurgie' => 'Informed consent for surgical treatment',
    'implant' => 'Informed consent for implant treatment',
];
const CONSENT_DEFAULTS_EN = [
    'gdpr' => "I, the undersigned {{pacient}}, agree that {{firma}} may process my identification and contact data and the data concerning my health (medical history, investigations, X-rays, treatments performed), for providing dental care, for the medical records required by law and for invoicing.\n\nI have been informed that:\n– only the people in the clinic who need my data for treatment or invoicing have access to it;\n– medical and financial data are kept for as long as the law requires;\n– I may at any time request access to my data, its correction, restriction, portability or erasure, within the limits of the law, at {{email}};\n– I may lodge a complaint with the Romanian National Supervisory Authority for Personal Data Processing (www.dataprotection.ro).",
    'tratament' => "I, the undersigned {{pacient}}, declare that the dentist has explained to me, in a way I understand: the diagnosis, the proposed treatment, the alternatives, the benefits, the possible risks and complications (for example pain, bleeding, swelling, reactions to the anaesthetic), the duration and the estimated cost, as well as what may happen if I do not have the treatment.\n\nI was able to ask questions and received answers. I have correctly declared my illnesses, allergies and medication.\n\nI agree to the treatment below and to the necessary local anaesthesia. I know that I may withdraw my consent before any procedure begins.\n\nTreatment: ______________________________________________",
    'foto' => "I, the undersigned {{pacient}}, agree that {{firma}} may take photographs and X-rays of my teeth and face, for diagnosis and for documenting the treatment in my file.\n\n[  ] I also agree that the images, without my name and without features by which I could be recognised, may be used in professional presentations.\n\nI may withdraw this consent at any time, without my treatment being affected.",
    'endodontic' => "I, the undersigned {{pacient}}, regarding the endodontic (root canal) treatment performed by {{medic}} ({{interventie}}), declare the following.\n\nRisks of endodontic treatment:\n– I understand that many factors contribute to the success of root canal treatment and not all of them can be determined in advance. These factors may include: my resistance to infection, the bacteria causing the infection, the size, shape and location of the root canals. My case may be more difficult if my tooth has a blocked, curved or narrowed root canal system.\n– I understand that root canal treatment may not relieve my symptoms and may sometimes, for unexplained reasons, fail. In this case, other procedures (including retreatment or surgical treatment) may be necessary to save the tooth, or the tooth may have to be extracted.\n– I understand that during and after treatment I may experience some pain or discomfort, swelling, bleeding, and damage to or loss of the dental restoration. I may also need antibiotics to treat associated infections.\n– I understand that root canal instruments may separate (break) in the canal, which may or may not affect the prognosis of the tooth. If the separated fragment cannot be removed, it may be sealed inside the root canal or require additional treatment in the future.\n– I understand that other risks of root canal treatment include accidental perforation, sinus perforation and/or nerve damage.\n– I understand that a local anaesthetic will be administered by infiltration. I understand that there may be some discomfort after treatment at the injection site, as well as from keeping my mouth open during treatment.\n– I understand that within a maximum of one month of completing the root canal treatment I will undergo long-term restorative treatment of the treated tooth (filling, crown), in the office/clinic of my attending dentist.\n\nDepending on the diagnosis, there may be alternatives to endodontic treatment. These are:\n– extraction of the tooth involved;\n– leaving the tooth untreated: without endodontic treatment, my initial condition may worsen, with the following risks: severe localised pain, localised infections, severe infections of the neighbouring anatomical spaces, loss of the tooth involved and possibly of other neighbouring teeth, as well as generalised spread of the infection, which can in rare cases be fatal.\n\nConsent to the treatment plan\nI state that the diagnosis, the treatment plan and the estimated cost have been explained to me in a way that I understand; I accept the proposed treatments and will follow the instructions received. I have taken note of the possible risks, accidents and complications that may occur during and after the treatment, and I declare in full knowledge that I fully accept them as they were explained to me.",
    'chirurgie' => "I, the undersigned {{pacient}}, residing at {{adresa}}, telephone {{telefon}}, consent to the following surgical procedure: {{interventie}}.\n\nAll dento-alveolar surgical procedures involve a number of complications, some of them unavoidable:\n– allergic/toxic reactions to medicines and anaesthetic substances before, during and after surgery;\n– bleeding during and after surgery;\n– post-operative haematoma, bruising, swelling;\n– pain in the oral and maxillofacial area;\n– wound dehiscence (reopening);\n– injury to neighbouring teeth;\n– numbness/loss of sensation of the inferior alveolar, mental, lingual or infraorbital nerve;\n– infections of the cervico-facial fascial spaces;\n– osteitis/osteomyelitis of the jaw bones;\n– maxillary sinusitis;\n– oro-antral or oro-nasal communication;\n– fractures of the jaw bones;\n– accidents caused by instruments breaking during surgery;\n– abrasions, wounds, ulcers caused by contact of the mucosa with surgical instruments or medicinal substances.\n\nThe nature, purpose and benefits of this surgical procedure, the risks of not having it and the other therapeutic options have been explained to me in a way I understand by {{medic}}, whom I designate to perform the surgical procedure above.\n\nI have been informed of the associated risks, the possible accidents and complications, as well as the unforeseeable risks (including the risk of death), the consequences of the surgical procedure and the risks of the investigations it requires. I also understand the need for an interdisciplinary consultation, with a specialist opinion, before dento-alveolar surgery.\n\nI declare that I am aware of these risks, accidents and complications and I accept them, without later claiming material or moral damages from the attending dentist or the dental clinic.\n\nConsequently, I understand the need for this surgical procedure, which I wish to have, and I declare that I have received no guarantee or assurance regarding the final result.\n\nFor the surgical procedure I consent to local/regional anaesthesia, having been informed, in a way I understand, of the risks of anaesthetic substances in relation to my general health, pregnancy, allergies etc., and I am aware of the risks involved.\n\nAfter surgery I undertake to follow strictly all the recommendations of the attending dentist, not to drive if I have been warned that I was given medicines that may affect my level of consciousness, and to tell the attending dentist about any change that might suggest an unfavourable post-operative course.\n\nAccordingly, and under the conditions stated, I freely and knowingly give my consent to the surgical procedure described.\n\nIn accordance with Romanian Law no. 46/2003 on patients' rights, articles 19 and 20, I agree to take part, as a patient, in medical teaching and scientific research, and to be photographed/filmed before, during and after surgery, all of which may be used for teaching, medical and scientific purposes.\n\nI certify that I have read, understood and fully accept the above and therefore sign.",
    'implant' => "I, the undersigned {{pacient}}, regarding the implant treatment performed by {{medic}} ({{interventie}}), declare:\n\n1. I fully understand the purpose and nature of the procedures for placing dental implants and the subsequent prosthetic reconstruction on implants. I have read and understood the treatment plan (including the related costs), which was explained to me clearly and in a way I understand. I also agree to pay an advance, if one is required.\nI have read and understood the document describing the treatment alternatives and their advantages and disadvantages.\n\n2. The treatment alternatives for replacing missing teeth have been explained to me, but I prefer dental implants.\n\n3. I understand that all safety measures will be taken for the success of the treatment and of the surgical procedures, but the result cannot be guaranteed, although implant failure is not frequent. I accept and agree that if an implant fails within 2 years of placement, it will be replaced free of charge, and if it cannot be replaced for any reason, 50% of the cost of that implant will be refunded to me.\n\n4. I understand and accept that, to benefit from the 2-year guarantee, I must attend check-ups every 3 months in the first year, then every 6 months, or otherwise as the dentist instructs.\n\n5. It has been explained to me clearly that complications such as pain, discomfort, swelling or bruising may occur during or after surgery. Prolonged or permanent numbness of the lip, chin or tongue may also occur after procedures in the lower jaw. After surgical procedures in the area of the maxillary sinus, nosebleeds may occur.\nI have read and understood the document describing the risks of dental implant treatment.\n\n6. I understand that additional treatment may be carried out in my interest if a situation (during or after the surgical procedure) requires it and it could only be discovered during or after surgery.\n\n7. I agree that antibiotics may need to be given to prevent infection, and I understand that giving up alcohol and tobacco is essential for long-term success. If these instructions are not followed, I understand that the 2-year guarantee may no longer apply.\n\n8. I understand that mechanical failure, such as fracture of crowns and bridges or loosening of dentures on implants, may occur and requires clinical attention, but is rare. I agree that in the first 2 years after the crowns, bridges or dentures on implants are fitted, they will be adjusted, repaired or replaced free of charge, only if they were used according to the dentist's instructions. If the damage was caused by improper use, including poor oral hygiene, I agree to pay 50% of the cost of the prosthetic work for its repair, adjustment or replacement.\n\n9. I have filled in the medical questionnaire correctly and accurately, including physical and mental illnesses, current medication, allergies and other reactions, and I have told the dentist about all known medical conditions and diagnoses. I also declare that I have answered whether or not I am a smoker.\n\n10. I accept that the surgical procedures may be photographed and filmed and that the X-rays may be used for: documenting the case, the clinic's patient portfolio, posting within the clinic, on social networks and the web, or presentations at congresses and conferences, as long as my identity is not disclosed.\n\n11. I understand that the success of the treatment depends largely on very good oral hygiene. I agree to the compulsory periodic check-ups required for the guarantee, which may include clinical and X-ray examination, cleaning and other maintenance procedures, and to their costs, which are shown in the price list.\n\n12. I declare that I have received a copy of this consent, together with the letter describing the proposed treatment plan and its costs, the alternatives to implant treatment, the risks of implant treatment and the post-operative instructions.\n\nI fully understand the proposed treatment and its costs and I agree to the implant treatment.\n\nThe dentist's confirmation: I confirm that I have explained to the patient, in a way they understand, the treatment plan with all its stages, the related costs, the risks and the treatment alternatives, which in my judgement represent the best treatment option for the patient's functional, aesthetic and financial expectations. {{medic}}",
];

/** The tablet's languages. */
const CONSENT_LANGS = ['ro' => 'Română', 'en' => 'English'];

function consent_text(string $type, string $lang = 'ro'): string
{
    $custom = setting($lang === 'en' ? 'consent_texts_en' : 'consent_texts')[$type] ?? null;
    return is_string($custom) && trim($custom) !== '' ? $custom : (($lang === 'en' ? CONSENT_DEFAULTS_EN : CONSENT_DEFAULTS)[$type] ?? '');
}

function consent_label(string $type, string $lang = 'ro'): string
{
    return ($lang === 'en' ? CONSENT_TYPES_EN[$type] ?? null : null) ?? CONSENT_TYPES[$type] ?? CONSENT_RETIRED[$type] ?? $type;
}

/**
 * A consent's text for one patient: {{pacient}}, {{firma}}, {{clinica}}, {{email}} filled in. The
 * company is the one of the clinic where it is signed (the tablet's clinic, or the clinic chosen
 * for printing); without one, the patient's clinic. Each clinic is its own company, so every text
 * ends by naming the one the patient gives the consent to (it is kept with the signature).
 */
function consent_text_for(string $type, array $p, ?int $locationId = null, array $details = [], string $lang = 'ro'): string
{
    $locationId ??= $p['preferred_location_id'] ? (int) $p['preferred_location_id'] : null;
    $clinic = $locationId ? db_one('SELECT short_name FROM locations WHERE id = ?', [$locationId]) : null;
    $company = location_company($locationId);
    $firma = $company['legalName'] !== '' ? $company['legalName'] : 'Dental Arena';
    $clinica = 'Dental Arena' . ($clinic ? ' ' . $clinic['short_name'] : '');
    return strtr(consent_text($type, $lang), [
        '{{pacient}}' => trim($p['last_name'] . ' ' . $p['first_name']),
        '{{firma}}' => $firma,
        '{{clinica}}' => $clinica,
        '{{email}}' => content('site.email'),
        '{{telefon}}' => trim((string) ($p['phone'] ?? '')) !== '' ? format_phone((string) $p['phone']) : '____________________',
        '{{adresa}}' => implode(', ', array_filter([trim((string) ($p['street'] ?? '')), trim((string) ($p['city'] ?? '')), trim((string) ($p['county'] ?? ''))])) ?: '________________________________________',
        // Chosen with the tablet code; on paper, a line to write on.
        '{{medic}}' => trim((string) ($details['medic'] ?? '')) ?: 'Dr. ______________________________',
        '{{interventie}}' => trim((string) ($details['interventie'] ?? '')) ?: '________________________________________',
    ]) . ($lang === 'en'
        ? "\n\nThis consent is given to {$firma}" . ($company['cui'] !== '' ? " (tax code {$company['cui']})" : '') . ", for the clinic {$clinica}."
        : "\n\nAcordul este dat către {$firma}" . ($company['cui'] !== '' ? " (CUI {$company['cui']})" : '') . ", pentru clinica {$clinica}.");
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
    if (can('procedures', $user)) {
        $tabs['proceduri'] = 'Proceduri și plăți';
    }
    if (can('billing', $user)) {
        $tabs['financiar'] = 'Facturi și plăți';
    }
    $tabs['documente'] = 'Documente și acorduri';
    $tabs['sterilizare'] = 'Sterilizare';
    $tabs['mesaje'] = 'Mesaje';
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
        $actions .= '<a href="/admin/programari/noua?pacient=' . $id . '" class="' . e(btn($extraActions === '' || str_contains($extraActions, 'consultatie-ai') ? 'primary' : 'secondary')) . '">' . icon('calendar-plus', 18) . 'Programare nouă</a>'
            . ($p['phone'] !== '' ? '<a href="' . e(tel_href($p['phone'])) . '" class="' . e(btn('secondary')) . '">' . icon('phone', 18) . 'Sunați</a>' : '');
    }
    $nav = '';
    foreach (patient_tabs($user) as $slug => $label) {
        $href = '/admin/pacienti/' . $id . ($slug !== '' ? '/' . $slug : '');
        $on = $slug === $active;
        $nav .= '<a href="' . e($href) . '"' . ($on ? ' aria-current="page"' : '') . ' class="' . e(cn('inline-flex min-h-control shrink-0 items-center border-b-2 px-3 text-control', $on ? 'border-actiune font-semibold text-cerneala' : 'border-transparent text-discret hover:text-cerneala')) . '">' . e($label) . '</a>';
    }
    $chips = alert_chips($alerts, 'text-corp') . comfort_chip($p['comfort']);
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
    $c = location_company($clinic ? (int) $clinic['id'] : null);
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
    'cod-qr-poze' => 'Cod QR pentru poze de pe telefon',
    'programare-nu-raspunde' => 'Programare: sunat, nu răspunde',
    'programare-nu-raspunde-scos' => 'Programare: scoasă bifa „nu răspunde”',
    'document-deschis' => 'Document deschis',
    'document-sters' => 'Document șters',
    'acord' => 'Acord înregistrat',
    'acord-retras' => 'Acord retras',
    'acord-tiparit' => 'Formular de acord tipărit',
    'gdpr-export' => 'GDPR: date exportate',
    'pacient-anonimizat' => 'GDPR: fișă anonimizată',
    'cerere-gdpr' => 'GDPR: cerere în registru',
    'mesaj-trimis' => 'Mesaj trimis pacientului',
    'mesaj-proba' => 'Mesaj de probă',
    'setari-mesaje' => 'Setările mesajelor',
    'dezabonare' => 'Dezabonare de la oferte',
    'campanie' => 'Campanie de marketing',
    'consultatie-ai' => 'Consultație analizată cu AI',
    'consultatie-ai-aplicata' => 'Propunerile AI aplicate în fișă',
    'setari-ai' => 'Setările asistentului AI',
    'tableta-asociata' => 'Tabletă de semnare asociată',
    'tableta-oprita' => 'Tabletă de semnare oprită',
    'cod-tableta' => 'Cod de semnare pe tabletă',
    'cod-tableta-anulat' => 'Cod de semnare anulat',
    'semnat-tableta' => 'Acorduri semnate pe tabletă',
    'chestionar-aplicat' => 'Chestionarul pacientului trecut în anamneză',
    'chestionar-respins' => 'Chestionarul pacientului respins',
    'acord-semnat-vazut' => 'Acord semnat deschis',
    'programare-online' => 'Programare făcută de pacient în chatul de pe site',
    'setari-chat' => 'Setările chatului de pe site',
    'chat-sters' => 'Conversație din chat ștearsă',
    'actualizare' => 'Site-ul actualizat dintr-o arhivă',
    'absenta' => 'Absență sau zi liberă adăugată',
    'implant-nou' => 'Caz de implant nou',
    'implant-etapa' => 'Etapă la implant',
    'eticheta' => 'Etichetă la pacient',
    'nota-modificata' => 'Notă modificată',
    'nota-stearsa' => 'Notă ștearsă',
    'cnp-vazut' => 'CNP afișat întreg',
    'sesiuni-inchise' => 'Toate sesiunile unui cont închise',
    'programare-mutata' => 'Programare mutată în calendar',
    'programare-mutare-anulata' => 'Mutarea unei programări anulată',
    'programare-revenire' => 'Programare readusă la o stare anterioară',
    'absenta-stearsa' => 'Absență sau zi liberă ștearsă',
    'setari-programari' => 'Setările programărilor online',
    'actualizare-revenire' => 'Site-ul pus înapoi la o versiune de dinainte',
];

/** The steps of an implant case: name, and the usual days until the next step. */
const IMPLANT_STAGES = [
    'planificat' => ['Planificat', 0],
    'inserat' => ['Implant inserat', 90],
    'descoperit' => ['Descoperit, bont de vindecare', 21],
    'amprenta' => ['Amprentă luată', 14],
    'protezat' => ['Lucrarea finală pusă', 365],
    'control' => ['Control anual', 365],
    'incheiat' => ['Încheiat', null],
];

/** The implant cases of a patient, or of everyone not finished (with the patient's name). */
function implant_cases(?int $patientId = null): array
{
    return $patientId !== null
        ? db_all('SELECT * FROM implant_cases WHERE patient_id = ? ORDER BY created_at DESC', [$patientId])
        : db_all("SELECT c.*, p.first_name, p.last_name, p.file_number, p.phone FROM implant_cases c JOIN patients p ON p.id = c.patient_id WHERE c.stage <> 'incheiat' AND p.active = 1 ORDER BY c.next_due IS NULL, c.next_due, c.id");
}

/** A case moves to a step on a date; the next step is due after the usual interval. */
function implant_set_stage(array $case, string $stage, string $date, array $user): void
{
    $dates = json_decode((string) $case['stage_dates'], true) ?: [];
    $dates[$stage] = $date;
    $days = IMPLANT_STAGES[$stage][1];
    db_update('implant_cases', ['stage' => $stage, 'stage_dates' => json_encode($dates), 'next_due' => $days ? date('Y-m-d', strtotime("{$date} +{$days} days")) : null, 'updated_at' => now_sql()], 'id = :id', ['id' => $case['id']]);
    audit('implant-etapa', "#{$case['id']} ({$case['teeth']}): " . IMPLANT_STAGES[$stage][0], (int) $user['id'], (int) $case['patient_id']);
}

/** What VITIM does that the administrator is told about: everything but looking and printing. */
const TECH_QUIET_ACTIONS = ['autentificare', 'iesire', 'fisa-deschisa', 'factura-tiparita', 'chitanta-tiparita', 'acord-tiparit', 'plan-tiparit'];

/** The technical account's changes after an audit id, newest first. */
function tech_changes(int $afterId = 0, int $limit = 50): array
{
    $quiet = "'" . implode("','", TECH_QUIET_ACTIONS) . "'";
    return db_all(
        "SELECT a.id, a.action, a.detail, a.created_at, u.name FROM audit_log a JOIN users u ON u.id = a.user_id
         WHERE u.role = 'tehnic' AND a.id > ? AND a.action NOT IN ({$quiet}) ORDER BY a.id DESC LIMIT " . max(1, $limit),
        [$afterId],
    );
}

function tech_change_line(array $c): string
{
    $detail = trim((string) $c['detail']);
    return date('d.m H:i', strtotime($c['created_at'])) . ' · ' . audit_label($c['action']) . ($detail !== '' ? ': ' . mb_strimwidth($detail, 0, 200, '…') : '');
}

/**
 * The administrators get one e-mail with what VITIM changed, once VITIM has been quiet for ten
 * minutes (one summary for a whole session of work, not one per click).
 */
function send_tech_digest(?DateTimeImmutable $now = null): int
{
    $now ??= new DateTimeImmutable();
    $rows = tech_changes((int) setting('vitim_rezumat_pana'), 200);
    if ($rows === [] || strtotime($rows[0]['created_at']) > $now->getTimestamp() - 600) {
        return 0;
    }
    $lines = implode("\n", array_map(static fn ($c) => '- ' . tech_change_line($c), array_reverse($rows)));
    $body = "Bună ziua,\n\nSuportul tehnic (VITIM) a făcut aceste modificări în panoul Dental Arena:\n\n{$lines}\n\nLe vedeți și pe pagina Azi din panou: " . absolute_url('/admin') . "\n";
    $n = 0;
    foreach (db_all("SELECT * FROM users WHERE role IN ('admin', 'admin-medic') AND active = 1") as $u) {
        if (filter_var($u['email'], FILTER_VALIDATE_EMAIL)) {
            $n += (int) (bool) queue_message(['event' => 'staff-configurare', 'user_id' => (int) $u['id'], 'channel' => 'email', 'to_address' => $u['email'], 'subject' => 'Dental Arena: ce a configurat VITIM', 'body' => $body]);
        }
    }
    setting_save('vitim_rezumat_pana', (int) $rows[0]['id']);
    return $n;
}

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
