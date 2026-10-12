# Manualele de utilizare

- `Manual-Receptie.pdf`: pentru recepție (programări, pacienți, cereri, rechemări, facturi, acorduri pe tabletă, mesaje).
- `Manual-Medici.pdf`: pentru medici (fișa, anamneza, odontograma, planuri, consultația cu AI, programul zilei).
- `Manual-Administrator.pdf`: tot panoul, plus setări, echipă, prețuri, mesaje, marketing, AI, chat, tablete, GDPR, jurnal, întreținere.

Se refac după o schimbare în panou (pe copia locală din php/README.md, cu datele demo):

    node scripts/manual/capturi.mjs        # capturile de ecran (scripts/manual/.capturi)
    node scripts/manual/manuale.mjs        # PDF-urile, aici

Textul e în `scripts/manual/continut.mjs`. Trebuie Playwright (Chromium) și poppler (pdftotext, pdfunite).
