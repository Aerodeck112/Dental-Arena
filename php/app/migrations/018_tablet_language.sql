-- October 2026: the signing tablet also in English, for foreign patients. Reception chooses the
-- language with the code; the patient reads the consents and the questionnaire in it, and the text
-- signed is kept in that language.
ALTER TABLE consent_sessions ADD COLUMN lang CHAR(2) NOT NULL DEFAULT 'ro' AFTER details;
