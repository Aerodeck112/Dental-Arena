-- October 2026: the procedures done for each patient, with their price and what was paid for them
-- (as in the clinic's previous program, QDental): every doctor adds what they did, reception takes
-- the payments; the tab „Proceduri și plăți” shows the total, the paid part and what is left.
-- Separate from the invoices (the money part of stage 2): a payment here is the patient paying for
-- procedures, spread over them in procedure_payment_items.
CREATE TABLE procedures (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NULL,
  doctor_id INT UNSIGNED NULL,
  appointment_id INT UNSIGNED NULL,
  service_id INT UNSIGNED NULL,
  performed_on DATE NOT NULL,
  tooth VARCHAR(40) NULL,
  name VARCHAR(255) NOT NULL,
  price INT NOT NULL DEFAULT 0,
  discount INT NOT NULL DEFAULT 0,
  lab_cost INT NOT NULL DEFAULT 0,
  done TINYINT(1) NOT NULL DEFAULT 1,
  notes VARCHAR(500) NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'panou',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY procedures_patient (patient_id, performed_on),
  KEY procedures_day (performed_on, doctor_id),
  CONSTRAINT fk_proc_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_proc_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL,
  CONSTRAINT fk_proc_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE SET NULL,
  CONSTRAINT fk_proc_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE procedure_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NULL,
  amount INT NOT NULL,
  paid_on DATE NOT NULL,
  method VARCHAR(12) NOT NULL,
  reference VARCHAR(60) NULL,
  notes VARCHAR(255) NULL,
  received_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  cancelled_at DATETIME NULL,
  cancelled_by INT UNSIGNED NULL,
  KEY proc_pay_patient (patient_id, paid_on),
  KEY proc_pay_day (paid_on),
  CONSTRAINT fk_procpay_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_procpay_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE procedure_payment_items (
  payment_id INT UNSIGNED NOT NULL,
  procedure_id INT UNSIGNED NOT NULL,
  amount INT NOT NULL,
  PRIMARY KEY (payment_id, procedure_id),
  KEY proc_pay_items_procedure (procedure_id),
  CONSTRAINT fk_ppi_payment FOREIGN KEY (payment_id) REFERENCES procedure_payments (id) ON DELETE CASCADE,
  CONSTRAINT fk_ppi_procedure FOREIGN KEY (procedure_id) REFERENCES procedures (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
