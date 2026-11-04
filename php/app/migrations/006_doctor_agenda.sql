-- The doctors' programme of the day, sent each morning on WhatsApp, SMS or e-mail, set per
-- doctor by the administrator (a doctor does not need a panel account for it).
ALTER TABLE doctors ADD COLUMN phone VARCHAR(40) NULL;
ALTER TABLE doctors ADD COLUMN email VARCHAR(190) NULL;
ALTER TABLE doctors ADD COLUMN agenda_channel VARCHAR(10) NULL;
ALTER TABLE doctors ADD COLUMN agenda_time CHAR(5) NOT NULL DEFAULT '07:00';
ALTER TABLE doctors ADD COLUMN agenda_alerts TINYINT(1) NOT NULL DEFAULT 0;

-- Which doctor a message was about (the agenda is sent once a day per doctor).
ALTER TABLE messages ADD COLUMN doctor_id INT UNSIGNED NULL AFTER user_id;
ALTER TABLE messages ADD KEY messages_doctor (doctor_id, event, created_at);
