-- The doctor of each line of a treatment plan (October 2026): one plan, several doctors.
ALTER TABLE treatment_plan_items ADD COLUMN doctor_id INT UNSIGNED NULL AFTER service_id;
