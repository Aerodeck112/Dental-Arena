-- October 2026: each clinic has its own approved prices (Cristești, Luduș), used in the panel when
-- a doctor adds a procedure; the site keeps showing services.price_min / price_max as before.
CREATE TABLE service_clinic_prices (
  service_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NOT NULL,
  price INT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (service_id, location_id),
  CONSTRAINT fk_scp_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
  CONSTRAINT fk_scp_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
