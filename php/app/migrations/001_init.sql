-- Stage 1: the site's data (clinics, services and prices, team, photos, settings) and the
-- requests that come from the site (booking requests and contact messages), plus the panel's users.

CREATE TABLE settings (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE locations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  short_name VARCHAR(60) NOT NULL,
  street VARCHAR(190) NOT NULL,
  city VARCHAR(80) NOT NULL,
  county VARCHAR(80) NOT NULL,
  postal_code VARCHAR(12) NOT NULL DEFAULT '',
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(190) NOT NULL DEFAULT '',
  hours_text TEXT NULL,
  publish_hours TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(16) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  last_login_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_locations (
  user_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, location_id),
  CONSTRAINT fk_ul_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ul_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  summary TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  code VARCHAR(40) NULL,
  name VARCHAR(190) NOT NULL,
  price_min INT NULL,
  price_max INT NULL,
  price_from TINYINT(1) NOT NULL DEFAULT 0,
  unit VARCHAR(16) NULL,
  representative TINYINT(1) NOT NULL DEFAULT 0,
  public_visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  KEY services_category (category_id, sort_order),
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE doctors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  public_name VARCHAR(160) NOT NULL,
  role_line VARCHAR(255) NOT NULL,
  bio TEXT NULL,
  photo_path VARCHAR(255) NULL,
  monogram VARCHAR(4) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  public_visible TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE doctor_categories (
  doctor_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  show_on_site TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (doctor_id, category_id),
  CONSTRAINT fk_dc_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE CASCADE,
  CONSTRAINT fk_dc_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE site_images (
  slot VARCHAR(64) NOT NULL PRIMARY KEY,
  path VARCHAR(255) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(16) NOT NULL,
  location_id INT UNSIGNED NULL,
  category_slug VARCHAR(64) NULL,
  preferred_date DATE NULL,
  preferred_time VARCHAR(16) NULL,
  comfort VARCHAR(16) NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(190) NULL,
  message TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'nou',
  note TEXT NULL,
  ip_hash CHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NULL,
  updated_by INT UNSIGNED NULL,
  KEY leads_status (status, created_at),
  KEY leads_location (location_id),
  KEY leads_ip (ip_hash, created_at),
  CONSTRAINT fk_leads_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_attempts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY login_attempts_ip (ip_hash, created_at),
  KEY login_attempts_email (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  detail TEXT NULL,
  created_at DATETIME NOT NULL,
  KEY audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
