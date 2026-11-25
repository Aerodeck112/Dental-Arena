-- Stage 6b: each clinic's opening hours by weekday (they cut the doctors' hours), how many
-- cabinets (chairs) and inhalation sedation units it has, each doctor's usual cabinet there, and
-- the cabinet of each appointment.
ALTER TABLE locations ADD COLUMN hours_json TEXT NULL;
ALTER TABLE locations ADD COLUMN cabinets TINYINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE locations ADD COLUMN sedation_units TINYINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE doctor_locations ADD COLUMN cabinet TINYINT UNSIGNED NULL;
ALTER TABLE appointments ADD COLUMN cabinet TINYINT UNSIGNED NULL
