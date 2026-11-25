-- Stage 2: patients, medical history, appointments, recalls; doctors' clinics and the link
-- between a doctor's panel account and their profile.

ALTER TABLE users ADD COLUMN doctor_id INT UNSIGNED NULL AFTER role;

CREATE TABLE doctor_locations (
  doctor_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (doctor_id, location_id),
  CONSTRAINT fk_dl_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE CASCADE,
  CONSTRAINT fk_dl_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every doctor works at both clinics until the clinic says otherwise (Echipa → medic).
INSERT INTO doctor_locations (doctor_id, location_id) SELECT d.id, l.id FROM doctors d CROSS JOIN locations l;

CREATE TABLE patients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_number INT UNSIGNED NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  search_text VARCHAR(400) NOT NULL DEFAULT '',
  cnp_enc VARCHAR(255) NULL,
  cnp_hash CHAR(64) NULL UNIQUE,
  birth_date DATE NULL,
  sex CHAR(1) NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(190) NULL,
  street VARCHAR(190) NULL,
  city VARCHAR(80) NULL,
  county VARCHAR(80) NULL,
  guardian_name VARCHAR(160) NULL,
  preferred_location_id INT UNSIGNED NULL,
  primary_doctor_id INT UNSIGNED NULL,
  comfort VARCHAR(16) NULL,
  prefers_sedation TINYINT(1) NOT NULL DEFAULT 0,
  email_reminders TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY patients_name (last_name, first_name),
  KEY patients_phone (phone),
  KEY patients_search (search_text(191)),
  CONSTRAINT fk_patients_location FOREIGN KEY (preferred_location_id) REFERENCES locations (id) ON DELETE SET NULL,
  CONSTRAINT fk_patients_doctor FOREIGN KEY (primary_doctor_id) REFERENCES doctors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_histories (
  patient_id INT UNSIGNED NOT NULL PRIMARY KEY,
  allergies TEXT NULL,
  medications TEXT NULL,
  anticoagulants TINYINT(1) NOT NULL DEFAULT 0,
  cardiac_disease TINYINT(1) NOT NULL DEFAULT 0,
  hypertension TINYINT(1) NOT NULL DEFAULT 0,
  diabetes TINYINT(1) NOT NULL DEFAULT 0,
  asthma TINYINT(1) NOT NULL DEFAULT 0,
  epilepsy TINYINT(1) NOT NULL DEFAULT 0,
  hepatitis TINYINT(1) NOT NULL DEFAULT 0,
  hiv TINYINT(1) NOT NULL DEFAULT 0,
  bleeding_disorder TINYINT(1) NOT NULL DEFAULT 0,
  bisphosphonates TINYINT(1) NOT NULL DEFAULT 0,
  pregnancy TINYINT(1) NOT NULL DEFAULT 0,
  smoker TINYINT(1) NOT NULL DEFAULT 0,
  other_conditions TEXT NULL,
  reviewed_at DATETIME NULL,
  reviewed_by INT UNSIGNED NULL,
  CONSTRAINT fk_mh_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NULL,
  category_slug VARCHAR(64) NULL,
  reason VARCHAR(255) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'programat',
  comfort VARCHAR(16) NULL,
  wants_sedation TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  confirmed_at DATETIME NULL,
  arrived_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  cancel_reason VARCHAR(255) NULL,
  no_show_at DATETIME NULL,
  reminder_sent_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY appt_location (location_id, starts_at),
  KEY appt_doctor (doctor_id, starts_at),
  KEY appt_patient (patient_id, starts_at),
  KEY appt_status (status, starts_at),
  CONSTRAINT fk_appt_location FOREIGN KEY (location_id) REFERENCES locations (id),
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patient_notes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  appointment_id INT UNSIGNED NULL,
  author_id INT UNSIGNED NULL,
  body TEXT NOT NULL,
  clinical TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  KEY notes_patient (patient_id, created_at),
  CONSTRAINT fk_notes_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_appt FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recalls (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NULL,
  doctor_id INT UNSIGNED NULL,
  reason VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'de-facut',
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at DATETIME NULL,
  outcome_note TEXT NULL,
  source_appointment_id INT UNSIGNED NULL,
  booked_appointment_id INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY recalls_due (status, due_date),
  CONSTRAINT fk_recalls_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_recalls_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL,
  CONSTRAINT fk_recalls_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE leads ADD COLUMN patient_id INT UNSIGNED NULL, ADD COLUMN appointment_id INT UNSIGNED NULL;
