import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { prisma, type Db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { formatDateRo } from "@/lib/format";
import { LEAD_SOURCE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { isValidDateISO, localDayRangeUtc, todayISO, utcToLocal } from "@/lib/time";
import { ATTENDED_STATUSES, effectiveLocationIds, ratio } from "./metrics";
import {
  REPORT_SLUGS,
  type ReportFilterValues,
  type ReportInfo,
  type ReportResult,
  type ReportRow,
  type ReportSlug,
} from "./types";

/**
 * Rapoarte (docs/architecture.md §5.3). Each report is a plain table with a totals row; the same
 * result feeds the page and the CSV export. Permissions are enforced here, not only in the UI:
 * a MEDIC with only `reports.viewOwn` always gets their own doctor's figures.
 */

export const REPORTS: Record<ReportSlug, ReportInfo> = {
  "venit-medic": {
    slug: "venit-medic",
    title: "Venit pe medic",
    description: "Sumele facturate pe fiecare medic, din liniile facturilor emise.",
    group: "venit",
  },
  "venit-serviciu": {
    slug: "venit-serviciu",
    title: "Venit pe serviciu",
    description: "Ce servicii s-au facturat, în ce cantitate și pentru ce sumă.",
    group: "venit",
  },
  "venit-clinica": {
    slug: "venit-clinica",
    title: "Venit pe clinică",
    description: "Facturat și încasat la Cristești și la Luduș.",
    group: "venit",
  },
  "venit-lunar": {
    slug: "venit-lunar",
    title: "Venit lunar",
    description: "Facturat și încasat, lună cu lună.",
    group: "venit",
  },
  "incasari-metoda": {
    slug: "incasari-metoda",
    title: "Încasări pe metodă de plată",
    description: "Numerar, card și transfer bancar.",
    group: "venit",
  },
  programari: {
    slug: "programari",
    title: "Programări",
    description: "Programările pe medic, după status.",
    group: "operational",
  },
  neprezentari: {
    slug: "neprezentari",
    title: "Neprezentări",
    description: "Pacienții care nu au venit, din programările trecute.",
    group: "operational",
  },
  "conversie-cereri": {
    slug: "conversie-cereri",
    title: "Conversia cererilor",
    description: "Câte cereri din site și de la telefon au devenit programări.",
    group: "operational",
  },
};

// ─────────────────────────────── access ───────────────────────────────

export type ReportAccess = { allowed: boolean; ownDoctorId: string | null };

/**
 * Who may open a report (§5.3). `ownDoctorId` is set when the user may see only their own figures
 * (`reports.viewOwn` without a wider permission); every query is then filtered by it.
 */
export function reportAccess(user: Pick<CurrentUser, "role" | "doctorId">, slug: ReportSlug): ReportAccess {
  const own = can(user, "reports.viewOwn") && user.doctorId ? { allowed: true, ownDoctorId: user.doctorId } : null;
  const denied = { allowed: false, ownDoctorId: null };
  switch (slug) {
    case "venit-medic":
    case "venit-serviciu":
    case "venit-clinica":
    case "venit-lunar":
      if (can(user, "reports.view")) return { allowed: true, ownDoctorId: null };
      return own ?? denied;
    case "programari":
    case "neprezentari":
      if (can(user, ["reports.view", "reports.operational"])) return { allowed: true, ownDoctorId: null };
      return own ?? denied;
    case "conversie-cereri":
      return can(user, "reports.operational") ? { allowed: true, ownDoctorId: null } : denied;
    case "incasari-metoda":
      return can(user, "reports.view") ? { allowed: true, ownDoctorId: null } : denied;
  }
}

/** Reports the user may open, in catalogue order. */
export function reportsFor(user: Pick<CurrentUser, "role" | "doctorId">): (ReportInfo & { ownOnly: boolean })[] {
  return REPORT_SLUGS.map((slug) => ({ slug, access: reportAccess(user, slug) }))
    .filter((r) => r.access.allowed)
    .map((r) => ({ ...REPORTS[r.slug], ownOnly: r.access.ownDoctorId !== null }));
}

// ─────────────────────────────── filters ───────────────────────────────

const SCOPES = ["cristesti", "ludus", "ambele"] as const;
const MAX_RANGE_DAYS = 3 * 366;

function firstOfMonth(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

function lastOfMonth(dateISO: string): string {
  const [y, m] = dateISO.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${dateISO.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/**
 * URL params → filters. Defaults: the current month and the user's clinic scope. Invalid values
 * fall back to the defaults instead of failing.
 */
export function parseReportFilters(
  params: Record<string, string | string[] | undefined>,
  defaults: { scope: ReportFilterValues["clinica"]; now?: Date },
): ReportFilterValues {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const today = todayISO(defaults.now ?? new Date());
  let de = one("de");
  let pana = one("pana");
  if (!de || !isValidDateISO(de)) de = firstOfMonth(today);
  if (!pana || !isValidDateISO(pana)) pana = lastOfMonth(de);
  if (pana < de) [de, pana] = [pana, de];
  const span = (Date.parse(pana) - Date.parse(de)) / 86_400_000;
  if (span > MAX_RANGE_DAYS) pana = lastOfMonth(de);
  const clinica = one("clinica");
  const medic = one("medic");
  return {
    de,
    pana,
    clinica: SCOPES.includes(clinica as (typeof SCOPES)[number]) ? (clinica as ReportFilterValues["clinica"]) : defaults.scope,
    medic: medic && /^[a-z0-9]{8,40}$/i.test(medic) ? medic : null,
  };
}

/** `[from, to)` in UTC for the inclusive local days `de`…`pana`. */
export function filterRange(f: Pick<ReportFilterValues, "de" | "pana">): { from: Date; to: Date } {
  return { from: localDayRangeUtc(f.de).start, to: localDayRangeUtc(f.pana).end };
}

// ─────────────────────────────── computing ───────────────────────────────

type Scope = { from: Date; to: Date; loc: string[] | undefined; doctorId: string | undefined };

async function resolveScope(f: ReportFilterValues, db: Db): Promise<Scope & { scopeLabel: string }> {
  const { from, to } = filterRange(f);
  const locations = await db.location.findMany({
    where: { active: true },
    select: { id: true, slug: true, shortName: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const picked = f.clinica === "ambele" ? locations : locations.filter((l) => l.slug === f.clinica);
  const loc = await effectiveLocationIds(
    picked.map((l) => l.id),
    db,
  );
  let doctorLabel = "toți medicii";
  if (f.medic) {
    const d = await db.doctor.findUnique({ where: { id: f.medic }, select: { publicName: true } });
    doctorLabel = d?.publicName ?? "medic necunoscut";
  }
  const clinicLabel = f.clinica === "ambele" ? "ambele clinici" : (picked[0]?.shortName ?? f.clinica);
  const period =
    f.de === f.pana ? formatDateRo(f.de, "short") : `${formatDateRo(f.de, "short")}–${formatDateRo(f.pana, "short")}`;
  return {
    from,
    to,
    loc: picked.length === 0 ? [] : loc,
    doctorId: f.medic ?? undefined,
    scopeLabel: `${period}, ${clinicLabel}, ${doctorLabel}`,
  };
}

const locIn = (loc: string[] | undefined) => (loc ? { in: loc } : undefined);

function sumBy<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((s, r) => s + f(r), 0);
}

async function invoiceLines(s: Scope, db: Db) {
  return db.invoiceItem.findMany({
    where: {
      invoice: { status: "EMISA", issuedAt: { gte: s.from, lt: s.to }, ...(s.loc ? { locationId: locIn(s.loc) } : {}) },
      ...(s.doctorId ? { doctorId: s.doctorId } : {}),
    },
    select: {
      total: true,
      quantity: true,
      invoiceId: true,
      doctorId: true,
      serviceId: true,
      description: true,
      doctor: { select: { publicName: true } },
      service: { select: { name: true, category: { select: { name: true } } } },
      invoice: { select: { issuedAt: true, locationId: true } },
    },
  });
}

async function payments(s: Scope, db: Db) {
  return db.payment.findMany({
    where: {
      cancelledAt: null,
      paidAt: { gte: s.from, lt: s.to },
      ...(s.loc ? { locationId: locIn(s.loc) } : {}),
      ...(s.doctorId ? { invoice: { items: { some: { doctorId: s.doctorId } } } } : {}),
    },
    select: { amount: true, method: true, paidAt: true, locationId: true },
  });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const names = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];
  return `${names[m - 1]} ${y}`;
}

type Table = Pick<ReportResult, "columns" | "rows" | "totals">;

async function compute(slug: ReportSlug, s: Scope, db: Db, now: Date): Promise<Table> {
  switch (slug) {
    case "venit-medic": {
      const lines = await invoiceLines(s, db);
      const groups = new Map<string, { name: string; lines: number; invoices: Set<string>; total: number }>();
      for (const l of lines) {
        const key = l.doctorId ?? "-";
        const g = groups.get(key) ?? { name: l.doctor?.publicName ?? "Fără medic", lines: 0, invoices: new Set<string>(), total: 0 };
        g.lines += 1;
        g.invoices.add(l.invoiceId);
        g.total += l.total;
        groups.set(key, g);
      }
      const rows = [...groups.values()]
        .sort((a, b) => b.total - a.total)
        .map((g) => ({ medic: g.name, facturi: g.invoices.size, linii: g.lines, venit: g.total }));
      return {
        columns: [
          { key: "medic", label: "Medic", kind: "text" },
          { key: "facturi", label: "Facturi", kind: "int" },
          { key: "linii", label: "Servicii facturate", kind: "int" },
          { key: "venit", label: "Venit facturat", kind: "lei" },
        ],
        rows,
        totals: { medic: "Total", facturi: new Set(lines.map((l) => l.invoiceId)).size, linii: lines.length, venit: sumBy(lines, (l) => l.total) },
      };
    }
    case "venit-serviciu": {
      const lines = await invoiceLines(s, db);
      const groups = new Map<string, { name: string; category: string; qty: number; total: number }>();
      for (const l of lines) {
        const key = l.serviceId ?? `text:${l.description}`;
        const g = groups.get(key) ?? {
          name: l.service?.name ?? l.description,
          category: l.service?.category.name ?? "În afara listei de prețuri",
          qty: 0,
          total: 0,
        };
        g.qty += l.quantity;
        g.total += l.total;
        groups.set(key, g);
      }
      const rows = [...groups.values()]
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ro"))
        .map((g) => ({ serviciu: g.name, categorie: g.category, cantitate: g.qty, venit: g.total }));
      return {
        columns: [
          { key: "serviciu", label: "Serviciu", kind: "text" },
          { key: "categorie", label: "Categorie", kind: "text" },
          { key: "cantitate", label: "Cantitate", kind: "int" },
          { key: "venit", label: "Venit facturat", kind: "lei" },
        ],
        rows,
        totals: { serviciu: "Total", categorie: null, cantitate: sumBy(lines, (l) => l.quantity), venit: sumBy(lines, (l) => l.total) },
      };
    }
    case "venit-clinica": {
      const [lines, pays, locations] = await Promise.all([
        invoiceLines(s, db),
        payments(s, db),
        db.location.findMany({
          where: { active: true, ...(s.loc ? { id: locIn(s.loc) } : {}) },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, shortName: true },
        }),
      ]);
      const rows: ReportRow[] = locations.map((loc) => {
        const ls = lines.filter((l) => l.invoice.locationId === loc.id);
        return {
          clinica: loc.shortName,
          facturi: new Set(ls.map((l) => l.invoiceId)).size,
          facturat: sumBy(ls, (l) => l.total),
          incasat: sumBy(
            pays.filter((p) => p.locationId === loc.id),
            (p) => p.amount,
          ),
        };
      });
      return {
        columns: [
          { key: "clinica", label: "Clinica", kind: "text" },
          { key: "facturi", label: "Facturi", kind: "int" },
          { key: "facturat", label: "Facturat", kind: "lei" },
          { key: "incasat", label: "Încasat", kind: "lei" },
        ],
        rows,
        totals: {
          clinica: "Total",
          facturi: new Set(lines.map((l) => l.invoiceId)).size,
          facturat: sumBy(lines, (l) => l.total),
          incasat: sumBy(pays, (p) => p.amount),
        },
      };
    }
    case "venit-lunar": {
      const [lines, pays] = await Promise.all([invoiceLines(s, db), payments(s, db)]);
      const months = new Map<string, { facturat: number; incasat: number; invoices: Set<string> }>();
      const bucket = (d: Date) => {
        const ym = utcToLocal(d).dateISO.slice(0, 7);
        const m = months.get(ym) ?? { facturat: 0, incasat: 0, invoices: new Set<string>() };
        months.set(ym, m);
        return m;
      };
      for (const l of lines) {
        const m = bucket(l.invoice.issuedAt);
        m.facturat += l.total;
        m.invoices.add(l.invoiceId);
      }
      for (const p of pays) bucket(p.paidAt).incasat += p.amount;
      const rows = [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ym, m]) => ({ luna: monthLabel(ym), facturi: m.invoices.size, facturat: m.facturat, incasat: m.incasat }));
      return {
        columns: [
          { key: "luna", label: "Luna", kind: "text" },
          { key: "facturi", label: "Facturi", kind: "int" },
          { key: "facturat", label: "Facturat", kind: "lei" },
          { key: "incasat", label: "Încasat", kind: "lei" },
        ],
        rows,
        totals: {
          luna: "Total",
          facturi: new Set(lines.map((l) => l.invoiceId)).size,
          facturat: sumBy(lines, (l) => l.total),
          incasat: sumBy(pays, (p) => p.amount),
        },
      };
    }
    case "incasari-metoda": {
      const pays = await payments(s, db);
      const methods = ["NUMERAR", "CARD", "TRANSFER"] as const;
      const total = sumBy(pays, (p) => p.amount);
      const rows = methods.map((m) => {
        const ps = pays.filter((p) => p.method === m);
        const sum = sumBy(ps, (p) => p.amount);
        return { metoda: PAYMENT_METHOD_LABEL[m], incasari: ps.length, suma: sum, pondere: ratio(sum, total) };
      });
      return {
        columns: [
          { key: "metoda", label: "Metodă de plată", kind: "text" },
          { key: "incasari", label: "Încasări", kind: "int" },
          { key: "suma", label: "Sumă", kind: "lei" },
          { key: "pondere", label: "Pondere", kind: "percent" },
        ],
        rows,
        totals: { metoda: "Total", incasari: pays.length, suma: total, pondere: total > 0 ? 1 : null },
      };
    }
    case "programari": {
      const appts = await db.appointment.findMany({
        where: {
          startsAt: { gte: s.from, lt: s.to },
          ...(s.loc ? { locationId: locIn(s.loc) } : {}),
          ...(s.doctorId ? { doctorId: s.doctorId } : {}),
        },
        select: { status: true, source: true, doctorId: true, doctor: { select: { publicName: true, sortOrder: true } } },
      });
      type G = { name: string; order: number; total: number; viitoare: number; efectuate: number; anulate: number; neprezentari: number; online: number };
      const groups = new Map<string, G>();
      const add = (g: G, a: (typeof appts)[number]) => {
        g.total += 1;
        if (a.status === "PROGRAMAT" || a.status === "CONFIRMAT") g.viitoare += 1;
        if ((ATTENDED_STATUSES as readonly string[]).includes(a.status)) g.efectuate += 1;
        if (a.status === "ANULAT") g.anulate += 1;
        if (a.status === "NEPREZENTAT") g.neprezentari += 1;
        if (a.source === "ONLINE") g.online += 1;
      };
      const totals: G = { name: "Total", order: 0, total: 0, viitoare: 0, efectuate: 0, anulate: 0, neprezentari: 0, online: 0 };
      for (const a of appts) {
        const g = groups.get(a.doctorId) ?? { name: a.doctor.publicName, order: a.doctor.sortOrder, total: 0, viitoare: 0, efectuate: 0, anulate: 0, neprezentari: 0, online: 0 };
        add(g, a);
        add(totals, a);
        groups.set(a.doctorId, g);
      }
      const toRow = (g: G): ReportRow => ({
        medic: g.name,
        total: g.total,
        viitoare: g.viitoare,
        efectuate: g.efectuate,
        anulate: g.anulate,
        neprezentari: g.neprezentari,
        online: g.online,
      });
      return {
        columns: [
          { key: "medic", label: "Medic", kind: "text" },
          { key: "total", label: "Total", kind: "int" },
          { key: "viitoare", label: "Programat sau confirmat", kind: "int" },
          { key: "efectuate", label: "Efectuate", kind: "int" },
          { key: "anulate", label: "Anulate", kind: "int" },
          { key: "neprezentari", label: "Neprezentări", kind: "int" },
          { key: "online", label: "Din site", kind: "int" },
        ],
        rows: [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ro")).map(toRow),
        totals: toRow(totals),
      };
    }
    case "neprezentari": {
      const appts = await db.appointment.findMany({
        where: {
          startsAt: { gte: s.from, lt: s.to.getTime() < now.getTime() ? s.to : now },
          status: { in: [...ATTENDED_STATUSES, "NEPREZENTAT"] },
          ...(s.loc ? { locationId: locIn(s.loc) } : {}),
          ...(s.doctorId ? { doctorId: s.doctorId } : {}),
        },
        select: { status: true, doctorId: true, doctor: { select: { publicName: true, sortOrder: true } } },
      });
      type G = { name: string; order: number; past: number; noShows: number };
      const groups = new Map<string, G>();
      for (const a of appts) {
        const g = groups.get(a.doctorId) ?? { name: a.doctor.publicName, order: a.doctor.sortOrder, past: 0, noShows: 0 };
        g.past += 1;
        if (a.status === "NEPREZENTAT") g.noShows += 1;
        groups.set(a.doctorId, g);
      }
      const noShows = appts.filter((a) => a.status === "NEPREZENTAT").length;
      return {
        columns: [
          { key: "medic", label: "Medic", kind: "text" },
          { key: "trecute", label: "Programări trecute", kind: "int" },
          { key: "neprezentari", label: "Neprezentări", kind: "int" },
          { key: "rata", label: "Rata neprezentărilor", kind: "percent" },
        ],
        rows: [...groups.values()]
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ro"))
          .map((g) => ({ medic: g.name, trecute: g.past, neprezentari: g.noShows, rata: ratio(g.noShows, g.past) })),
        totals: { medic: "Total", trecute: appts.length, neprezentari: noShows, rata: ratio(noShows, appts.length) },
      };
    }
    case "conversie-cereri": {
      const leads = await db.lead.findMany({
        where: { createdAt: { gte: s.from, lt: s.to }, ...(s.loc ? { locationId: locIn(s.loc) } : {}) },
        select: { source: true, status: true, convertedAt: true },
      });
      const converted = (l: (typeof leads)[number]) => l.convertedAt !== null || l.status === "PROGRAMAT";
      const sources = Object.keys(LEAD_SOURCE_LABEL) as (keyof typeof LEAD_SOURCE_LABEL)[];
      const rows = sources
        .map((src) => {
          const ls = leads.filter((l) => l.source === src);
          const c = ls.filter(converted).length;
          return {
            sursa: LEAD_SOURCE_LABEL[src],
            cereri: ls.length,
            convertite: c,
            deschise: ls.filter((l) => !converted(l) && (l.status === "NOU" || l.status === "CONTACTAT")).length,
            pierdute: ls.filter((l) => !converted(l) && l.status === "PIERDUT").length,
            rata: ratio(c, ls.length),
          };
        })
        .filter((r) => r.cereri > 0);
      const c = leads.filter(converted).length;
      return {
        columns: [
          { key: "sursa", label: "Sursa", kind: "text" },
          { key: "cereri", label: "Cereri", kind: "int" },
          { key: "convertite", label: "Programate", kind: "int" },
          { key: "deschise", label: "În lucru", kind: "int" },
          { key: "pierdute", label: "Pierdute", kind: "int" },
          { key: "rata", label: "Rata de conversie", kind: "percent" },
        ],
        rows,
        totals: {
          sursa: "Total",
          cereri: leads.length,
          convertite: c,
          deschise: sumBy(rows, (r) => r.deschise),
          pierdute: sumBy(rows, (r) => r.pierdute),
          rata: ratio(c, leads.length),
        },
      };
    }
  }
}

/**
 * Runs one report for a user. Throws `FORBIDDEN` when the user may not open it; a MEDIC limited to
 * their own figures gets `medic` forced to their doctor.
 */
export async function runReport(
  slug: ReportSlug,
  filters: ReportFilterValues,
  user: Pick<CurrentUser, "role" | "doctorId">,
  o: { db?: Db; now?: Date } = {},
): Promise<ReportResult> {
  const db = o.db ?? prisma;
  const access = reportAccess(user, slug);
  if (!access.allowed) throw new DomainError("FORBIDDEN");
  const f: ReportFilterValues = access.ownDoctorId ? { ...filters, medic: access.ownDoctorId } : filters;
  const scope = await resolveScope(f, db);
  const table = await compute(slug, scope, db, o.now ?? new Date());
  const info = REPORTS[slug];
  return { slug, title: info.title, description: info.description, ...table, scopeLabel: scope.scopeLabel, filters: f };
}

/** Period shortcuts above the filters: this month, last month, the last 3 months, this year. */
export function periodPresets(now: Date = new Date()): { label: string; de: string; pana: string }[] {
  const today = todayISO(now);
  const thisMonth = firstOfMonth(today);
  const [y, m] = today.split("-").map(Number);
  const monthStart = (yy: number, mm: number) => {
    const d = new Date(Date.UTC(yy, mm - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  };
  const lastMonth = monthStart(y, m - 1);
  return [
    { label: "Luna aceasta", de: thisMonth, pana: lastOfMonth(thisMonth) },
    { label: "Luna trecută", de: lastMonth, pana: lastOfMonth(lastMonth) },
    { label: "Ultimele 3 luni", de: monthStart(y, m - 2), pana: lastOfMonth(thisMonth) },
    { label: `Anul ${y}`, de: `${y}-01-01`, pana: `${y}-12-31` },
  ];
}

/** Doctors for the „Medic” filter (active ones, in display order). */
export async function reportDoctors(db: Db = prisma): Promise<{ id: string; name: string }[]> {
  const rows = await db.doctor.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }],
    select: { id: true, publicName: true },
  });
  return rows.map((d) => ({ id: d.id, name: d.publicName }));
}
