# Manualele de utilizare

- `Manual-Receptie.pdf`: pentru recepție (calendar cu mutare prin tragere, programări, programările de pe site, absențe, pacienți, cereri, rechemări, acorduri pe tabletă, mesaje).
- `Manual-Medici.pdf`: pentru medici (fișa, anamneza, odontograma, planuri, implanturi, consultația cu AI, absențe, programul zilei).
- `Manual-Administrator.pdf`: tot ce ține de clinică, plus echipă, prețuri și programarea online, fotografii, marketing, GDPR, jurnal și ce primește de la VITIM.
- `Manual-VITIM.pdf`: pentru suportul tehnic (setări, clinici, conturi, mesaje, AI, programări online, chat, tablete, actualizări, întreținere).

Partea financiară (facturi, încasări) e oprită în perioada de probă; capitolele ei se adaugă în etapa a doua.

Se refac după o schimbare în panou (pe copia locală din php/README.md, cu datele demo):

    node scripts/manual/capturi.mjs        # capturile de ecran (scripts/manual/.capturi)
    node scripts/manual/manuale.mjs        # PDF-urile, aici

Textul e în `scripts/manual/continut.mjs`. Trebuie Playwright (Chromium) și poppler (pdftotext, pdfunite).
