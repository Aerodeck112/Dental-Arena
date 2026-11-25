<?php
/**
 * November 2026: the clinic has a contract with MEDOC. As with CAS, the site shows only that: a
 * page „Servicii prin contract cu MEDOC”, without prices. The contract's list (from the clinic's
 * Word file) stays in the panel: every row is hidden on the site, and „Adaugă procedură” offers it
 * at both clinics, with its price (0 lei = nothing to pay). Run once; a list already there is kept.
 */
declare(strict_types=1);

$rows = [
    ['ABCES DENTAR', 0],
    ['CIMENTARE CU CIMENT GLASIONOMER', 0],
    ['CONSULTATIE PRIMARA PROTETICA', 0],
    ['CONSULTATIE SPECIALIST PROTETICA', 0],
    ['CONTROL INITIAL MEDIC IMPLANTOLOG', 0],
    ['CONTROL INITIAL MEDIC SPECIALIST ORTODONT', 50],
    ['CONTROL INITIAL MEDIC SPECIALIST PARODONTOLOG', 50],
    ['COROANA PROVIZORIE PMMA', 100],
    ['COROANA PROVIZORIE CABINET', 0],
    ['DETARTRAJ', 100],
    ['ECHILIBRARE OCLUZALA', 0],
    ['EXAMEN INITIAL', 0],
    ['EXAMEN ANUAL', 0],
    ['EXTRACTIE CHIRURGICALA', 0],
    ['EXTRACTIE COMPLICATA A UNUI DINTE TEMPORAR', 0],
    ['EXTRACTIE SIMPLA A UNUI DINTE TEMPORAR', 0],
    ['EXTRACTIE SIMPLA MONORADICULAR', 0],
    ['EXTRACTIE SIMPLA PLURIRADICULARI', 50],
    ['IMOBILIZARE DINTI PARODONTOTICI/DINTE', 0],
    ['IMPLANT DENTAR MIS', 1500],
    ['INDEPARTARE COROANA', 0],
    ['INDEPARTARE PLAN DE TRATAMENT', 0],
    ['OBTURATIE FIZIONOMICA D', 0],
    ['OBTURATIE FIZIONOMICA DO', 40],
    ['OBTURATIE FIZIONOMICA I/O', 0],
    ['OBTURATIE FIZIONOMICA L', 0],
    ['OBTURATIE FIZIONOMICA M', 0],
    ['OBTURATIE FIZIONOMICA MO', 40],
    ['OBTURATIE FIZIONOMICA MOD', 50],
    ['OBTURATIE FIZIONOMICA P', 0],
    ['OBTURATIE FIZIONOMICA V', 0],
    ['OBTURATIE FIZIONOMICA ATIPICA', 50],
    ['OBTURATIE FIZIONOMICA CERVICALA', 0],
    ['OBTURATIE FIZIONOMICA FRONTALA', 25],
    ['PERICONORANITA', 0],
    ['PROTEZA ACRILICA PARTIALA', 650],
    ['PROTEZA ACRILICA TOTALA', 400],
    ['PULPOTOMIE', 0],
    ['RADIOGRAFIE BITE-WING', 0],
    ['RADIOGRAFIE RETROALVEOLARA', 0],
    ['REALIZAREA MULAJULUI DE ANALIZA A OCLUZIEI', 0],
    ['RECONSTRUCTIE CORONO-RADICULARA (PIVOT FIBRA DE STICLA)', 150],
    ['RELUARE TRATAMENT DE CANAL 1 CANAL', 25],
    ['RELUARE TRATAMENT DE CANAL 2 CANALE', 25],
    ['RELUARE TRATAMENT DE CANAL 3 CANALE', 125],
    ['TRATAMENT DE CANAL 1 CANAL', 75],
    ['TRATAMENT DE CANAL 2 CANALE', 75],
    ['TRATAMENT DE CANAL 3 CANALE', 125],
    ['URGENTE NESPECIFICE', 0],
];

$now = date('Y-m-d H:i:s');
$find = $pdo->prepare("SELECT id FROM categories WHERE slug = 'servicii-medoc' OR name LIKE '%MEDOC%' ORDER BY id LIMIT 1");
$find->execute();
$catId = $find->fetchColumn();
if ($catId === false) {
    $sort = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories')->fetchColumn();
    $pdo->prepare('INSERT INTO categories (slug, name, summary, lead, body, sort_order, public_visible) VALUES (?, ?, ?, ?, ?, ?, 1)')->execute([
        'servicii-medoc',
        'Servicii prin contract cu MEDOC',
        'Avem contract cu MEDOC.',
        'Avem contract cu MEDOC.',
        "Dental Arena are contract cu MEDOC. Dacă sunteți client MEDOC, spuneți-ne când vă programați.\n\nCe servicii sunt incluse și cât plătiți aflați la telefon, la clinica la care veniți.",
        $sort,
    ]);
    $catId = (int) $pdo->lastInsertId();
}
$has = $pdo->prepare('SELECT 1 FROM services WHERE category_id = ? AND name = ?');
$add = $pdo->prepare('INSERT INTO services (category_id, code, name, price_min, price_max, price_from, unit, representative, public_visible, sort_order, updated_at) VALUES (?, NULL, ?, ?, NULL, 0, NULL, 0, 0, ?, ?)');
foreach ($rows as $i => [$name, $lei]) {
    $has->execute([(int) $catId, $name]);
    if ($has->fetchColumn() === false) {
        $add->execute([(int) $catId, $name, $lei * 100, $i + 1, $now]);
    }
}
