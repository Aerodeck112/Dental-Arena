# Dental Arena: architecture (website + CRM)

Version 1, 5 October 2026. This is the build contract for the parallel builders. It covers:
- the public website (Romanian, formal „dumneavoastră” voice)
- the staff CRM, labelled „Cabinet” in the UI and served under `/crm`

Both run in one Next.js app.

**Sources:**
- `docs/design-system.md`: visual and copy rules, components, tokens
- `research/content.json` and `research/pages/*.txt`: all site copy
- `research/media/*`: original images
- the Next.js 16 docs in `node_modules/next/dist/docs/`

**Precedence:**
1. This file wins on stack, routes, data, security and file ownership.
2. `design-system.md` wins on look, components and copy.
3. Where the two conflict, §0.2 records the decision.

**Fixed stack:**

| Area | Choice |
|---|---|
| Framework | Next.js 16.3 (App Router, Server Components, Server Actions) |
| Language and UI | React 19.2, TypeScript `strict`, Tailwind CSS v4 |
| Database | Prisma 7.10 with the `prisma-client` generator and driver adapters. SQLite in dev through `@prisma/adapter-better-sqlite3`. The schema must stay PostgreSQL-compatible. |
| Validation | zod 4 |
| Auth | Custom: bcryptjs plus a JWT (jose) in an httpOnly cookie. Roles: ADMIN, MEDIC, RECEPTIE. |
| Messaging | nodemailer for e-mail. SMS goes through a provider interface; the default provider writes to the console. |
| Tests | vitest |

---

## 0. Ground rules

### 0.1 Next.js 16 facts every builder must respect

These differ from older Next.js habits. Read the matching file in `node_modules/next/dist/docs/01-app/` before you code.

- **Middleware is now Proxy.** The file is `src/proxy.ts` and exports `proxy()`. It runs on the Node.js runtime. Use it only for optimistic cookie checks and redirects, never for DB access (`01-getting-started/16-proxy.md`).
- **Request APIs are async.** Await `params` and `searchParams` (both are Promises), `cookies()` and `headers()`. Type pages with the global helpers `PageProps<'/crm/pacienti/[id]'>`, `LayoutProps<…>` and `RouteContext<…>`.
- **No Cache Components.** `cacheComponents` stays off.
  - Public pages that read the DB set `export const revalidate = 300`. The home page sets `60`, because its availability panel shows live slots.
  - Those pages prerender at build time, so `npm run build` needs a migrated database at `DATABASE_URL`. The integration gate (§12.1) migrates before it builds.
  - CRM mutations call `revalidatePath()`.
  - CRM pages are dynamic: they read cookies through the DAL.
- **No `forbidden()` or `unauthorized()`.** They are experimental (they need `authInterrupts`). Redirect to `/crm/acces-interzis` instead.
- **Use `after()` from `next/server`** to send e-mail and SMS after a response has been sent, so a slow SMTP server never delays the visitor.
- **Server Actions:**
  - They are POST-only and Next checks Origin against Host. That is our CSRF protection (§8.1).
  - The default body limit is 1 MB. We set `serverActions.bodySizeLimit: '2mb'`.
  - Files larger than that go through route handlers (§4.3).
- **Prisma 7:**
  - The datasource URL lives in `prisma.config.ts`, not in the schema.
  - The client is generated to `src/generated/prisma` (gitignored) and is imported from `@/generated/prisma/client`.
  - `PrismaClient` must receive an `adapter`.
- **`better-sqlite3`** is already in Next's default `serverExternalPackages`. Do not bundle it.
- **No SQLite-only Prisma features:**
  - no `mode: 'insensitive'` (Postgres only, so search uses a normalised `searchText` column)
  - no scalar lists
  - no `@db.*` native types
  - no raw SQL, except `SELECT 1` in the health check
  - money as `Int` in bani (1 leu = 100 bani)
  - JSON stored as validated `String`

### 0.2 Decisions and reconciliations

| Topic | `design-system.md` says | Brief says | Decision |
|---|---|---|---|
| CRM URL | `/cabinet/*` | `app/(crm)/crm/...`, login at `/crm/login` | **`/crm`**. The UI may still call the product „Cabinet”. `/cabinet` 308-redirects to `/crm`. |
| Team page | `/medici`, `/medici/[slug]` | „Echipa” | **`/echipa`** and **`/echipa/[slug]`**. `/medici` and `/medici/:slug` 308-redirect. |
| 15 ani | Retire, 301 to `/despre-noi` | Keep the page | **Keep `/15ani`** as a brand-history page. The July–August 2024 promotion has expired: present it as history in the past tense, never as a live offer. |
| Legal slugs | `/confidentialitate`, `/cookie-uri` | „Politica de confidențialitate / GDPR”, „Politica cookies” | **`/termeni-si-conditii`**, **`/politica-de-confidentialitate`** and **`/politica-cookies`**. The design-system slugs and `/gdpr` redirect to them. |
| Appointment statuses | 6 statuses; „în cabinet” is Sosit plus a timer | 7 statuses, including „în tratament” | **7 statuses** (`IN_TRATAMENT` added). It renders like Sosit (solid `menta` fill) with its own icon (`activity`) and the label „În tratament · 12 min”. Sosit keeps `door-enter`. |
| Roles | Administrator, Medic, Asistentă, Recepție | ADMIN, MEDIC, RECEPTIE | **3 roles**. An assistant gets a RECEPTIE account. |
| Extra pages | `/preturi`, `/clinici/[slug]` | Not listed | **`/preturi` is in scope**: the home index links to it, and it costs little because it is rendered from the catalog. **`/clinici/*` is out of scope for v1.** The header item „Clinici” links to `/contact#clinici`. |
| Façade photos | House = Cristești, shopfront = Luduș (marked „to confirm”) | n/a | **Reversed**, per the live alt texts recorded in `research/content.json` → `critic.corrections`: the shopfront `DSC1557-Copy.jpg` is **Cristești**; the dusk house (`407869274…jpg`, `Untitled-design-2024-05-27T102007.291.png`, `WhatsApp…09.13.08.jpeg`) is **Luduș**. |
| Opening hours | Hidden until the clinic supplies them | n/a | Seed demo hours and shifts so that availability works in dev. `Location.publishHours = false` keeps hours off the site. Demo schedules are labelled „program demonstrativ” in the CRM until an admin edits them. |
| General consultation price | Open item | n/a | The service exists with `priceMin = null`. The site shows „Prețul îl aflați la telefon” instead of a number. |

### 0.3 Naming conventions

- **Code identifiers are English**: `Appointment`, `getAvailableSlots`.
- **Enum values and URL segments are Romanian, without diacritics**: `PROGRAMAT`, `/crm/pacienti`.
- **Every user-facing string is Romanian with correct diacritics**:
  - use comma-below ș ț (U+0219, U+021B), never the cedilla forms ş ţ
  - use Romanian quotes „…”
- **Labels for enums** live in `src/lib/labels.ts` and nowhere else.
- **Money:**
  - stored as `Int` bani
  - parsed from „1.200,50” or „1200”
  - formatted by `formatLei()` as „2.200 lei”, „de la 200 lei”, „900 / 1.100 lei” or „150 lei / oră”
- **Time:**
  - Instants are `DateTime` (UTC).
  - Schedule times are `Int` minutes after local midnight in `Europe/Bucharest` (540 = 09:00).
  - Calendar days in URLs and forms are ISO `YYYY-MM-DD` local dates.
  - All conversion goes through `src/lib/time.ts`; there is no date library.
- **Phones** are stored as E.164 (`+40744123456`) and displayed as „0744 123 456”. A clinic phone is always shown with the clinic's name.

---

## 1. System overview

```
                        Internet
                           │
          ┌────────────────┴──────────────────────────────────────────┐
          │                 Next.js 16 app (Node.js)                   │
          │                                                            │
          │  src/proxy.ts ── /crm/* optimistic session check, rolling  │
          │                  cookie refresh, noindex header            │
          │                                                            │
          │  app/(site)  public pages (RSC, revalidate 300)            │
          │     /programare wizard ─┐   /p/[token] confirm/cancel      │
          │                         │                                  │
          │  app/(crm)/crm  staff UI (RSC + client islands)            │
          │     Server Actions ─────┼──► src/server/** domain services │
          │                         │       (server-only, zod-checked) │
          │  app/api/*  route handlers: public slots, cron, CSV,       │
          │              uploads/downloads, GDPR export, health        │
          │                         │                                  │
          │  src/lib/**  platform: db, auth/DAL, permissions, time,    │
          │              pii, audit, rate-limit, tokens, settings      │
          └───────┬──────────────┬──────────────────┬──────────────────┘
                  │              │                  │
          Prisma 7 + adapter   SMTP (nodemailer)   SmsProvider
          SQLite dev / PG prod   dev: console       dev: console
                  │
          ./storage/ (patient files, outside public/, gitignored)

  External scheduler (system cron, GitHub Actions or the host's cron) ──►
      GET /api/cron/reminders     hourly, Bearer CRON_SECRET
      GET /api/cron/maintenance   daily 03:15, Bearer CRON_SECRET
```

**Layers.** A layer imports only from the layers below it:
1. `app/**`: routes, pages, `actions.ts`
2. `src/components/**`: UI. A component never imports Prisma, except through props.
3. `src/server/**`: domain services. Every file starts with `import "server-only"`.
4. `src/lib/**`: platform
5. `@/generated/prisma`

There are two exceptions:
- Client components may import types from `src/server/**/types.ts`. Those files contain types only and do not import `server-only`.
- Client components may import pure helpers from `src/lib/format.ts`, `src/lib/labels.ts` and `src/lib/time.ts`.

**Environment** (`.env.example` is owned by WP1; every variable is validated by `src/lib/env.ts`):

| Variable | Required | Use |
|---|---|---|
| `DATABASE_URL` | yes | `file:./prisma/dev.db` in dev, `postgresql://…` in prod |
| `AUTH_SECRET` | yes, at least 32 chars | Signs sessions. Subkeys for appointment tokens and IP hashing are derived with HMAC(AUTH_SECRET, purpose). |
| `PII_ENCRYPTION_KEY` | yes (**new**) | 32 bytes, base64. AES-256-GCM for the CNP. |
| `APP_URL` | yes | Absolute links in e-mail and SMS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | If `SMTP_HOST` is empty, mail goes to the console (dev). In production the message is logged as `SIMULAT`, without its body. |
| `CLINIC_NOTIFY_EMAIL` | yes | Where new-lead alerts go |
| `SMS_PROVIDER` | no, default `console` | Picks the SMS provider |
| `CRON_SECRET` | yes | Bearer token for `/api/cron/*` |
| `STORAGE_DIR` | no, default `./storage` (**new**) | Patient documents |
| `EINVOICE_PROVIDER` | no, default `none` (**new**) | e-Factura adapter selector |
| `SEED_PASSWORD` | no (**new**) | Password for the seeded staff accounts |

**Database lifecycle:**
- Dev: `npm run db:migrate` (`prisma migrate dev`), then `npm run db:seed`.
- Production on PostgreSQL:
  1. Set `provider = "postgresql"`.
  2. Create a new baseline migration folder. SQLite migration SQL is not portable, so `prisma/migrations` is regenerated once against Postgres.
  3. Install `@prisma/adapter-pg`.
  4. Switch the adapter in `src/lib/db.ts`.

  The schema itself needs no other change. Both providers were validated, and 35 tables are generated.

---
## 2. Folder structure

Owner tags such as `[WP3]` refer to the work packages in §11. A tag on a folder covers everything inside it unless a child carries its own tag. §11 repeats the exact file list for each package; where the two differ, §11 wins.

```
/
├─ package.json  next.config.ts  .env.example  vitest.config.ts            [WP1]
├─ prisma.config.ts                                                        (unchanged)
├─ prisma/
│  ├─ schema.prisma                                                        [WP1] (verbatim from §3)
│  ├─ migrations/                                                          [WP1] (generated)
│  ├─ seed.ts                                                              [WP1]
│  └─ seed-data/ locations.ts team.ts services.ts demo.ts random.ts        [WP1]
├─ public/images/                                                          [WP2] (renamed copies, §10.6)
│  ├─ clinica/  echipa/  legal/
├─ storage/                                                                (runtime, gitignored)
└─ src/
   ├─ proxy.ts                                                             [WP1]
   ├─ generated/prisma/                                                    (prisma generate, gitignored)
   ├─ app/
   │  ├─ layout.tsx  globals.css  fonts.ts  icon.svg                       [WP2]
   │  ├─ not-found.tsx  robots.ts  sitemap.ts                              [WP3]
   │  ├─ (site)/
   │  │  ├─ layout.tsx                                                     [WP3] cookie consent, skip link
   │  │  ├─ (pagini)/                                                      [WP3] header + footer layout
   │  │  │  ├─ layout.tsx  page.tsx (Acasă)
   │  │  │  ├─ servicii/  [serviciu]/  preturi/  echipa/  echipa/[slug]/
   │  │  │  ├─ despre-noi/  15ani/  contact/
   │  │  │  ├─ termeni-si-conditii/  politica-de-confidentialitate/  politica-cookies/
   │  │  │  └─ dentist-targu-mures/  cabinet-stomatologic-targu-mures/
   │  │  ├─ programare/                                                    [WP4] wizard, own minimal header
   │  │  └─ p/[token]/                                                     [WP4] confirm/cancel + .ics
   │  ├─ (crm)/crm/
   │  │  ├─ layout.tsx                                                     [WP1] noindex, data-density
   │  │  ├─ login/                                                         [WP1]
   │  │  └─ (app)/
   │  │     ├─ layout.tsx  error.tsx  loading.tsx                          [WP1] requireUser + AppShell
   │  │     ├─ acces-interzis/  cont/                                      [WP1]
   │  │     ├─ ui/                                                         [WP2] component gallery (ADMIN)
   │  │     ├─ page.tsx (Azi)  programari/  cereri/  rechemari/            [WP6]
   │  │     ├─ pacienti/  gdpr/                                            [WP7]
   │  │     ├─ pacienti/[id]/incasari/                                     [WP8]
   │  │     ├─ facturi/  incasari/  servicii/  echipa/  locatii/  setari/  [WP8]
   │  │     ├─ echipa/[id]/program/  absente/                              [WP4]
   │  │     └─ mesaje/  rapoarte/  audit/                                  [WP5]
   │  └─ api/
   │     ├─ health/                                                        [WP1]
   │     ├─ public/slots/                                                  [WP4]
   │     ├─ cron/reminders/  cron/maintenance/                             [WP5]
   │     ├─ crm/rapoarte/[raport]/                                         [WP5] CSV
   │     └─ crm/pacienti/[id]/documente/  crm/pacienti/[id]/export/
   │        crm/documente/[id]/                                            [WP7]
   ├─ components/
   │  ├─ ui/  brand/                                                       [WP2]
   │  ├─ forms/HoneypotFields.tsx                                          [WP1]
   │  ├─ site/                                                             [WP3]
   │  ├─ booking/                                                          [WP4]
   │  └─ crm/
   │     ├─ shell/                                                         [WP1]
   │     ├─ schedule/                                                      [WP4]
   │     ├─ comms/  reports/  audit/                                       [WP5]
   │     ├─ calendar/  dashboard/  leads/  recalls/                        [WP6]
   │     ├─ patients/  odontogram/  plans/                                 [WP7]
   │     └─ billing/  admin/                                               [WP8]
   ├─ content/                                                             [WP3] static Romanian copy
   ├─ lib/                                                                 [WP1] platform (+ lib/cn.ts [WP2])
   └─ server/                                                              domain services, "server-only"
      ├─ public/                                                           [WP3]
      ├─ scheduling/  leads/intake.ts  leads/schemas.ts                    [WP4]
      ├─ notify/  reports/  maintenance.ts                                 [WP5]
      ├─ appointments/  leads/pipeline.ts  recalls/                        [WP6]
      ├─ patients/                                                         [WP7]
      └─ billing/  catalog/  staff/  locations/                            [WP8]
```

**Conventions inside a route folder:**
- `page.tsx` is a Server Component.
- `actions.ts` holds the Server Actions (`'use server'`) for that screen only.
- Client islands are `*Form.tsx`, `*Dialog.tsx` and similar files under `src/components/<area>/`. Route-private components may sit next to the page only if the same package owns both.

---
## 3. Data model

### 3.1 Overview

| Area | Models |
|---|---|
| Clinics | `Location` (Cristești, Luduș), `LocationHours`, `Cabinet` (chairs/rooms, optional) |
| People | `User` (login, role), `Doctor` (public profile; optionally linked to a MEDIC user), `DoctorCategory` (which service categories a doctor does) |
| Schedules | `WorkShift` (doctor × location × weekday, local minutes, optional cabinet, validity window), `ShiftBreak`, `TimeOff` (doctor and/or location) |
| Catalog | `ServiceCategory` (the 10 public service pages; `slug` = URL), `Service` (price items, durations, online-bookable flags) |
| Patients | `Patient`, `MedicalHistory` (anamneză), `Consent`, `ToothCondition` (odontogram), `TreatmentPlan` and `TreatmentPlanItem`, `PatientDocument`, `Tag` and `PatientTag`, `PatientNote` |
| Scheduling | `Appointment` (7 statuses, source, comfort, sedation, status timestamps, `tokenVersion` for links) |
| Leads | `Lead` (contact form, online booking, callback), `LeadActivity` |
| Recalls | `Recall` („De rechemat”) |
| Billing | `Invoice`, `InvoiceItem`, `Payment` (cash/card/transfer; receipts for cash) |
| Messaging | `MessageTemplate` (DB override of the code defaults), `MessageLog` |
| GDPR and audit | `AuditLog`, `DataRequest` |
| System | `Setting` (JSON per key), `NumberSequence` (gap-free numbers), `RateLimitBucket` |

### 3.2 Invariants enforced in code

Each rule is enforced by the owning service.

1. **Appointment interval:**
   - `startsAt < endsAt`
   - both on the 5-minute grid
   - the same local calendar day
   - duration from 5 to 480 minutes
2. **Blocking statuses.** These appointments occupy the doctor, the cabinet and the sedation unit:

   `BLOCKING_STATUSES = [PROGRAMAT, CONFIRMAT, SOSIT, IN_TRATAMENT, FINALIZAT]`

   `ANULAT` and `NEPREZENTAT` free the slot.
3. **No double booking of a doctor.** Two blocking appointments of the same doctor never overlap, at any location. This is checked inside the write transaction (§6.3).
4. **Money:**
   - All amounts are `Int` bani and `>= 0`.
   - Line totals: `InvoiceItem.total = quantity * unitPrice - discount` (VAT 0 by default, because dental medical services are VAT-exempt; to be confirmed by the clinic's accountant).
   - Invoice totals:
     - `Invoice.subtotal = Σ quantity*unitPrice`
     - `discountTotal = Σ discount`
     - `total = subtotal - discountTotal + vatTotal`
   - `Invoice.amountPaid = Σ` of the non-cancelled payments linked to the invoice. It is recomputed in the same transaction as every payment write.
   - Patient balance = `Σ total` of non-cancelled invoices − `Σ amount` of non-cancelled payments. A positive balance means the patient owes money; a negative one is credit.
5. **Numbering.** `Invoice.number`, `Payment.receiptNumber` and `Patient.fileNumber` come from `NumberSequence`, incremented inside the same transaction. Issued invoices are never deleted, only `ANULATA`.
6. **Search.** `Patient.searchText` = `normalizeSearch(firstName + lastName + phone digits + local phone + email)`. It is rebuilt on every patient write. Normalisation: lowercase, diacritics stripped (ă→a, â→a, î→i, ș/ş→s, ț/ţ→t), runs of whitespace collapsed. Queries are normalised the same way and use `contains`.
7. **CNP:**
   - Never stored in clear.
   - `cnpEncrypted` holds AES-256-GCM `iv.ciphertext.tag` in base64url.
   - `cnpHash` is HMAC-SHA256(PII key, CNP), used for duplicate detection.
   - The UI shows it masked („1••••••••••23”). Revealing it is a separate action, and that action is audited.
8. **Appointment without a patient.** `Appointment.patientId` may be null only while `leadId` is set: a tentative online booking. The calendar then shows `lead.name` with the „Online” tag. Lead conversion sets `patientId`.
9. **Every reschedule or cancellation increments `Appointment.tokenVersion`**, which invalidates old confirmation links, and resets `reminderSentAt` to null.
10. **`Setting.value`** is JSON validated by the zod schema of its key (§7.4). Unknown keys are rejected.
11. **Anonymisation (GDPR erasure):**
    - Patient identity fields are replaced: name „Pacient anonimizat #<fileNumber>”, CNP, phone, email and address nulled, `searchText` reset.
    - `anonymizedAt` is set.
    - Leads, notes and the bodies and recipients of `MessageLog` rows for the patient are redacted.
    - The clinical and financial records are kept, because the clinic may have to keep them by law. Retention periods are to be confirmed with the clinic's legal adviser.

### 3.3 Full Prisma schema (`prisma/schema.prisma`)

This schema was validated with `prisma validate` against both `sqlite` and `postgresql`. It was generated with Prisma 7.10 and smoke-tested with the better-sqlite3 adapter, including the Serializable transactions used for gap-free sequences. WP1 copies it verbatim.

```prisma
// Dental Arena: schema Prisma (sursa de adevăr: docs/architecture.md §3).
// Dev: SQLite (driver adapter better-sqlite3). Prod: PostgreSQL (driver adapter pg).
// Portabil: fără tipuri native (@db.*), fără funcții SQL specifice, bani în Int (bani = 1/100 lei),
// ore de program în minute de la miezul nopții (ora României), momente în DateTime (UTC).

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite" // în producție: "postgresql" (URL-ul vine din prisma.config.ts)
}

// ───────────────────────────── Enum-uri ─────────────────────────────

enum Role {
  ADMIN
  MEDIC
  RECEPTIE
}

enum ThemePreference {
  SISTEM
  LUMINOS
  INTUNECAT
}

enum Density {
  COMPACT
  CONFORTABIL
}

enum AppointmentStatus {
  PROGRAMAT
  CONFIRMAT
  SOSIT
  IN_TRATAMENT
  FINALIZAT
  ANULAT
  NEPREZENTAT
}

enum AppointmentSource {
  ONLINE
  TELEFON
  RECEPTIE
  RECHEMARE
}

enum ConfirmationChannel {
  TELEFON
  SMS
  EMAIL
  LINK
  RECEPTIE
}

enum CancelledBy {
  PACIENT
  CLINICA
}

enum Comfort {
  FARA_EMOTII
  EMOTII
  FRICA
}

enum Sex {
  F
  M
}

enum LeadSource {
  FORMULAR_CONTACT
  PROGRAMARE_ONLINE
  APEL_INVERS
  TELEFON
  RECOMANDARE
  SOCIAL
  ALT
}

enum LeadStatus {
  NOU
  CONTACTAT
  PROGRAMAT
  PIERDUT
}

enum LeadActivityType {
  NOTA
  APEL
  SMS
  EMAIL
  STATUS
  ATRIBUIRE
  CONVERSIE
}

enum ConsentType {
  GDPR_DATE_SANATATE
  TRATAMENT
  INHALOSEDARE
  SMS
  EMAIL
  MARKETING
  FOTO
}

enum ConsentMethod {
  FORMULAR_ONLINE
  SEMNAT_HARTIE
  SEMNAT_TABLETA
  VERBAL
}

enum ToothConditionType {
  CARIE
  OBTURATIE
  ENDODONTIE
  COROANA
  PUNTE
  IMPLANT
  EXTRAS
  LIPSA
  FRACTURA
  RADACINA_RESTANTA
  FATETA
  SIGILARE
  MOBILITATE
  PARODONTOPATIE
  PROTEZA
  INCLUS
  ALTA
}

enum PlanStatus {
  CIORNA
  PREZENTAT
  ACCEPTAT
  IN_CURS
  FINALIZAT
  RESPINS
  ANULAT
}

enum PlanItemStatus {
  PROPUS
  ACCEPTAT
  PROGRAMAT
  EFECTUAT
  ANULAT
}

enum DocumentKind {
  RADIOGRAFIE_PANORAMICA
  RADIOGRAFIE_RETROALVEOLARA
  CBCT
  FOTOGRAFIE
  CONSIMTAMANT
  DEVIZ
  SCRISOARE_MEDICALA
  ALT
}

enum InvoiceStatus {
  EMISA
  ANULATA
}

enum EInvoiceStatus {
  NETRANSMISA
  IN_ASTEPTARE
  TRANSMISA
  RESPINSA
}

enum PaymentMethod {
  NUMERAR
  CARD
  TRANSFER
}

enum PriceUnit {
  ACT
  DINTE
  ARCADA
  ORA
  SEDINTA
}

enum TimeOffKind {
  CONCEDIU
  FORMARE
  BLOCAJ
  SARBATOARE
}

enum RecallStatus {
  DE_FACUT
  CONTACTAT
  PROGRAMAT
  REFUZAT
  ANULAT
}

enum MessageChannel {
  EMAIL
  SMS
}

enum MessageKind {
  CONFIRMARE_PROGRAMARE
  REMINDER
  ANULARE
  MODIFICARE
  NOTIFICARE_CLINICA
  RECHEMARE
  MANUAL
}

enum MessageStatus {
  TRIMIS
  SIMULAT
  EROARE
}

enum DataRequestType {
  ACCES
  EXPORT
  RECTIFICARE
  STERGERE
  OPOZITIE
}

enum DataRequestStatus {
  PRIMITA
  IN_LUCRU
  FINALIZATA
  RESPINSA
}

// ───────────────────────────── Clinici ─────────────────────────────

model Location {
  id            String   @id @default(cuid())
  slug          String   @unique // "cristesti" | "ludus"
  name          String // "Dental Arena Cristești"
  shortName     String // "Cristești"
  street        String // "str. Principală 536J/1"
  city          String
  county        String   @default("Mureș")
  postalCode    String?
  phone         String // "0265 326 316" (afișare); tel: se derivă
  email         String?
  mapsUrl       String?
  latitude      Float?
  longitude     Float?
  publishHours  Boolean  @default(false) // programul apare pe site doar după confirmarea clinicii
  sedationUnits Int      @default(1) // aparate de inhalosedare disponibile simultan
  sortOrder     Int      @default(0)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  hours        LocationHours[]
  cabinets     Cabinet[]
  shifts       WorkShift[]
  timeOff      TimeOff[]
  appointments Appointment[]
  leads        Lead[]
  patients     Patient[]       @relation("PreferredLocation")
  invoices     Invoice[]
  payments     Payment[]
  staff        User[]          @relation("HomeLocation")
  recalls      Recall[]
}

model LocationHours {
  id          String   @id @default(cuid())
  locationId  String
  weekday     Int // 1 = luni … 7 = duminică (ISO)
  openMinute  Int // 540 = 09:00, ora României
  closeMinute Int
  location    Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([locationId, weekday, openMinute])
}

model Cabinet {
  id         String   @id @default(cuid())
  locationId String
  name       String // "Cabinet 1"
  sortOrder  Int      @default(0)
  active     Boolean  @default(true)
  location   Location @relation(fields: [locationId], references: [id], onDelete: Cascade)

  shifts       WorkShift[]
  appointments Appointment[]

  @@unique([locationId, name])
}

// ───────────────────────────── Personal ─────────────────────────────

model User {
  id                 String          @id @default(cuid())
  email              String          @unique // stocat lowercase
  passwordHash       String
  role               Role
  firstName          String
  lastName           String
  phone              String?
  active             Boolean         @default(true)
  mustChangePassword Boolean         @default(false)
  failedLogins       Int             @default(0)
  lockedUntil        DateTime?
  lastLoginAt        DateTime?
  sessionVersion     Int             @default(1) // incrementat = toate sesiunile revocate
  theme              ThemePreference @default(SISTEM)
  density            Density         @default(COMPACT)
  homeLocationId     String?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  homeLocation   Location?      @relation("HomeLocation", fields: [homeLocationId], references: [id], onDelete: SetNull)
  doctor         Doctor?
  assignedLeads  Lead[]         @relation("LeadAssignee")
  leadActivities LeadActivity[]
  patientNotes   PatientNote[]
}

model Doctor {
  id                   String   @id @default(cuid())
  userId               String?  @unique
  slug                 String   @unique // "andrei-marcoci"
  honorific            String   @default("Dr.")
  firstName            String
  lastName             String
  publicName           String // "Dr. Andrei Marcoci"
  roleLine             String // "Medic dentist, stomatologie generală"
  bio                  String?
  photoPath            String? // "/images/echipa/andrei-marcoci.jpg"; null = placă cu monogramă
  monogram             String? // "VP"
  publicVisible        Boolean  @default(true)
  acceptsOnlineBooking Boolean  @default(true)
  sortOrder            Int      @default(0)
  active               Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user               User?               @relation(fields: [userId], references: [id], onDelete: SetNull)
  categories         DoctorCategory[]
  shifts             WorkShift[]
  timeOff            TimeOff[]
  appointments       Appointment[]
  preferredByLeads   Lead[]
  primaryForPatients Patient[]           @relation("PrimaryDoctor")
  treatmentPlans     TreatmentPlan[]
  performedItems     TreatmentPlanItem[] @relation("PerformedBy")
  invoiceItems       InvoiceItem[]
  recalls            Recall[]
}

model DoctorCategory {
  doctorId   String
  categoryId String
  showOnSite Boolean         @default(false) // apare în „Cine vă tratează” pe pagina serviciului
  doctor     Doctor          @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  category   ServiceCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([doctorId, categoryId])
}

model WorkShift {
  id            String    @id @default(cuid())
  doctorId      String
  locationId    String
  cabinetId     String?
  weekday       Int // 1 = luni … 7 = duminică
  startMinute   Int // ora României
  endMinute     Int
  onlineBooking Boolean   @default(true) // intervalul e oferit online
  validFrom     DateTime? // inclusiv (miezul nopții, ora României, salvat UTC)
  validUntil    DateTime? // exclusiv
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  doctor   Doctor       @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  location Location     @relation(fields: [locationId], references: [id], onDelete: Cascade)
  cabinet  Cabinet?     @relation(fields: [cabinetId], references: [id], onDelete: SetNull)
  breaks   ShiftBreak[]

  @@index([doctorId, weekday])
  @@index([locationId, weekday])
}

model ShiftBreak {
  id          String    @id @default(cuid())
  shiftId     String
  startMinute Int
  endMinute   Int
  label       String? // "Pauză de masă"
  shift       WorkShift @relation(fields: [shiftId], references: [id], onDelete: Cascade)
}

// doctorId null + locationId setat = clinica închisă (sărbătoare); ambele setate = medicul absent doar acolo.
model TimeOff {
  id          String      @id @default(cuid())
  doctorId    String?
  locationId  String?
  kind        TimeOffKind @default(CONCEDIU)
  startsAt    DateTime
  endsAt      DateTime
  reason      String?
  createdById String?
  createdAt   DateTime    @default(now())

  doctor   Doctor?   @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  location Location? @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@index([doctorId, startsAt])
  @@index([locationId, startsAt])
}

// ───────────────────────────── Servicii și prețuri ─────────────────────────────

model ServiceCategory {
  id            String   @id @default(cuid())
  slug          String   @unique // identic cu URL-ul paginii publice: "implantologie"
  name          String // "Implantologie"
  summary       String? // o propoziție pentru indexul „Ce tratăm”
  sortOrder     Int      @default(0)
  publicVisible Boolean  @default(true)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  services Service[]
  doctors  DoctorCategory[]
}

model Service {
  id               String    @id @default(cuid())
  categoryId       String
  code             String?   @unique // "IMP-NEODENT"
  name             String // „Implant Neodent”
  priceMin         Int? // bani; null = „preț stabilit la consultație”
  priceMax         Int? // bani; setat doar pentru intervale „900/1.100 lei”
  priceFrom        Boolean   @default(false) // „de la 200 lei”
  unit             PriceUnit @default(ACT)
  durationMinutes  Int       @default(30)
  bookableOnline   Boolean   @default(false)
  onlineLabel      String? // eticheta din pasul 1 al programării: „Igienizare (detartraj)”
  onlineHint       String?
  urgent           Boolean   @default(false) // „Am o durere acum”: afișează telefoanele
  isRepresentative Boolean   @default(false) // prețul afișat în indexul de pe Acasă (unul per categorie)
  toothSpecific    Boolean   @default(false) // cere dinte în planul de tratament
  recallMonths     Int? // după FINALIZAT se creează automat o rechemare (ex. 6 la igienizare)
  publicVisible    Boolean   @default(true) // apare în listele de prețuri
  active           Boolean   @default(true)
  sortOrder        Int       @default(0)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  category     ServiceCategory     @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  appointments Appointment[]
  leads        Lead[]
  planItems    TreatmentPlanItem[]
  invoiceItems InvoiceItem[]

  @@index([categoryId, sortOrder])
}

// ───────────────────────────── Pacienți ─────────────────────────────

model Patient {
  id                  String      @id @default(cuid())
  fileNumber          Int         @unique // nr. fișă, din NumberSequence "PACIENT"
  firstName           String
  lastName            String
  searchText          String // nume + telefon + email, lowercase, fără diacritice (căutare portabilă)
  cnpEncrypted        String? // AES-256-GCM (PII_ENCRYPTION_KEY)
  cnpHash             String?     @unique // HMAC-SHA256 pentru deduplicare
  birthDate           DateTime?
  sex                 Sex?
  phone               String? // E.164: "+40744123456"
  email               String?
  street              String?
  city                String?
  county              String?
  guardianId          String? // părinte/tutore pentru minori
  preferredLocationId String?
  primaryDoctorId     String?
  comfortDefault      Comfort?
  prefersSedation     Boolean     @default(false)
  smsOptIn            Boolean     @default(false)
  emailOptIn          Boolean     @default(false)
  acquisitionSource   LeadSource?
  notes               String? // observații administrative (nu clinice)
  active              Boolean     @default(true)
  anonymizedAt        DateTime? // GDPR: date personale șterse, fișa clinică păstrată
  createdById         String?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  guardian          Patient?          @relation("Guardian", fields: [guardianId], references: [id], onDelete: SetNull)
  dependents        Patient[]         @relation("Guardian")
  preferredLocation Location?         @relation("PreferredLocation", fields: [preferredLocationId], references: [id], onDelete: SetNull)
  primaryDoctor     Doctor?           @relation("PrimaryDoctor", fields: [primaryDoctorId], references: [id], onDelete: SetNull)
  medicalHistory    MedicalHistory?
  consents          Consent[]
  toothConditions   ToothCondition[]
  treatmentPlans    TreatmentPlan[]
  appointments      Appointment[]
  documents         PatientDocument[]
  tags              PatientTag[]
  patientNotes      PatientNote[]
  invoices          Invoice[]
  payments          Payment[]
  leads             Lead[]
  recalls           Recall[]
  dataRequests      DataRequest[]

  @@index([lastName, firstName])
  @@index([phone])
  @@index([searchText])
}

model MedicalHistory {
  id                   String    @id @default(cuid())
  patientId            String    @unique
  allergies            String? // text liber; nevid = alertă „Alergie: …”
  medications          String?
  anticoagulants       Boolean   @default(false)
  cardiacDisease       Boolean   @default(false)
  hypertension         Boolean   @default(false)
  diabetes             Boolean   @default(false)
  asthma               Boolean   @default(false)
  epilepsy             Boolean   @default(false)
  hepatitis            Boolean   @default(false)
  hiv                  Boolean   @default(false)
  bleedingDisorder     Boolean   @default(false)
  bisphosphonates      Boolean   @default(false)
  pregnancy            Boolean   @default(false)
  smoker               Boolean   @default(false)
  otherConditions      String?
  lastReviewedAt       DateTime?
  lastReviewedByUserId String?
  updatedAt            DateTime  @updatedAt
  patient              Patient   @relation(fields: [patientId], references: [id], onDelete: Cascade)
}

model Consent {
  id              String        @id @default(cuid())
  patientId       String
  type            ConsentType
  granted         Boolean // false = refuz explicit înregistrat
  method          ConsentMethod
  textVersion     String // „gdpr-2026-10”, „tratament-implant-v1”
  grantedAt       DateTime      @default(now())
  revokedAt       DateTime?
  treatmentPlanId String?
  documentId      String? // scanul formularului semnat
  ipHash          String? // doar pentru FORMULAR_ONLINE
  recordedById    String?
  notes           String?

  patient       Patient          @relation(fields: [patientId], references: [id], onDelete: Cascade)
  treatmentPlan TreatmentPlan?   @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)
  document      PatientDocument? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([patientId, type])
}

model ToothCondition {
  id           String             @id @default(cuid())
  patientId    String
  tooth        Int // FDI: 11–48 permanenți, 51–85 temporari
  surfaces     String? // combinație din M O D V L/P, ex. "MOD"
  condition    ToothConditionType
  notes        String?
  recordedAt   DateTime           @default(now())
  recordedById String?
  resolvedAt   DateTime? // ex. caria devine obturație: rândul vechi primește resolvedAt
  patient      Patient            @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId, tooth])
}

model TreatmentPlan {
  id          String     @id @default(cuid())
  patientId   String
  doctorId    String?
  title       String // „Plan implant 36”
  status      PlanStatus @default(CIORNA)
  notes       String?
  discount    Int        @default(0) // bani, reducere la nivel de plan
  presentedAt DateTime?
  acceptedAt  DateTime?
  createdById String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  patient  Patient             @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor   Doctor?             @relation(fields: [doctorId], references: [id], onDelete: SetNull)
  items    TreatmentPlanItem[]
  consents Consent[]

  @@index([patientId, status])
}

model TreatmentPlanItem {
  id                  String         @id @default(cuid())
  planId              String
  serviceId           String?
  tooth               Int?
  surfaces            String?
  description         String // copie a numelui serviciului la momentul adăugării
  phase               Int            @default(1)
  quantity            Int            @default(1)
  unitPrice           Int // bani, copie a prețului la momentul adăugării
  discount            Int            @default(0) // bani, pe linie
  status              PlanItemStatus @default(PROPUS)
  appointmentId       String?
  performedAt         DateTime?
  performedByDoctorId String?
  sortOrder           Int            @default(0)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  plan         TreatmentPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  service      Service?      @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  appointment  Appointment?  @relation(fields: [appointmentId], references: [id], onDelete: SetNull)
  performedBy  Doctor?       @relation("PerformedBy", fields: [performedByDoctorId], references: [id], onDelete: SetNull)
  invoiceItems InvoiceItem[]

  @@index([planId, phase])
}

model PatientDocument {
  id           String       @id @default(cuid())
  patientId    String
  kind         DocumentKind
  title        String
  fileName     String // numele original
  mimeType     String
  sizeBytes    Int
  storageKey   String       @unique // "patients/<patientId>/<cuid>.<ext>" sub STORAGE_DIR
  sha256       String
  tooth        Int?
  takenAt      DateTime?
  uploadedById String?
  createdAt    DateTime     @default(now())
  deletedAt    DateTime?

  patient  Patient   @relation(fields: [patientId], references: [id], onDelete: Cascade)
  consents Consent[]

  @@index([patientId, kind])
}

model Tag {
  id       String       @id @default(cuid())
  name     String       @unique // „VIP”, „Ortodonție în curs”
  color    String? // numele unui token: "menta" | "discret" | …
  patients PatientTag[]
}

model PatientTag {
  patientId String
  tagId     String
  patient   Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  tag       Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([patientId, tagId])
}

model PatientNote {
  id            String   @id @default(cuid())
  patientId     String
  appointmentId String?
  authorId      String?
  body          String
  clinical      Boolean  @default(false) // vizibilă doar ADMIN și MEDIC
  pinned        Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  patient     Patient      @relation(fields: [patientId], references: [id], onDelete: Cascade)
  appointment Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)
  author      User?        @relation(fields: [authorId], references: [id], onDelete: SetNull)

  @@index([patientId, createdAt])
}

// ───────────────────────────── Programări ─────────────────────────────

model Appointment {
  id             String               @id @default(cuid())
  locationId     String
  doctorId       String
  cabinetId      String?
  patientId      String? // null până la conversia cererii online
  leadId         String?
  serviceId      String?
  reason         String? // „Consultație sau control” sau text liber
  startsAt       DateTime
  endsAt         DateTime
  status         AppointmentStatus    @default(PROGRAMAT)
  source         AppointmentSource
  comfort        Comfort?
  comfortNote    String? // cuvintele pacientului
  wantsSedation  Boolean              @default(false) // rezervă aparatul de inhalosedare
  notes          String? // observații de recepție
  confirmedAt    DateTime?
  confirmedVia   ConfirmationChannel?
  arrivedAt      DateTime?
  startedAt      DateTime?
  completedAt    DateTime?
  cancelledAt    DateTime?
  cancelledBy    CancelledBy?
  cancelReason   String?
  noShowAt       DateTime?
  reminderSentAt DateTime?
  tokenVersion   Int                  @default(0) // incrementat la mutare/anulare: link-urile vechi expiră
  createdById    String?
  updatedById    String?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  location  Location            @relation(fields: [locationId], references: [id], onDelete: Restrict)
  doctor    Doctor              @relation(fields: [doctorId], references: [id], onDelete: Restrict)
  cabinet   Cabinet?            @relation(fields: [cabinetId], references: [id], onDelete: SetNull)
  patient   Patient?            @relation(fields: [patientId], references: [id], onDelete: SetNull)
  lead      Lead?               @relation(fields: [leadId], references: [id], onDelete: SetNull)
  service   Service?            @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  planItems TreatmentPlanItem[]
  notesList PatientNote[]

  @@index([locationId, startsAt])
  @@index([doctorId, startsAt])
  @@index([cabinetId, startsAt])
  @@index([patientId, startsAt])
  @@index([status, startsAt])
  @@index([leadId])
}

// ───────────────────────────── Cereri (lead-uri) ─────────────────────────────

model Lead {
  id                 String     @id @default(cuid())
  source             LeadSource
  status             LeadStatus @default(NOU)
  name               String
  phone              String? // E.164
  email              String?
  message            String?
  locationId         String?
  serviceId          String?
  preferredDoctorId  String?
  preferredTime      String? // pentru „Prefer să mă sunați”: „după ora 16”
  comfort            Comfort?
  comfortNote        String?
  wantsSedation      Boolean    @default(false)
  forChild           Boolean    @default(false)
  childFirstName     String?
  childAge           Int?
  consentGdprAt      DateTime?
  consentTextVersion String?
  consentSms         Boolean    @default(false)
  sourcePath         String? // pagina de pe care a venit
  ipHash             String?
  idempotencyKey     String?    @unique // generat în formular; un dublu-click nu creează două cereri
  assignedToId       String?
  patientId          String?
  lostReason         String?
  contactedAt        DateTime?
  convertedAt        DateTime?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  location        Location?      @relation(fields: [locationId], references: [id], onDelete: SetNull)
  service         Service?       @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  preferredDoctor Doctor?        @relation(fields: [preferredDoctorId], references: [id], onDelete: SetNull)
  assignedTo      User?          @relation("LeadAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  patient         Patient?       @relation(fields: [patientId], references: [id], onDelete: SetNull)
  appointments    Appointment[]
  activities      LeadActivity[]

  @@index([status, createdAt])
  @@index([phone])
}

model LeadActivity {
  id        String           @id @default(cuid())
  leadId    String
  type      LeadActivityType
  body      String?
  authorId  String?
  createdAt DateTime         @default(now())

  lead   Lead  @relation(fields: [leadId], references: [id], onDelete: Cascade)
  author User? @relation(fields: [authorId], references: [id], onDelete: SetNull)

  @@index([leadId, createdAt])
}

model Recall {
  id                  String       @id @default(cuid())
  patientId           String
  locationId          String?
  doctorId            String?
  reason              String // „Control la 6 luni după igienizare”
  dueDate             DateTime
  status              RecallStatus @default(DE_FACUT)
  attempts            Int          @default(0)
  lastAttemptAt       DateTime?
  outcomeNote         String?
  sourceAppointmentId String?
  bookedAppointmentId String?
  createdById         String?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  patient  Patient   @relation(fields: [patientId], references: [id], onDelete: Cascade)
  location Location? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  doctor   Doctor?   @relation(fields: [doctorId], references: [id], onDelete: SetNull)

  @@index([status, dueDate])
}

// ───────────────────────────── Facturare și încasări ─────────────────────────────

model Invoice {
  id             String         @id @default(cuid())
  series         String // „DA”
  number         Int // secvențial per serie, fără goluri (NumberSequence "FACTURA:<serie>")
  patientId      String
  locationId     String
  status         InvoiceStatus  @default(EMISA)
  issuedAt       DateTime       @default(now())
  dueAt          DateTime?
  currency       String         @default("RON")
  subtotal       Int // bani
  discountTotal  Int            @default(0)
  vatTotal       Int            @default(0) // servicii medicale scutite de TVA (implicit 0)
  total          Int
  amountPaid     Int            @default(0) // denormalizat; recalculat în aceeași tranzacție cu plata
  buyerName      String
  buyerAddress   String?
  buyerEmail     String?
  buyerCompany   String? // persoană juridică (opțional)
  buyerCui       String?
  buyerRegCom    String?
  notes          String?
  eInvoiceStatus EInvoiceStatus @default(NETRANSMISA)
  eInvoiceRef    String?
  eInvoiceError  String?
  createdById    String?
  cancelledAt    DateTime?
  cancelledById  String?
  cancelReason   String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  patient  Patient       @relation(fields: [patientId], references: [id], onDelete: Restrict)
  location Location      @relation(fields: [locationId], references: [id], onDelete: Restrict)
  items    InvoiceItem[]
  payments Payment[]

  @@unique([series, number])
  @@index([patientId, issuedAt])
  @@index([locationId, issuedAt])
}

model InvoiceItem {
  id                  String  @id @default(cuid())
  invoiceId           String
  serviceId           String?
  treatmentPlanItemId String?
  doctorId            String? // pentru raportul „venit pe medic”
  description         String
  tooth               Int?
  quantity            Int     @default(1)
  unitPrice           Int // bani
  discount            Int     @default(0) // bani, pe linie
  vatRate             Int     @default(0) // procent întreg
  total               Int // quantity*unitPrice - discount (+ TVA)
  sortOrder           Int     @default(0)

  invoice           Invoice            @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  service           Service?           @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  treatmentPlanItem TreatmentPlanItem? @relation(fields: [treatmentPlanItemId], references: [id], onDelete: SetNull)
  doctor            Doctor?            @relation(fields: [doctorId], references: [id], onDelete: SetNull)

  @@index([invoiceId])
  @@index([treatmentPlanItemId])
}

model Payment {
  id            String        @id @default(cuid())
  patientId     String
  invoiceId     String? // null = avans / plată în cont
  locationId    String
  amount        Int // bani, > 0
  method        PaymentMethod
  paidAt        DateTime      @default(now())
  receiptSeries String? // chitanță (doar NUMERAR)
  receiptNumber Int?
  reference     String? // nr. tranzacție POS / OP
  notes         String?
  receivedById  String?
  cancelledAt   DateTime?
  cancelledById String?
  cancelReason  String?
  createdAt     DateTime      @default(now())

  patient  Patient  @relation(fields: [patientId], references: [id], onDelete: Restrict)
  invoice  Invoice? @relation(fields: [invoiceId], references: [id], onDelete: SetNull)
  location Location @relation(fields: [locationId], references: [id], onDelete: Restrict)

  @@unique([receiptSeries, receiptNumber])
  @@index([patientId, paidAt])
  @@index([locationId, paidAt])
}

// ───────────────────────────── Mesaje ─────────────────────────────

model MessageTemplate {
  id          String         @id @default(cuid())
  key         String         @unique // „reminder.sms”, „reminder.email”, „booking.received.email” …
  channel     MessageChannel
  kind        MessageKind
  name        String // eticheta din Setări
  subject     String? // doar EMAIL
  body        String // cu {{variabile}}
  active      Boolean        @default(true)
  updatedById String?
  updatedAt   DateTime       @updatedAt
}

model MessageLog {
  id                String         @id @default(cuid())
  channel           MessageChannel
  kind              MessageKind
  status            MessageStatus
  to                String
  subject           String?
  body              String
  provider          String? // "smtp" | "console" | numele furnizorului SMS
  providerMessageId String?
  error             String?
  patientId         String?
  appointmentId     String?
  leadId            String?
  sentById          String? // null = trimis automat
  createdAt         DateTime       @default(now())

  @@index([appointmentId])
  @@index([patientId, createdAt])
  @@index([createdAt])
}

// ───────────────────────────── GDPR și audit ─────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  at         DateTime @default(now())
  actorId    String? // null = sistem / pacient prin link semnat
  actorName  String? // copie, rămâne lizibilă după dezactivarea contului
  actorRole  Role?
  action     String // „patient.view”, „patient.cnp.reveal”, „document.download” …
  entityType String // „Patient”, „Appointment”, „Invoice” …
  entityId   String?
  patientId  String? // pentru raportul GDPR „cine a accesat datele mele”
  ipHash     String?
  metadata   String? // JSON: câmpuri modificate (nume, nu valori PII)

  @@index([patientId, at])
  @@index([actorId, at])
  @@index([entityType, entityId])
  @@index([at])
}

model DataRequest {
  id            String            @id @default(cuid())
  patientId     String?
  type          DataRequestType
  status        DataRequestStatus @default(PRIMITA)
  requesterName String
  contact       String?
  details       String?
  receivedAt    DateTime          @default(now())
  dueAt         DateTime // receivedAt + 30 de zile (art. 12 GDPR)
  completedAt   DateTime?
  handledById   String?
  outcome       String?

  patient Patient? @relation(fields: [patientId], references: [id], onDelete: SetNull)

  @@index([status, dueAt])
}

// ───────────────────────────── Sistem ─────────────────────────────

model Setting {
  key         String   @id // „clinic”, „booking”, „reminders”, „invoicing” (valoare JSON validată cu zod)
  value       String
  updatedById String?
  updatedAt   DateTime @updatedAt
}

model NumberSequence {
  key       String   @id // „PACIENT”, „FACTURA:DA”, „CHITANTA:DAC”
  value     Int      @default(0) // ultimul număr emis
  updatedAt DateTime @updatedAt
}

model RateLimitBucket {
  key     String   @id // „booking:<ipHash>”, „login:<email>”
  count   Int
  resetAt DateTime

  @@index([resetAt])
}
```

---

## 4. Route map

### 4.1 Public site (`app/(site)`, all `lang="ro"`)

| URL | Page | Data | Owner |
|---|---|---|---|
| `/` | Acasă: hero with `AvailabilityPanel`, comfort question, Medicii, „Ce tratăm” index, Copiii, Clinicile | DB (doctors, representative prices, next free slots), `content/home.ts` | WP3 |
| `/servicii` | All 10 services. Two-column text index; no cards, no icons. | DB catalog plus `content/services` | WP3 |
| `/consultatie-profilaxie`, `/stomatologie-generala`, `/inhalosedare`, `/implantologie`, `/chirurgie-dento-alveolara`, `/protetica-dentara`, `/pedodontie`, `/ortodontie`, `/parodontologie`, `/estetica-dentara` | One dynamic route `[serviciu]` with `generateStaticParams` from `content/services` and `dynamicParams = false`. Hero, prose, „Cum decurge” (implantologie, ortodonție and inhalosedare only), „Cine vă tratează”, price table from the DB, CTA, related services. | DB plus content | WP3 |
| `/preturi` | Every price, grouped by category, with client-side search | DB | WP3 |
| `/echipa` | The five doctors. Podar gets a monogram plate. | DB `Doctor` | WP3 |
| `/echipa/[slug]` | Doctor profile: role, services, „Unde lucrează” (from shifts, only if `Location.publishHours`), booking link `/programare?medic=<slug>` | DB | WP3 |
| `/despre-noi` | The clinic story, „Fără durere / Fără frică / Precizie” (correct pairing), photos | content | WP3 |
| `/15ani` | Brand history: 15 years, from 2009 (founding year inferred). The 2024 promotion is told in the past tense. | content | WP3 |
| `/contact` | Two clinics split on the axis (`#clinici`, `#cristesti`, `#ludus`), phones, e-mail, maps behind consent, contact form, which creates a `Lead` with source `FORMULAR_CONTACT` | DB plus action | WP3 (form action calls WP4 `createContactLead`) |
| `/termeni-si-conditii`, `/politica-de-confidentialitate`, `/politica-cookies` | Legal pages: structured drafts with `[de completat]` placeholders for the legal entity, CUI and registry number | content | WP3 |
| `/dentist-targu-mures`, `/cabinet-stomatologic-targu-mures` | SEO landing pages pointing to Cristești („lângă Târgu Mureș”) | content plus DB | WP3 |
| `/programare` | Booking wizard. Query params prefill it: `?serviciu=<code>&clinica=cristesti\|ludus&medic=<slug>&ora=<ISO>&confort=fara-emotii\|emotii\|frica` | DB plus `/api/public/slots` | WP4 |
| `/p/[token]` | Patient self-service: shows the appointment, with POST buttons „Confirm programarea” and „Anulez programarea” | signed token | WP4 |
| `/p/[token]/ics` | `text/calendar` download | signed token | WP4 |
| `/robots.txt`, `/sitemap.xml` | `robots.ts` disallows `/crm` and `/api`, plus `sitemap.ts` | | WP3 |

**Redirects** (in `next.config.ts` `redirects()`, all `permanent: true`, owned by WP1):

| From | To |
|---|---|
| `/medici` | `/echipa` |
| `/medici/:slug` | `/echipa/:slug` |
| `/confidentialitate`, `/gdpr`, `/privacy-policy` | `/politica-de-confidentialitate` |
| `/cookie-uri`, `/cookies` | `/politica-cookies` |
| `/termeni-conditii` | `/termeni-si-conditii` |
| `/cabinet`, `/cabinet/:path*` | `/crm` |
| `/programari` | `/programare` |

Trailing-slash URLs from WordPress (`/implantologie/`) get Next's default 308 to the URL without the slash.

### 4.2 CRM (`app/(crm)/crm`, noindex, behind auth)

All pages below `/crm` except `/crm/login` sit under the `(app)` group layout, which calls `requireUser()`. The query params `clinica` and `zi` are optional everywhere. The clinic scope (`cristesti`, `ludus` or `ambele`) persists in the `da_clinica` cookie (§7.4).

| URL | Screen | Permission (§5) | Owner |
|---|---|---|---|
| `/crm/login` | Login („Intrați în cont”) | public | WP1 |
| `/crm` | **Azi** (dashboard): a one-sentence summary per clinic, today's list with status actions, work queues (cereri noi, de rechemat, solduri), and KPIs: month revenue (ADMIN), no-show rate, new leads | `dashboard.view` | WP6 (KPIs from WP5) |
| `/crm/programari` | **Calendar.** `?vedere=zi\|saptamana&zi=YYYY-MM-DD&clinica=…&coloane=medici\|cabinete&medic=<doctorId>` | `appointments.view` | WP6 |
| `/crm/programari/noua` | Full create form (prefilled from `?medic&zi&ora&pacient&cerere`) | `appointments.manage` or `appointments.manageOwn` | WP6 |
| `/crm/programari/[id]` | Appointment detail (the drawer content as a page; deep link) | `appointments.view` | WP6 |
| `/crm/cereri` | **Lead-uri** pipeline (columns Nou / Contactat / Programat / Pierdut; list view toggle) | `leads.view` | WP6 |
| `/crm/cereri/[id]` | Lead detail: activity, assignment, conversion to patient and appointment | `leads.view` | WP6 |
| `/crm/rechemari` | „De rechemat” queue | `recalls.view` | WP6 |
| `/crm/pacienti` | Patient search and list (`?q=`, `?eticheta=`) | `patients.view` | WP7 |
| `/crm/pacienti/nou` | New patient, with a duplicate warning | `patients.create` | WP7 |
| `/crm/pacienti/[id]` | Fișă: Prezentare (header with flags, comfort note, balance, next appointment, alerts) | `patients.view` | WP7 |
| `/crm/pacienti/[id]/date` | Personal data, CNP (masked, with reveal), guardian, preferences, tags | `patients.view` (edit: `patients.edit`) | WP7 |
| `/crm/pacienti/[id]/anamneza` | Anamneză (medical history) | `medical.view` | WP7 |
| `/crm/pacienti/[id]/consimtaminte` | Consents with timestamps, method and text version; record or revoke | `patients.view` (record: `consents.manage`) | WP7 |
| `/crm/pacienti/[id]/odontograma` | FDI tooth chart, adult and child | `medical.view` | WP7 |
| `/crm/pacienti/[id]/planuri` | Treatment plans list | `plans.view` | WP7 |
| `/crm/pacienti/[id]/planuri/[planId]` | Plan editor: phases, lines (tooth, service, price, status), totals, progress | `plans.view` (edit: `plans.manage`) | WP7 |
| `/crm/pacienti/[id]/planuri/[planId]/tipar` | Printable deviz (A4, print CSS) | `plans.view` | WP7 |
| `/crm/pacienti/[id]/programari` | Appointment history | `appointments.view` | WP7 |
| `/crm/pacienti/[id]/documente` | Document metadata list, upload, download | `documents.view` | WP7 |
| `/crm/pacienti/[id]/note` | Notes (administrative and clinical) | `patients.view` (clinical: `medical.view`) | WP7 |
| `/crm/pacienti/[id]/incasari` | Invoices, payments and balance for the patient | `billing.view` | WP8 |
| `/crm/pacienti/[id]/gdpr` | Export (JSON), anonymise, audit trail for this patient | `gdpr.manage` | WP7 |
| `/crm/gdpr` | Register of GDPR requests (`DataRequest`), with 30-day due dates | `gdpr.manage` | WP7 |
| `/crm/facturi`, `/crm/facturi/noua`, `/crm/facturi/[id]`, `/crm/facturi/[id]/tipar` | Invoices: list, create (from plan items, appointments or the catalog), view and cancel, print | `billing.view` / `billing.create` / `billing.cancel` | WP8 |
| `/crm/incasari` | Payments journal (per day and location, per method), record a payment | `billing.view` / `billing.create` | WP8 |
| `/crm/servicii`, `/crm/servicii/[id]` | Catalog: categories, services, prices, durations, online flags, representative price, recall months | `catalog.view` / `catalog.manage` | WP8 |
| `/crm/echipa`, `/crm/echipa/nou`, `/crm/echipa/[id]` | Users and doctors: role, home location, doctor profile, categories, activate/deactivate, reset password | `staff.view` / `staff.manage` | WP8 |
| `/crm/echipa/[id]/program` | Weekly shifts per location (with cabinet and breaks), online flag, validity | `schedules.view` / `schedules.manage` | WP4 |
| `/crm/absente` | Time off and closures (doctor and/or location) | `schedules.view` / `timeoff.manage` | WP4 |
| `/crm/locatii`, `/crm/locatii/[id]` | Locations: address, phone, hours, publish flag, cabinets, sedation units | `locations.view` / `locations.manage` | WP8 |
| `/crm/mesaje` | Message log (filters: channel, kind, status, date), manual send | `messages.view` | WP5 |
| `/crm/mesaje/sabloane`, `/crm/mesaje/sabloane/[key]` | Template list and editor (preview with sample data) | `templates.manage` | WP5 |
| `/crm/rapoarte` | Report index plus a line chart of visits per week per clinic | `reports.view` or `reports.viewOwn` or `reports.operational` | WP5 |
| `/crm/rapoarte/[raport]` | One report with filters (`?de=&pana=&clinica=&medic=`) and a CSV button | as above, per report (§5.3) | WP5 |
| `/crm/audit` | Audit log viewer (filters: actor, action, patient, date) | `audit.view` | WP5 |
| `/crm/setari` | Clinic info, booking rules, reminders, invoicing series, GDPR retention | `settings.manage` | WP8 |
| `/crm/cont` | My account: name, password, theme, density | any user | WP1 |
| `/crm/acces-interzis` | 403 page | any user | WP1 |
| `/crm/ui` | Component gallery for QA | ADMIN | WP2 |

### 4.3 API route handlers (`app/api`)

All handlers validate with zod and return JSON errors of the form `{ error: string }` with the correct status codes. Handlers that need a user call `getCurrentUser()` themselves; proxy does not cover `/api`.

| Method and URL | Auth | Purpose | Owner |
|---|---|---|---|
| `GET /api/health` | none | `{ ok: true, db: true }` (runs `SELECT 1`) | WP1 |
| `GET /api/public/slots?clinica=&serviciu=&medic=&de=YYYY-MM-DD&zile=7` | none, rate-limited 60/min/IP | Free slots for the wizard: `DaySlots[]` (§6.1). Sends `Cache-Control: no-store`. | WP4 |
| `GET /api/cron/reminders` (also `POST`) | `Authorization: Bearer $CRON_SECRET`, compared timing-safe | Sends the 24h reminders (§6.6). Returns a summary. | WP5 |
| `GET /api/cron/maintenance` (also `POST`) | Bearer `CRON_SECRET` | Purges expired rate-limit buckets and anonymises stale unconverted leads (§8.4) | WP5 |
| `GET /api/crm/rapoarte/[raport]?…` | session plus report permission | CSV: UTF-8 with BOM, `;` separator (Excel RO), filename `raport-<slug>-<de>-<pana>.csv`. Audited as `report.export`. | WP5 |
| `POST /api/crm/pacienti/[id]/documente` | session plus `documents.upload`, plus a same-origin `Origin` check | Multipart upload, at most 20 MB. MIME allowlist: jpeg, png, webp, pdf, dicom. Magic bytes are checked and SHA-256 computed. The file goes to `STORAGE_DIR`. | WP7 |
| `GET /api/crm/documente/[id]` | session plus `documents.view` | Streams the file with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. Audited as `document.download`. | WP7 |
| `GET /api/crm/pacienti/[id]/export` | session plus `gdpr.manage` | GDPR export as JSON: all patient data plus document metadata. Audited as `patient.export`. | WP7 |

---

## 5. Authentication and authorisation

### 5.1 Session design

**Login** (`/crm/login`, action `login`):
1. Apply the rate limits `login:ip:<ipHash>` (20 per 15 minutes) and `login:email:<email>` (5 per 15 minutes).
2. Look up the user by lowercased e-mail.
3. Always run `bcrypt.compare`. If the user does not exist, compare against a constant dummy hash, so timing does not reveal which e-mails exist.
4. On failure:
   - increment `failedLogins`
   - at 10 failures, set `lockedUntil = now + 15 min`
   - show one generic message: „E-mailul sau parola nu sunt corecte.”
5. On success:
   - reset `failedLogins`, set `lastLoginAt`
   - audit `auth.login`
   - set the cookie
   - redirect to `next`, which must be a same-origin path starting with `/crm`, or to `/crm`

**Cookie:**
- name `da_session`
- `httpOnly`, `secure` in production, `sameSite: 'lax'`, `path: '/'`
- holds an HS256 JWT signed with jose, using the key `HMAC(AUTH_SECRET, "session")`
- claims:
  - `uid`
  - `role`
  - `sv` (= `User.sessionVersion`)
  - `iat`
  - `exp` (idle: 8 hours)
  - `aexp` (absolute: 12 hours after login)

**Proxy** (`src/proxy.ts`, matcher `['/crm/:path*']`):
1. Verify the JWT, with no DB access.
2. If it is missing or invalid and the path is not `/crm/login`, redirect to `/crm/login?next=<path>`.
3. If it is valid and older than 30 minutes, re-sign it with a new `iat` and `exp = min(now + 8h, aexp)` (sliding idle timeout).
4. On every response, set the headers `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.

**DAL** (`src/lib/auth/dal.ts`): `getCurrentUser()` is wrapped in React `cache()` and checks:
- the JWT
- that the user exists and `active`
- that `sv === user.sessionVersion`
- that `lockedUntil` has passed

This check is the real security boundary. Every CRM page, action and route handler goes through it.

**Revocation.** Incrementing `User.sessionVersion` logs the user out everywhere. This happens on:
- deactivation
- a password change
- a role change
- an admin's „Deconectați toate sesiunile”

**Logout.** A Server Action deletes the cookie and audits `auth.logout`.

**Passwords:**
- bcryptjs, cost 12
- policy: at least 10 characters, not equal to the e-mail, not in a short local deny list
- `mustChangePassword` forces a redirect to `/crm/cont?schimbare=1`

### 5.2 Permission keys (`src/lib/permissions.ts`)

```ts
export const PERMISSIONS = {
  "dashboard.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "dashboard.revenue":         ["ADMIN"],                       // month revenue on Azi
  "appointments.view":         ["ADMIN", "MEDIC", "RECEPTIE"],  // all calendars, both clinics
  "appointments.manage":       ["ADMIN", "RECEPTIE"],           // create/edit/move/cancel/status for anyone
  "appointments.manageOwn":    ["MEDIC"],                       // same, only where doctorId = own doctor
  "appointments.override":     ["ADMIN", "RECEPTIE"],           // save despite "warn" conflicts
  "leads.view":                ["ADMIN", "RECEPTIE"],
  "leads.manage":              ["ADMIN", "RECEPTIE"],           // status, assign, convert
  "recalls.view":              ["ADMIN", "MEDIC", "RECEPTIE"],  // MEDIC: own recalls
  "recalls.manage":            ["ADMIN", "RECEPTIE"],
  "patients.view":             ["ADMIN", "MEDIC", "RECEPTIE"],
  "patients.create":           ["ADMIN", "MEDIC", "RECEPTIE"],
  "patients.edit":             ["ADMIN", "MEDIC", "RECEPTIE"],  // demographics, contact, tags, comfort
  "patients.revealCnp":        ["ADMIN", "MEDIC", "RECEPTIE"],  // always audited
  "consents.manage":           ["ADMIN", "MEDIC", "RECEPTIE"],
  "medical.view":              ["ADMIN", "MEDIC"],              // anamneză, odontogramă, clinical notes
  "medical.edit":              ["ADMIN", "MEDIC"],
  "plans.view":                ["ADMIN", "MEDIC", "RECEPTIE"],  // reception needs prices to bill
  "plans.manage":              ["ADMIN", "MEDIC"],
  "documents.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "documents.upload":          ["ADMIN", "MEDIC", "RECEPTIE"],
  "documents.delete":          ["ADMIN"],                       // soft delete
  "gdpr.manage":               ["ADMIN"],                       // export, anonymise, request register
  "catalog.view":              ["ADMIN", "MEDIC", "RECEPTIE"],
  "catalog.manage":            ["ADMIN"],
  "billing.view":              ["ADMIN", "RECEPTIE"],
  "billing.create":            ["ADMIN", "RECEPTIE"],           // invoices + payments
  "billing.cancel":            ["ADMIN"],
  "staff.view":                ["ADMIN", "MEDIC", "RECEPTIE"],
  "staff.manage":              ["ADMIN"],
  "schedules.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "schedules.manage":          ["ADMIN"],
  "timeoff.manage":            ["ADMIN", "RECEPTIE"],           // MEDIC may add own time off (scoped)
  "locations.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "locations.manage":          ["ADMIN"],
  "messages.view":             ["ADMIN", "RECEPTIE"],
  "messages.send":             ["ADMIN", "RECEPTIE"],
  "templates.manage":          ["ADMIN"],
  "reports.view":              ["ADMIN"],                       // every report, incl. revenue
  "reports.operational":       ["ADMIN", "RECEPTIE"],           // appointments, no-shows, leads
  "reports.viewOwn":           ["ADMIN", "MEDIC"],              // own production and no-shows
  "audit.view":                ["ADMIN"],
  "settings.manage":           ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
```

**Scoping rules for MEDIC.** These are enforced in the services, not only in the UI:
- With `appointments.manageOwn` a MEDIC acts only on appointments where `doctorId === user.doctorId`. When creating, `doctorId` is forced to their own.
- In status transitions, a MEDIC may move their own appointments through `SOSIT → IN_TRATAMENT → FINALIZAT`. Confirming and cancelling their own appointments is also allowed.
- `reports.viewOwn` filters every query by `doctorId = user.doctorId`.
- `timeoff.manage` for MEDIC (an explicit extra rule, `canManageTimeOff(user, doctorId)`) is limited to their own doctor.
- `recalls.view` for MEDIC lists only recalls where `doctorId = own`.

**RECEPTIE on the patient file** sees the medical alert flags (allergies, anticoagulants and so on, computed by `getPatientFlags`) on the header and in the calendar. It does not see the full anamneză, the odontogram or clinical notes.

### 5.3 Matrix per module

Key: **full** = every action in the module · **partial** = only what the cell lists · **read** = read-only · — = no access.

| Module | ADMIN | MEDIC | RECEPTIE |
|---|---|---|---|
| Dashboard (Azi) | full, incl. month revenue | partial: own agenda first, clinic KPIs without revenue, own production | partial: both clinics' agenda, cash collected today, no month revenue |
| Programări (calendar) | full | partial: sees all; creates, moves and changes status on own only | full, incl. override of warnings |
| Cereri / Lead-uri | full | — | full |
| De rechemat | full | read, own only | full |
| Pacienți: date, contact, tag-uri, consimțăminte | full | full | full |
| Pacienți: CNP | reveal (audited) | reveal (audited) | reveal (audited) |
| Pacienți: anamneză, odontogramă, note clinice | full | full | partial: alert flags only |
| Planuri de tratament | full | full | read (for billing) |
| Documente | full, incl. delete | partial: view and upload | partial: view and upload |
| GDPR: export, anonimizare, registru | full | — | — |
| Servicii și prețuri | full | read | read |
| Facturare și încasări | full, incl. cancel | — | partial: create invoices and payments, no cancel |
| Echipă (users and doctors) | full | read (list) | read (list) |
| Program medici | full | partial: view; own time off | partial: view; time off for anyone |
| Locații | full | read | read |
| Mesaje: jurnal, trimitere | full | — | full |
| Mesaje: șabloane | full | — | — |
| Rapoarte | full: all reports plus CSV | partial: own production and no-shows | partial: appointments, no-shows, lead conversion plus CSV; no revenue |
| Audit log | full | — | — |
| Setări | full | — | — |
| Contul meu | full | full | full |

**Reports and the permission each needs** (`src/server/reports/reports.ts`):

| Report slug | Permission |
|---|---|
| `venit-medic`, `venit-serviciu`, `venit-clinica`, `venit-lunar` | `reports.view` (or `reports.viewOwn`, filtered) |
| `programari`, `neprezentari` | `reports.operational` (or `reports.viewOwn`, filtered) |
| `conversie-cereri` | `reports.operational` |
| `incasari-metoda` | `reports.view` |

---
## 6. Scheduling: availability, conflicts, statuses, booking, links, reminders

All of this lives in `src/server/scheduling/**` (WP4). The pure parts take no Prisma and no clock, so they can be unit-tested:
- `compute.ts`
- `intervals.ts`
- `ALLOWED_TRANSITIONS` in `status.ts`

### 6.1 Slot-availability algorithm

**Inputs** (`SlotQuery`):
- `locationId`
- `serviceId`
- `doctorId | null` (null = „Oricare medic”)
- `fromDateISO` (local date)
- `days`: at most `booking.maxDaysPerRequest`, default 7, capped at 14
- `channel`: `"online"` or `"crm"`
- `now`

**Settings used** (`booking`, §7.4):

| Setting | Default | Meaning |
|---|---|---|
| `slotStepMinutes` | 15 | Grid for candidate start times |
| `minLeadMinutes` | 120 | Online only: no slot sooner than now + 2h |
| `horizonDays` | 30 | Online only: nothing beyond today + 30 days |
| `bufferMinutes` | 0 | Gap after each appointment (cleaning time) |
| `morningEndsAtMinute` | 780 | Split between „Dimineața” and „După-amiaza” |

**Step 1: duration.** `D = service.durationMinutes` (5–480).

**Step 2: eligible doctors.** All doctors that meet every condition:
- `active = true`
- for `online`: `acceptsOnlineBooking = true`, and the service has `bookableOnline = true`
- a `DoctorCategory` row exists for `service.categoryId`. If the category has no doctor rows at all, every doctor qualifies.
- if `doctorId` is given, only that doctor

**Step 3: load data in 4 queries** for `[rangeStartUtc, rangeEndUtc)`. The range runs from local midnight of `fromDateISO` to local midnight of `fromDateISO + days`.
- `WorkShift` (with `breaks`) for the eligible doctors at `locationId`, where `onlineBooking = true` when the channel is online, and the validity window overlaps the range
- `TimeOff` where (`doctorId ∈ eligible`, or `doctorId IS NULL AND locationId = locationId`) and the interval overlaps the range
- `Appointment` with a status in `BLOCKING_STATUSES` and an interval overlapping the range, where:
  - the `doctorId` is eligible, at **any** location (a doctor cannot be in two places at once), or
  - the `cabinetId` belongs to one of the shifts' cabinets
- `LocationHours` for the location. If the location has hours, they clip shifts. If it has none, shifts alone decide.

**Step 4: compute, per local date `d` and per eligible doctor.** This is the pure function `computeSlots`:
1. Take `shifts(d)`: weekday = ISO weekday of `d`, the validity window contains `d`, and the location matches.
2. For each shift, build `open = [toUtc(d, startMinute), toUtc(d, endMinute))`. `toUtc` composes a local wall-clock time through `Intl` and is DST-safe.
3. Clip `open` to the location hours of that weekday, if any.
4. Subtract:
   - each break of the shift
   - each `TimeOff` for the doctor or the location (location closure)
   - each blocking appointment of the doctor, expanded by `[start, end + bufferMinutes)`
   - if the shift has a `cabinetId`: each blocking appointment in that cabinet by another doctor
5. What is left is a sorted list of free intervals `F`.
6. In each free interval `[a, b)`:
   - Generate starts `t` on the grid: local minutes from midnight that are multiples of `slotStepMinutes`, starting from `ceil(a)`.
   - Keep `t` while `t + D <= b`.
   - For online, also require `t >= now + minLeadMinutes` and `t < now + horizonDays`. For the CRM, require only `t >= now - 0` for today; past days are not offered.

**Step 5: merge across doctors.**
- Group the starts by `t`. Each slot becomes `{ startsAt, endsAt = t + D, localTime: "HH:MM", doctorIds: [...] }`.
- With „Oricare medic”, the same time from two doctors appears once, with both ids.

**Step 6: result.** `DaySlots[] = [{ dateISO, slots[] }]`, sorted by date and then time. Days without slots are kept with `slots: []`, so the WeekStrip can disable them. `period` is `"dimineata"` when `localTime < morningEndsAtMinute`, otherwise `"dupa-amiaza"`.

**Step 7: doctor choice for „Oricare medic” at submit.** Among `doctorIds`, pick:
1. the doctor with the fewest booked minutes that local day
2. on a tie, the lowest `Doctor.sortOrder`

The choice is stable and deterministic.

**Complexity.** The cost is O(shifts + appointments) per day, all in memory. A 14-day query for 5 doctors runs well under 50 ms on SQLite.

**`getNextFreeSlots(locationId, count = 3, serviceCode = settings.booking.homeServiceCode)`** feeds the home panel. It scans forward in 7-day windows, up to the horizon, until it has `count` slots. Any error or an empty result returns `[]`, and the panel then shows the phone fallback.

**Inhalosedare is not a slot filter.** Comfort and sedation are chosen after the slot (wizard step 3). At submit, if `wantsSedation` is set and the sedation units are busy, the booking still succeeds. The appointment then carries a `SEDATION_UNIT_BUSY` warning, which the CRM shows, and reception arranges it by phone.

**Tests** (`compute.test.ts`) must cover at least:
- a break in the middle of a shift
- an appointment that straddles two grid points
- a buffer
- location closure via `TimeOff`
- a doctor busy at the other clinic
- a cabinet shared by two doctors
- `minLeadMinutes` across midnight
- the **DST change on 25 Oct 2026**, where the 09:00 local shift must still produce 09:00 slots
- „Oricare medic” de-duplication

### 6.2 Conflict detection (CRM create, edit and move; online submit)

```ts
type ConflictKind =
  | "DOCTOR_OVERLAP"      // block   – same doctor, overlapping blocking appointment (any location)
  | "CABINET_OVERLAP"     // block   – same cabinet, overlapping blocking appointment
  | "TIME_OFF"            // block   – doctor on leave / location closed
  | "OUTSIDE_SHIFT"       // warn    – outside the doctor's shift at this location
  | "ON_BREAK"            // warn    – overlaps a shift break
  | "PATIENT_OVERLAP"     // warn    – same patient has another blocking appointment overlapping
  | "SEDATION_UNIT_BUSY"  // warn    – concurrent wantsSedation appointments >= Location.sedationUnits
  | "IN_PAST";            // warn    – start before now (back-office entry of a past visit)
type Conflict = { kind: ConflictKind; severity: "block" | "warn"; message: string; appointmentId?: string };
```

**Overlap predicate:** `a.startsAt < b.endsAt && b.startsAt < a.endsAt`. Touching intervals do not conflict. `excludeAppointmentId` ignores the appointment being edited.

**Behaviour by severity:**
- A `block` conflict always rejects the save.
- A `warn` conflict rejects the save unless:
  - the request carries `acknowledgeWarnings: true`, and
  - the user has `appointments.override` (a MEDIC overrides only `OUTSIDE_SHIFT` and `IN_PAST` on their own appointments)

**Messages** follow §12.4 of the design system. For example:
- „Dr. Mașca are deja o programare la 10:30. Alegeți altă oră sau alt medic.”
- „Cabinetul 2 este ocupat la 10:30.”
- „Dr. Fertea este în concediu în această zi.”

### 6.3 Race safety (two people booking the same slot)

All appointment writes go through `withSchedulingTx(fn)` in `src/server/scheduling/conflicts.ts`:

```ts
await prisma.$transaction(async (tx) => {
  const conflicts = await findConflicts(tx, candidate);   // re-checked INSIDE the tx
  if (conflicts.some(c => c.severity === "block") || (warns && !ack)) throw new DomainError("CONFLICT", …, { conflicts });
  return tx.appointment.create/update(…);
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
```

- On SQLite, writers are serialised by the database.
- On PostgreSQL, Serializable makes a concurrent write fail with Prisma error `P2034`. `withSchedulingTx` retries up to 3 times with jitter. It then raises `SLOT_TAKEN`, which online booking shows as: „Ora de 10:30 tocmai a fost ocupată. Alegeți altă oră; celelalte date au rămas completate.”

### 6.4 Appointment status machine

| From \ To | PROGRAMAT | CONFIRMAT | SOSIT | IN_TRATAMENT | FINALIZAT | ANULAT | NEPREZENTAT |
|---|---|---|---|---|---|---|---|
| PROGRAMAT | | ✓ | ✓ | | | ✓ | ✓ (after start) |
| CONFIRMAT | ✓ (undo) | | ✓ | | | ✓ | ✓ (after start) |
| SOSIT | | ✓ (undo) | | ✓ | ✓ | ✓ (left before treatment) | |
| IN_TRATAMENT | | | ✓ (undo) | | ✓ | | |
| FINALIZAT | | | | ✓ (undo, ≤ 24 h, ADMIN only) | | | |
| ANULAT | ✓ (restore, only if no block conflict) | | | | | | |
| NEPREZENTAT | ✓ (restore) | | ✓ (arrived late) | | | | |

**Side effects** (in `transitionAppointment`, one transaction):

| Target | Sets | Also |
|---|---|---|
| `CONFIRMAT` | `confirmedAt`, `confirmedVia` | |
| `SOSIT` | `arrivedAt` | |
| `IN_TRATAMENT` | `startedAt` | |
| `FINALIZAT` | `completedAt` | |
| `ANULAT` | `cancelledAt`, `cancelledBy`, `cancelReason` | `tokenVersion++` |
| `NEPREZENTAT` | `noShowAt` | |
| any undo | clears the timestamp it reverts | |

Every transition writes `AuditLog` `appointment.status` with `{ from, to }`.

**Notifications** are triggered by the caller after commit, through `after()`:
- `CONFIRMAT` from the CRM sends SMS `CONFIRMARE_PROGRAMARE`, but only if the patient opted in to SMS
- `ANULAT` by the clinic sends `ANULARE`
- a move sends `MODIFICARE`

**Moving** is `moveAppointment` (WP6). It is allowed only in `PROGRAMAT` and `CONFIRMAT`. It:
- runs the full conflict check
- increments `tokenVersion` and clears `reminderSentAt`
- keeps `CONFIRMAT` only if the user ticks „Pacientul a confirmat noua oră”; otherwise the status goes back to `PROGRAMAT`

The toast „Programare mutată la 11:30” offers „Anulați” (undo) for 6 seconds. Undo calls `moveAppointment` back to the old values.

**Recalls.** When an appointment reaches `FINALIZAT` and its service has `recallMonths`, the WP6 action also calls `createRecallForCompleted(appointmentId)`. That creates `Recall { dueDate = completedAt + recallMonths }` unless an open recall already exists for the patient and service.

### 6.5 Online booking flow (`/programare`, WP4)

**Steps.** These follow design system §6.7. The wizard is a client component (`BookingWizard`) and its state is kept in the URL plus `sessionStorage`.

| Step | Content |
|---|---|
| 1. Motivul și clinica | Reasons = active services with `bookableOnline` and an `onlineLabel`, sorted. „Am o durere acum” (`urgent = true`) pins both phone numbers. Clinics come as two `ChoicePanel`s, each with its next free slot. |
| 2. Ziua și ora | Doctor filter („Oricare medic” plus the eligible doctors), a 14-day `WeekStrip`, slots grouped by period from `GET /api/public/slots`. The link „Prefer să mă sunați” opens `CallbackForm`. |
| 3. Cum vă simțiți | Comfort answer (prefilled from `sessionStorage['da-confort']`), the „Aș vrea inhalosedare” checkbox, and an optional `comfortNote` |
| 4. Datele dumneavoastră | Name, phone (required), e-mail (optional), „Pentru cine?” (with the child's first name and age), a note, GDPR consent (required, linking to the privacy page, `textVersion = settings.gdpr.consentTextVersion`), and SMS consent (optional). Plus a honeypot and an idempotency key (a `crypto.randomUUID()` created when the wizard mounts). |

**Submit** is the Server Action `submitBooking`, which calls `createOnlineBooking`:
1. `publicAction` guard:
   - rate limits: `booking:ip` 5 per 10 minutes, `booking:phone` 3 per 24 hours
   - honeypot plus minimum fill time of 3 s; a bot gets a fake success
   - zod validation
2. If a `Lead` with the same `idempotencyKey` exists, return its stored result: a double click does not book twice.
3. Re-validate that the service is bookable online, the doctor eligible, and the slot still inside the rules (lead time, horizon, on the grid).
4. Run `withSchedulingTx`:
   - re-compute that the exact slot is free. For „Oricare”, pick the doctor per §6.1 step 7 among those still free.
   - create the `Lead`:
     - `source = PROGRAMARE_ONLINE`, `status = NOU`
     - comfort, child and consent fields
     - `ipHash`, `sourcePath`
   - create the `Appointment`:
     - `status = PROGRAMAT`, `source = ONLINE`
     - `patientId = null`, `leadId = lead.id`
     - `serviceId`, `reason = service.onlineLabel`
     - comfort, `comfortNote`, `wantsSedation`
     - cabinet from the doctor's shift, if any
   - write `LeadActivity(STATUS, "Programare online creată")`
   - write `AuditLog` `booking.create` with no actor and `metadata.channel = online`
5. After commit, via `after()`:
   - `sendAppointmentMessage("CONFIRMARE_PROGRAMARE", appointmentId, { channels: ["EMAIL"] })` if an e-mail was given. The subject is „Am primit programarea dumneavoastră” and the text says reception will call to confirm.
   - `notifyClinicNewLead(leadId)`
6. Return `{ ok: true, data: { startsAtISO, localDateLabel, localTime, locationName, locationPhone, doctorName, manageUrl } }`. The wizard shows the Confirmation screen, with „Adăugați în calendar” pointing to `manageUrl + "/ics"`.

**`createCallbackRequest`:**
- creates `Lead { source: APEL_INVERS, preferredTime, locationId, serviceId }` with the same guards
- notifies the clinic
- the UI answers: „Vă sunăm noi în cel mult o zi lucrătoare.” (to be approved by the clinic)

**`createContactLead`** (used by the `/contact` action in WP3):
- creates `Lead { source: FORMULAR_CONTACT, message, consentGdprAt }`
- notifies the clinic
- answers „Mesajul a fost trimis. Vă răspundem în cel mult o zi lucrătoare.”

### 6.6 Confirmation links and 24h reminders

**Token format** (`src/lib/tokens.ts`, WP1). It is compact so that it fits in an SMS (about 60 chars):

```
token   = b64url(appointmentId) "." tokenVersion "." exp(base36 unix seconds) "." sig
sig     = b64url( HMAC-SHA256( key = HMAC(AUTH_SECRET, "apt-link"), payload = "apt|" + id + "|" + ver + "|" + exp ) )[0..22]   // 128-bit
exp     = appointment.startsAt + 24h
url     = `${APP_URL}/p/${token}`
```

**Verification:**
- the signature is compared timing-safe
- `exp > now`
- the appointment exists
- `tokenVersion` matches the DB, so moved or cancelled appointments invalidate old links

On any failure the page shows: „Linkul nu mai este valabil. Pentru modificări sunați la Cristești, 0265 326 316 sau Luduș, 0365 430 125.”

**`/p/[token]` page:**
- **GET never mutates**, because SMS and e-mail apps prefetch links.
- It shows the date, time, clinic, address and doctor, and the patient's **first name only**. No service details and no health data.
- It has two POST forms (Server Actions in `p/[token]/actions.ts`):
  - **Confirm.** Allowed when the status is `PROGRAMAT`. The status becomes `CONFIRMAT` with `confirmedVia = LINK`.
  - **Cancel.** Allowed while `now < startsAt - booking.cancelCutoffHours` (default 2) and the status is `PROGRAMAT` or `CONFIRMAT`. The status becomes `ANULAT` with `cancelledBy = PACIENT`, and `tokenVersion++`. Past the cutoff, the page shows the clinic phone instead.
- Both actions:
  - are rate-limited (`token:ip`, 20 per 10 minutes)
  - are audited with no actor, `metadata.via = "link"`
  - add a `LeadActivity` if the appointment has a lead
  - notify the clinic by e-mail on a cancellation

**Reminder job** (`runReminders(now)` in `src/server/notify/reminders.ts`, WP5; `/api/cron/reminders` runs it hourly):
1. Read `settings.reminders`: `enabled`, `hoursBefore = 24`, `quietStartMinute = 1260` (21:00), `quietEndMinute = 480` (08:00), `smsEnabled`, `emailEnabled`, `smsStripDiacritics = true`.
2. If the local time is inside the quiet window, return `{ skipped: "quiet-hours" }`.
3. Find candidates where:
   - `status IN (PROGRAMAT, CONFIRMAT)`
   - `reminderSentAt IS NULL`
   - `startsAt > now + 2h`
   - `startsAt <= now + hoursBefore`
   - `createdAt <= startsAt - 6h`. Last-minute bookings get no reminder; reception calls them.
4. For each candidate:
   1. **Claim it:** `updateMany({ where: { id, reminderSentAt: null }, data: { reminderSentAt: now } })`. Continue only when `count === 1`. This makes concurrent runs idempotent.
   2. **Resolve the contact:** the patient, or the lead when there is no patient.
   3. **Pick channels:**
      - SMS if `smsEnabled`, a phone exists, and there is consent: `Patient.smsOptIn`, or `Lead.consentSms`, or an active `Consent(SMS)`
      - e-mail if `emailEnabled` and an e-mail exists
   4. **Render** the template `reminder.sms` or `reminder.email` with the variables in §9.2. Each includes the `/p/[token]` link.
   5. **Send** through the provider and write `MessageLog`.
   6. **On failure on every channel:** set `reminderSentAt` back to null, so the next run retries. Stop retrying after 3 `EROARE` logs for the same appointment and kind.
5. Return `{ considered, sent: { sms, email }, failed, skipped }`.

The reminder text never contains the reason for the visit or any health information.

---
## 7. Server Actions, services and shared contracts

### 7.1 Server Action conventions

1. **Placement:**
   - `actions.ts` sits next to the route that uses it.
   - The first line is `'use server'`.
   - The file exports only actions built with `crmAction` or `publicAction`. Helpers live in `src/server/**`.
2. **One wrapper per audience** (`src/lib/actions.ts`, WP1). In order, the wrapper:
   1. **Authenticates.** `crmAction` calls `getCurrentUser()`; with no user it returns `UNAUTHENTICATED`, and the client redirects to login.
   2. **Authorises.** It runs `can(user, permission)`. Ownership and scope checks (MEDIC own appointments) happen inside the handler through service helpers.
   3. **Validates.** It runs `schema.safeParse(input)`. The input may be `FormData` (converted by `formDataToObject`: repeated keys become arrays, `""` becomes `undefined`, `"on"` becomes `true`) or a plain object for programmatic calls such as a drag-and-drop move.
   4. **Executes** the handler.
   5. **Maps errors:**
      - `DomainError` becomes `{ ok: false, code, error, fieldErrors?, details? }`
      - `ZodError` becomes `VALIDATION` with `fieldErrors`
      - anything else is logged with a random `errorId` (and no PII) and returned as „A apărut o eroare neașteptată. Încercați din nou.”
   6. **Revalidates.** The handler calls `revalidatePath`/`revalidateTag` itself for what it changed. Public-facing data changes (catalog, doctors, locations) also call `revalidatePath('/', 'layout')`.
3. **Result type.** Results never throw to the client, and there are no redirects inside the wrapper. A handler may call `redirect()` after success, since that is the Next convention for "create then go to the page".

   ```ts
   export type ActionResult<T = null> =
     | { ok: true; data: T; message?: string }
     | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]>; details?: { conflicts?: Conflict[] } };
   export type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "CONFLICT"
     | "SLOT_TAKEN" | "INVALID_TRANSITION" | "RATE_LIMITED" | "STALE" | "INTERNAL";
   ```

4. **Forms:**
   - Use `useActionState((_prev, fd: FormData) => action(fd), null)`, with `SubmitButton` built on `useFormStatus`.
   - Field errors render next to the fields, and `ErrorSummary` takes focus.
   - Every form works without JS where feasible (public forms must).
5. **Optimistic UI** is allowed only in the calendar (drag) and status chips, via `useOptimistic`. It always reconciles with the server result.
6. **Audit.** Sensitive actions call `audit()` inside the same transaction when possible (§8.3).
7. **No business logic in pages or actions.** Actions parse, authorise and call one service function. Services are framework-free (no `next/*` imports except `server-only`) so they can be unit-tested.
8. **Idempotency:**
   - Public create actions carry an `idempotencyKey`.
   - CRM create forms disable the submit button while pending.
   - Moves send `expectedUpdatedAt`; a mismatch returns `STALE`: „Programarea a fost modificată între timp. Reîncărcați pagina.”

Example:

```ts
// src/app/(crm)/crm/(app)/programari/actions.ts
'use server'
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { crmAction } from "@/lib/actions";
import { zId } from "@/lib/validation/common";
import { assertCanActOnAppointment } from "@/server/appointments/service";
import { transitionAppointment } from "@/server/scheduling/status";
import { sendAppointmentMessage } from "@/server/notify/send";

export const confirmAppointment = crmAction(
  { permission: ["appointments.manage", "appointments.manageOwn"], schema: z.object({ id: zId }),
    successMessage: "Programare confirmată" },
  async ({ id }, { user }) => {
    await assertCanActOnAppointment(user, id);                 // MEDIC → own only
    const appt = await transitionAppointment(id, "CONFIRMAT", { actor: user, via: "TELEFON" });
    after(() => sendAppointmentMessage("CONFIRMARE_PROGRAMARE", id, { channels: ["SMS"] }));
    revalidatePath("/crm/programari"); revalidatePath("/crm");
    return { id: appt.id, status: appt.status };
  },
);
```

`permission` accepts one key or an array (any of them). `publicAction` takes:
- `rateLimit: { bucket: string; limit: number; windowSec: number; key?: (input) => string }[]`
- `honeypot: true`

It returns the same `ActionResult`.

### 7.2 Platform contracts (WP1 provides; everyone consumes)

These signatures are binding. A builder who needs more adds a function in their own files instead of editing WP1 files.

```ts
// src/lib/env.ts
export const env: { DATABASE_URL: string; AUTH_SECRET: string; PII_ENCRYPTION_KEY: string; APP_URL: string;
  SMTP_HOST?: string; SMTP_PORT: number; SMTP_USER?: string; SMTP_PASS?: string; MAIL_FROM: string;
  CLINIC_NOTIFY_EMAIL: string; SMS_PROVIDER: string; CRON_SECRET: string; STORAGE_DIR: string;
  EINVOICE_PROVIDER: string; NODE_ENV: "development" | "test" | "production" };

// src/lib/db.ts   ("server-only"; global singleton in dev)
export const prisma: PrismaClient;
export type Tx = Prisma.TransactionClient;
export type Db = PrismaClient | Tx;

// src/lib/auth/session.ts
export const SESSION_COOKIE = "da_session";
export type SessionClaims = { uid: string; role: Role; sv: number; iat: number; exp: number; aexp: number };
export async function createSession(u: { id: string; role: Role; sessionVersion: number }): Promise<void>;
export async function deleteSession(): Promise<void>;
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null>; // used by proxy
export async function refreshSessionToken(c: SessionClaims): Promise<string>;                        // used by proxy

// src/lib/auth/password.ts
export async function hashPassword(plain: string): Promise<string>;
export async function verifyPassword(plain: string, hash: string): Promise<boolean>;
export function passwordProblems(plain: string, email: string): string[];   // Romanian messages, [] = ok

// src/lib/auth/dal.ts   ("server-only")
export type CurrentUser = { id: string; role: Role; email: string; firstName: string; lastName: string;
  displayName: string; doctorId: string | null; homeLocationId: string | null;
  theme: ThemePreference; density: Density; mustChangePassword: boolean };
export const getCurrentUser: () => Promise<CurrentUser | null>;            // React cache()
export async function requireUser(): Promise<CurrentUser>;                 // redirect("/crm/login?next=…")
export async function requirePermission(p: Permission | Permission[]): Promise<CurrentUser>; // redirect("/crm/acces-interzis")

// src/lib/permissions.ts   (pure; importable by client components)
export const PERMISSIONS: { … };                     // §5.2
export type Permission = keyof typeof PERMISSIONS;
export function can(user: { role: Role } | null, p: Permission | Permission[]): boolean;

// src/lib/actions.ts
export type ActionResult<T = null> = …;              // §7.1
export class DomainError extends Error { constructor(code: ErrorCode, message: string, extra?: { fieldErrors?: Record<string, string[]>; details?: unknown }) }
export function crmAction<S extends z.ZodType, T>(opts: { permission: Permission | Permission[]; schema: S; successMessage?: string | ((d: T) => string) },
  handler: (input: z.output<S>, ctx: { user: CurrentUser }) => Promise<T>): (input: FormData | z.input<S>) => Promise<ActionResult<T>>;
export function publicAction<S extends z.ZodType, T>(opts: { schema: S; honeypot?: boolean;
  rateLimit?: { bucket: string; limit: number; windowSec: number; key?: (i: z.output<S>) => string | null }[] },
  handler: (input: z.output<S>, ctx: { ipHash: string; userAgent: string | null }) => Promise<T>): (input: FormData | z.input<S>) => Promise<ActionResult<T>>;
export function formDataToObject(fd: FormData): Record<string, unknown>;

// src/lib/validation/common.ts   (pure)
export const zId: z.ZodString;                       // cuid
export const zPhoneRo: z.ZodType<string>;            // accepts "0744 123 456", "+40744123456", "0265.326.316" → "+40744123456"; message: „Introduceți un număr de telefon, de exemplu 0745 123 456.”
export const zEmail: z.ZodType<string>;              // trimmed, lowercased, max 254
export const zOptionalEmail: z.ZodType<string | undefined>;
export const zCnp: z.ZodType<string>;                // 13 digits + control digit + valid date; „CNP-ul nu este valid.”
export const zLei: z.ZodType<number>;                // "1.200,50" | "1200" | 1200 → 120050 (bani), >= 0
export const zDateISO: z.ZodType<string>;            // YYYY-MM-DD
export const zTimeHHMM: z.ZodType<number>;           // "09:30" → 570
export const zToothFdi: z.ZodType<number>;           // 11–18,21–28,31–38,41–48,51–55,61–65,71–75,81–85
export const zCheckbox: z.ZodType<boolean>;          // "on" | "true" | true → true, absent → false
export const zText: (max: number) => z.ZodType<string>;  // trimmed, control chars stripped, max length
export const zOptionalText: (max: number) => z.ZodType<string | undefined>;

// src/lib/time.ts   (pure)
export const CLINIC_TZ = "Europe/Bucharest";
export function localToUtc(dateISO: string, minuteOfDay: number): Date;
export function utcToLocal(d: Date): { dateISO: string; minute: number; weekday: 1|2|3|4|5|6|7 };
export function localDayRangeUtc(dateISO: string): { start: Date; end: Date };
export function todayISO(now?: Date): string;
export function addDaysISO(dateISO: string, n: number): string;
export function isoWeekday(dateISO: string): 1|2|3|4|5|6|7;
export function startOfWeekISO(dateISO: string): string;           // Monday
export function minutesToHHMM(m: number): string;                   // 570 → "09:30"
export function monthRangeUtc(year: number, month1to12: number): { start: Date; end: Date };

// src/lib/format.ts   (pure)
export function formatLei(bani: number | null, o?: { from?: boolean; max?: number | null; unit?: PriceUnit }): string; // „2.200 lei”, „de la 200 lei”, „900 / 1.100 lei”, „150 lei / oră”, null → „Prețul îl aflați la telefon”
export function formatDateRo(d: Date | string, style?: "long" | "short" | "weekday"): string; // „marți, 7 octombrie” | „07.10.2026” | „mar. 7 oct.”
export function formatTime(d: Date): string;                         // „09:30” (local)
export function formatPhone(e164OrLocal: string): string;            // „0744 123 456” / „0265 326 316”
export function telHref(phone: string): string;                      // „tel:+40265326316”
export function maskCnp(last2: string): string;                      // „1••••••••••23”
export function personName(p: { firstName: string; lastName: string }): string;
export function ageFromBirthDate(d: Date, now?: Date): number;

// src/lib/labels.ts   (pure) – every enum → Romanian label, e.g.
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string>; // PROGRAMAT: „Programat”, IN_TRATAMENT: „În tratament” …
export const LEAD_STATUS_LABEL, LEAD_SOURCE_LABEL, COMFORT_LABEL, CONSENT_TYPE_LABEL, TOOTH_CONDITION_LABEL,
  TOOTH_CONDITION_LETTER, PLAN_STATUS_LABEL, PLAN_ITEM_STATUS_LABEL, PAYMENT_METHOD_LABEL, PRICE_UNIT_LABEL,
  DOCUMENT_KIND_LABEL, ROLE_LABEL, RECALL_STATUS_LABEL, MESSAGE_KIND_LABEL, TIME_OFF_KIND_LABEL, …;

// src/lib/pii.ts   ("server-only")
export function encryptPii(plain: string): string;
export function decryptPii(blob: string): string;
export function hmacHash(value: string, purpose: "cnp" | "ip"): string;
export function normalizeSearch(s: string): string;                  // pure; also exported from src/lib/search.ts for client use
export function buildPatientSearchText(p: { firstName: string; lastName: string; phone?: string | null; email?: string | null }): string;

// src/lib/request.ts   ("server-only")
export async function getClientIp(): Promise<string>;                // x-forwarded-for first hop, else "0.0.0.0"
export async function getIpHash(): Promise<string>;

// src/lib/rate-limit.ts   ("server-only"; fixed window in RateLimitBucket, works on SQLite + PG)
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }>;

// src/lib/honeypot.ts + src/components/forms/HoneypotFields.tsx
export const HONEYPOT_FIELD = "website", FORM_TS_FIELD = "_ts";
export function signFormTimestamp(now?: Date): string;               // HMAC-signed render time
export function isLikelyBot(fd: FormData | Record<string, unknown>, minMs?: number): boolean; // honeypot filled || ts invalid || < 3000 ms
export function HoneypotFields(): JSX.Element;                       // server component: hidden "website" input + signed _ts

// src/lib/audit.ts   ("server-only")
export type AuditAction = "auth.login" | "auth.logout" | "auth.failed" | "user.create" | "user.update" | "user.deactivate"
  | "patient.create" | "patient.update" | "patient.view" | "patient.cnp.reveal" | "patient.export" | "patient.anonymize"
  | "medical.update" | "consent.record" | "consent.revoke" | "document.upload" | "document.download" | "document.delete"
  | "appointment.create" | "appointment.update" | "appointment.move" | "appointment.status" | "booking.create"
  | "lead.update" | "lead.convert" | "plan.update" | "invoice.create" | "invoice.cancel" | "payment.create" | "payment.cancel"
  | "catalog.update" | "schedule.update" | "settings.update" | "template.update" | "report.export" | "gdpr.request";
export async function audit(e: { action: AuditAction; entityType: string; entityId?: string | null; patientId?: string | null;
  metadata?: Record<string, unknown> }, o?: { actor?: CurrentUser | null; db?: Db }): Promise<void>;

// src/lib/tokens.ts   ("server-only")
export function signAppointmentToken(a: { id: string; tokenVersion: number; startsAt: Date }): string;
export function verifyAppointmentToken(token: string, now?: Date): { appointmentId: string; tokenVersion: number } | null;
export function appointmentManageUrl(a: { id: string; tokenVersion: number; startsAt: Date }): string; // `${APP_URL}/p/${token}`

// src/lib/sequences.ts   ("server-only")
export async function nextSequence(tx: Tx, key: string): Promise<number>; // upsert + increment, inside caller's tx

// src/lib/settings.ts   ("server-only") – §7.4
export async function getSettings<K extends SettingKey>(key: K): Promise<SettingsMap[K]>; // DB value merged over defaults, cached per request
export async function saveSettings<K extends SettingKey>(key: K, value: SettingsMap[K], actor: CurrentUser): Promise<void>;

// src/lib/clinic-scope.ts   ("server-only")
export type ClinicScope = "cristesti" | "ludus" | "ambele";
export async function getClinicScope(): Promise<ClinicScope>;        // cookie da_clinica, default from user.homeLocationId or "ambele"
export async function scopeLocationIds(scope?: ClinicScope): Promise<string[]>;
// setClinicScope is a Server Action in src/components/crm/shell/actions.ts

// src/lib/cn.ts   (WP2, pure)
export function cn(...parts: (string | false | null | undefined)[]): string;
```

### 7.3 Cross-package service contracts

Each owner creates these files **first**, with the exact exports below. A stub that throws `not implemented` is fine at first, so that dependents type-check early.

```ts
// ── WP4 ── src/server/scheduling/types.ts (types only, client-safe)
export type Slot = { startsAt: string; endsAt: string; localTime: string; period: "dimineata" | "dupa-amiaza"; doctorIds: string[] };
export type DaySlots = { dateISO: string; slots: Slot[] };
export type SlotQuery = { locationId: string; serviceId: string; doctorId?: string | null; fromDateISO: string; days: number; channel: "online" | "crm"; now?: Date };
export type ConflictKind = …; export type Conflict = …;        // §6.2
export type AppointmentCandidate = { appointmentId?: string; locationId: string; doctorId: string; cabinetId?: string | null;
  patientId?: string | null; startsAt: Date; endsAt: Date; wantsSedation?: boolean };
// src/server/scheduling/availability.ts
export async function getAvailableSlots(q: SlotQuery): Promise<DaySlots[]>;
export async function getNextFreeSlots(locationId: string, count?: number, serviceCode?: string): Promise<Slot[]>;
// src/server/scheduling/conflicts.ts
export async function findConflicts(db: Db, c: AppointmentCandidate): Promise<Conflict[]>;
export async function withSchedulingTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;   // Serializable + P2034 retry
// src/server/scheduling/status.ts
export const BLOCKING_STATUSES: AppointmentStatus[];
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]>;
export function canTransition(from: AppointmentStatus, to: AppointmentStatus, role: Role, completedAt?: Date | null, now?: Date): boolean;
export async function transitionAppointment(id: string, to: AppointmentStatus, ctx: { actor: CurrentUser | null;
  via?: ConfirmationChannel; cancelledBy?: CancelledBy; reason?: string }): Promise<Appointment>;
// src/server/leads/schemas.ts (pure zod, client-safe)
export const contactLeadSchema, onlineBookingSchema, callbackSchema;   // + inferred types ContactLeadInput, OnlineBookingInput, CallbackInput
// src/server/leads/intake.ts
export async function createContactLead(i: ContactLeadInput, meta: { ipHash: string; sourcePath?: string }): Promise<{ leadId: string }>;
export async function createOnlineBooking(i: OnlineBookingInput, meta: { ipHash: string; sourcePath?: string }): Promise<BookingResult>;
export async function createCallbackRequest(i: CallbackInput, meta: { ipHash: string; sourcePath?: string }): Promise<{ leadId: string }>;
export type BookingResult = { leadId: string; appointmentId: string; startsAtISO: string; localDateLabel: string; localTime: string;
  locationName: string; locationPhone: string; doctorName: string; manageUrl: string };

// ── WP5 ── src/server/notify/send.ts
export async function sendAppointmentMessage(kind: "CONFIRMARE_PROGRAMARE" | "REMINDER" | "ANULARE" | "MODIFICARE",
  appointmentId: string, o?: { channels?: MessageChannel[]; sentById?: string | null }): Promise<{ channel: MessageChannel; status: MessageStatus }[]>;
export async function notifyClinicNewLead(leadId: string): Promise<void>;
export async function notifyClinicCancellation(appointmentId: string): Promise<void>;
export async function sendManualMessage(i: { channel: MessageChannel; to: string; subject?: string; body: string;
  patientId?: string; leadId?: string; sentById: string }): Promise<{ status: MessageStatus }>;
// src/server/reports/metrics.ts
export type Kpis = { appointmentsTotal: number; completed: number; noShows: number; cancelled: number; noShowRate: number | null;
  revenueInvoiced: number; revenueCollected: number; newPatients: number; leadsNew: number; leadsConverted: number; leadConversionRate: number | null };
export async function getKpis(f: { from: Date; to: Date; locationIds?: string[]; doctorId?: string | null }): Promise<Kpis>;
// src/components/crm/comms/SendMessageDialog.tsx (client)
export function SendMessageDialog(p: { patientId?: string; leadId?: string; phone?: string | null; email?: string | null; defaultChannel?: MessageChannel }): JSX.Element;

// ── WP7 ── src/server/patients/service.ts
export async function createPatient(db: Db, i: PatientCreateInput, actor: CurrentUser): Promise<Patient>; // assigns fileNumber, searchText, audits
export async function getPatientSummary(id: string): Promise<PatientSummary | null>;
// src/server/patients/duplicates.ts
export async function findDuplicatePatients(q: { phone?: string | null; email?: string | null; firstName?: string; lastName?: string; cnp?: string | null }): Promise<PatientSummary[]>;
// src/server/patients/flags.ts
export type PatientFlag = { kind: "alerta" | "confort" | "copil" | "sedare"; label: string };
export async function getPatientFlagsBulk(patientIds: string[]): Promise<Map<string, PatientFlag[]>>;
// src/server/patients/types.ts (client-safe)
export type PatientSummary = { id: string; fileNumber: number; name: string; phone: string | null; email: string | null; birthDate: string | null; anonymized: boolean };
export type PatientCreateInput = { firstName: string; lastName: string; phone?: string | null; email?: string | null; birthDate?: string | null;
  sex?: Sex | null; cnp?: string | null; guardianId?: string | null; preferredLocationId?: string | null; primaryDoctorId?: string | null;
  comfortDefault?: Comfort | null; smsOptIn?: boolean; emailOptIn?: boolean; acquisitionSource?: LeadSource | null };

// ── WP8 ── src/server/billing/balance.ts
export async function getPatientBalance(patientId: string): Promise<{ invoiced: number; paid: number; balance: number }>;
```

**Who consumes what:**

| Contract | Owner | Consumers |
|---|---|---|
| `createContactLead`, `getNextFreeSlots` | WP4 | WP3 |
| `sendAppointmentMessage`, `notifyClinicNewLead`, `notifyClinicCancellation` | WP5 | WP4 |
| `findConflicts`, `withSchedulingTx`, `transitionAppointment`, `getAvailableSlots` | WP4 | WP6 |
| `createPatient`, `findDuplicatePatients`, `getPatientFlagsBulk` | WP7 | WP6 |
| `getKpis`, `sendAppointmentMessage` | WP5 | WP6 |
| `getPatientBalance` | WP8 | WP7 |
| `SendMessageDialog` | WP5 | WP7 |

### 7.4 Settings (`Setting` rows; schemas and defaults in `src/lib/settings.ts`)

| Key | Fields (defaults) |
|---|---|
| `clinic` | `displayName: "Dental Arena Clinic"`, `legalName: "[de completat]"`, `cui: "[de completat]"`, `regCom: "[de completat]"`, `registeredAddress: "[de completat]"`, `email: "office@dentalarena.ro"`, `iban: null`, `bank: null`, `facebookUrl`, `instagramUrl`, `foundedYear: 2009`, `dpoEmail: "office@dentalarena.ro"` |
| `booking` | `slotStepMinutes: 15`, `minLeadMinutes: 120`, `horizonDays: 30`, `maxDaysPerRequest: 14`, `bufferMinutes: 0`, `cancelCutoffHours: 2`, `morningEndsAtMinute: 780`, `homeServiceCode: "CON-CONSULT"`, `unsureServiceCode: "CON-CONSULT"`, `onlineEnabled: true` |
| `reminders` | `enabled: true`, `hoursBefore: 24`, `smsEnabled: true`, `emailEnabled: true`, `quietStartMinute: 1260`, `quietEndMinute: 480`, `smsStripDiacritics: true` |
| `invoicing` | `invoiceSeries: "DA"`, `receiptSeries: "DAC"`, `defaultVatRate: 0`, `vatExemptionNote: "Scutit de TVA conform art. 292 alin. (1) lit. a) din Codul fiscal"` (to be confirmed by the accountant), `paymentTermDays: 0` |
| `gdpr` | `consentTextVersion: "gdpr-2026-10"`, `leadRetentionDays: 180`, `messageBodyRetentionDays: 365` |
| `ui` | `defaultDensity: "COMPACT"` |

Which services can be booked online is not a setting: it is `Service.bookableOnline` plus `onlineLabel`, edited in Servicii.

---

## 8. Security and privacy

### 8.1 CSRF and request integrity

- **Mutations from browsers are Server Actions only.** Next accepts them only as POST and rejects them when Origin ≠ Host. We do not set `serverActions.allowedOrigins`.
- **The session cookie is `SameSite=Lax`.** Cross-site POSTs carry no cookie, and cross-site GETs never mutate.
- **Route handlers that mutate:**
  - The upload handler checks `Origin`/`Sec-Fetch-Site: same-origin` and the session.
  - Cron handlers check `Authorization: Bearer` with `crypto.timingSafeEqual`.
- **Patient links (`/p/[token]`)** never mutate on GET (prefetch-safe). Confirm and cancel are POST Server Actions on that page.
- **Login `next=`** accepts only relative paths that start with `/crm/` (no `//`, no scheme).

### 8.2 Abuse protection on public forms

| Form | Rate limits | Other |
|---|---|---|
| Contact | `contact:ip` 5 per 10 min | Honeypot `website` plus signed `_ts` (fill time ≥ 3 s, signature valid, age ≤ 2 h). A bot gets a **fake success**, with no lead and no hint. |
| Booking | `booking:ip` 5 per 10 min, `booking:phone` 3 per 24 h | Same honeypot and timing. `idempotencyKey`. |
| Callback | `callback:ip` 5 per 10 min | Same honeypot and timing |
| Slots API | `slots:ip` 60 per min | |
| Token pages | `token:ip` 20 per 10 min | |
| Login | `login:ip` 20 per 15 min, `login:email` 5 per 15 min | Account lockout (§5.1) |

- When a limit is hit, the user sees „Ați trimis prea multe cereri. Încercați din nou peste câteva minute sau sunați-ne.” and HTTP 429 for APIs.
- There are no CAPTCHAs (WCAG 3.3.8, design system §6.7).
- Buckets live in `RateLimitBucket`, so limits hold across instances on PostgreSQL. `/api/cron/maintenance` purges expired rows.

### 8.3 Input validation and output encoding

**Input:**
- Every action and route handler validates with zod. Unknown keys are stripped.
- Every free text has a max length (names 80, messages 2000, notes 5000), and control characters are stripped.
- Phones are normalised to E.164 and e-mails lowercased.
- IDs are validated as cuid. Ownership is re-checked server-side: never trust an id because it came from a hidden field.

**Output:**
- React escapes everything. `dangerouslySetInnerHTML` is forbidden except for JSON-LD, which is serialised with `JSON.stringify` and `<` escaped.
- E-mail templates are rendered with an HTML-escaping renderer (§9.2). SMS is plain text.
- CSV export prefixes cells starting with `= + - @` with `'`, to prevent formula injection.

**Uploads:**
- extension and MIME allowlist plus magic-byte sniffing
- random storage key
- stored outside `public/`
- served only through the authenticated download route with `Content-Disposition: attachment`

**Security headers** (`next.config.ts` `headers()`, all routes):
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` (production)
- `Content-Security-Policy`:

  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' ('unsafe-eval' in dev only);
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  frame-src https://www.google.com https://maps.google.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none'
  ```

  `/crm/*` additionally gets `X-Robots-Tag: noindex` from the proxy.

### 8.4 PII and health data (GDPR art. 9)

**Minimisation:**
- Public forms collect only what the design lists.
- Online booking does **not** create a `Patient`. Reception converts the lead after the phone confirmation, with a duplicate check.
- Reception sees medical alert flags, not the full anamneză.

**Encryption:**
- The CNP is AES-256-GCM encrypted, with an HMAC for uniqueness.
- In production, the DB disk and backups are encrypted at the infrastructure level (deployment note).

**IP addresses** are stored only as `hmacHash(ip, "ip")`, for rate limits and consent evidence.

**Consent evidence:**
- `Consent` rows record `type`, `granted`, `method`, `textVersion`, `grantedAt`/`revokedAt`, `ipHash` (online) or `documentId` (a scanned paper form), and `recordedById`.
- Online booking stores the consent on the `Lead`: `consentGdprAt`, `consentTextVersion`, `consentSms`.
- Lead conversion copies it into `Consent(GDPR_DATE_SANATATE, FORMULAR_ONLINE)` and, if given, `Consent(SMS)`.

**Audit:** every row in the table below is written to `AuditLog`, and the viewer is ADMIN-only. `AuditLog.metadata` stores **field names**, never values. Audit rows are append-only: there is no update or delete path in code.

| Event | Audit action |
|---|---|
| Viewing a patient file | `patient.view`, at most once per user, patient and hour |
| Revealing the CNP | `patient.cnp.reveal` |
| Downloading a document | `document.download` |
| Exporting a patient's data | `patient.export` |
| Exporting a report | `report.export` |
| Anonymising a patient | `patient.anonymize` |
| Any change to medical history, consents or plans | `medical.update`, `consent.record`, `consent.revoke`, `plan.update` |
| Any change to invoices or payments | `invoice.create`, `invoice.cancel`, `payment.create`, `payment.cancel` |
| Login and logout | `auth.login`, `auth.logout`, `auth.failed` |
| Role and user changes | `user.create`, `user.update`, `user.deactivate` |
| Settings and template changes | `settings.update`, `template.update` |

**Data subject rights** (`/crm/gdpr`, `/crm/pacienti/[id]/gdpr`, WP7):
- **Register.** Each request is a `DataRequest` with `dueAt = receivedAt + 30 days`.
- **Export.** One JSON file with:
  - patient fields (CNP decrypted)
  - medical history, consents, tooth conditions
  - plans and items
  - appointments
  - invoices and payments
  - notes
  - document metadata (files are listed, not embedded)
  - message log entries
  - the audit trail for the patient
- **Erasure** = `anonymizePatient()` (§3.2 invariant 11):
  - one transaction
  - ADMIN only
  - requires typing the file number to confirm
  - documents are soft-deleted (`deletedAt`) and their files removed from storage
  - financial documents are kept

**Retention jobs** (`/api/cron/maintenance`, daily):
- Leads that are not converted (`PIERDUT`, or `NOU`/`CONTACTAT` untouched) for longer than `gdpr.leadRetentionDays` are anonymised: name „Cerere anonimizată”, phone, e-mail and message nulled.
- `MessageLog.body` older than `gdpr.messageBodyRetentionDays` is redacted.

**Logs.** Server logs never contain names, phones, e-mails, CNPs or message bodies. The console mailer and SMS stub print full content **only** when `NODE_ENV !== "production"`.

**Third parties:**
- Google Maps iframes load only after consent (`MapConsent`). The consent cookie `da_consent` records `{ v: 1, harti: boolean, at }`.
- There is no analytics in v1.
- The cookie policy lists `da_session` (CRM, necessary), `da_clinica` (CRM preference) and `da_consent` (necessary).

### 8.5 Authorisation hygiene

- Every CRM page calls `requirePermission(...)` at the top, even though the layout already called `requireUser()`. Layouts are not a security boundary for nested data fetches.
- Services that return patient data take `CurrentUser` and apply field-level rules. For example, `getPatientFile(user, id)` omits `medicalHistory` and clinical notes for RECEPTIE.
- Server Components never pass full Prisma rows to client components. They pass DTOs, so `cnpEncrypted`, `passwordHash` and similar fields never reach the client. Use `select` in queries.

---

## 9. Integrations

### 9.1 E-mail (`src/server/notify/mailer.ts`, WP5)

- **Transport:**
  - nodemailer `createTransport({ host, port, secure: port === 465, auth })` when `SMTP_HOST` is set
  - otherwise a console transport: it prints a framed message in dev, and in production records `SIMULAT` without printing anything
- **Interface:** `sendMail({ to, subject, html, text, replyTo? }): Promise<{ provider: "smtp" | "console"; messageId?: string }>`
- `from` is `MAIL_FROM`, and `replyTo` is the clinic e-mail.
- Each e-mail has a plain-text part and simple inline-styled HTML with the clinic name. There are no remote images.

### 9.2 Templates

**Lookup.** `MessageTemplate` rows override code defaults in `src/server/notify/default-templates.ts`. If no row exists, the default is used, so seeding templates is not required. The Mesaje UI creates a row on the first edit and offers „Reveniți la textul implicit”.

**Syntax** is `{{variabila}}`. Unknown variables are a validation error in the editor.

**Variables:**

| Variable | Example |
|---|---|
| `prenume` | |
| `nume` | |
| `data` | „marți, 7 octombrie” |
| `ora` | „10:30” |
| `clinica` | „Dental Arena Cristești” |
| `clinicaScurt` | „Cristești” |
| `adresa` | |
| `telefonClinica` | |
| `medic` | |
| `link` | the `/p/[token]` URL |
| `motiv` | **clinic notifications only, never in patient messages** |

**Keys and default texts** (formal register, no exclamation marks):

| Key | Text |
|---|---|
| `booking.received.email` | Subject: „Am primit cererea de programare: {{data}}, ora {{ora}}”. The body says reception will call from `{{telefonClinica}}` to confirm, gives the address, includes `{{link}}` to confirm or cancel, and closes with „Echipa Dental Arena”. |
| `booking.confirmed.sms` | „Programarea de {{data}}, ora {{ora}}, la Dental Arena {{clinicaScurt}} este confirmată. Dacă nu mai puteți veni, sunați la {{telefonClinica}}.” |
| `reminder.sms` | „Dental Arena: vă reamintim programarea de {{data}}, ora {{ora}}, la {{clinica}}. Confirmați sau anulați: {{link}}” |
| `reminder.email` | Same content, plus the address and „Ce să aveți la dumneavoastră”: buletinul și lista medicamentelor pe care le luați. |
| `cancel.sms` and `cancel.email` | Cancellation by the clinic |
| `moved.sms` and `moved.email` | The new date and time |
| `clinic.newLead.email` | To `CLINIC_NOTIFY_EMAIL`. Subject: „Cerere nouă din site: {{nume}}, {{motiv}}”. The body links to `/crm/cereri/<id>`. Health details go only into the CRM, not the e-mail. |
| `clinic.cancelled.email` | Sent to the clinic when a patient cancels through a link |

**SMS encoding.** With `smsStripDiacritics`, `toGsm7()` transliterates ă→a, â→a, î→i, ș→s, ț→t, „ ”→" and –→- before sending. This keeps each segment at 160 characters instead of 70. The `MessageLog` stores the text that was actually sent.

### 9.3 SMS provider interface (`src/server/notify/sms/`, WP5)

```ts
export interface SmsProvider { readonly name: string; send(toE164: string, text: string): Promise<{ providerMessageId?: string }>; }
export function getSmsProvider(): SmsProvider;   // switch (env.SMS_PROVIDER) { case "console": default: return consoleSmsProvider }
```

A real provider is one new file plus one `case` line. It must:
- throw on a non-2xx response
- never log the full text in production

### 9.4 e-Factura interface (`src/server/billing/einvoice/`, WP8)

```ts
export interface EInvoiceProvider {
  readonly name: string;                                  // "none" | "smartbill" | "anaf-spv" (future)
  submit(invoice: InvoiceForEInvoice): Promise<{ status: EInvoiceStatus; ref?: string; error?: string }>;
  status(ref: string): Promise<{ status: EInvoiceStatus; error?: string }>;
}
export function getEInvoiceProvider(): EInvoiceProvider; // "none" → returns { status: "NETRANSMISA" }
```

- The invoice view shows the e-Factura status, plus a disabled button „Trimiteți în SPV” when the provider is `none`.
- `InvoiceForEInvoice` is a plain DTO: seller from `settings.clinic`, buyer, lines, totals, VAT note.
- B2C medical invoices are out of scope for v1. Whether e-Factura applies to them must be confirmed with the clinic's accountant.

### 9.5 File storage (`src/server/patients/storage.ts`, WP7)

```ts
export interface FileStorage { put(key: string, data: Uint8Array, mime: string): Promise<void>;
  stream(key: string): Promise<ReadableStream<Uint8Array>>; remove(key: string): Promise<void>; }
export const storage: FileStorage;  // local disk under env.STORAGE_DIR; keys "patients/<patientId>/<cuid>.<ext>"
```

Path traversal is impossible: keys are generated server-side and validated against `^patients/[a-z0-9]+/[a-z0-9]+\.(jpg|png|webp|pdf|dcm)$`.

---
## 10. Seed data plan (`prisma/seed.ts`, WP1)

**How the seed runs:**
- **Command.** `npm run db:seed` runs `prisma db seed`, which runs `tsx prisma/seed.ts`. `npm run db:reset` runs `prisma migrate reset --force`, which re-runs the seed.
- **Base data is idempotent.** It uses `upsert` on natural keys: `Location.slug`, `User.email`, `Doctor.slug`, `ServiceCategory.slug`, `Service.code`, `Tag.name` and `Setting.key`.
- **Demo data:**
  - Created only when `SEED_DEMO !== "0"` **and** the `Patient` table is empty.
  - Deterministic: a mulberry32 PRNG with seed `20261005` (`seed-data/random.ts`).
  - Dates are relative to the seed day. Everything clinical is fictitious, and phones use the non-allocated range `+40700000xxx`.
- **Console output.** The seed prints a summary table and the demo login credentials.

### 10.1 Locations and cabinets (`seed-data/locations.ts`)

| slug | name | shortName | street | city | phone | mapsUrl | cabinets (demo) | sedationUnits |
|---|---|---|---|---|---|---|---|---|
| `cristesti` | Dental Arena Cristești | Cristești | str. Principală 536J/1 | Cristești | 0265 326 316 | `research/content.json` → `clinic.locations[0].mapUrl` | Cabinet 1, Cabinet 2, Cabinet 3 | 1 |
| `ludus` | Dental Arena Luduș | Luduș | str. Gheorghe Barițiu nr. 6 | Luduș | 0365 430 125 | `clinic.locations[1].mapUrl` | Cabinet 1, Cabinet 2 | 1 |

- Both locations have `county: "Mureș"` and `email: office@dentalarena.ro`.
- **Coordinates** are approximate, from `general.notes` item 4: Cristești 46.5092, 24.5058 (postal code 547185); Luduș 46.4819, 24.0943 (545202). Store them, but they must be verified before they are used as a map pin.
- **Opening hours (demo):** Monday–Friday 09:00–19:00 at both locations. `publishHours = false`.

### 10.2 Team (`seed-data/team.ts`)

**Doctors.** Display names follow design system §12.5. Role lines are verbatim, with the diacritics fixed.

| slug | publicName | roleLine | photoPath | categories (`showOnSite` in **bold**) | sortOrder |
|---|---|---|---|---|---|
| `andrei-marcoci` | Dr. Andrei Marcoci | Medic dentist, stomatologie generală | `/images/echipa/andrei-marcoci.jpg` | **stomatologie-generala**, consultatie-profilaxie, pedodontie, parodontologie, estetica-dentara, protetica-dentara | 1 |
| `mihail-dan-masca` | Dr. Mihail Dan Mașca | Medic dentist, stomatologie generală, competență în implantologie | `/images/echipa/mihail-dan-masca.png` | **implantologie**, **stomatologie-generala**, consultatie-profilaxie, protetica-dentara, chirurgie-dento-alveolara | 2 |
| `paul-bologa` | Dr. Paul Bologa | Medic dentist, stomatologie generală | `/images/echipa/paul-bologa.jpg` | **stomatologie-generala**, consultatie-profilaxie, pedodontie, parodontologie, estetica-dentara, protetica-dentara | 3 |
| `victoria-ana-podar` | Dr. Victoria-Ana Podar | Medic dentist specializat în ortodonție și ortopedie dento-facială | `null` (monogram `VP`) | **ortodontie** | 4 |
| `ana-maria-fertea` | Dr. Ana-Maria Fertea | Medic dentist, medic specialist în chirurgie dento-alveolară | `/images/echipa/ana-maria-fertea.jpg` | **chirurgie-dento-alveolara**, consultatie-profilaxie | 5 |

- The non-bold categories exist for booking eligibility only. They are **demo assumptions** for the clinic to confirm.
- `inhalosedare` has no doctor rows, so every doctor qualifies, but its service is not bookable online on its own.

**Users** (password `SEED_PASSWORD`, default `parola-demo-2026`; `mustChangePassword = (NODE_ENV === "production")`):

| email | role | name | link |
|---|---|---|---|
| `admin@dentalarena.ro` | ADMIN | Administrator Clinică | — |
| `receptie.cristesti@dentalarena.ro` | RECEPTIE | Recepție Cristești | homeLocation `cristesti` |
| `receptie.ludus@dentalarena.ro` | RECEPTIE | Recepție Luduș | homeLocation `ludus` |
| `andrei.marcoci@dentalarena.ro`, `mihail.masca@dentalarena.ro`, `paul.bologa@dentalarena.ro`, `victoria.podar@dentalarena.ro`, `anamaria.fertea@dentalarena.ro` | MEDIC | (doctor names) | `Doctor.userId` |

These e-mail addresses are placeholders for dev.

**Demo shifts** („program demonstrativ”, `onlineBooking: true`):

| Doctor | Cristești | Luduș |
|---|---|---|
| Marcoci | Mon, Wed, Fri 09:00–15:00 (break 12:00–12:30), Cabinet 1 | Tue, Thu 12:00–19:00 (break 15:30–16:00), Cabinet 1 |
| Mașca | Tue, Thu 09:00–17:00 (break 13:00–13:30), Cabinet 2 | Mon, Wed 12:00–19:00 (break 15:30–16:00), Cabinet 2 |
| Bologa | Tue, Thu 12:00–19:00, Cabinet 1 | Mon, Wed, Fri 09:00–15:00, Cabinet 1 |
| Podar | Wed 10:00–18:00, Cabinet 3 | Fri 10:00–16:00, Cabinet 2 |
| Fertea | Mon, Thu 12:00–19:00, Cabinet 3 | Tue 09:00–14:00, Cabinet 2 |

No two shifts share a cabinet at the same time; the seed asserts this.

**TimeOff:** Fertea is on leave 10 days from now, for 3 days (`CONCEDIU`). One location-wide closure on 1 December (`SARBATOARE`, „Ziua Națională”) at both locations.

### 10.3 Catalog (`seed-data/services.ts`)

These are the 10 categories and every price item on the current site, with the diacritics restored.

- Prices are in lei here; the seed converts them to bani.
- `R` = `isRepresentative`.
- `Online` = `bookableOnline` with its `onlineLabel`.
- Durations are **demo estimates for the clinic to confirm**.
- Units default to `ACT`.

| # | Category slug | Name (`ServiceCategory.name`) |
|---|---|---|
| 1 | `consultatie-profilaxie` | Consultație și profilaxie |
| 2 | `stomatologie-generala` | Stomatologie generală |
| 3 | `inhalosedare` | Inhalosedare |
| 4 | `implantologie` | Implantologie |
| 5 | `chirurgie-dento-alveolara` | Chirurgie dento-alveolară |
| 6 | `protetica-dentara` | Protetică dentară |
| 7 | `pedodontie` | Pedodonție |
| 8 | `ortodontie` | Ortodonție |
| 9 | `parodontologie` | Parodontologie |
| 10 | `estetica-dentara` | Estetică dentară |

| code | category | name | price (lei) | unit | min | flags |
|---|---|---|---|---|---|---|
| CON-CONSULT | consultatie-profilaxie | Consultație și plan de tratament | null („Prețul îl aflați la telefon”) | ACT | 30 | Online „Consultație sau control”; also the „Nu știu sigur” target; `publicVisible` |
| CON-DETARTRAJ | consultatie-profilaxie | Detartraj și periaj profesional / arcadă | 200 | ARCADA | 45 | **R**; Online „Igienizare (detartraj)”; `recallMonths 6` |
| CON-AIRFLOW | consultatie-profilaxie | Detartraj, periaj și air-flow / arcadă | 250 | ARCADA | 60 | `recallMonths 6` |
| CON-ALBIRE | consultatie-profilaxie | Albire dentară | 1.000 | ACT | 60 | open item 7 (vs EST-OPALESCENCE) |
| CON-SIGILARE | consultatie-profilaxie | Sigilare șanțuri | 130 | ACT | 30 | |
| SG-URGENTA | stomatologie-generala | Consultație de urgență (durere) | null | ACT | 30 | Online „Am o durere acum”; `urgent`; **not** `publicVisible` |
| SG-PANSAMENT | stomatologie-generala | Pansament calmant | 50 | ACT | 30 | |
| SG-OBT-COMPOZIT | stomatologie-generala | Obturație compozit | de la 200 | DINTE | 45 | **R**; `priceFrom`; `toothSpecific` |
| SG-OBT-ESTETICA | stomatologie-generala | Obturație estetică | de la 300 | DINTE | 60 | `priceFrom`; `toothSpecific` |
| SG-PIVOT | stomatologie-generala | Reconstrucție cu pivot din fibră de sticlă | 550 | DINTE | 60 | `toothSpecific` |
| SG-OBT-GIC | stomatologie-generala | Obturație glas-ionomer | 120 | DINTE | 30 | `toothSpecific` |
| SG-ENDO-MONO | stomatologie-generala | Tratament endodontic rotativ, monoradiculari | 350 | DINTE | 60 | `toothSpecific` |
| SG-ENDO-PLURI | stomatologie-generala | Tratament endodontic rotativ, pluriradiculari | 400 | DINTE | 90 | `toothSpecific` |
| SG-RETRAT-MONO | stomatologie-generala | Retratament, monoradiculari | 400 | DINTE | 60 | `toothSpecific` |
| SG-RETRAT-PLURI | stomatologie-generala | Retratament, pluriradiculari | 600 | DINTE | 90 | `toothSpecific` |
| INH-ORA | inhalosedare | Inhalosedare | 150 | ORA | 60 | **R**; added to other appointments through `wantsSedation` |
| IMP-CONSULT | implantologie | Consultație de implantologie | null | ACT | 30 | Online „Implant sau lucrare dentară”; not `publicVisible` |
| IMP-NEODENT | implantologie | Implant Neodent | 2.200 | DINTE | 90 | **R**; `toothSpecific` |
| IMP-BONT | implantologie | Bont protetic drept sau angulat | 550 | DINTE | 30 | `toothSpecific` |
| IMP-KHOURY | implantologie | Adiție de os, tehnica Khoury | 3.000 | ACT | 120 | |
| IMP-ADITIE | implantologie | Adiție de os preimplantară | 1.500 | ACT | 90 | |
| IMP-PLASA | implantologie | Augmentare osoasă cu plasă de titan | 3.500 | ACT | 120 | |
| IMP-PROT-MAND2 | implantologie | Proteză mandibulară pe două implanturi | 9.000 | ACT | 60 | |
| IMP-PROT-MAX4 | implantologie | Proteză maxilară pe 4 implanturi | 15.000 | ACT | 60 | |
| CH-EXT-PARODONTOTIC | chirurgie-dento-alveolara | Extracție dinte parodontotic | 100 | DINTE | 30 | `toothSpecific` |
| CH-EXT-MONO | chirurgie-dento-alveolara | Extracție dinte monoradicular | 200 | DINTE | 30 | **R**; `toothSpecific` |
| CH-EXT-PLURI | chirurgie-dento-alveolara | Extracție dinte pluriradicular | 250 | DINTE | 45 | `toothSpecific` |
| CH-EXT-MINTE | chirurgie-dento-alveolara | Extracție molar de minte erupt | 300 | DINTE | 45 | `toothSpecific` |
| CH-EXT-ALVEOLOTOMIE | chirurgie-dento-alveolara | Extracție cu alveolotomie | 350 | DINTE | 60 | `toothSpecific` |
| CH-ODONTECTOMIE | chirurgie-dento-alveolara | Odontectomie, chistectomie, rezecție apicală | 600 | DINTE | 90 | `toothSpecific` |
| CH-CHIURETAJ | chirurgie-dento-alveolara | Chiuretaj alveolar | 150 | ACT | 30 | |
| CH-INCIZIE | chirurgie-dento-alveolara | Incizie abces | 100 | ACT | 30 | |
| CH-SEPARARE | chirurgie-dento-alveolara | Separare de rădăcini | 50 | DINTE | 15 | |
| CH-SUTURA | chirurgie-dento-alveolara | Sutură | 100 | ACT | 15 | |
| CH-HEMORAGIE | chirurgie-dento-alveolara | Tratamentul hemoragiei postextracționale | 100 | ACT | 30 | |
| PR-INDEPARTARE | protetica-dentara | Îndepărtare coroană | 80 | DINTE | 30 | |
| PR-PROV-CABINET | protetica-dentara | Coroană provizorie în cabinet | 120 | DINTE | 30 | `toothSpecific` |
| PR-PROV-PMMA | protetica-dentara | Coroană provizorie PMMA | 200 / 350 | DINTE | 30 | `priceMax 350` |
| PR-MC | protetica-dentara | Coroană metalo-ceramică total fizionomică | 900 / 1.100 | DINTE | 60 | `toothSpecific` |
| PR-ZR | protetica-dentara | Coroană zirconiu monolitic | 900 / 1.200 | DINTE | 60 | **R**; `toothSpecific` |
| PR-MC-IMPLANT | protetica-dentara | Coroană metalo-ceramică pe implant | 1.000 | DINTE | 60 | `toothSpecific` |
| PR-ZR-IMPLANT | protetica-dentara | Coroană zirconiu monolitic pe implant | 1.100 / 1.500 | DINTE | 60 | `toothSpecific` |
| PR-EMAX | protetica-dentara | Coroană EMAX | 1.500 | DINTE | 60 | `toothSpecific` |
| PR-SCHELETATA | protetica-dentara | Proteză dentară scheletată metalică | 3.800 | ACT | 60 | |
| PR-BIOHPP | protetica-dentara | Proteză dentară scheletată Bio-HPP | 5.200 | ACT | 60 | |
| PR-REBAZARE | protetica-dentara | Rebazare proteză acrilică | 350 | ACT | 45 | |
| PR-WAXUP | protetica-dentara | Wax-up și mock-up / dinte | 150 | DINTE | 30 | |
| PED-FLUOR | pedodontie | Fluorizare / arcadă | 50 | ARCADA | 20 | **R** |
| PED-SIGILARE | pedodontie | Sigilare dinte temporar / permanent | 100 | DINTE | 20 | |
| PED-OBT-TEMP | pedodontie | Obturație dinte temporar | 120 | DINTE | 30 | `toothSpecific` |
| PED-OBT-PERM | pedodontie | Obturație dinte permanent | de la 200 | DINTE | 45 | `priceFrom`; `toothSpecific` |
| PED-PANSAMENT | pedodontie | Pansament calmant endodontic | 100 | DINTE | 30 | |
| ORT-CONSULT | ortodontie | Consultație ortodontică | 150 | ACT | 30 | Online „Aparat dentar” |
| ORT-METALIC | ortodontie | Aparat fix cu brackeți metalici | 2.400 | ARCADA | 90 | **R** |
| ORT-CERAMIC | ortodontie | Aparat fix cu brackeți ceramici | 3.500 | ARCADA | 90 | |
| ORT-MOBILIZABIL | ortodontie | Aparat mobilizabil | 900 | ACT | 30 | |
| ORT-CONTROL | ortodontie | Control și activare aparat fix | 100 / 150 | SEDINTA | 30 | |
| ORT-INDEPARTARE | ortodontie | Îndepărtare aparat fix și fluorizare | 700 | ACT | 60 | |
| PAR-PARODONTOMETRIE | parodontologie | Parodontometrie | 200 | ACT | 30 | |
| PAR-IMOBILIZARE | parodontologie | Imobilizare cu bandă din fibră de sticlă | 450 | ACT | 60 | |
| PAR-CHIURETAJ | parodontologie | Chiuretaj parodontal subgingival / arcadă | 700 | ARCADA | 60 | **R** |
| PAR-GINGIVECTOMIE | parodontologie | Gingivectomie / dinte | 100 | DINTE | 30 | |
| EST-OPALESCENCE | estetica-dentara | Albire profesională Opalescence Boost | 800 | ACT | 90 | **R** |
| EST-ALBIRE-INTERNA | estetica-dentara | Albire internă dinte | 200 | DINTE | 45 | |
| EST-BIJUTERIE | estetica-dentara | Aplicare bijuterie dentară | 200 | ACT | 30 | |
| EST-GUTIERA | estetica-dentara | Gutieră bruxism / arcadă | 300 | ARCADA | 30 | |

### 10.4 Settings, tags and templates

- **Settings:** every key in §7.4 with its defaults.
- **Tags:** „Pacient nou”, „Familie”, „Ortodonție în curs”, „Implant în curs”, „Preferă dimineața”, „Necesită reconfirmare”.
- **Templates:** none are seeded. The code defaults apply (§9.2).

### 10.5 Demo data (`seed-data/demo.ts`)

| Entity | Volume and shape |
|---|---|
| Patients | 40 fictitious adults and 6 children. The children are linked through `guardianId` to adult guardians; `birthDate` gives ages 6–12. Names come from fixed Romanian lists (Ion Pop, Maria Suciu, Elena Rus, Gheorghe Moldovan, Ioana Man and so on). `fileNumber` comes from the sequence. `searchText` is built. Every patient has `preferredLocationId`, about 60% Cristești. |
| Contact data | Phones `+40700000001…` and e-mails `pacient<n>@example.com` (half of the patients have one). Consents: `GDPR_DATE_SANATATE` for all; `SMS` for 70%. |
| CNP | 10 patients get syntactically valid fake CNPs, generated with a correct checksum and encrypted. |
| Medical history | 8 with penicillin allergy, 2 with latex allergy, 3 on anticoagulants, and 1 who is pregnant. |
| Comfort | 8 with `comfortDefault = FRICA` and 2 with `prefersSedation`, so the mustard overlays show in the calendar. |
| Odontograms | 15 patients with 3–8 `ToothCondition`s each: caries, fillings, a crown, an extraction, and 2 implants (one on tooth 36). |
| Treatment plans | 8 plans. Required: Maria Suciu, „Plan implant 36”, in status `IN_CURS`, with five lines: radiografie (described as text, priced 0), IMP-NEODENT 36 EFECTUAT, IMP-BONT 36 PROGRAMAT, PR-ZR-IMPLANT 36 ACCEPTAT, CON-DETARTRAJ PROPUS. The other plans are spread across the statuses. |
| Appointments: past 60 days | About 260, on working days inside the shifts, never conflicting (each slot is drawn through `computeSlots`). Status mix: ~85% FINALIZAT, ~8% NEPREZENTAT, ~7% ANULAT. |
| Appointments: today | 8–12 per location, in all 7 statuses: past slots FINALIZAT, the current slot IN_TRATAMENT or SOSIT, later slots CONFIRMAT or PROGRAMAT. |
| Appointments: next 14 days | About 120: 60% CONFIRMAT, 40% PROGRAMAT. 10% have `source = ONLINE`. A few have `wantsSedation` or `comfort = FRICA`. |
| Invoices and payments | One invoice per FINALIZAT visit with a billable service (lines from the service or plan item, `doctorId` set), sequential `DA` numbers. Payments: 70% card, 25% cash (with receipts `DAC`), 5% transfer. About 10 patients keep a positive balance (partial payment). 1 cancelled invoice. |
| Leads | 12 in total. 4 NOU: 2 `PROGRAMARE_ONLINE`, each with a tentative appointment where `patientId` is null; 1 `FORMULAR_CONTACT`; 1 `APEL_INVERS`. 3 CONTACTAT with activities. 3 PROGRAMAT, converted, with `patientId` set. 2 PIERDUT with a `lostReason`. Assigned to the reception users. |
| Recalls | 10 DE_FACUT, due in the past 30 days or the next 14, from detartraj visits. 2 CONTACTAT with attempts. |
| Messages | `MessageLog`: about 20 entries (REMINDER sms SIMULAT, CONFIRMARE email SIMULAT, 1 EROARE). |
| Audit | `AuditLog`: about 30 entries (logins, views, a CNP reveal, an export). |
| DataRequest | 1 open ACCES request due in 12 days. |

### 10.6 Images (`public/images/`, WP2 copies them from `research/media/`)

| Published path | Source file | Use |
|---|---|---|
| `clinica/receptie.jpg` | `Picture1.jpg` | Home hero (4:5 crop through `object-position`), Despre noi |
| `clinica/sala-asteptare.jpg` | `438712305_938311964749424_5696109962466858468_n.jpg` | Comfort section |
| `clinica/floare-canapea.jpg` | `Picture2-1.jpg` | Despre noi, Inhalosedare |
| `clinica/cabinet-plaja.jpg` | `438716692_938311954749425_6793390655779106115_n.jpg` | Copiii, Pedodonție, Inhalosedare |
| `clinica/receptie-larg.jpg` | `Picture3-1.jpg` | Contact |
| `clinica/perete-muschi.jpg` | `WhatsApp-Image-2024-04-12-at-09.13.07.jpeg` | Despre noi, 404 |
| `clinica/cristesti-fatada.jpg` | `DSC1557-Copy.jpg` | Cristești (Clinicile, Contact, landing pages) |
| `clinica/ludus-seara.jpg` | `407869274_18037383127613789_3652406136975789781_n.jpg` | Luduș |
| `clinica/ludus-zi.jpg` | `WhatsApp-Image-2024-04-12-at-09.13.08.jpeg` | Luduș „Cum ne găsiți” |
| `clinica/radiografie-tableta.jpg` | `1-1.jpg` | Despre noi „Precizie” (at most 480px wide) |
| `echipa/andrei-marcoci.jpg` | `312167804_577320624181895_7536328341001133742_n.jpg` | Team |
| `echipa/mihail-dan-masca.png` | `Untitled-design-2024-05-27T102139.723.png` | Team (row only) |
| `echipa/paul-bologa.jpg` | `328740551_1261847997699717_3209855370680217997_n.jpg` | Team |
| `echipa/ana-maria-fertea.jpg` | `431150871_18047793892613789_4261121530290906434_n.jpg` | Team (centre crop) |
| `legal/anpc-sal.jpg` | `anpc-1-300x76-1.jpg` | Footer. Verify visually which image is SAL and which is SOL. |
| `legal/anpc-sol.jpg` | `anpc-2-300x76-1-1.jpg` | Footer |

- Do not publish the retired images listed in design system §9.1, including the `15-Ani…png` gift box.
- The logo is a hand-traced SVG React component (`src/components/brand/Logo.tsx`), using `Untitled-design-2024-05-27T094429.697.png` as the tracing reference.

---
## 11. Implementation work breakdown

### 11.1 Rules for parallel builders

1. **Disjoint ownership.**
   - A file belongs to exactly one work package (WP).
   - You create, edit and delete only the files on your list, plus generated artifacts named there.
   - Need a change in someone else's file? Do not edit it. Either add a function in your own files (for example, query Prisma directly), or list a „change request” in your final report.
2. **Shared single-owner files:**
   - **WP1 owns:**
     - `package.json` and `package-lock.json`
     - `next.config.ts`
     - `.env.example`
     - `prisma/schema.prisma` and `prisma/migrations/**`
     - `src/proxy.ts`
     - `src/lib/**` (except `cn.ts`)
   - **WP2 owns:**
     - `src/app/layout.tsx` and `src/app/globals.css`
     - `src/components/ui/**` and `src/components/brand/**`
     - `public/**`

   The only dependencies added in v1 are `server-only` and `lucide-react`, and WP1 adds them. Nobody else adds npm packages.
3. **Contracts first.**
   - Each WP that provides a contract in §7.2 or §7.3 creates those files with the exact exports first, as stubs if necessary, before anything else.
   - Consumers import only those exports.
   - Prisma types come from `@/generated/prisma/client`, generated by `npx prisma generate` from the §3.3 schema.
4. **Copy and UI:**
   - All UI text is Romanian, follows design system §12, and uses comma-below ș ț.
   - Components use role tokens only (no raw hex) and the WP2 components.
   - Forum appears in the CRM only for the page title and the patient name.
5. **Every WP passes, for its own files:**
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`

   The full `npm run build` is the integration gate (§12).
6. **Tests.** Unit tests live in `__tests__/` next to the code. Integration tests use a temp SQLite file (`DATABASE_URL=file:./prisma/test-<wp>.db`), migrated with `prisma migrate deploy` in a vitest `globalSetup` owned by WP1. Each test file is responsible for its own data.

**Package scripts** (WP1 adds these to `package.json`):

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"db:migrate": "prisma migrate dev",
"db:seed": "prisma db seed",
"db:reset": "prisma migrate reset --force",
"db:studio": "prisma studio",
"postinstall": "prisma generate"
```

### 11.2 Dependency graph and order

```
WP1 Platform ─┬─► every WP  (lib, schema, auth, shell, seed)
WP2 UI kit ───┘
WP4 Scheduling+Booking ──► used by WP3 (contact lead, home slots) and WP6 (conflicts, transitions)
WP5 Comms+Reports ───────► used by WP4 (send), WP6 (KPIs), WP7 (SendMessageDialog)
WP7 Patients ────────────► used by WP6 (createPatient, duplicates, flags)
WP8 Finance+Admin ───────► used by WP7 (getPatientBalance)
```

- All eight packages can start at once, coding against §7.
- Recommended merge order: **WP1 → WP2 → WP5 → WP4 → WP8 → WP7 → WP3 → WP6**.

---

### WP1: Platform, auth, CRM shell, seed

**Goal.** The foundation every other package builds on:
- schema and migrations
- the `src/lib/**` platform contracts (§7.2)
- authentication and the proxy
- the CRM shell and login
- the seed

**Files to modify:**
- `package.json`: add `server-only` and `lucide-react`; add the scripts in §11.1
- `next.config.ts`: redirects (§4.1), headers (§8.3), `serverActions.bodySizeLimit: '2mb'`
- `.env.example`: add `PII_ENCRYPTION_KEY`, `STORAGE_DIR`, `EINVOICE_PROVIDER`, `SEED_PASSWORD`, `SEED_DEMO`

**Files to create:**

| Area | Files |
|---|---|
| Test config | `vitest.config.ts`, `vitest.global-setup.ts` |
| Database | `prisma/schema.prisma` (verbatim §3.3), `prisma/migrations/*_init/migration.sql`, `prisma/migrations/migration_lock.toml` (generated) |
| Seed | `prisma/seed.ts`, `prisma/seed-data/locations.ts`, `prisma/seed-data/team.ts`, `prisma/seed-data/services.ts`, `prisma/seed-data/demo.ts`, `prisma/seed-data/random.ts` |
| Proxy | `src/proxy.ts` |
| Platform lib | `src/lib/env.ts`, `src/lib/db.ts`, `src/lib/errors.ts` (`DomainError`, `ErrorCode`), `src/lib/actions.ts`, `src/lib/permissions.ts` |
| Auth | `src/lib/auth/session.ts`, `src/lib/auth/password.ts`, `src/lib/auth/dal.ts` |
| Helpers | `src/lib/validation/common.ts`, `src/lib/time.ts`, `src/lib/format.ts`, `src/lib/labels.ts`, `src/lib/search.ts`, `src/lib/pii.ts`, `src/lib/request.ts`, `src/lib/rate-limit.ts`, `src/lib/honeypot.ts`, `src/lib/audit.ts`, `src/lib/tokens.ts`, `src/lib/sequences.ts`, `src/lib/settings.ts`, `src/lib/clinic-scope.ts` |
| Unit tests | `src/lib/__tests__/time.test.ts`, `format.test.ts`, `validation.test.ts`, `pii.test.ts`, `search.test.ts`, `tokens.test.ts`, `permissions.test.ts`, `rate-limit.test.ts` |
| Forms | `src/components/forms/HoneypotFields.tsx` |
| CRM shell | `src/components/crm/shell/AppShell.tsx`, `Sidebar.tsx`, `nav.ts`, `TopBar.tsx`, `ClinicSwitch.tsx`, `UserMenu.tsx`, `actions.ts` (`setClinicScope`, `logout`) |
| CRM routes | `src/app/(crm)/crm/layout.tsx` (metadata robots noindex; `<div data-density>` from the user preference) |
| Login | `src/app/(crm)/crm/login/page.tsx`, `src/app/(crm)/crm/login/LoginForm.tsx`, `src/app/(crm)/crm/login/actions.ts` |
| App shell routes | `src/app/(crm)/crm/(app)/layout.tsx`, `error.tsx`, `loading.tsx`, `not-found.tsx` |
| Utility pages | `src/app/(crm)/crm/(app)/acces-interzis/page.tsx`, `src/app/(crm)/crm/(app)/cont/page.tsx`, `cont/actions.ts`, `cont/AccountForms.tsx` |
| API | `src/app/api/health/route.ts` |

**Sidebar (`nav.ts`).** Items appear in this order. Each declares the permission it needs and is hidden without it:

| Item | Route | Permission |
|---|---|---|
| Azi | `/crm` | |
| Calendar | `/crm/programari` | |
| Cereri online | `/crm/cereri` | count badge: leads with status NOU |
| Pacienți | `/crm/pacienti` | |
| De rechemat | `/crm/rechemari` | count badge: due recalls |
| Încasări | `/crm/incasari` | |
| Facturi | `/crm/facturi` | |
| Servicii și prețuri | `/crm/servicii` | |
| Echipă | `/crm/echipa` | |
| Absențe | `/crm/absente` | |
| Locații | `/crm/locatii` | |
| Mesaje | `/crm/mesaje` | |
| Rapoarte | `/crm/rapoarte` | `reports.*` (any) |
| GDPR | `/crm/gdpr` | |
| Audit | `/crm/audit` | |
| Setări | `/crm/setari` | |

The top bar holds:
- the `ClinicSwitch` (Cristești | Luduș | Ambele)
- the search box, a GET form to `/crm/pacienti?q=` with the `/` and Ctrl+K shortcuts
- „Programare nouă”, linking to `/crm/programari/noua`
- the user menu: Contul meu, the theme toggle (Luminos, Întunecat, Sistem; it saves `User.theme` and writes `localStorage['da-theme']`, which WP2's root-layout script reads), and „Ieșiți din cont”

**Acceptance criteria:**

*Database and seed*
- [ ] `npm install` succeeds and `npx prisma validate` passes.
- [ ] `prisma/schema.prisma` is byte-identical to §3.3, apart from formatting by `prisma format`.
- [ ] On a fresh clone, `npm run db:migrate && npm run db:seed` succeeds.
- [ ] Running `npm run db:seed` a second time succeeds with no duplicates.
- [ ] The seeded counts match §10. Prices match §10.3, and spot checks of IMP-NEODENT (220000), PR-ZR (90000–120000) and INH-ORA (15000, ORA) pass.
- [ ] The demo appointments contain no blocking conflicts. The seed asserts this through `findConflicts`-equivalent overlap checks.

*Auth*
- [ ] Logging in as `admin@dentalarena.ro` with the seed password reaches `/crm`.
- [ ] A wrong password shows the generic message.
- [ ] 10 failures lock the account for 15 minutes.
- [ ] More than 5 attempts per e-mail in 15 minutes return the rate-limit message.
- [ ] Logout clears the cookie.
- [ ] Bumping `sessionVersion` in the DB invalidates the session on the next request.
- [ ] `/crm/*` without a cookie redirects to `/crm/login?next=…`. `next` cannot point off-site.
- [ ] Responses under `/crm` carry `X-Robots-Tag: noindex`.

*Shell*
- [ ] The sidebar shows only the permitted items per role: MEDIC sees no Cereri, Încasări, Facturi, Setări, Audit or GDPR.
- [ ] The counts show.
- [ ] The clinic switch persists across pages.
- [ ] `/crm/cont` changes the password (with the policy), the theme and the density.

*Unit tests*
- [ ] All `src/lib/__tests__` pass, including:
  - DST: `localToUtc("2026-10-25", 540)` is `07:00Z`, and `localToUtc("2026-10-24", 540)` is `06:00Z`
  - `formatLei` variants
  - phone normalisation for „0744 123 456”, „0744123456”, „+40 744 123 456” and „0265.326.316”
  - CNP checksum
  - token tamper, expiry and version mismatch
  - `normalizeSearch("Mașca Ştefan")` is „masca stefan”
- [ ] `GET /api/health` returns `{ ok: true, db: true }`.

---

### WP2: Design system, UI kit, brand, images

**Goal.** Implement `docs/design-system.md` §3–§5 and §7–§11 as tokens and components that every screen reuses.

**Files to modify or delete:**
- Replace `src/app/layout.tsx`:
  - `<html lang="ro">` with the Forum and Red Hat Text variables
  - `suppressHydrationWarning`
  - a tiny inline script that sets `data-theme` from `localStorage['da-theme']`, only when the path starts with `/crm`
- Replace `src/app/globals.css` with design system §5.2, written out in full: the dark declarations are duplicated inside the media query, plus base styles, `tabular-nums` helpers and print styles.
- Delete `src/app/favicon.ico` and `public/{next,vercel,globe,window,file}.svg`.

**Files to create:**

| Area | Files |
|---|---|
| App | `src/app/fonts.ts`, `src/app/icon.svg` (simplified mark) |
| Helpers | `src/lib/cn.ts` |
| Brand | `src/components/brand/Logo.tsx`, `ThreadGlyph.tsx`, `ThreadSteps.tsx` |
| UI kit | `src/components/ui/` (listed below) |
| Images | `public/images/clinica/*` (10 files), `public/images/echipa/*` (4 files), `public/images/legal/*` (2 files), per §10.6 |
| Gallery | `src/app/(crm)/crm/(app)/ui/page.tsx` (ADMIN-only gallery of every component and state) |

The UI kit files are `Button.tsx`, `ButtonLink.tsx`, `TextLink.tsx`, `Field.tsx`, `TextField.tsx`, `PhoneField.tsx`, `TextArea.tsx`, `Select.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `ConsentCheckbox.tsx`, `DateInput.tsx`, `TimeInput.tsx`, `SearchField.tsx`, `SubmitButton.tsx`, `ErrorSummary.tsx`, `EmptyState.tsx`, `Toast.tsx`, `Dialog.tsx`, `Drawer.tsx`, `Popover.tsx`, `Menu.tsx`, `Tabs.tsx`, `SegmentedControl.tsx`, `StatusChip.tsx`, `FlagTag.tsx`, `CountBadge.tsx`, `DataTable.tsx`, `Pagination.tsx`, `SlotButton.tsx`, `ChoiceButton.tsx`, `ChoicePanel.tsx`, `WeekStrip.tsx`, `Accordion.tsx`, `Breadcrumbs.tsx`, `PageHeader.tsx`, `Panel.tsx`, `Icon.tsx`, `VisuallyHidden.tsx`, `Spinner.tsx` and `index.ts`.

**Component contracts.** Consumers rely on these props. Every component also accepts `className`.

| Component | Props |
|---|---|
| `Button` | `variant?: "primary" \| "secondary" \| "text" \| "danger"`, `size?: "s" \| "m" \| "l"`, `loading?`, `icon?: IconName`, plus button attributes |
| `ButtonLink` | Same visual props plus `href` (next/link) |
| `TextLink` | `href`, `standalone?`, `external?` |
| `Field` | `label`, `name`, `hint?`, `error?: string \| string[]`, `required?`, `children`. Wires `id`, `aria-describedby` and `aria-invalid`. |
| `TextField`, `PhoneField`, `TextArea`, `DateInput`, `TimeInput`, `SearchField` | Field props plus the native attributes. `PhoneField` sets `inputMode="tel"` and `autoComplete="tel"`. |
| `Select` | `options: { value: string; label: string }[]`, `placeholder?` |
| `Checkbox` | `label`, `name`, `defaultChecked?`, `error?` |
| `RadioGroup` | `legend`, `name`, `options: { value; label; description? }[]`, `defaultValue?`, `error?` |
| `ConsentCheckbox` | `name`, `required?`, `children` (a label with links), `error?` |
| `SubmitButton` | Button props plus `pendingLabel?` (uses `useFormStatus`) |
| `ErrorSummary` | `errors?: Record<string, string[]>`, `title?`. Focuses itself when non-empty. |
| `EmptyState` | `title`, `action?` |
| `Toast` | `<Toaster />` plus `useToast().show({ kind: "success" \| "error", message, undo?: () => void })`. Polite live region; lasts 6 s. |
| `Dialog` | Native `<dialog>`: `open`, `onClose`, `title`, `children`, `footer?` |
| `Drawer` | `open`, `onClose`, `title`, `width?` (default 400) |
| `Popover` and `Menu` | Anchored. Close on Esc and on an outside click. |
| `Tabs` | `items: { href; label; count? }[]`. Link tabs; the active one is matched on the pathname. |
| `SegmentedControl` | `options: { value; label; href? }[]`, `value`, `name?`. Link mode or form mode. |
| `StatusChip` | `status: AppointmentStatus`, `size?`. Icon plus word, in the 7 styles from §0.2 and design system §3.3. |
| `FlagTag` | `kind: "confort" \| "alerta" \| "copil" \| "online" \| "neutral"`, `children` |
| `CountBadge` | `count` |
| `DataTable<T>` | `columns: { key; header; align?: "left" \| "right"; render?: (row: T) => ReactNode }[]`, `rows: T[]`, `rowHref?: (row: T) => string`, `empty?`, `caption`. Server-renderable; row height follows density. |
| `Pagination` | Server component: `page`, `pageCount`, `baseHref`, `searchParams` |
| `SlotButton` | `time`, `selected?`, `disabled?`, plus button attributes |
| `ChoiceButton` | `selected?`, `tone?: "neutral" \| "calm" \| "comfort"`, `description?` |
| `ChoicePanel` | `title`, `children`, `selected?` |
| `WeekStrip` | `days: { dateISO; label; disabled }[]`, `value`, `onChange` |
| `Accordion` | `items: { question; answer }[]`. Built on `details`/`summary`. |
| `Breadcrumbs` | `items: { href?; label }[]` |
| `PageHeader` | `title`, `subtitle?`, `actions?` |
| `Panel` | `title?`, `tone?: "suprafata" \| "menta-pal" \| "mustar-pal"` |
| `Icon` | `name: IconName`, `size?`, `label?`. A curated lucide subset: phone, map-pin, calendar, clock, check, check-check, x, alert-triangle, door-open, activity, user-x, circle-slash, search, plus, chevron-left, chevron-right, menu, log-out, settings, file, upload, download, printer, mail, message-square. |
| `ThreadSteps` | `steps: string[]`, `current: number`, `variant: "rail" \| "inline" \| "list" \| "plan" \| "mini"`, `crown?: boolean`. Renders the `<ol>` with `aria-current="step"`; the glyph itself is `aria-hidden`. |
| `Logo` | `variant: "full" \| "compact" \| "mark" \| "reversed" \| "mono"`, `title?` |

**Acceptance criteria:**

*Tokens and theming*
- [ ] Only the design tokens exist: Tailwind's default palette is removed (`--color-*: initial`). No raw hex appears outside `globals.css`.
- [ ] Fonts load with `latin-ext`. „ș ț Ș Ț ă â î” render in both families.
- [ ] Light, dark and `data-density="compact"` all work in `/crm/ui`.

*Components*
- [ ] `/crm/ui` shows every component in every state listed in design system §10. That includes the 7 status chips and 4 overlays, and the thread in its 5 variants with done, current and future bands.
- [ ] Every interactive component is keyboard-operable, has a visible focus ring, meets the target sizes (48 px on the site, 32 px in the CRM), and honours `prefers-reduced-motion`.
- [ ] Contrast pairs match design system §11.1 (checked in a small unit test or a documented manual check).

*Images*
- [ ] The 16 images exist under `public/images` with the names in §10.6. No retired image is published.
- [ ] The Logo SVG matches the mark's geometry and works from 16 px (mark) to 220 px (full).

---

### WP3: Public website

**Goal.** Every public marketing page in §4.1 except `/programare` and `/p/*`. That includes the site chrome, cookie consent, SEO and the static Romanian content.

**Files to delete:** `src/app/page.tsx` (the scaffold home conflicts with `(site)/(pagini)/page.tsx`).

**Files to create:**

| Area | Files |
|---|---|
| App root | `src/app/not-found.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts` |
| Layouts | `src/app/(site)/layout.tsx`, `src/app/(site)/(pagini)/layout.tsx` |
| Pages | Under `src/app/(site)/(pagini)/`: `page.tsx`, `servicii/page.tsx`, `[serviciu]/page.tsx`, `preturi/page.tsx`, `echipa/page.tsx`, `echipa/[slug]/page.tsx`, `despre-noi/page.tsx`, `15ani/page.tsx`, `contact/page.tsx`, `contact/actions.ts`, `termeni-si-conditii/page.tsx`, `politica-de-confidentialitate/page.tsx`, `politica-cookies/page.tsx`, `dentist-targu-mures/page.tsx`, `cabinet-stomatologic-targu-mures/page.tsx` |
| Site components | `src/components/site/` (listed below) |
| Content | `src/content/site.ts` (nav, footer, SEO defaults, phones), `home.ts`, `about.ts`, `anniversary.ts`, `landing.ts` |
| Service content | `src/content/services/index.ts` (slugs, order, metadata), plus one file per service: `consultatie-profilaxie.ts`, `stomatologie-generala.ts`, `inhalosedare.ts`, `implantologie.ts`, `chirurgie-dento-alveolara.ts`, `protetica-dentara.ts`, `pedodontie.ts`, `ortodontie.ts`, `parodontologie.ts`, `estetica-dentara.ts` |
| Legal content | `src/content/legal/termeni.ts`, `confidentialitate.ts`, `cookies.ts` |
| Tests | `src/content/__tests__/content.test.ts` |
| Public queries | `src/server/public/queries.ts`, `src/server/public/types.ts` |

The site components are `SiteHeader.tsx`, `ServicesMenu.tsx`, `MobileMenu.tsx`, `CallMenu.tsx`, `CallSheet.tsx`, `StickyCallBar.tsx`, `SiteFooter.tsx`, `AnpcBadges.tsx`, `CookieConsent.tsx`, `MapConsent.tsx`, `AvailabilityPanel.tsx`, `AvailabilityPanelClient.tsx`, `ComfortQuestion.tsx`, `ComfortNote.tsx`, `ServiceIndex.tsx`, `PriceTable.tsx`, `PriceSearch.tsx`, `DoctorFigure.tsx`, `DoctorMonogram.tsx`, `ClinicSplit.tsx`, `ServiceHero.tsx`, `ServiceSteps.tsx`, `WhoTreats.tsx`, `BookingCta.tsx`, `RelatedServices.tsx`, `ContactForm.tsx`, `LegalPage.tsx` and `JsonLd.tsx`.

**Content rules:**
- Copy comes from `research/content.json` and `research/pages/*.txt`, with every correction in design system §0.4 and §12.6 and in `critic.corrections` applied.
- The `[serviciu]` page reads prose from content and prices from the DB through `getPublicCatalog(slug)`.

**Acceptance criteria:**

*Pages and SEO*
- [ ] Every WP3 URL in §4.1 returns 200, and unknown service slugs return 404.
- [ ] Each page has a unique Romanian `<title>` and description (consultație și profilaxie gets its own title) and canonical URLs.
- [ ] `sitemap.xml` lists every public page, and `robots.txt` disallows `/crm` and `/api`.
- [ ] JSON-LD `Dentist` is emitted per location, without hours unless `publishHours` is set.

*Content*
- [ ] A content test fails on:
  - the cedilla characters ş ţ Ş Ţ
  - the English leftovers „Get in touch”, „Office Email Address”, „Reject All”
  - „100% sigur”
  - „la 1 km”

  It also asserts that all 10 slugs exist.
- [ ] Home follows design system §6.4:
  - hero headline „Fără durere, / fără frică, / cu precizie.”
  - `AvailabilityPanel` with 3 slots per clinic from `getNextFreeSlots`, no preselection, falling back to „Sunați-ne și vă găsim o oră.” with both phones
  - comfort question writes `sessionStorage['da-confort']` and links to `/programare?confort=…`, and works without JS
  - five doctors, „Ce tratăm” with representative DB prices, „Copiii” with three prices, „Clinicile” split on the axis
- [ ] Service pages:
  - „Cum decurge” only on implantologie, ortodonție and inhalosedare
  - „Cine vă tratează” per §6.5
  - prices rendered by `formatLei`
  - „Programați o consultație” links to `/programare?serviciu=<code>`
- [ ] Changing a price in the CRM (or the DB plus `revalidatePath`) shows on the site.
- [ ] `/echipa` shows 5 doctors with the Podar monogram, and the profile pages work.
- [ ] `/preturi` searches client-side and is diacritics-insensitive.
- [ ] `/15ani` uses the past tense for the 2024 promotion.

*Contact form*
- [ ] Validates with the Romanian messages.
- [ ] Honeypot and timing work, and the rate limit works.
- [ ] Creates a `Lead` through `createContactLead`.
- [ ] Shows the success message.
- [ ] Works without JS.

*Chrome and accessibility*
- [ ] The cookie banner is fully Romanian. Maps load only after consent, and „Setări cookie-uri” in the footer reopens it.
- [ ] Header: „Sunați” menu, mobile sheet, sticky call bar.
- [ ] Footer: ANPC SAL/SOL images linked, generated year.
- [ ] At 320 px there is no horizontal scroll. Keyboard navigation works across header, menus and forms. Lighthouse accessibility is at least 95 on `/` and `/implantologie` (manual).

---

### WP4: Scheduling engine, online booking, patient links, doctor schedules

**Goal.** Everything about availability and appointment lifecycle rules:
- §6.1–§6.5 and the token pages of §6.6
- the public wizard
- the CRM schedule editor

**Files to create:**

| Area | Files |
|---|---|
| Scheduling | `src/server/scheduling/types.ts`, `intervals.ts`, `compute.ts`, `availability.ts`, `conflicts.ts`, `status.ts`, `schedules.ts`, `ics.ts` |
| Scheduling tests | `src/server/scheduling/__tests__/intervals.test.ts`, `compute.test.ts`, `conflicts.test.ts`, `status.test.ts` |
| Leads intake | `src/server/leads/schemas.ts`, `src/server/leads/intake.ts`, `src/server/leads/__tests__/schemas.test.ts` |
| Booking wizard | `src/app/(site)/programare/layout.tsx`, `page.tsx`, `actions.ts` |
| Patient links | `src/app/(site)/p/[token]/page.tsx`, `actions.ts`, `ics/route.ts` |
| API | `src/app/api/public/slots/route.ts` |
| Booking components | `src/components/booking/BookingWizard.tsx`, `BookingHeader.tsx`, `StepRail.tsx`, `StepReasonClinic.tsx`, `StepSlot.tsx`, `StepComfort.tsx`, `StepDetails.tsx`, `BookingSummary.tsx`, `BookingConfirmation.tsx`, `CallbackForm.tsx`, `AppointmentManage.tsx`, `useBookingState.ts` |
| Schedule editor | `src/app/(crm)/crm/(app)/echipa/[id]/program/page.tsx`, `actions.ts`; `src/app/(crm)/crm/(app)/absente/page.tsx`, `actions.ts` |
| Schedule components | `src/components/crm/schedule/ScheduleEditor.tsx`, `ShiftRow.tsx`, `TimeOffForm.tsx`, `TimeOffList.tsx` |

**Acceptance criteria:**

*Engine*
- [ ] Every test case listed in §6.1 passes, including DST on 25 Oct 2026, plus the transition table in §6.4 (`status.test.ts`).
- [ ] `GET /api/public/slots`:
  - returns slots matching the seeded shifts for each clinic, service and doctor
  - returns 400 on bad params and 429 over the limit
  - never offers a slot inside the lead time, inside a break or time off, or overlapping a blocking appointment

*Wizard*
- [ ] Works keyboard-only and follows design system §6.7 copy.
- [ ] Query-param prefill skips to the first unanswered step. Back keeps the data. „Am o durere acum” pins the phones.
- [ ] „Prefer să mă sunați” creates an `APEL_INVERS` lead.
- [ ] Submit creates `Lead(PROGRAMARE_ONLINE, NOU)` plus `Appointment(PROGRAMAT, ONLINE, patientId null, leadId)` and shows the confirmation with an `.ics` link.
- [ ] The confirmation e-mail and clinic notification are sent via WP5 `after()`; with the console provider they appear in the log.
- [ ] Integration tests:
  - two concurrent submits for the same doctor and slot give exactly one success, and the other gets the „tocmai a fost ocupată” error
  - a repeated `idempotencyKey` returns the first result
  - a filled honeypot gives a fake success and writes no rows

*Patient links*
- [ ] `/p/[token]` shows only first name, date, time, clinic, address and doctor.
- [ ] Confirm gives CONFIRMAT with `confirmedVia LINK`. Cancel works before the cutoff and shows the phone after it.
- [ ] Tampered, expired and stale-version tokens show the invalid-link message.
- [ ] A GET never changes data.
- [ ] `/p/[token]/ics` is a valid iCalendar file.

*Status transitions*
- [ ] `transitionAppointment` rejects illegal transitions (`INVALID_TRANSITION`), applies the side effects and writes the audit row.

*Schedule editor*
- [ ] ADMIN edits weekly shifts per location with breaks, cabinet, online flag and validity, and overlapping shifts are rejected with a clear message.
- [ ] RECEPTIE adds time off for any doctor; MEDIC only for themselves.
- [ ] Availability reflects changes immediately.

---

### WP5: Communications, reminders, reports, audit viewer

**Goal.** Covers:
- §6.6 reminders, §9.1–§9.3 messaging
- the Mesaje module
- Rapoarte with CSV
- the KPI service
- the audit viewer
- the maintenance job

**Files to create:**

| Area | Files |
|---|---|
| Notifications | `src/server/notify/types.ts`, `mailer.ts`, `gsm.ts`, `templates.ts`, `default-templates.ts`, `send.ts`, `reminders.ts` |
| SMS | `src/server/notify/sms/types.ts`, `sms/console.ts`, `sms/index.ts` |
| Notification tests | `src/server/notify/__tests__/templates.test.ts`, `gsm.test.ts`, `reminders.test.ts` |
| Maintenance | `src/server/maintenance.ts` |
| Reports | `src/server/reports/types.ts`, `metrics.ts`, `reports.ts`, `csv.ts` |
| Report tests | `src/server/reports/__tests__/csv.test.ts`, `metrics.test.ts` |
| API | `src/app/api/cron/reminders/route.ts`, `src/app/api/cron/maintenance/route.ts`, `src/app/api/crm/rapoarte/[raport]/route.ts` |
| Mesaje pages | `src/app/(crm)/crm/(app)/mesaje/page.tsx`, `mesaje/actions.ts`, `mesaje/sabloane/page.tsx`, `mesaje/sabloane/[key]/page.tsx` |
| Report pages | `src/app/(crm)/crm/(app)/rapoarte/page.tsx`, `rapoarte/[raport]/page.tsx` |
| Audit page | `src/app/(crm)/crm/(app)/audit/page.tsx` |
| Components | `src/components/crm/comms/MessageLogTable.tsx`, `TemplateEditor.tsx`, `SendMessageDialog.tsx`; `src/components/crm/reports/ReportFilters.tsx`, `ReportTable.tsx`, `LineChart.tsx`; `src/components/crm/audit/AuditTable.tsx` |

**KPI definitions** (`getKpis`, all for appointments or documents in `[from, to)` and scoped by location and doctor):

| KPI | Definition |
|---|---|
| `noShowRate` | NEPREZENTAT ÷ (FINALIZAT + NEPREZENTAT + SOSIT + IN_TRATAMENT), counting only appointments with `startsAt < now`. Null when the denominator is 0. |
| `revenueInvoiced` | Σ `InvoiceItem.total` of EMISA invoices issued in range. For a location scope, use `Invoice.locationId`; for a doctor scope, `InvoiceItem.doctorId`. |
| `revenueCollected` | Σ non-cancelled `Payment.amount` with `paidAt` in range |
| `newPatients` | Patients created in range |
| `leadConversionRate` | Leads created in range with `convertedAt` set or status PROGRAMAT, ÷ leads created in range |

**Acceptance criteria:**

*Messaging*
- [ ] Without `SMTP_HOST`, mail prints to the console in dev and is logged `SIMULAT`.
- [ ] The SMS console provider prints GSM-7 text when `smsStripDiacritics` is on.
- [ ] Every send writes `MessageLog`.

*Cron*
- [ ] `/api/cron/reminders` returns 401 without the bearer token or with a wrong one.
- [ ] With the correct token, it selects exactly the §6.6 candidates. A unit test runs on a fixed `now` with fixture appointments.
- [ ] A second run sends nothing, the quiet hours skip, and each reminder contains a valid `/p/[token]` link.
- [ ] `/api/cron/maintenance` anonymises leads past retention and purges expired buckets.

*Mesaje*
- [ ] The log filters by channel, kind, status and date.
- [ ] A and R can send manually (`SendMessageDialog`); only ADMIN edits templates.
- [ ] The editor previews with sample variables, rejects unknown variables and offers „Reveniți la textul implicit”.

*Reports*
- [ ] Every report in §5.3 renders with filters (default: the current month, the clinic scope).
- [ ] Totals equal direct DB sums on the seed data (integration test).
- [ ] CSV has a UTF-8 BOM, `;` separators and the formula-injection guard, and the download is audited.
- [ ] Permissions follow §5.3: MEDIC sees only their own; RECEPTIE gets no revenue reports.
- [ ] The visits-per-week line chart follows the dataviz rules: brand mint and slate, an accessible table fallback.

*Audit viewer*
- [ ] ADMIN only, filterable, paginated, read-only.

---

### WP6: Front desk (Azi dashboard, calendar and appointments, leads, recalls)

**Goal.** Reception and doctors run the day:
- the dashboard
- the calendar with create, edit, move and status
- the lead pipeline and conversion
- recalls

**Files to create:**

| Area | Files |
|---|---|
| Services | `src/server/appointments/types.ts`, `service.ts` (create, update, move, `assertCanActOnAppointment`, `createRecallForCompleted`), `calendar.ts` (`getCalendarData`), `dashboard.ts` (today's agenda, work queues, positive balances) |
| Lead pipeline | `src/server/leads/pipeline.ts`, `src/server/leads/__tests__/pipeline.test.ts` |
| Recalls | `src/server/recalls/service.ts` |
| Dashboard page | `src/app/(crm)/crm/(app)/page.tsx` |
| Calendar pages | `src/app/(crm)/crm/(app)/programari/page.tsx`, `programari/actions.ts`, `programari/noua/page.tsx`, `programari/[id]/page.tsx` |
| Lead pages | `src/app/(crm)/crm/(app)/cereri/page.tsx`, `cereri/actions.ts`, `cereri/[id]/page.tsx` |
| Recall pages | `src/app/(crm)/crm/(app)/rechemari/page.tsx`, `rechemari/actions.ts` |
| Calendar components | `src/components/crm/calendar/CalendarToolbar.tsx`, `CalendarGrid.tsx`, `CalendarWeek.tsx`, `TimeGutter.tsx`, `NowLine.tsx`, `AppointmentBlock.tsx`, `AppointmentDrawer.tsx`, `QuickCreatePopover.tsx`, `AppointmentForm.tsx`, `MoveDialog.tsx`, `StatusActions.tsx`, `ConflictNotice.tsx`, `useCalendarDrag.ts`, `layout.ts` |
| Calendar tests | `src/components/crm/calendar/__tests__/layout.test.ts` |
| Dashboard components | `src/components/crm/dashboard/TodayList.tsx`, `WorkQueue.tsx`, `KpiSentence.tsx` |
| Lead components | `src/components/crm/leads/LeadBoard.tsx`, `LeadCard.tsx`, `LeadDetail.tsx`, `LeadActivityList.tsx`, `ConvertLeadForm.tsx`, `AssignSelect.tsx` |
| Recall components | `src/components/crm/recalls/RecallList.tsx`, `RecallAttemptForm.tsx` |

**Acceptance criteria:**

*Calendar day view*
- [ ] Doctor columns for the clinic scope, or a cabinet toggle.
- [ ] 15-minute rows at 24 px, and a now-line.
- [ ] Blocks styled per the 7 statuses, with the overlays: confort (mustard), alertă (carmin, from `getPatientFlagsBulk`), copil, online.
- [ ] Blocks under 30 minutes keep the icon and edge but drop the word.
- [ ] Overlapping blocks lay out in lanes (`layout.ts`, unit-tested).

*Calendar week view*
- [ ] Per doctor, defaulting to the first doctor in scope.
- [ ] Day and week navigation, „Azi”, and the date in the URL.

*Create and edit*
- [ ] Clicking an empty slot opens quick-create:
  - patient search, or „Pacient nou” inline via `createPatient`, after `findDuplicatePatients`
  - a service, whose duration presets the end
  - a sedation toggle and a note
- [ ] The full form is at `/crm/programari/noua`.
- [ ] Block conflicts are refused with the §6.2 messages. Warnings need the „Salvați oricum” checkbox (A/R; MEDIC only for `OUTSIDE_SHIFT` and `IN_PAST` on their own appointments).

*Move*
- [ ] Drag snaps to 15 minutes with a ghost.
- [ ] `MoveDialog` is the keyboard alternative.
- [ ] The undo toast lasts 6 s.
- [ ] `STALE` is detected.
- [ ] `tokenVersion` increments, `reminderSentAt` resets, and a `MODIFICARE` message goes out if the patient opted in.

*Drawer*
- [ ] Actions follow §6.4 with the design copy: „Confirmați programarea”, „A sosit”, „Începeți tratamentul”, „Finalizați”, „Anulați programarea”, „Marcați ca neprezentat”.
- [ ] A MEDIC acts only on their own appointments.
- [ ] FINALIZAT creates a recall when the service has `recallMonths`.

*Azi*
- [ ] The one-sentence summary per clinic (design system §6.8).
- [ ] Today's list with inline status actions.
- [ ] Queues: new leads with confirm/call actions, due recalls, positive balances.
- [ ] KPIs from `getKpis`; month revenue only with `dashboard.revenue`.

*Cereri*
- [ ] A board with the 4 columns plus a list view; filters by source, clinic and assignee.
- [ ] Assign, add a note or call activity, change status, „Pierdut” with a reason.
- [ ] Convert:
  1. The duplicate check offers „Folosiți pacientul existent” or „Creați pacient nou”.
  2. The lead's GDPR and SMS consents are copied into `Consent` rows.
  3. The tentative appointment gets its `patientId`, or a new appointment is created.
  4. The lead gets status PROGRAMAT and `convertedAt`.
  5. The `lead.convert` audit is written.
- [ ] A tentative online appointment can be confirmed straight from the lead card.

*Rechemări*
- [ ] The due list, logging call attempts (outcome and note), „Programați”, which deep-links to `/crm/programari/noua?pacient=`, and refused or cancelled states.

---

### WP7: Patients and clinical record, documents, GDPR

**Goal.** The full „Fișa pacientului” and the patient-level GDPR tooling.

**Files to create:**

| Area | Files |
|---|---|
| Services | `src/server/patients/types.ts`, `schemas.ts`, `service.ts`, `duplicates.ts`, `flags.ts`, `medical.ts`, `consents.ts`, `odontogram.ts`, `plans.ts`, `documents.ts`, `storage.ts`, `notes.ts`, `tags.ts`, `gdpr.ts` |
| Service tests | `src/server/patients/__tests__/flags.test.ts`, `duplicates.test.ts`, `odontogram.test.ts`, `plans.test.ts`, `gdpr.test.ts` |
| List and create | `src/app/(crm)/crm/(app)/pacienti/page.tsx`, `pacienti/actions.ts`, `pacienti/nou/page.tsx` |
| Patient file | Under `src/app/(crm)/crm/(app)/pacienti/[id]/`: `layout.tsx`, `page.tsx`, `date/page.tsx`, `date/actions.ts`, `anamneza/page.tsx`, `anamneza/actions.ts`, `consimtaminte/page.tsx`, `consimtaminte/actions.ts`, `odontograma/page.tsx`, `odontograma/actions.ts`, `planuri/page.tsx`, `planuri/actions.ts`, `planuri/[planId]/page.tsx`, `planuri/[planId]/tipar/page.tsx`, `programari/page.tsx`, `documente/page.tsx`, `documente/actions.ts`, `note/page.tsx`, `note/actions.ts`, `gdpr/page.tsx`, `gdpr/actions.ts` |
| GDPR register | `src/app/(crm)/crm/(app)/gdpr/page.tsx`, `gdpr/actions.ts` |
| API | `src/app/api/crm/pacienti/[id]/documente/route.ts`, `src/app/api/crm/pacienti/[id]/export/route.ts`, `src/app/api/crm/documente/[id]/route.ts` |
| Patient components | `src/components/crm/patients/PatientHeader.tsx`, `PatientTabs.tsx`, `PatientForm.tsx`, `PatientList.tsx`, `PatientSearchBox.tsx`, `DuplicateWarning.tsx`, `CnpField.tsx`, `CnpReveal.tsx`, `MedicalHistoryForm.tsx`, `ConsentList.tsx`, `ConsentForm.tsx`, `NotesList.tsx`, `NoteForm.tsx`, `TagEditor.tsx`, `DocumentList.tsx`, `DocumentUpload.tsx`, `ComfortEditor.tsx`, `GdprPanel.tsx`, `DataRequestTable.tsx` |
| Odontogram | `src/components/crm/odontogram/Odontogram.tsx`, `Tooth.tsx`, `ToothDialog.tsx`, `fdi.ts`, `legend.ts`, `__tests__/fdi.test.ts` |
| Plans | `src/components/crm/plans/TreatmentPlanEditor.tsx`, `PlanItemRow.tsx`, `PlanTotals.tsx`, `PlanProgress.tsx`, `PlanPrint.tsx` |

**Acceptance criteria:**

*Search and create*
- [ ] Search finds patients by name with or without diacritics, by phone in any format, by e-mail and by file number. 25 per page; filter by tag.
- [ ] A new patient triggers the duplicate warning on the same phone, the same CNP hash, or the same name plus birth date.
- [ ] The CNP is validated and encrypted, masked on display, and revealed by an audited action that shows it for 30 s.

*Patient header*
- [ ] Shows the name (Forum), age, preferred clinic, primary doctor, phone (`tel:`), flags and the comfort note in a mustard panel.
- [ ] Balance comes from `getPatientBalance`.
- [ ] Actions: Programați, Trimiteți SMS (`SendMessageDialog`), Încasați (→ `/crm/facturi/noua?pacient=`).

*Role rules*
- [ ] For RECEPTIE, the anamneză, odontogram and clinical-notes tabs are hidden and their routes redirect. Flags stay visible.
- [ ] DTOs never include `cnpEncrypted`. Clinical data is omitted for RECEPTIE at the service layer.

*Clinical tabs*
- [ ] **Anamneză:** saving writes `lastReviewedAt` and the `medical.update` audit; flags derive correctly (unit test).
- [ ] **Consents:** list with timestamp, method and text version; record (granted or refused, method, optional linked document); revoke.
- [ ] **Odontogram:**
  - adult and child FDI layouts
  - surfaces M O D V L/P
  - colour plus pattern plus letter legend; the implant drawn as the mini thread
  - clicking a tooth adds a condition, or a plan line priced from the catalog
  - fully keyboard-operable
  - FDI validation unit-tested
- [ ] **Plans:**
  - CRUD with phases and items: tooth, service, quantity, unit price copied from the catalog, discount, status
  - totals unit-tested
  - status flow CIORNA → PREZENTAT → ACCEPTAT → IN_CURS → FINALIZAT
  - the printable deviz has the clinic header and signature lines
  - the implant plan shows `ThreadSteps` progress
- [ ] **Appointment history** lists every appointment with its status chip.

*Documents*
- [ ] Upload is capped at 20 MB, with type and magic-byte checks; metadata is listed.
- [ ] Download goes through the authenticated route and is audited.
- [ ] Soft delete is ADMIN only.

*Notes*
- [ ] Administrative and clinical notes (clinical only for A and M), with pinning.

*GDPR*
- [ ] Export downloads JSON (ADMIN, audited).
- [ ] Anonymise requires typing the file number and follows §3.2 invariant 11 (unit test of the field map).
- [ ] The request register shows due dates and highlights overdue requests.
- [ ] The `patient.view` audit is written at most once per user, patient and hour.

---

### WP8: Finance and administration

**Goal.** Covers:
- invoices, payments and balances, with the e-Factura interface
- the services and prices catalog
- users and doctors
- locations, hours and cabinets
- settings

**Files to create:**

| Area | Files |
|---|---|
| Billing services | `src/server/billing/types.ts`, `totals.ts`, `invoices.ts`, `payments.ts`, `balance.ts` |
| e-Factura | `src/server/billing/einvoice/types.ts`, `einvoice/none.ts`, `einvoice/index.ts` |
| Billing tests | `src/server/billing/__tests__/totals.test.ts`, `balance.test.ts` |
| Admin services | `src/server/catalog/service.ts`, `src/server/staff/service.ts`, `src/server/locations/service.ts` |
| Invoice pages | `src/app/(crm)/crm/(app)/facturi/page.tsx`, `facturi/actions.ts`, `facturi/noua/page.tsx`, `facturi/[id]/page.tsx`, `facturi/[id]/tipar/page.tsx` |
| Payment pages | `src/app/(crm)/crm/(app)/incasari/page.tsx`, `incasari/actions.ts`, `src/app/(crm)/crm/(app)/pacienti/[id]/incasari/page.tsx` |
| Catalog pages | `src/app/(crm)/crm/(app)/servicii/page.tsx`, `servicii/actions.ts`, `servicii/[id]/page.tsx` |
| Team pages | `src/app/(crm)/crm/(app)/echipa/page.tsx`, `echipa/actions.ts`, `echipa/nou/page.tsx`, `echipa/[id]/page.tsx` |
| Location pages | `src/app/(crm)/crm/(app)/locatii/page.tsx`, `locatii/actions.ts`, `locatii/[id]/page.tsx` |
| Settings page | `src/app/(crm)/crm/(app)/setari/page.tsx`, `setari/actions.ts` |
| Billing components | `src/components/crm/billing/InvoiceForm.tsx`, `InvoiceItemsEditor.tsx`, `InvoiceView.tsx`, `InvoicePrint.tsx`, `PaymentForm.tsx`, `PaymentList.tsx`, `BalanceSummary.tsx`, `CancelDialog.tsx` |
| Admin components | `src/components/crm/admin/CategoryEditor.tsx`, `ServiceEditor.tsx`, `PriceInput.tsx`, `UserForm.tsx`, `DoctorProfileForm.tsx`, `LocationForm.tsx`, `HoursEditor.tsx`, `CabinetEditor.tsx`, `SettingsForms.tsx` |

**Acceptance criteria:**

*Invoices*
- [ ] Lines can come from:
  - plan items that are ACCEPTAT or EFECTUAT and not yet invoiced
  - services of FINALIZAT appointments
  - the catalog
  - free text
- [ ] The doctor is set per line. Totals are computed on the server with `totals.ts`, and the client preview uses the same pure function.
- [ ] Numbering is gap-free, `DA-000001` style, from `NumberSequence` inside the transaction.
- [ ] Buyer data comes from the patient, with optional company fields (CUI, Reg. Com.). The VAT note comes from settings.
- [ ] An optional „încasare imediată” records the payment in the same transaction.
- [ ] The view and the A4 print show the clinic's legal data from settings, with `[de completat]` placeholders visibly flagged.
- [ ] The e-Factura status is shown, with a disabled send button under the `none` provider.
- [ ] Cancelling (ADMIN, with a reason) sets ANULATA. Its payments are detached and become credit on account.

*Payments*
- [ ] Recorded against an invoice or on account; methods NUMERAR, CARD and TRANSFER.
- [ ] Cash gets a `DAC` receipt number. Partial payments work.
- [ ] `amountPaid` is recomputed in the transaction.
- [ ] Cancellation is ADMIN only.
- [ ] `getPatientBalance` and `totals.ts` are unit-tested.
- [ ] The patient tab lists invoices, payments and the balance.
- [ ] The Încasări journal shows totals per day, location and method, respects the clinic scope, and offers a CSV link through WP5's `incasari-metoda` report.

*Catalog*
- [ ] CRUD for categories and services.
- [ ] `PriceInput` accepts „1.200”, „900 / 1.100” and „de la 200”.
- [ ] Duration, unit, `bookableOnline` with `onlineLabel`, `urgent`, `toothSpecific`, `recallMonths` and `publicVisible` are editable.
- [ ] Exactly one representative service per category is enforced.
- [ ] Saving revalidates the public pages (`revalidatePath('/', 'layout')`).

*Staff*
- [ ] Users: list, create (role, home location, initial password with the policy), edit, reset password, deactivate (`sessionVersion++`).
- [ ] An admin cannot deactivate or demote themselves or the last ADMIN.
- [ ] The doctor profile covers slug, public name, role line, photo path, monogram, categories with `showOnSite`, `acceptsOnlineBooking`, `publicVisible` and sort order.
- [ ] Links to „Program” (WP4).

*Locations and settings*
- [ ] Locations: address, phone, maps URL, coordinates, hours (`HoursEditor`), `publishHours`, `sedationUnits`, cabinets CRUD; saving revalidates the site.
- [ ] Settings: one form per key in §7.4, zod-validated, saved through `saveSettings` (audited); ADMIN only.

---

## 12. Integration, definition of done, open items

### 12.1 Integration gate

The integrator runs these on the merged tree:
1. `npm ci && npx prisma migrate reset --force` (migrates and seeds)
2. `npm run typecheck && npm run lint && npm test`
3. `npm run build`. The build must succeed with no type errors.
4. Smoke script (manual or Playwright, if added later):
   1. Book online on the site, at `/programare`.
   2. Confirm the lead appears in `/crm/cereri` with the tentative appointment in the calendar.
   3. Convert the lead.
   4. Confirm the appointment.
   5. Mark it Sosit, then În tratament, then Finalizat.
   6. Invoice it and record the payment.
   7. Check that the balance is 0, a recall exists if applicable, and the reports show the revenue.
   8. Run `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders` and check that the reminder for tomorrow's appointments is logged.
   9. Open the `/p/[token]` link and cancel.
5. Log in as MEDIC and as RECEPTIE and check the permission matrix in §5.3 screen by screen.

### 12.2 Definition of done (every WP)

- [ ] The files match the WP list. No file outside it was touched.
- [ ] Typecheck, lint and tests pass. Pure logic has unit tests.
- [ ] All UI text is Romanian with correct diacritics: no cedilla ş ţ, no English leftovers.
- [ ] Every mutation goes through `crmAction` or `publicAction`, with zod and a permission check. Sensitive actions are audited.
- [ ] No PII appears in server logs, and no full Prisma rows reach client components.
- [ ] Keyboard and screen-reader basics are met: labels, focus, `aria-live` for toasts, never colour alone.
- [ ] Empty states and error messages follow design system §12.4.

### 12.3 Open items to confirm with the clinic

These come from design system §14 plus architecture-specific items. The build uses the placeholders or demo values given above until they are answered.
1. **Hours and staffing:** opening hours, real doctor shifts and cabinets per clinic, and how many inhalosedare units each clinic has.
2. **Consultation price:** the price of a general consultation and an implant consultation.
3. **Whitening:** whether whitening at 1.000 lei and Opalescence at 800 lei are the same service.
4. **Legal identity:** legal entity, CUI, Reg. Com. and registered address, for invoices, the T&C and the ANPC footer.
5. **Legal texts:** approval of the T&C, privacy and cookie texts, and of the GDPR consent text version.
6. **Invoicing:** VAT exemption wording, invoice and receipt series, and whether a fiscal receipt (bon fiscal) from the cash register is used alongside our receipts.
7. **SMS:** the provider and sender ID. Whether to send SMS with diacritics (UCS-2, more expensive) or transliterated.
8. **Online booking policy:** confirm that online bookings stay „Programat” until reception calls, the cancellation cutoff (2 h) and the reminder timing (24 h).
9. **Retention:** retention periods for medical records, invoices and unconverted leads (default 180 days), to be confirmed with legal counsel.
10. **Booking eligibility:** which doctors may be booked online for which categories. The non-bold rows in §10.2 are demo assumptions.
