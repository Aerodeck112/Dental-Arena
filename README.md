# Dental Arena

Site-ul public și CRM-ul („Cabinet”) pentru Dental Arena Clinic, Cristești și Luduș.

- **Site public:** acasă, 10 pagini de servicii, prețuri, echipă, despre noi, 15 ani, contact, pagini legale, programare online.
- **CRM** (`/crm`): Azi, calendar, programări, cereri online, pacienți (fișă, anamneză, odontogramă, planuri de tratament, documente), rechemări, facturi și încasări, servicii și prețuri, echipă și program, absențe, locații, mesaje (email/SMS), rapoarte cu export CSV, jurnal de audit, GDPR, setări.

Tehnologie: Next.js 16, TypeScript, Tailwind CSS v4, Prisma 7 (SQLite local, compatibil PostgreSQL).

## Pornire locală

```bash
npm install
cp .env.example .env        # apoi completați AUTH_SECRET, PII_ENCRYPTION_KEY, CRON_SECRET
npx prisma migrate deploy
npm run db:seed             # clinici, medici, servicii cu prețuri, date demonstrative
npm run dev                 # http://localhost:3000, CRM la /crm/login
```

Conturile demonstrative sunt în `docs/demo-logins.md`.

## Verificări

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Documentație

- `docs/architecture.md`: arhitectura, schema bazei de date, roluri și permisiuni
- `docs/design-system.md`: culori, fonturi, componente, reguli de text
- `docs/screenshots/`: capturi de ecran
- `research/`: conținutul și imaginile preluate de pe site-ul actual

## Înainte de lansare

- Datele firmei (denumire, CUI, Reg. Com., sediu, IBAN) în Setări.
- Programul real al clinicilor și al medicilor (acum este demonstrativ).
- Secrete noi în `.env` (`AUTH_SECRET`, `PII_ENCRYPTION_KEY`, `CRON_SECRET`) și SMTP pentru email.
- Un job programat care apelează `/api/cron/reminders` (remindere cu 24h înainte).
