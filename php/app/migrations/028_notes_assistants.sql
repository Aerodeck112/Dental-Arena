-- October 2026: the team's notes on „Azi” (not to forget), and the assistants of the team
-- (Echipa → Asistente; on the site's team page when shown), apart from the doctors.
CREATE TABLE IF NOT EXISTS team_notes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id INT UNSIGNED NULL,
  body VARCHAR(500) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  done_at DATETIME NULL,
  done_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_team_notes_open (done_at, location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS team_assistants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  role_line VARCHAR(160) NOT NULL DEFAULT 'Asistentă medicală',
  photo_path VARCHAR(255) NULL,
  locations VARCHAR(60) NOT NULL DEFAULT '',
  public_visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
