-- Stage 4: messages to patients and staff (SMS, WhatsApp, e-mail), marketing campaigns with
-- consent, and the AI consultation drafts.

-- Staff: a phone for SMS/WhatsApp and which notices each person wants, on which channel.
ALTER TABLE users ADD COLUMN phone VARCHAR(40) NULL AFTER email;
ALTER TABLE users ADD COLUMN notify_prefs TEXT NULL;

-- Patients: the phone channel for notices (SMS or WhatsApp or none), and marketing consent per
-- channel (separate from notices, given explicitly, with its date and source).
ALTER TABLE patients ADD COLUMN phone_channel VARCHAR(10) NOT NULL DEFAULT 'sms' AFTER email_reminders;
ALTER TABLE patients ADD COLUMN marketing_sms TINYINT(1) NOT NULL DEFAULT 0 AFTER phone_channel;
ALTER TABLE patients ADD COLUMN marketing_whatsapp TINYINT(1) NOT NULL DEFAULT 0 AFTER marketing_sms;
ALTER TABLE patients ADD COLUMN marketing_email TINYINT(1) NOT NULL DEFAULT 0 AFTER marketing_whatsapp;
ALTER TABLE patients ADD COLUMN marketing_consent_at DATETIME NULL AFTER marketing_email;
ALTER TABLE patients ADD COLUMN marketing_consent_source VARCHAR(60) NULL AFTER marketing_consent_at;
ALTER TABLE patients ADD COLUMN unsubscribe_token CHAR(12) NULL AFTER marketing_consent_source;
ALTER TABLE patients ADD UNIQUE KEY patients_unsubscribe (unsubscribe_token);

ALTER TABLE leads ADD COLUMN marketing_ok TINYINT(1) NOT NULL DEFAULT 0 AFTER comfort;

-- Every message, out and in. Outgoing ones wait in the queue (status in-asteptare) until their
-- send_after time; cron.php and the panel's own requests send them.
CREATE TABLE messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  direction CHAR(3) NOT NULL DEFAULT 'out',
  channel VARCHAR(10) NOT NULL,
  event VARCHAR(40) NOT NULL,
  patient_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  appointment_id INT UNSIGNED NULL,
  campaign_id INT UNSIGNED NULL,
  to_address VARCHAR(190) NOT NULL,
  subject VARCHAR(190) NULL,
  body TEXT NOT NULL,
  template VARCHAR(80) NULL,
  template_params TEXT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'in-asteptare',
  provider_id VARCHAR(120) NULL,
  error VARCHAR(255) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  send_after DATETIME NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  sent_at DATETIME NULL,
  updated_at DATETIME NULL,
  KEY messages_queue (status, send_after),
  KEY messages_patient (patient_id, created_at),
  KEY messages_campaign (campaign_id),
  KEY messages_provider (provider_id),
  KEY messages_event (event, appointment_id),
  CONSTRAINT fk_msg_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaigns (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  channel VARCHAR(10) NOT NULL,
  subject VARCHAR(190) NULL,
  body TEXT NOT NULL,
  template VARCHAR(80) NULL,
  segment TEXT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'ciorna',
  recipients INT NOT NULL DEFAULT 0,
  scheduled_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  sent_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The AI consultation: what was dictated, what the AI proposed, and what the doctor applied.
CREATE TABLE ai_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  transcript MEDIUMTEXT NOT NULL,
  result MEDIUMTEXT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'ciorna',
  model VARCHAR(60) NULL,
  input_tokens INT NULL,
  output_tokens INT NULL,
  error VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  applied_at DATETIME NULL,
  KEY ai_patient (patient_id, created_at),
  CONSTRAINT fk_ai_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
