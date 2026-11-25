-- Stage 5: consents signed on the reception tablet, the patient's own medical questionnaire,
-- the doctors' working hours for online booking, and the AI chat on the site.

-- Tablets allowed to open /tableta (paired from the panel; the cookie holds a random token).
CREATE TABLE kiosk_devices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  location_id INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  last_seen_at DATETIME NULL,
  revoked_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A signing session: reception picks what the patient signs and gives a 6-digit code.
CREATE TABLE consent_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  code CHAR(6) NOT NULL,
  types VARCHAR(190) NOT NULL,
  with_history TINYINT(1) NOT NULL DEFAULT 0,
  with_marketing TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'asteptare',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  opened_at DATETIME NULL,
  signed_at DATETIME NULL,
  device_id INT UNSIGNED NULL,
  KEY consent_sessions_code (code, status),
  KEY consent_sessions_patient (patient_id, created_at),
  CONSTRAINT fk_cs_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- What exactly was signed: the text at that moment, the signature, and a fingerprint of both.
ALTER TABLE consents ADD COLUMN text_snapshot MEDIUMTEXT NULL AFTER text_version;
ALTER TABLE consents ADD COLUMN session_id INT UNSIGNED NULL AFTER document_id;
ALTER TABLE consents ADD COLUMN signed_at DATETIME NULL AFTER signed_on;
ALTER TABLE consents ADD COLUMN integrity_hash CHAR(64) NULL AFTER session_id;

-- Forms the patient fills in (the medical questionnaire on the tablet), until a doctor applies them.
CREATE TABLE patient_forms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  kind VARCHAR(20) NOT NULL,
  data TEXT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'nou',
  session_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  KEY patient_forms_patient (patient_id, status),
  CONSTRAINT fk_pf_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- When each doctor works at each clinic (JSON: weekday 1–7 → ["09:00", "17:00"]), for the slots
-- the chat offers. Empty = not bookable online at that clinic.
ALTER TABLE doctor_locations ADD COLUMN schedule TEXT NULL;

-- The AI chat on the site: one row per conversation, the messages as the API needs them.
CREATE TABLE chat_conversations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token CHAR(32) NOT NULL UNIQUE,
  ip_hash CHAR(64) NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'activ',
  turns INT NOT NULL DEFAULT 0,
  phone VARCHAR(40) NULL,
  otp_hash CHAR(64) NULL,
  otp_expires_at DATETIME NULL,
  otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  phone_verified_at DATETIME NULL,
  lead_id INT UNSIGNED NULL,
  appointment_id INT UNSIGNED NULL,
  patient_id INT UNSIGNED NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  last_at DATETIME NOT NULL,
  KEY chat_last (last_at),
  KEY chat_ip (ip_hash, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT UNSIGNED NOT NULL,
  role VARCHAR(10) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  display TEXT NULL,
  created_at DATETIME NOT NULL,
  KEY chat_messages_conv (conversation_id, id),
  CONSTRAINT fk_cm_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
