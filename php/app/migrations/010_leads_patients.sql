-- Stage 6b: requests handled like a small pipeline (who takes care of it, what was done, why it
-- was lost), patient tags, pinned and editable notes, a guardian who is a patient too, the
-- implant cases followed step by step, and „close all sessions” and the panel's theme per account.
ALTER TABLE leads ADD COLUMN assigned_to INT UNSIGNED NULL;
ALTER TABLE leads ADD COLUMN lost_reason VARCHAR(20) NULL;
CREATE TABLE lead_activities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  kind VARCHAR(12) NOT NULL,
  outcome VARCHAR(16) NULL,
  body TEXT NULL,
  created_at DATETIME NOT NULL,
  KEY lead_activities_lead (lead_id, created_at),
  CONSTRAINT fk_la_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tags (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  color VARCHAR(12) NOT NULL DEFAULT 'menta',
  created_at DATETIME NOT NULL,
  UNIQUE KEY tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE patient_tags (
  patient_id INT UNSIGNED NOT NULL,
  tag_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (patient_id, tag_id),
  KEY patient_tags_tag (tag_id),
  CONSTRAINT fk_pt_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_pt_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE patient_notes ADD COLUMN pinned TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE patient_notes ADD COLUMN updated_at DATETIME NULL;
ALTER TABLE patients ADD COLUMN guardian_patient_id INT UNSIGNED NULL;

CREATE TABLE implant_cases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NULL,
  teeth VARCHAR(40) NOT NULL,
  system_name VARCHAR(80) NULL,
  stage VARCHAR(12) NOT NULL,
  stage_dates TEXT NULL,
  next_due DATE NULL,
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY implant_cases_patient (patient_id),
  KEY implant_cases_due (stage, next_due),
  CONSTRAINT fk_ic_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN theme VARCHAR(10) NULL
