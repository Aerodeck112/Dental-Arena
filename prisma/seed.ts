import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { cnpHashKey, deriveKey, ipHashKey, parseAesKey } from "../src/lib/crypto";
import { env } from "../src/lib/env";
import { SETTINGS_DEFAULTS, SETTING_KEYS } from "../src/lib/settings-schema";
import { addDaysISO, hhmmToMinutes, localToUtc, todayISO } from "../src/lib/time";
import { seedDemo, type DemoContext, type LocSlug } from "./seed-data/demo";
import { DEMO_HOURS, LOCATIONS } from "./seed-data/locations";
import { createRandom } from "./seed-data/random";
import { CATEGORIES, SERVICES, lei } from "./seed-data/services";
import { DEFAULT_SEED_PASSWORD, DEMO_SHIFTS, DEMO_TIME_OFF, DOCTORS, STAFF_USERS } from "./seed-data/team";

/**
 * Seed (docs/architecture.md §10). Run with `npm run db:seed` (`prisma db seed`).
 *
 * Base data is idempotent: upserts on natural keys that never overwrite what the clinic has
 * edited since. Demo data is created only when SEED_DEMO is not "0" and there are no patients.
 */

const TAGS: readonly { name: string; color: string }[] = [
  { name: "Pacient nou", color: "menta" },
  { name: "Familie", color: "discret" },
  { name: "Ortodonție în curs", color: "menta" },
  { name: "Implant în curs", color: "menta" },
  { name: "Preferă dimineața", color: "discret" },
  { name: "Necesită reconfirmare", color: "discret" },
];

function minutes(hhmm: string): number {
  const m = hhmmToMinutes(hhmm);
  if (m === null) throw new Error(`Oră invalidă în datele de seed: ${hhmm}`);
  return m;
}

function nextOccurrence(today: string, month: number, day: number): string {
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return candidate >= today ? candidate : `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function main() {
  const startedAt = Date.now();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: env.DATABASE_URL }) });
  const password = process.env.SEED_PASSWORD?.trim() || DEFAULT_SEED_PASSWORD;
  const mustChangePassword = env.NODE_ENV === "production";
  const now = new Date();
  const today = todayISO(now);

  try {
    // ── Settings (every key with its defaults; existing values are kept) ──
    for (const key of SETTING_KEYS) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: JSON.stringify(SETTINGS_DEFAULTS[key]) },
        update: {},
      });
    }

    // ── Locations, demo hours, cabinets ──
    const locations = {} as DemoContext["locations"];
    const cabinetIds = new Map<string, string>();
    for (const l of LOCATIONS) {
      const row = await prisma.location.upsert({
        where: { slug: l.slug },
        create: {
          slug: l.slug,
          name: l.name,
          shortName: l.shortName,
          street: l.street,
          city: l.city,
          county: l.county,
          postalCode: l.postalCode,
          phone: l.phone,
          email: l.email,
          mapsUrl: l.mapsUrl,
          latitude: l.latitude,
          longitude: l.longitude,
          publishHours: false,
          sedationUnits: l.sedationUnits,
          sortOrder: l.sortOrder,
        },
        update: {},
      });
      locations[l.slug] = {
        id: row.id,
        slug: l.slug,
        name: row.name,
        shortName: row.shortName,
        phone: row.phone,
        street: row.street,
        city: row.city,
        sedationUnits: row.sedationUnits,
      };
      for (const h of DEMO_HOURS) {
        await prisma.locationHours.upsert({
          where: { locationId_weekday_openMinute: { locationId: row.id, weekday: h.weekday, openMinute: h.openMinute } },
          create: { locationId: row.id, ...h },
          update: {},
        });
      }
      for (const [i, name] of l.cabinets.entries()) {
        const cabinet = await prisma.cabinet.upsert({
          where: { locationId_name: { locationId: row.id, name } },
          create: { locationId: row.id, name, sortOrder: i + 1 },
          update: {},
        });
        cabinetIds.set(`${l.slug}:${name}`, cabinet.id);
      }
    }

    // ── Catalog ──
    const categoryIds = new Map<string, string>();
    for (const c of CATEGORIES) {
      const row = await prisma.serviceCategory.upsert({
        where: { slug: c.slug },
        create: { slug: c.slug, name: c.name, summary: c.summary, sortOrder: c.sortOrder },
        update: {},
      });
      categoryIds.set(c.slug, row.id);
    }
    const services = new Map() as DemoContext["services"];
    const sortInCategory = new Map<string, number>();
    for (const s of SERVICES) {
      const categoryId = categoryIds.get(s.category);
      if (!categoryId) throw new Error(`Categorie necunoscută pentru ${s.code}: ${s.category}`);
      const sortOrder = (sortInCategory.get(s.category) ?? 0) + 1;
      sortInCategory.set(s.category, sortOrder);
      const row = await prisma.service.upsert({
        where: { code: s.code },
        create: {
          code: s.code,
          categoryId,
          name: s.name,
          priceMin: s.price === null ? null : lei(s.price),
          priceMax: s.priceMax === undefined ? null : lei(s.priceMax),
          priceFrom: s.priceFrom ?? false,
          unit: s.unit ?? "ACT",
          durationMinutes: s.durationMinutes,
          bookableOnline: Boolean(s.online),
          onlineLabel: s.online?.label ?? null,
          onlineHint: s.online?.hint ?? null,
          urgent: s.urgent ?? false,
          isRepresentative: s.representative ?? false,
          toothSpecific: s.toothSpecific ?? false,
          recallMonths: s.recallMonths ?? null,
          publicVisible: s.publicVisible ?? true,
          sortOrder,
        },
        update: {},
      });
      services.set(s.code, {
        id: row.id,
        code: s.code,
        name: row.name,
        categorySlug: s.category,
        priceMin: row.priceMin,
        priceMax: row.priceMax,
        unit: row.unit,
        durationMinutes: row.durationMinutes,
        onlineLabel: row.onlineLabel,
      });
    }

    // ── Users and doctors ──
    const passwordHash = await hashPassword(password);
    const users = {} as DemoContext["users"];
    users.receptie = {} as DemoContext["users"]["receptie"];
    for (const u of STAFF_USERS) {
      const row = await prisma.user.upsert({
        where: { email: u.email },
        create: {
          email: u.email,
          passwordHash,
          role: u.role,
          firstName: u.firstName,
          lastName: u.lastName,
          mustChangePassword,
          homeLocationId: u.homeLocation ? locations[u.homeLocation].id : null,
          locations: {
            create: (u.homeLocation ? [locations[u.homeLocation]] : Object.values(locations)).map((l) => ({ locationId: l.id })),
          },
        },
        update: {},
      });
      const info = { id: row.id, name: `${row.firstName} ${row.lastName}` };
      if (u.role === "ADMIN") users.admin = info;
      else if (u.homeLocation) users.receptie[u.homeLocation] = info;
    }

    const doctors = {} as DemoContext["doctors"];
    for (const d of DOCTORS) {
      const user = await prisma.user.upsert({
        where: { email: d.email },
        create: {
          email: d.email,
          passwordHash,
          role: "MEDIC",
          firstName: d.firstName,
          lastName: d.lastName,
          mustChangePassword,
          locations: { create: Object.values(locations).map((l) => ({ locationId: l.id })) },
        },
        update: {},
      });
      const doctor = await prisma.doctor.upsert({
        where: { slug: d.slug },
        create: {
          slug: d.slug,
          userId: user.id,
          firstName: d.firstName,
          lastName: d.lastName,
          publicName: d.publicName,
          roleLine: d.roleLine,
          photoPath: d.photoPath,
          monogram: d.monogram,
          sortOrder: d.sortOrder,
        },
        update: {},
      });
      for (const c of d.categories) {
        const categoryId = categoryIds.get(c.slug);
        if (!categoryId) throw new Error(`Categorie necunoscută pentru ${d.slug}: ${c.slug}`);
        await prisma.doctorCategory.upsert({
          where: { doctorId_categoryId: { doctorId: doctor.id, categoryId } },
          create: { doctorId: doctor.id, categoryId, showOnSite: c.showOnSite },
          update: {},
        });
      }
      doctors[d.slug] = {
        id: doctor.id,
        slug: d.slug,
        publicName: doctor.publicName,
        lastName: doctor.lastName,
        categories: new Set(d.categories.map((c) => c.slug)),
        userId: doctor.userId ?? user.id,
      };
    }

    // ── Demo shifts („program demonstrativ”), only for doctors without any shift yet ──
    for (const s of DEMO_SHIFTS) {
      const doctorId = doctors[s.doctor].id;
      const locationId = locations[s.location].id;
      const existing = await prisma.workShift.count({ where: { doctorId, locationId } });
      if (existing > 0) continue;
      for (const weekday of s.weekdays) {
        await prisma.workShift.create({
          data: {
            doctorId,
            locationId,
            cabinetId: cabinetIds.get(`${s.location}:${s.cabinet}`) ?? null,
            weekday,
            startMinute: minutes(s.start),
            endMinute: minutes(s.end),
            onlineBooking: true,
            breaks: {
              create: s.breaks.map((b) => ({ startMinute: minutes(b.start), endMinute: minutes(b.end), label: b.label })),
            },
          },
        });
      }
    }

    // No two shifts may share a cabinet at the same time (§10.2).
    const allShifts = await prisma.workShift.findMany({ include: { breaks: true } });
    for (let i = 0; i < allShifts.length; i += 1) {
      for (let j = i + 1; j < allShifts.length; j += 1) {
        const a = allShifts[i];
        const b = allShifts[j];
        const sameDay = a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
        if (sameDay && a.cabinetId && a.cabinetId === b.cabinetId) {
          throw new Error(`Două ture folosesc același cabinet în aceeași zi (${a.weekday}).`);
        }
        if (sameDay && a.doctorId === b.doctorId) {
          throw new Error(`Un medic are două ture suprapuse în ziua ${a.weekday}.`);
        }
      }
    }

    // ── Time off: Fertea on leave in 10 days, 1 December closure at both clinics ──
    if ((await prisma.timeOff.count()) === 0) {
      for (const t of DEMO_TIME_OFF) {
        const from = t.nextMonthDay ? nextOccurrence(today, t.nextMonthDay.month, t.nextMonthDay.day) : addDaysISO(today, t.fromDayOffset ?? 0);
        await prisma.timeOff.create({
          data: {
            doctorId: t.doctor ? doctors[t.doctor].id : null,
            locationId: t.location ? locations[t.location].id : null,
            kind: t.kind,
            startsAt: localToUtc(from, 0),
            endsAt: localToUtc(addDaysISO(from, t.days), 0),
            reason: t.reason,
            createdById: users.admin.id,
          },
        });
      }
    }

    // ── Tags ──
    const tags = new Map<string, string>();
    for (const t of TAGS) {
      const row = await prisma.tag.upsert({ where: { name: t.name }, create: t, update: {} });
      tags.set(t.name, row.id);
    }

    // ── Demo data ──
    let demo: Record<string, number> | null = null;
    const demoEnabled = process.env.SEED_DEMO !== "0";
    const patientCount = await prisma.patient.count();
    if (demoEnabled && patientCount === 0) {
      const shifts = (await prisma.workShift.findMany({ include: { breaks: true, doctor: true, location: true } })).map((s) => ({
        doctorSlug: s.doctor.slug,
        doctorId: s.doctorId,
        loc: s.location.slug as LocSlug,
        locationId: s.locationId,
        weekday: s.weekday,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
        cabinetId: s.cabinetId,
        breaks: s.breaks.map((b) => ({ startMinute: b.startMinute, endMinute: b.endMinute })),
      }));
      const timeOff = (await prisma.timeOff.findMany()).map((t) => ({
        doctorId: t.doctorId,
        locationId: t.locationId,
        start: t.startsAt.getTime(),
        end: t.endsAt.getTime(),
      }));
      const piiKey = parseAesKey(env.PII_ENCRYPTION_KEY);
      demo = await seedDemo({
        db: prisma,
        random: createRandom(),
        now,
        today,
        locations,
        doctors,
        services,
        users,
        tags,
        shifts,
        timeOff,
        keys: {
          pii: piiKey,
          cnpHash: cnpHashKey(piiKey),
          link: deriveKey(env.AUTH_SECRET, "apt-link"),
          ipHash: ipHashKey(env.AUTH_SECRET),
        },
        appUrl: env.APP_URL,
        consentTextVersion: SETTINGS_DEFAULTS.gdpr.consentTextVersion,
        invoiceSeries: SETTINGS_DEFAULTS.invoicing.invoiceSeries,
        receiptSeries: SETTINGS_DEFAULTS.invoicing.receiptSeries,
      });
    }

    // ── Summary ──
    const counts = {
      Locații: await prisma.location.count(),
      Cabinete: await prisma.cabinet.count(),
      Utilizatori: await prisma.user.count(),
      Medici: await prisma.doctor.count(),
      "Categorii de servicii": await prisma.serviceCategory.count(),
      Servicii: await prisma.service.count(),
      "Ture (program demonstrativ)": await prisma.workShift.count(),
      Absențe: await prisma.timeOff.count(),
      Setări: await prisma.setting.count(),
      Etichete: await prisma.tag.count(),
      Pacienți: await prisma.patient.count(),
      Programări: await prisma.appointment.count(),
      Cereri: await prisma.lead.count(),
      Rechemări: await prisma.recall.count(),
      Facturi: await prisma.invoice.count(),
      Încasări: await prisma.payment.count(),
      "Planuri de tratament": await prisma.treatmentPlan.count(),
      "Jurnal mesaje": await prisma.messageLog.count(),
      "Jurnal audit": await prisma.auditLog.count(),
    };
    console.log("\nDental Arena: seed finalizat în", `${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
    console.table(counts);
    if (demo) console.log("Date demonstrative create:", demo);
    else if (!demoEnabled) console.log("Date demonstrative: dezactivate (SEED_DEMO=0).");
    else console.log(`Date demonstrative: omise, există deja ${patientCount} pacienți.`);

    console.log("\nConturi de test (parola pentru toate):", password);
    console.table([
      { rol: "ADMIN", email: "admin@dentalarena.ro" },
      { rol: "RECEPTIE", email: "receptie.cristesti@dentalarena.ro" },
      { rol: "RECEPTIE", email: "receptie.ludus@dentalarena.ro" },
      ...DOCTORS.map((d) => ({ rol: "MEDIC", email: d.email })),
    ]);
    if (mustChangePassword) console.log("Producție: fiecare cont trebuie să-și schimbe parola la prima autentificare.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error("Seed eșuat:", e instanceof Error ? e.message : e);
  if (e instanceof Error && e.stack) console.error(e.stack.split("\n").slice(1, 8).join("\n"));
  process.exit(1);
});
