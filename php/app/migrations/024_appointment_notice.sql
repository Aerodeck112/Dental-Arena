-- The time a patient was last told about (confirmation, moved, „Trimiteți SMS acum”). A clinic
-- that sends the confirmations at the end of the day (Setări → Mesaje) sends them for the
-- appointments whose time the patient does not know yet. The existing ones count as told.
ALTER TABLE appointments ADD COLUMN notice_sent_for DATETIME NULL AFTER reminder_sent_at;
UPDATE appointments SET notice_sent_for = starts_at;
