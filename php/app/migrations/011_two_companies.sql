-- October 2026: each clinic belongs to its own company (Cristești: S.C. Dental Arena S.R.L.,
-- Luduș: S.C. Dental Arena Ludus S.R.L.); the consents, printed documents and legal pages name the
-- company of the clinic, and each company numbers its own invoices and receipts (a clinic without
-- its own series uses the one in Setări: Cristești keeps DA and DAC, Luduș starts DAL and DALC). Inhalation sedation is no longer offered: its category and service leave
-- the site and the panel (a service already used in a plan or an invoice stays, hidden).
ALTER TABLE locations ADD COLUMN legal_name VARCHAR(190) NULL;
ALTER TABLE locations ADD COLUMN cui VARCHAR(20) NULL;
ALTER TABLE locations ADD COLUMN reg_com VARCHAR(40) NULL;
ALTER TABLE locations ADD COLUMN registered_address VARCHAR(255) NULL;
ALTER TABLE locations ADD COLUMN bank VARCHAR(120) NULL;
ALTER TABLE locations ADD COLUMN iban VARCHAR(34) NULL;
ALTER TABLE locations ADD COLUMN invoice_series VARCHAR(8) NULL;
ALTER TABLE locations ADD COLUMN receipt_series VARCHAR(8) NULL;
UPDATE locations SET legal_name = 'S.C. Dental Arena S.R.L.', cui = 'RO30570968' WHERE slug = 'cristesti';
UPDATE locations SET legal_name = 'S.C. Dental Arena Ludus S.R.L.', cui = 'RO30611278', invoice_series = 'DAL', receipt_series = 'DALC' WHERE slug = 'ludus';
DELETE FROM doctor_categories WHERE category_id IN (SELECT id FROM categories WHERE slug = 'inhalosedare');
UPDATE services SET public_visible = 0, bookable_online = 0, representative = 0 WHERE category_id IN (SELECT id FROM categories WHERE slug = 'inhalosedare');
DELETE FROM services WHERE category_id IN (SELECT id FROM categories WHERE slug = 'inhalosedare') AND id NOT IN (SELECT service_id FROM treatment_plan_items WHERE service_id IS NOT NULL) AND id NOT IN (SELECT service_id FROM invoice_items WHERE service_id IS NOT NULL);
DELETE FROM categories WHERE slug = 'inhalosedare' AND id NOT IN (SELECT category_id FROM services);
UPDATE patients SET prefers_sedation = 0
