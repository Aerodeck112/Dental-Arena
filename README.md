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

## Instalare pe cPanel

```bash
npm run build:cpanel        # face deploy/dental-arena-cpanel.zip
```

Pașii de instalare pe hosting (Setup Node.js App, fișierul `.env`, Cron Jobs, actualizări, copii de siguranță) sunt în `docs/cpanel.md`.

## Mediu de test

O copie cu date demonstrative, gratuită, pe Render.com: pașii sunt în `docs/mediu-test.md`.

## Ce se administrează din panou

- **Echipă:** conturi noi, cu bifă pentru clinica în care lucrează fiecare (Cristești, Luduș sau ambele). Un utilizator vede doar datele clinicilor bifate. Tot aici se încarcă fotografia fiecărui medic.
- **Servicii și prețuri:** serviciile fiecărei pagini de pe site și prețurile lor; se pot adăuga servicii noi.
- **Fotografii site:** toate fotografiile site-ului, cu încărcare directă și revenire la fotografia inițială.
- **Setări:** datele firmei (denumire, CUI, Reg. Com., sediu, IBAN, bancă), regulile de programare online, reamintirile.

## Documentație

- `docs/architecture.md`: arhitectura, schema bazei de date, roluri și permisiuni
- `docs/design-system.md`: culori, fonturi, componente, reguli de text
- `docs/screenshots/`: capturi de ecran
- `research/`: conținutul și imaginile preluate de pe site-ul actual

## Înainte de lansare

- Datele firmei (denumire, CUI, Reg. Com., sediu, IBAN) în Setări.
- Prețurile, în Servicii și prețuri.
- Fotografiile, în Fotografii site și pe profilul fiecărui medic.
- Programul real al clinicilor și al medicilor (acum este demonstrativ).
- Secrete noi în `.env` (`AUTH_SECRET`, `PII_ENCRYPTION_KEY`, `CRON_SECRET`) și SMTP pentru email.
- Cron Jobs pentru `/api/cron/reminders` și `/api/cron/maintenance` (vezi `docs/cpanel.md`).
