-- October 2026: the first procedures import noted „De verificat” also on patients whose two QDental
-- files are the same person here (same name and phone, one patient in the panel). Only the three
-- names with two different people keep the note.
UPDATE procedures SET notes = NULL
WHERE source = 'qdental' AND notes LIKE 'De verificat:%'
  AND (notes LIKE '%Colnea Dana%' OR notes LIKE '%Istvan Szidonia%' OR notes LIKE '%Szabo Adriana%');
