-- Separate ledgers (October 2026): an account with its own ledger („Luduș 2”, a doctor who bills
-- and collects himself) sees only the procedures and payments it entered; the others see the
-- common ledger (NULL); the administrators see all.
ALTER TABLE users ADD COLUMN own_ledger TINYINT(1) NOT NULL DEFAULT 0 AFTER history_from;
ALTER TABLE procedures ADD COLUMN ledger_user_id INT UNSIGNED NULL AFTER source, ADD KEY idx_procedures_ledger (ledger_user_id);
ALTER TABLE procedure_payments ADD COLUMN ledger_user_id INT UNSIGNED NULL AFTER received_by, ADD KEY idx_proc_payments_ledger (ledger_user_id);
