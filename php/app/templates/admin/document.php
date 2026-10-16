<?php
/**
 * /admin/documente/{id}: sends a patient's file to a user who may see the patient. Images and
 * PDFs open in the browser; ?descarca=1 downloads.
 */
declare(strict_types=1);

$d = db_one('SELECT * FROM patient_documents WHERE id = ? AND deleted_at IS NULL', [(int) $param]);
if ($d === null || find_patient((int) $d['patient_id'], $user) === null) {
    admin_not_found($user);
}
$file = documents_dir() . '/' . basename($d['stored_name']);
if (!is_file($file)) {
    admin_not_found($user);
}
if (!str_starts_with($d['mime'], 'image/') || query('descarca') === '1') {
    audit('document-deschis', $d['title'], null, (int) $d['patient_id']);
}
$name = preg_replace('/[^\pL\pN._ -]+/u', '_', $d['original_name']) ?: 'document';
header('Content-Type: ' . (isset(DOC_MIME[$d['mime']]) ? $d['mime'] : 'application/octet-stream'));
header('Content-Length: ' . filesize($file));
header('Content-Disposition: ' . (query('descarca') === '1' ? 'attachment' : 'inline') . '; filename="' . str_replace('"', '', preg_replace('/[^\x20-\x7e]/', '_', $name) ?: 'document') . '"; filename*=UTF-8\'\'' . rawurlencode($name));
header('X-Content-Type-Options: nosniff');
if ($d['mime'] !== 'application/pdf') {
    // Chrome does not open PDFs under a sandbox policy; images get the strictest one.
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
}
header('Cache-Control: private, no-store');
readfile($file);
exit;
