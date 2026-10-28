-- Sterilization (October 2026): a cycle of the autoclave (day, autoclave, program, who ran it,
-- until when it keeps) and its pouches, each with a code on its 62 mm label; a pouch opened for a
-- patient is noted on the patient (traceability of the instruments).
CREATE TABLE IF NOT EXISTS sterilization_cycles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id INT UNSIGNED NOT NULL,
  cycle_no INT UNSIGNED NOT NULL,
  sterilized_on DATE NOT NULL,
  expires_on DATE NOT NULL,
  autoclave VARCHAR(80) NOT NULL DEFAULT '',
  program VARCHAR(80) NOT NULL DEFAULT '',
  operator_id INT UNSIGNED NULL,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_steril_cycles_day (location_id, sterilized_on),
  CONSTRAINT fk_steril_cycles_location FOREIGN KEY (location_id) REFERENCES locations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS sterilization_packs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cycle_id INT UNSIGNED NOT NULL,
  pack_no SMALLINT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  content VARCHAR(120) NOT NULL,
  patient_id INT UNSIGNED NULL,
  used_at DATETIME NULL,
  used_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_steril_pack_code (code),
  KEY idx_steril_pack_patient (patient_id),
  CONSTRAINT fk_steril_pack_cycle FOREIGN KEY (cycle_id) REFERENCES sterilization_cycles (id) ON DELETE CASCADE,
  CONSTRAINT fk_steril_pack_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
