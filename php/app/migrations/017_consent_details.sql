-- October 2026: the clinic's own consents for endodontics, surgery and implants name the doctor and
-- the intervention; they are chosen at reception with the tablet code and printed into the text the
-- patient signs (kept, as it was signed, in consents.text_snapshot).
ALTER TABLE consent_sessions ADD COLUMN details VARCHAR(600) NULL AFTER with_marketing;
