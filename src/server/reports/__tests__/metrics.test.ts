import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp5.db";
});

import type { AppointmentStatus, LeadSource, LeadStatus, PaymentMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { getKpis, getWeeklyVisits, ratio } from "../metrics";
import { filterRange, parseReportFilters, reportAccess, reportsFor, runReport } from "../reports";
import type { ReportFilterValues, ReportSlug } from "../types";

/**
 * Integration test on prisma/test-wp5.db. The fixture lives in one month of a random past year,
 * on two locations of its own, so the report totals can be compared with direct DB sums.
 */

const YEAR = 1990 + Math.floor(Math.random() * 25);
const MONTH = 1 + Math.floor(Math.random() * 12);
const MM = String(MONTH).padStart(2, "0");
const DE = `${YEAR}-${MM}-01`;
const PANA = `${YEAR}-${MM}-${String(new Date(Date.UTC(YEAR, MONTH, 0)).getUTCDate()).padStart(2, "0")}`;
const day = (d: number, minute = 600) => localToUtc(`${YEAR}-${MM}-${String(d).padStart(2, "0")}`, minute);
const NOW = new Date(Date.UTC(YEAR + 1, 0, 15)); // everything in the fixture is in the past
const tag = `met${process.pid}${Date.now().toString(36)}`;

let L1: { id: string; slug: string };
let L2: { id: string; slug: string };
let D1: string;
let D2: string;
let S1: string;
let S2: string;
const patients: string[] = [];
const admin = { role: "ADMIN" as const, doctorId: null };
const reception = { role: "RECEPTIE" as const, doctorId: null };
let medic: { role: "MEDIC"; doctorId: string };

beforeAll(async () => {
  L1 = await prisma.location.create({
    data: { slug: `${tag}-a`, name: "Dental Arena Test A", shortName: "Testești", street: "str. A 1", city: "Testești", phone: "+40265000001", sortOrder: 80 },
    select: { id: true, slug: true },
  });
  L2 = await prisma.location.create({
    data: { slug: `${tag}-b`, name: "Dental Arena Test B", shortName: "Probești", street: "str. B 2", city: "Probești", phone: "+40365000002", sortOrder: 81 },
    select: { id: true, slug: true },
  });
  // A third active location without data: the fixture's two never cover „every location”.
  await prisma.location.create({
    data: { slug: `${tag}-c`, name: "Dental Arena Test C", shortName: "Goalești", street: "str. C 3", city: "Goalești", phone: "+40265000003", sortOrder: 82 },
  });
  D1 = (await prisma.doctor.create({ data: { slug: `${tag}-d1`, firstName: "Ana", lastName: "Unu", publicName: "Dr. Ana Unu", roleLine: "Medic", sortOrder: 1 } })).id;
  D2 = (await prisma.doctor.create({ data: { slug: `${tag}-d2`, firstName: "Ion", lastName: "Doi", publicName: "Dr. Ion Doi", roleLine: "Medic", sortOrder: 2 } })).id;
  medic = { role: "MEDIC", doctorId: D1 };
  const cat = await prisma.serviceCategory.create({ data: { slug: `${tag}-cat`, name: "Implantologie test" } });
  S1 = (await prisma.service.create({ data: { categoryId: cat.id, code: `${tag}-S1`.toUpperCase(), name: "Implant test" } })).id;
  S2 = (await prisma.service.create({ data: { categoryId: cat.id, code: `${tag}-S2`.toUpperCase(), name: "Detartraj test" } })).id;

  let fileNumber = 800_000 + Math.floor(Math.random() * 99_000);
  for (let i = 0; i < 4; i++) {
    fileNumber += 1;
    const p = await prisma.patient.create({
      data: {
        fileNumber,
        firstName: "Pacient",
        lastName: `${i}`,
        searchText: `pacient ${i}`,
        preferredLocationId: i < 3 ? L1.id : L2.id,
        primaryDoctorId: i < 2 ? D1 : D2,
        createdAt: day(3 + i),
      },
    });
    patients.push(p.id);
  }

  // Appointments: D1 at L1, D2 at L1 and L2. One outside the month must never count.
  const appts: [string, string, AppointmentStatus, number, "ONLINE" | "TELEFON"][] = [
    [D1, L1.id, "FINALIZAT", 2, "TELEFON"],
    [D1, L1.id, "FINALIZAT", 3, "ONLINE"],
    [D1, L1.id, "NEPREZENTAT", 4, "TELEFON"],
    [D1, L1.id, "ANULAT", 5, "TELEFON"],
    [D1, L1.id, "SOSIT", 6, "TELEFON"],
    [D2, L1.id, "FINALIZAT", 7, "TELEFON"],
    [D2, L1.id, "NEPREZENTAT", 8, "ONLINE"],
    [D2, L2.id, "FINALIZAT", 9, "TELEFON"],
    [D2, L2.id, "CONFIRMAT", 10, "TELEFON"],
    [D2, L2.id, "PROGRAMAT", 11, "ONLINE"],
  ];
  for (const [doctorId, locationId, status, d, source] of appts) {
    await prisma.appointment.create({
      data: { doctorId, locationId, status, source, patientId: patients[0], startsAt: day(d), endsAt: day(d, 630) },
    });
  }
  await prisma.appointment.create({
    data: { doctorId: D1, locationId: L1.id, status: "FINALIZAT", source: "TELEFON", startsAt: localToUtc(`${YEAR + 1}-01-03`, 600), endsAt: localToUtc(`${YEAR + 1}-01-03`, 630) },
  });

  // Invoices: EMISA ones count, the ANULATA one never does.
  let number = Math.floor(Math.random() * 1_000_000);
  async function invoice(locationId: string, status: "EMISA" | "ANULATA", d: number, items: { doctorId: string | null; serviceId: string | null; total: number; qty?: number; description?: string }[]) {
    number += 1;
    const total = items.reduce((s, i) => s + i.total, 0);
    return prisma.invoice.create({
      data: {
        series: `T${tag}`.slice(0, 12),
        number,
        patientId: patients[0],
        locationId,
        status,
        issuedAt: day(d),
        subtotal: total,
        total,
        buyerName: "Pacient 0",
        items: {
          create: items.map((i) => ({
            doctorId: i.doctorId,
            serviceId: i.serviceId,
            description: i.description ?? "Serviciu",
            quantity: i.qty ?? 1,
            unitPrice: Math.round(i.total / (i.qty ?? 1)),
            total: i.total,
          })),
        },
      },
    });
  }
  const inv1 = await invoice(L1.id, "EMISA", 2, [
    { doctorId: D1, serviceId: S1, total: 220000 },
    { doctorId: D1, serviceId: S2, total: 25000 },
  ]);
  const inv2 = await invoice(L1.id, "EMISA", 7, [{ doctorId: D2, serviceId: S2, total: 25000 }]);
  const inv3 = await invoice(L2.id, "EMISA", 9, [
    { doctorId: D2, serviceId: S2, total: 50000, qty: 2 },
    { doctorId: null, serviceId: null, total: 12050, description: "Radiografie" },
  ]);
  await invoice(L1.id, "ANULATA", 12, [{ doctorId: D1, serviceId: S1, total: 999900 }]);

  const pays: [string, string | null, number, PaymentMethod, number, boolean][] = [
    [L1.id, inv1.id, 200000, "CARD", 2, false],
    [L1.id, inv1.id, 45000, "NUMERAR", 3, false],
    [L1.id, inv2.id, 25000, "CARD", 7, true], // cancelled
    [L2.id, inv3.id, 62050, "TRANSFER", 9, false],
    [L2.id, null, 10000, "NUMERAR", 10, false], // advance without invoice
  ];
  for (const [locationId, invoiceId, amount, method, d, cancelled] of pays) {
    await prisma.payment.create({
      data: { patientId: patients[0], invoiceId, locationId, amount, method, paidAt: day(d), cancelledAt: cancelled ? day(d + 1) : null },
    });
  }

  const leads: [LeadSource, LeadStatus, boolean, string | null][] = [
    ["PROGRAMARE_ONLINE", "PROGRAMAT", true, L1.id],
    ["PROGRAMARE_ONLINE", "NOU", false, L1.id],
    ["FORMULAR_CONTACT", "PROGRAMAT", false, L2.id],
    ["FORMULAR_CONTACT", "PIERDUT", false, L2.id],
    ["APEL_INVERS", "CONTACTAT", false, null],
  ];
  for (const [source, status, converted, locationId] of leads) {
    await prisma.lead.create({ data: { source, status, name: "Cerere test", locationId, convertedAt: converted ? day(15) : null, createdAt: day(14) } });
  }
});

const filters = (o: Partial<ReportFilterValues> = {}): ReportFilterValues => ({ de: DE, pana: PANA, clinica: "ambele", medic: null, ...o });

/** Runs a report scoped to the fixture's two locations (the „ambele” scope covers every location). */
async function report(slug: ReportSlug, user: { role: "ADMIN" | "MEDIC" | "RECEPTIE"; doctorId: string | null }, f = filters()) {
  return runReport(slug, f, user, { now: NOW });
}

describe("getKpis", () => {
  it("follows the WP5 definitions and equals direct DB sums", async () => {
    const { from, to } = filterRange({ de: DE, pana: PANA });
    const k = await getKpis({ from, to, locationIds: [L1.id, L2.id], now: NOW });
    expect(k).toEqual({
      appointmentsTotal: 10,
      completed: 4,
      noShows: 2,
      cancelled: 1,
      noShowRate: 2 / 7, // NEPREZENTAT ÷ (FINALIZAT 4 + NEPREZENTAT 2 + SOSIT 1)
      revenueInvoiced: 220000 + 25000 + 25000 + 50000 + 12050,
      revenueCollected: 200000 + 45000 + 62050 + 10000,
      newPatients: 4,
      leadsNew: 4, // the lead without a location is outside a two-location scope
      leadsConverted: 2,
      leadConversionRate: 0.5,
    });

    const direct = await prisma.invoiceItem.aggregate({
      _sum: { total: true },
      where: { invoice: { status: "EMISA", issuedAt: { gte: from, lt: to }, locationId: { in: [L1.id, L2.id] } } },
    });
    expect(k.revenueInvoiced).toBe(direct._sum.total);
    const paid = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { cancelledAt: null, paidAt: { gte: from, lt: to }, locationId: { in: [L1.id, L2.id] } },
    });
    expect(k.revenueCollected).toBe(paid._sum.amount);
  });

  it("scopes by location and by doctor", async () => {
    const { from, to } = filterRange({ de: DE, pana: PANA });
    const l2 = await getKpis({ from, to, locationIds: [L2.id], now: NOW });
    expect(l2).toMatchObject({ appointmentsTotal: 3, completed: 1, noShows: 0, noShowRate: 0, revenueInvoiced: 62050, revenueCollected: 72050, newPatients: 1, leadsNew: 2 });
    const d1 = await getKpis({ from, to, locationIds: [L1.id, L2.id], doctorId: D1, now: NOW });
    expect(d1).toMatchObject({ appointmentsTotal: 5, completed: 2, noShows: 1, cancelled: 1, noShowRate: 1 / 4, revenueInvoiced: 245000, newPatients: 2 });
    // Payments carry no doctor: the doctor scope counts payments on invoices with their lines.
    expect(d1.revenueCollected).toBe(245000);
  });

  it("counts only past appointments for the no-show rate and returns null without a denominator", async () => {
    const { from, to } = filterRange({ de: DE, pana: PANA });
    const k = await getKpis({ from, to, locationIds: [L1.id, L2.id], now: day(4, 0) });
    expect(k.noShowRate).toBe(0); // only the two FINALIZAT visits on days 2 and 3 are in the past
    const none = await getKpis({ from, to, locationIds: [L1.id, L2.id], now: day(1) });
    expect(none.noShowRate).toBeNull();
    expect(ratio(1, 0)).toBeNull();
  });
});

describe("reports", () => {
  it("revenue per doctor, service, clinic and month all total the invoiced sum", async () => {
    const expected = 332050;
    for (const slug of ["venit-medic", "venit-serviciu", "venit-clinica", "venit-lunar"] as const) {
      const r = await report(slug, admin);
      const key = r.columns.find((c) => c.kind === "lei")!.key;
      expect(r.totals?.[key], slug).toBe(expected);
      expect(r.rows.reduce((s, row) => s + Number(row[key] ?? 0), 0), slug).toBe(expected);
    }
    const perDoctor = await report("venit-medic", admin);
    expect(perDoctor.rows).toEqual([
      { medic: "Dr. Ana Unu", facturi: 1, linii: 2, venit: 245000 },
      { medic: "Dr. Ion Doi", facturi: 2, linii: 2, venit: 75000 },
      { medic: "Fără medic", facturi: 1, linii: 1, venit: 12050 },
    ]);
    const perClinic = await report("venit-clinica", admin);
    expect(perClinic.rows.filter((r) => r.clinica === "Testești" || r.clinica === "Probești")).toEqual([
      { clinica: "Testești", facturi: 2, facturat: 270000, incasat: 245000 },
      { clinica: "Probești", facturi: 1, facturat: 62050, incasat: 72050 },
    ]);
    const perService = await report("venit-serviciu", admin);
    expect(perService.rows.find((r) => r.serviciu === "Detartraj test")).toMatchObject({ cantitate: 4, venit: 100000 });
    expect(perService.rows.find((r) => r.serviciu === "Radiografie")).toMatchObject({ categorie: "În afara listei de prețuri" });
  });

  it("payments per method exclude cancelled payments", async () => {
    const r = await report("incasari-metoda", admin);
    expect(r.rows.map((x) => [x.metoda, x.incasari, x.suma])).toEqual([
      ["Numerar", 2, 55000],
      ["Card", 1, 200000],
      ["Transfer bancar", 1, 62050],
    ]);
    expect(r.totals).toMatchObject({ incasari: 4, suma: 317050, pondere: 1 });
  });

  it("appointments, no-shows and lead conversion match the fixture", async () => {
    const appts = await report("programari", admin);
    expect(appts.totals).toEqual({ medic: "Total", total: 10, viitoare: 2, efectuate: 5, anulate: 1, neprezentari: 2, online: 3 });
    const noShows = await report("neprezentari", admin);
    expect(noShows.rows).toEqual([
      { medic: "Dr. Ana Unu", trecute: 4, neprezentari: 1, rata: 0.25 },
      { medic: "Dr. Ion Doi", trecute: 3, neprezentari: 1, rata: 1 / 3 },
    ]);
    expect(noShows.totals).toMatchObject({ trecute: 7, neprezentari: 2, rata: 2 / 7 });
    const leads = await report("conversie-cereri", admin);
    expect(leads.rows).toEqual([
      { sursa: "Formular de contact", cereri: 2, convertite: 1, deschise: 0, pierdute: 1, rata: 0.5 },
      { sursa: "Programare online", cereri: 2, convertite: 1, deschise: 1, pierdute: 0, rata: 0.5 },
      { sursa: "Cerere de apel", cereri: 1, convertite: 0, deschise: 1, pierdute: 0, rata: 0 },
    ]);
    expect(leads.totals).toEqual({ sursa: "Total", cereri: 5, convertite: 2, deschise: 2, pierdute: 1, rata: 0.4 });
  });

  it("enforces §5.3: MEDIC sees only their own, RECEPTIE gets no revenue", async () => {
    expect(reportAccess(reception, "venit-medic").allowed).toBe(false);
    expect(reportAccess(reception, "incasari-metoda").allowed).toBe(false);
    expect(reportAccess(reception, "programari")).toEqual({ allowed: true, ownDoctorId: null });
    expect(reportAccess(reception, "conversie-cereri").allowed).toBe(true);
    expect(reportAccess(medic, "conversie-cereri").allowed).toBe(false);
    expect(reportAccess(medic, "incasari-metoda").allowed).toBe(false);
    expect(reportAccess(medic, "venit-medic")).toEqual({ allowed: true, ownDoctorId: D1 });
    expect(reportAccess({ role: "MEDIC", doctorId: null }, "venit-medic").allowed).toBe(false);
    expect(reportsFor(reception).map((r) => r.slug)).toEqual(["programari", "neprezentari", "conversie-cereri"]);
    expect(reportsFor(admin)).toHaveLength(8);

    await expect(report("venit-medic", reception)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // The MEDIC asks for the other doctor and still gets their own figures.
    const own = await report("venit-medic", medic, filters({ medic: D2 }));
    expect(own.filters.medic).toBe(D1);
    expect(own.rows).toEqual([{ medic: "Dr. Ana Unu", facturi: 1, linii: 2, venit: 245000 }]);
    const ownAppts = await report("programari", medic);
    expect(ownAppts.totals).toMatchObject({ total: 5 });
  });
});

describe("filters and chart", () => {
  it("default to the current month and the clinic scope, and survive bad input", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(parseReportFilters({}, { scope: "ludus", now })).toEqual({ de: "2026-10-01", pana: "2026-10-31", clinica: "ludus", medic: null });
    expect(parseReportFilters({ de: "2026-02-10", pana: "x", clinica: "nicaieri", medic: "<script>" }, { scope: "ambele", now })).toEqual({
      de: "2026-02-10",
      pana: "2026-02-28",
      clinica: "ambele",
      medic: null,
    });
    expect(parseReportFilters({ de: "2026-03-31", pana: "2026-03-01" }, { scope: "ambele", now })).toMatchObject({ de: "2026-03-01", pana: "2026-03-31" });
  });

  it("counts visits per week per clinic", async () => {
    const v = await getWeeklyVisits({ weeks: 8, locationIds: [L1.id, L2.id], now: day(28) });
    expect(v.weeks).toHaveLength(8);
    expect(v.series.map((s) => s.label)).toEqual(["Testești", "Probești"]);
    const sum = (i: number) => v.series[i].values.reduce((a, b) => a + b, 0);
    expect(sum(0)).toBe(4); // L1: FINALIZAT ×3, SOSIT ×1
    expect(sum(1)).toBe(1); // L2: FINALIZAT ×1
  });
});
