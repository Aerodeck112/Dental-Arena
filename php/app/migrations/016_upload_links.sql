-- October 2026: photos from the phone. On the patient's „Sterilizare” tab the panel shows a QR code;
-- the phone that scans it opens /incarca/<code> and sends photos straight into the patient's file,
-- without signing in. The code works for an hour, only for that patient, only to add photos; the
-- database keeps only its SHA-256.
CREATE TABLE upload_links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  kind VARCHAR(32) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  uploads INT UNSIGNED NOT NULL DEFAULT 0,
  last_upload_at DATETIME NULL,
  UNIQUE KEY upload_links_token (token_hash),
  KEY upload_links_patient (patient_id, expires_at),
  CONSTRAINT fk_upl_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
