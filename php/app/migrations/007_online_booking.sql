-- Stage 6a: days off (doctors' leave, clinic closures), online booking with real free times on
-- the site, and the patient's link to the appointment (confirm, cancel, add to calendar).

-- Leave, training, blocked hours, clinic closures. Doctor only = absent everywhere; doctor and
-- clinic = absent at that clinic; clinic only = the clinic is closed. ends_at is exclusive.
CREATE TABLE time_off (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT UNSIGNED NULL,
  location_id INT UNSIGNED NULL,
  kind VARCHAR(12) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  reason VARCHAR(200) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  KEY time_off_doctor (doctor_id, starts_at),
  KEY time_off_location (location_id, starts_at),
  CONSTRAINT fk_to_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE CASCADE,
  CONSTRAINT fk_to_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Whether a doctor takes bookings from the site (and the chat).
ALTER TABLE doctors ADD COLUMN accepts_online TINYINT(1) NOT NULL DEFAULT 1;

-- How long each service takes, and which ones the site offers as a reason for booking.
ALTER TABLE services ADD COLUMN duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30;
ALTER TABLE services ADD COLUMN bookable_online TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN online_label VARCHAR(80) NULL;
ALTER TABLE services ADD COLUMN online_hint VARCHAR(190) NULL;
ALTER TABLE services ADD COLUMN urgent TINYINT(1) NOT NULL DEFAULT 0;

-- Where an appointment came from, the link's version (a move or a cancel ends the old link),
-- how it was confirmed and who cancelled it.
ALTER TABLE appointments ADD COLUMN source VARCHAR(12) NULL;
ALTER TABLE appointments ADD COLUMN service_id INT UNSIGNED NULL;
ALTER TABLE appointments ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN confirmed_via VARCHAR(12) NULL;
ALTER TABLE appointments ADD COLUMN cancelled_by VARCHAR(10) NULL;

-- A booking sent twice (double click, reload) is saved once.
ALTER TABLE leads ADD COLUMN idempotency_key CHAR(32) NULL;
ALTER TABLE leads ADD UNIQUE KEY leads_idempotency (idempotency_key);

-- Simple counters for the public forms' limits (per IP, per phone).
CREATE TABLE rate_limits (
  k VARCHAR(120) NOT NULL PRIMARY KEY,
  n INT UNSIGNED NOT NULL DEFAULT 0,
  reset_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The durations and the five online reasons of the first version.
UPDATE services SET duration_minutes = 45 WHERE code IN ('CON-DETARTRAJ', 'SG-OBT-COMPOZIT', 'CH-EXT-PLURI', 'CH-EXT-MINTE', 'PR-REBAZARE', 'PED-OBT-PERM', 'EST-ALBIRE-INTERNA');
UPDATE services SET duration_minutes = 60 WHERE code IN ('CON-AIRFLOW', 'CON-ALBIRE', 'SG-OBT-ESTETICA', 'SG-PIVOT', 'SG-ENDO-MONO', 'SG-RETRAT-MONO', 'INH-ORA', 'IMP-PROT-MAND2', 'IMP-PROT-MAX4', 'CH-EXT-ALVEOLOTOMIE', 'PR-MC', 'PR-ZR', 'PR-MC-IMPLANT', 'PR-ZR-IMPLANT', 'PR-EMAX', 'PR-SCHELETATA', 'PR-BIOHPP', 'ORT-INDEPARTARE', 'PAR-IMOBILIZARE', 'PAR-CHIURETAJ');
UPDATE services SET duration_minutes = 90 WHERE code IN ('SG-ENDO-PLURI', 'SG-RETRAT-PLURI', 'IMP-NEODENT', 'IMP-ADITIE', 'CH-ODONTECTOMIE', 'ORT-METALIC', 'ORT-CERAMIC', 'EST-OPALESCENCE');
UPDATE services SET duration_minutes = 120 WHERE code IN ('IMP-KHOURY', 'IMP-PLASA');
UPDATE services SET duration_minutes = 20 WHERE code IN ('PED-FLUOR', 'PED-SIGILARE');
UPDATE services SET duration_minutes = 15 WHERE code IN ('CH-SEPARARE', 'CH-SUTURA');
UPDATE services SET bookable_online = 1, online_label = 'Consultație sau control', online_hint = 'Și dacă nu știți sigur de ce aveți nevoie.' WHERE code = 'CON-CONSULT';
UPDATE services SET bookable_online = 1, online_label = 'Igienizare (detartraj)' WHERE code = 'CON-DETARTRAJ';
UPDATE services SET bookable_online = 1, online_label = 'Am o durere acum', urgent = 1 WHERE code = 'SG-URGENTA';
UPDATE services SET bookable_online = 1, online_label = 'Implant sau lucrare dentară' WHERE code = 'IMP-CONSULT';
UPDATE services SET bookable_online = 1, online_label = 'Aparat dentar' WHERE code = 'ORT-CONSULT'
