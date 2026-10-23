-- October 2026: „Sunat, nu răspunde”. Reception called the patient about the appointment and got
-- no answer: the appointment blinks in the calendar and on „Azi” until the patient confirms, arrives
-- or the box is unchecked.
ALTER TABLE appointments
  ADD COLUMN no_answer_at DATETIME NULL AFTER no_show_at,
  ADD COLUMN no_answer_by INT UNSIGNED NULL AFTER no_answer_at;
