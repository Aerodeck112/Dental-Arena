-- October 2026: an account can start with an empty history (for example „Luduș 2”): it sees the
-- patients, but the procedures and the payments only from this day on, as if they began with it.
ALTER TABLE users ADD COLUMN history_from DATE NULL AFTER doctor_id;
