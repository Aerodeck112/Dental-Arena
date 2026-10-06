import "server-only";
import { prisma, type Db } from "@/lib/db";
import { addDaysISO, localDayRangeUtc, startOfWeekISO, todayISO, utcToLocal } from "@/lib/time";
import type { WeeklyVisits } from "./types";

/**
 * KPI service (docs/architecture.md §7.3, WP5 KPI definitions). Every figure is for appointments
 * or documents in `[from, to)`, scoped by location and doctor. Money is in bani.
 */

export type Kpis = {
  appointmentsTotal: number;
  completed: number;
  noShows: number;
  cancelled: number;
  noShowRate: number | null;
  revenueInvoiced: number;
  revenueCollected: number;
  newPatients: number;
  leadsNew: number;
  leadsConverted: number;
  leadConversionRate: number | null;
};

export type KpiFilter = { from: Date; to: Date; locationIds?: string[]; doctorId?: string | null; now?: Date };

/** Statuses that count as „came” for the no-show denominator. */
export const ATTENDED_STATUSES = ["FINALIZAT", "SOSIT", "IN_TRATAMENT"] as const;

/**
 * `undefined` when the ids cover every active location (or none were given), so records without
 * a location (a lead from the contact form, a patient without a preferred clinic) still count in
 * the „Ambele” scope.
 */
export async function effectiveLocationIds(locationIds: string[] | undefined, db: Db = prisma): Promise<string[] | undefined> {
  if (!locationIds) return undefined;
  const active = await db.location.findMany({ where: { active: true }, select: { id: true } });
  const all = active.every((l) => locationIds.includes(l.id));
  return all ? undefined : locationIds;
}

/** a ÷ b, or null when b is 0. */
export function ratio(a: number, b: number): number | null {
  return b === 0 ? null : a / b;
}

export async function getKpis(f: KpiFilter, db: Db = prisma): Promise<Kpis> {
  const now = f.now ?? new Date();
  const loc = await effectiveLocationIds(f.locationIds, db);
  const doctorId = f.doctorId ?? undefined;
  const range = { gte: f.from, lt: f.to };

  const apptWhere = {
    startsAt: range,
    ...(loc ? { locationId: { in: loc } } : {}),
    ...(doctorId ? { doctorId } : {}),
  };

  const [byStatus, pastByStatus, invoiced, collected, newPatients, leadsNew, leadsConverted] = await Promise.all([
    db.appointment.groupBy({ by: ["status"], where: apptWhere, _count: { _all: true } }),
    db.appointment.groupBy({
      by: ["status"],
      where: { ...apptWhere, startsAt: { gte: f.from, lt: f.to.getTime() < now.getTime() ? f.to : now } },
      _count: { _all: true },
    }),
    db.invoiceItem.aggregate({
      _sum: { total: true },
      where: {
        invoice: { status: "EMISA", issuedAt: range, ...(loc ? { locationId: { in: loc } } : {}) },
        ...(doctorId ? { doctorId } : {}),
      },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: {
        cancelledAt: null,
        paidAt: range,
        ...(loc ? { locationId: { in: loc } } : {}),
        // A payment has no doctor: for a doctor scope, count payments on invoices with their lines.
        ...(doctorId ? { invoice: { items: { some: { doctorId } } } } : {}),
      },
    }),
    db.patient.count({
      where: {
        createdAt: range,
        ...(loc ? { preferredLocationId: { in: loc } } : {}),
        ...(doctorId ? { primaryDoctorId: doctorId } : {}),
      },
    }),
    db.lead.count({ where: { createdAt: range, ...(loc ? { locationId: { in: loc } } : {}) } }),
    db.lead.count({
      where: {
        createdAt: range,
        ...(loc ? { locationId: { in: loc } } : {}),
        OR: [{ convertedAt: { not: null } }, { status: "PROGRAMAT" }],
      },
    }),
  ]);

  const count = (rows: { status: string; _count: { _all: number } }[], ...statuses: string[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r._count._all, 0);

  const pastNoShows = count(pastByStatus, "NEPREZENTAT");
  const pastAttended = count(pastByStatus, ...ATTENDED_STATUSES);

  return {
    appointmentsTotal: count(byStatus, "PROGRAMAT", "CONFIRMAT", "SOSIT", "IN_TRATAMENT", "FINALIZAT", "ANULAT", "NEPREZENTAT"),
    completed: count(byStatus, "FINALIZAT"),
    noShows: count(byStatus, "NEPREZENTAT"),
    cancelled: count(byStatus, "ANULAT"),
    noShowRate: ratio(pastNoShows, pastAttended + pastNoShows),
    revenueInvoiced: invoiced._sum.total ?? 0,
    revenueCollected: collected._sum.amount ?? 0,
    newPatients,
    leadsNew,
    leadsConverted,
    leadConversionRate: ratio(leadsConverted, leadsNew),
  };
}

/**
 * Visits per week per clinic for the Rapoarte chart: appointments that took place (Sosit, În
 * tratament, Finalizat), grouped by the Monday of their local week. `weeks` weeks ending with the
 * current one.
 */
export async function getWeeklyVisits(
  o: { weeks?: number; locationIds?: string[]; doctorId?: string | null; now?: Date } = {},
  db: Db = prisma,
): Promise<WeeklyVisits> {
  const n = o.weeks ?? 12;
  const lastMonday = startOfWeekISO(todayISO(o.now ?? new Date()));
  const firstMonday = addDaysISO(lastMonday, -7 * (n - 1));
  const weeks = Array.from({ length: n }, (_, i) => addDaysISO(firstMonday, 7 * i));
  const from = localDayRangeUtc(firstMonday).start;
  const to = localDayRangeUtc(addDaysISO(lastMonday, 6)).end;

  const locations = await db.location.findMany({
    where: { active: true, ...(o.locationIds ? { id: { in: o.locationIds } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, shortName: true },
  });
  const rows = await db.appointment.findMany({
    where: {
      startsAt: { gte: from, lt: to },
      status: { in: [...ATTENDED_STATUSES] },
      locationId: { in: locations.map((l) => l.id) },
      ...(o.doctorId ? { doctorId: o.doctorId } : {}),
    },
    select: { startsAt: true, locationId: true },
  });

  const index = new Map(weeks.map((w, i) => [w, i]));
  const series = locations.map((l) => ({ key: l.slug, label: l.shortName, values: weeks.map(() => 0) }));
  const seriesByLocation = new Map(locations.map((l, i) => [l.id, series[i]]));
  for (const r of rows) {
    const week = startOfWeekISO(utcToLocal(r.startsAt).dateISO);
    const i = index.get(week);
    const s = seriesByLocation.get(r.locationId);
    if (i !== undefined && s) s.values[i] += 1;
  }
  return { weeks, series };
}
