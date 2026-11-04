-- Stage 3: invoices and payments, treatment plans, the odontogram, documents and consents,
-- the GDPR register, and the audit trail per patient. Money is in bani (1 leu = 100 bani).

-- Gap-free numbering (invoices, receipts): the row is locked inside the transaction that uses it.
CREATE TABLE number_sequences (
  k VARCHAR(32) NOT NULL PRIMARY KEY,
  v INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE patients ADD COLUMN anonymized_at DATETIME NULL AFTER active;

ALTER TABLE audit_log ADD COLUMN patient_id INT UNSIGNED NULL AFTER user_id;
ALTER TABLE audit_log ADD KEY audit_patient (patient_id, created_at);
ALTER TABLE audit_log ADD KEY audit_user (user_id, created_at);

CREATE TABLE treatment_plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  doctor_id INT UNSIGNED NULL,
  location_id INT UNSIGNED NULL,
  title VARCHAR(190) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ciorna',
  discount INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  valid_until DATE NULL,
  presented_at DATETIME NULL,
  accepted_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY plans_patient (patient_id, created_at),
  CONSTRAINT fk_plans_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_plans_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE SET NULL,
  CONSTRAINT fk_plans_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE treatment_plan_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plan_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NULL,
  tooth TINYINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  phase TINYINT UNSIGNED NOT NULL DEFAULT 1,
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL DEFAULT 0,
  discount INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'propus',
  performed_at DATETIME NULL,
  performed_by INT UNSIGNED NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY plan_items_plan (plan_id, phase, sort_order),
  CONSTRAINT fk_pi_plan FOREIGN KEY (plan_id) REFERENCES treatment_plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE SET NULL,
  CONSTRAINT fk_pi_doctor FOREIGN KEY (performed_by) REFERENCES doctors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  series VARCHAR(8) NOT NULL,
  number INT UNSIGNED NOT NULL,
  patient_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NOT NULL,
  issued_at DATETIME NOT NULL,
  due_date DATE NULL,
  subtotal INT NOT NULL,
  discount_total INT NOT NULL,
  vat_total INT NOT NULL,
  total INT NOT NULL,
  amount_paid INT NOT NULL DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'emisa',
  buyer_name VARCHAR(190) NOT NULL,
  buyer_address VARCHAR(255) NULL,
  buyer_email VARCHAR(190) NULL,
  buyer_company VARCHAR(190) NULL,
  buyer_cui VARCHAR(16) NULL,
  buyer_reg_com VARCHAR(40) NULL,
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  cancelled_at DATETIME NULL,
  cancelled_by INT UNSIGNED NULL,
  cancel_reason VARCHAR(255) NULL,
  UNIQUE KEY invoices_number (series, number),
  KEY invoices_patient (patient_id, issued_at),
  KEY invoices_location (location_id, issued_at),
  CONSTRAINT fk_inv_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
  CONSTRAINT fk_inv_location FOREIGN KEY (location_id) REFERENCES locations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NULL,
  plan_item_id INT UNSIGNED NULL,
  doctor_id INT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  tooth TINYINT UNSIGNED NULL,
  quantity INT NOT NULL,
  unit_price INT NOT NULL,
  discount INT NOT NULL DEFAULT 0,
  vat_rate TINYINT UNSIGNED NOT NULL DEFAULT 0,
  total INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY invoice_items_invoice (invoice_id, sort_order),
  KEY invoice_items_plan (plan_item_id),
  KEY invoice_items_doctor (doctor_id),
  CONSTRAINT fk_ii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_ii_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE SET NULL,
  CONSTRAINT fk_ii_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  invoice_id INT UNSIGNED NULL,
  location_id INT UNSIGNED NOT NULL,
  amount INT NOT NULL,
  method VARCHAR(12) NOT NULL,
  paid_at DATETIME NOT NULL,
  receipt_series VARCHAR(8) NULL,
  receipt_number INT UNSIGNED NULL,
  reference VARCHAR(120) NULL,
  notes VARCHAR(255) NULL,
  received_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  cancelled_at DATETIME NULL,
  cancelled_by INT UNSIGNED NULL,
  cancel_reason VARCHAR(255) NULL,
  UNIQUE KEY payments_receipt (receipt_series, receipt_number),
  KEY payments_patient (patient_id, paid_at),
  KEY payments_invoice (invoice_id),
  KEY payments_location (location_id, paid_at),
  CONSTRAINT fk_pay_patient FOREIGN KEY (patient_id) REFERENCES patients (id),
  CONSTRAINT fk_pay_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE SET NULL,
  CONSTRAINT fk_pay_location FOREIGN KEY (location_id) REFERENCES locations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A finding on a tooth is never edited: it is resolved when the tooth changes, so the history stays.
CREATE TABLE tooth_conditions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  tooth TINYINT UNSIGNED NOT NULL,
  kind VARCHAR(24) NOT NULL,
  surfaces VARCHAR(8) NULL,
  note VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  resolved_by INT UNSIGNED NULL,
  KEY tooth_patient (patient_id, tooth, resolved_at),
  CONSTRAINT fk_tc_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Files live in dentalarena/storage/documente (outside public_html) and are served by the panel.
CREATE TABLE patient_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  kind VARCHAR(32) NOT NULL,
  title VARCHAR(190) NOT NULL,
  original_name VARCHAR(190) NOT NULL,
  stored_name VARCHAR(80) NOT NULL,
  mime VARCHAR(80) NOT NULL,
  size INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  deleted_by INT UNSIGNED NULL,
  KEY documents_patient (patient_id, created_at),
  CONSTRAINT fk_doc_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE consents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  type VARCHAR(24) NOT NULL,
  method VARCHAR(16) NOT NULL,
  signed_on DATE NOT NULL,
  text_version VARCHAR(16) NOT NULL,
  document_id INT UNSIGNED NULL,
  recorded_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  withdrawn_at DATETIME NULL,
  withdrawn_by INT UNSIGNED NULL,
  KEY consents_patient (patient_id, type),
  CONSTRAINT fk_cons_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_cons_document FOREIGN KEY (document_id) REFERENCES patient_documents (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The register of data-protection requests (access, erasure, …): 30 days to answer.
CREATE TABLE data_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NULL,
  requester VARCHAR(190) NOT NULL,
  contact VARCHAR(190) NULL,
  type VARCHAR(16) NOT NULL,
  received_on DATE NOT NULL,
  due_on DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'primita',
  notes TEXT NULL,
  resolved_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY data_requests_status (status, due_on),
  CONSTRAINT fk_dr_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
