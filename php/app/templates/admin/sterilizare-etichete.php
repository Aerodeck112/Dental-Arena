<?php
/**
 * /admin/sterilizare/{id}/etichete: the labels of a cycle's pouches, one per page of 62 mm × the
 * height set (29, 40, 50 or 62 mm), for a label printer (Brother QL and the like, 62 mm roll):
 * the clinic, the content, sterilized and expiry day, the cycle, the autoclave and the program,
 * who ran it, the pouch's code and its QR. ?plic=3 prints only that one again.
 */
declare(strict_types=1);

require_once APP_DIR . '/src/admin/sterilization.php';

$cycle = db_one('SELECT c.*, u.name AS operator, l.short_name AS clinic FROM sterilization_cycles c JOIN locations l ON l.id = c.location_id LEFT JOIN users u ON u.id = c.operator_id WHERE c.id = ?', [(int) $param]);
if ($cycle === null || !in_array((int) $cycle['location_id'], allowed_location_ids($user), true)) {
    admin_not_found($user);
}
$s = steril_settings();
$h = in_array((int) query('inaltime'), [29, 40, 50, 62], true) ? (int) query('inaltime') : (int) $s['label_height'];
$one = admin_int(query('plic'));
$packs = db_all('SELECT * FROM sterilization_packs WHERE cycle_id = ?' . ($one !== null ? ' AND pack_no = ?' : '') . ' ORDER BY pack_no', $one !== null ? [(int) $cycle['id'], $one] : [(int) $cycle['id']]);
$small = $h <= 29;
$qr = $small ? 15 : 19;
$total = (int) db_value('SELECT COUNT(*) FROM sterilization_packs WHERE cycle_id = ?', [(int) $cycle['id']]);
$labels = '';
foreach ($packs as $k) {
    $svg = qr_svg(absolute_url('/admin/sterilizare/plic/' . $k['code']), 200) ?? '';
    $labels .= '<section class="eticheta">'
        . '<div class="sus"><div class="text">'
        . '<p class="clinica">DENTAL ARENA · ' . e(mb_strtoupper((string) $cycle['clinic'])) . '</p>'
        . '<p class="continut">' . e($k['content']) . '</p>'
        . '<p>Sterilizat: <b>' . e(date('d.m.Y', strtotime($cycle['sterilized_on']))) . '</b></p>'
        . '<p>Expiră: <b>' . e(date('d.m.Y', strtotime($cycle['expires_on']))) . '</b></p>'
        . (!$small ? '<p>Ciclul ' . (int) $cycle['cycle_no'] . ($cycle['autoclave'] !== '' ? ' · ' . e($cycle['autoclave']) : '') . '</p>' . ($cycle['program'] !== '' ? '<p>' . e($cycle['program']) . '</p>' : '') . ($cycle['operator'] ? '<p>Op.: ' . e($cycle['operator']) . '</p>' : '') : '')
        . '</div><div class="qr" style="width:' . $qr . 'mm;height:' . $qr . 'mm">' . $svg . '</div></div>'
        . '<p class="cod">' . e($k['code']) . ($small ? ' · ciclul ' . (int) $cycle['cycle_no'] : ' · plicul ' . (int) $k['pack_no'] . '/' . $total) . '</p>'
        . '</section>';
}
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
$heights = ['29' => '62 × 29', '40' => '62 × 40', '50' => '62 × 50', '62' => '62 × 62'];
?>
<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Etichete sterilizare · ciclul <?= (int) $cycle['cycle_no'] ?></title>
<script src="<?= e(asset(is_file(PUBLIC_DIR . '/assets/admin.min.js') ? '/assets/admin.min.js' : '/assets/admin.js')) ?>" defer></script>
<style>
  @page { size: 62mm <?= $h ?>mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #eef1ef; }
  .bara { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 16px; font-size: 14px; }
  .bara a, .bara button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid #555; background: #fff; color: #000; text-decoration: none; cursor: pointer; }
  .bara button.tipar { background: #1F6B4C; border-color: #1F6B4C; color: #fff; font-weight: bold; }
  .bara .nota { flex-basis: 100%; color: #444; font-size: 13px; }
  .foi { display: flex; flex-wrap: wrap; gap: 10px; padding: 0 16px 24px; }
  .eticheta { width: 62mm; height: <?= $h ?>mm; padding: 2mm 2.5mm; background: #fff; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; outline: 1px dashed #999; }
  .eticheta p { margin: 0; font-size: <?= $small ? '6.6' : '7.4' ?>pt; line-height: 1.22; }
  .sus { display: flex; gap: 1.5mm; justify-content: space-between; }
  .text { min-width: 0; }
  .clinica { font-weight: bold; letter-spacing: .02em; font-size: <?= $small ? '6' : '6.6' ?>pt !important; }
  .continut { font-weight: bold; font-size: <?= $small ? '9' : '10.5' ?>pt !important; line-height: 1.1 !important; margin: .4mm 0 .6mm !important; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .qr { flex-shrink: 0; }
  .cod { font-family: "Courier New", monospace; font-weight: bold; font-size: <?= $small ? '7' : '8' ?>pt !important; }
  @media print {
    body { background: #fff; }
    .bara { display: none; }
    .foi { display: block; padding: 0; }
    .eticheta { outline: 0; break-after: page; page-break-after: always; }
  }
</style>
</head>
<body>
<div class="bara">
  <a href="/admin/sterilizare">‹ Sterilizare</a>
  <button type="button" class="tipar" data-tipareste>Tipăriți <?= count_ro(count($packs), 'eticheta', 'etichete') ?></button>
  <?php foreach ($heights as $k => $l) { ?><a href="<?= e(admin_url('/admin/sterilizare/' . (int) $cycle['id'] . '/etichete', ['inaltime' => $k] + ($one !== null ? ['plic' => $one] : []))) ?>"<?= (int) $k === $h ? ' style="font-weight:bold;border-width:2px"' : '' ?>><?= e($l) ?> mm</a><?php } ?>
  <p class="nota">La tipărire: imprimanta de etichete, hârtia „62 mm” (rola continuă, de exemplu Brother DK-22205) sau eticheta de 62 × <?= $h ?> mm, margini „Niciuna”, scala 100%. Fiecare etichetă iese pe o pagină.</p>
</div>
<div class="foi"><?= $labels ?></div>
</body>
</html>
