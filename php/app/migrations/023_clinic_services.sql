-- A clinic's own price list (October 2026): Luduș names and prices its services otherwise than
-- the site (Cristești). When a clinic has one, „Adaugă procedură” offers it for that clinic.
CREATE TABLE IF NOT EXISTS clinic_services (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id INT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  price INT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_clinic_services_location (location_id, active),
  CONSTRAINT fk_clinic_services_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
