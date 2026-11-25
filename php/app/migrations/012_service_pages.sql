-- October 2026: the service pages are the clinic's to manage (add, rename, hide, delete, with
-- their own texts); „Stomatologie generală” becomes Odontologie (fillings, reconstructions) and
-- Endodonție (root canals); „Estetică dentară” is no longer offered (a price already used in a plan
-- or an invoice stays, hidden).
ALTER TABLE categories ADD COLUMN lead TEXT NULL;
ALTER TABLE categories ADD COLUMN body TEXT NULL;
ALTER TABLE categories ADD COLUMN public_visible TINYINT(1) NOT NULL DEFAULT 1;
UPDATE categories SET slug = 'odontologie', name = 'Odontologie', summary = 'Tratamentul cariilor și refacerea dinților: obturații din compozit, estetice, reconstrucții, cu planuri de tratament personalizate.' WHERE slug = 'stomatologie-generala';
UPDATE categories SET sort_order = sort_order + 1 WHERE sort_order > (SELECT s FROM (SELECT sort_order AS s FROM categories WHERE slug = 'odontologie') t);
INSERT IGNORE INTO categories (slug, name, summary, sort_order) SELECT 'endodontie', 'Endodonție', 'Tratamentul de canal, cu instrumente rotative, ca să păstrăm dintele: când nervul este inflamat sau infectat.', sort_order + 1 FROM categories WHERE slug = 'odontologie';
UPDATE services SET category_id = (SELECT id FROM categories WHERE slug = 'endodontie') WHERE code IN ('SG-PANSAMENT', 'SG-ENDO-MONO', 'SG-ENDO-PLURI', 'SG-RETRAT-MONO', 'SG-RETRAT-PLURI');
UPDATE services SET representative = 0 WHERE category_id = (SELECT id FROM categories WHERE slug = 'endodontie');
UPDATE services SET representative = 1 WHERE code = 'SG-ENDO-MONO';
INSERT IGNORE INTO doctor_categories (doctor_id, category_id, show_on_site) SELECT doctor_id, (SELECT id FROM categories WHERE slug = 'endodontie'), show_on_site FROM doctor_categories WHERE category_id = (SELECT id FROM categories WHERE slug = 'odontologie');
UPDATE appointments SET category_slug = 'odontologie' WHERE category_slug = 'stomatologie-generala';
UPDATE leads SET category_slug = 'odontologie' WHERE category_slug = 'stomatologie-generala';
UPDATE site_images SET slot = 'serviciu.odontologie' WHERE slot = 'serviciu.stomatologie-generala';
DELETE FROM doctor_categories WHERE category_id IN (SELECT id FROM categories WHERE slug = 'estetica-dentara');
UPDATE services SET public_visible = 0, bookable_online = 0, representative = 0 WHERE category_id IN (SELECT id FROM categories WHERE slug = 'estetica-dentara');
DELETE FROM services WHERE category_id IN (SELECT id FROM categories WHERE slug = 'estetica-dentara') AND id NOT IN (SELECT service_id FROM treatment_plan_items WHERE service_id IS NOT NULL) AND id NOT IN (SELECT service_id FROM invoice_items WHERE service_id IS NOT NULL);
UPDATE categories SET public_visible = 0 WHERE slug = 'estetica-dentara';
DELETE FROM categories WHERE slug = 'estetica-dentara' AND id NOT IN (SELECT category_id FROM services);
DELETE FROM site_images WHERE slot = 'serviciu.estetica-dentara';
UPDATE appointments SET category_slug = NULL WHERE category_slug = 'estetica-dentara';
UPDATE leads SET category_slug = NULL WHERE category_slug = 'estetica-dentara'
