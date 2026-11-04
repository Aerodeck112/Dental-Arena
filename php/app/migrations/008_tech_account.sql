-- The technical account (VITIM): which of its changes each administrator has already seen on „Azi”.
ALTER TABLE users ADD COLUMN changes_seen_id INT UNSIGNED NULL
