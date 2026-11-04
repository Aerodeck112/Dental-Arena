import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { scopeLocationIds, type ClinicScope } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { capitalize, formatDateRo, personName } from "@/lib/format";
import { can } from "@/lib/permissions";
import { addDaysISO, localDayRangeUtc, monthRangeUtc, todayISO, utcToLocal } from "@/lib/time";
import { getPatientBalancesBulk } from "@/server/billing/balance";
import { getKpis } from "@/server/reports/metrics";
import { APPOINTMENT_ROW_SELECT, shortDoctorName, toCalendarAppointments } from "./calendar";
import type { BalanceQueueItem, ClinicSummary, DashboardData, KpiSummary, LeadQueueItem, RecallQueueItem } from "./types";

/**
 * „Azi” (design system §6.8): one sentence per clinic, today's agenda with status actions, the
 * work queues (cereri noi, de rechemat, solduri) and the month KPIs from WP5's `getKpis`.
 */

const MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

/** Recalls shown on Azi: due up to 7 days ahead (overdue included). */
export const RECALL_QUEUE_DAYS = 7;

export async function getDashboardData(user: CurrentUser, scope: ClinicScope, now: Date = new Date()): Promise<DashboardData> {
  const locationIds = await scopeLocationIds(scope);
  const dateISO = todayISO(now);
  const { start, end } = localDayRangeUtc(dateISO);
  const recallHorizon = localDayRangeUtc(addDaysISO(dateISO, RECALL_QUEUE_DAYS)).end;
  const ownRecalls = user.role === "MEDIC" ? { doctorId: user.doctorId ?? "__niciunul__" } : {};
  const seeMoney = can(user, "billing.view");
  const seeLeads = can(user, "leads.view");

  const [locations, rows, leadCounts, recallCounts, payments] = await Promise.all([
    prisma.location.findMany({ where: { id: { in: locationIds } }, orderBy: [{ sortOrder: "asc" }], select: { id: true, shortName: true } }),
    prisma.appointment.findMany({
      where: { locationId: { in: locationIds }, startsAt: { gte: start, lt: end } },
      orderBy: [{ startsAt: "asc" }],
      select: APPOINTMENT_ROW_SELECT,
    }),
    seeLeads
      ? prisma.lead.groupBy({ by: ["locationId"], where: { status: "NOU", OR: [{ locationId: { in: locationIds } }, { locationId: null }] }, _count: { _all: true } })
      : Promise.resolve([]),
    prisma.recall.groupBy({
      by: ["locationId"],
      where: { status: "DE_FACUT", dueDate: { lt: end }, ...ownRecalls, OR: [{ locationId: { in: locationIds } }, { locationId: null }] },
      _count: { _all: true },
    }),
    seeMoney
      ? prisma.payment.groupBy({ by: ["locationId"], where: { locationId: { in: locationIds }, paidAt: { gte: start, lt: end }, cancelledAt: null }, _sum: { amount: true } })
      : Promise.resolve([]),
  ]);

  const today = await toCalendarAppointments(rows, user, now);
  if (user.role === "MEDIC" && user.doctorId) {
    // Own agenda first (§5.3), each part still in time order.
    today.sort((a, b) => Number(b.doctorId === user.doctorId) - Number(a.doctorId === user.doctorId) || a.startsAt.localeCompare(b.startsAt));
  }

  const summaries: ClinicSummary[] = locations.map((l, index) => {
    const unassigned = index === 0 ? 1 : 0; // requests without a clinic are counted on the first one
    return {
      locationId: l.id,
      name: l.shortName,
      appointments: today.filter((a) => a.locationId === l.id && a.status !== "ANULAT").length,
      leadsNew: (leadCounts as { locationId: string | null; _count: { _all: number } }[])
        .filter((c) => c.locationId === l.id || (unassigned && c.locationId === null))
        .reduce((s, c) => s + c._count._all, 0),
      recallsDue: recallCounts.filter((c) => c.locationId === l.id || (unassigned && c.locationId === null)).reduce((s, c) => s + c._count._all, 0),
      collectedToday: seeMoney
        ? ((payments as { locationId: string; _sum: { amount: number | null } }[]).find((p) => p.locationId === l.id)?._sum.amount ?? 0)
        : null,
    };
  });

  const [leads, recalls, balances, kpis] = await Promise.all([
    seeLeads ? leadQueue(locationIds) : Promise.resolve(null),
    recallQueue(locationIds, recallHorizon, ownRecalls),
    seeMoney ? balanceQueue(locationIds) : Promise.resolve(null),
    kpiSummary(user, locationIds, now),
  ]);

  return {
    dateISO,
    title: capitalize(formatDateRo(dateISO, "long")),
    summaries,
    today,
    ownDoctorId: user.role === "MEDIC" ? user.doctorId : null,
    leads,
    recalls,
    balances,
    kpis,
    nowISO: now.toISOString(),
  };
}

async function leadQueue(locationIds: string[]): Promise<LeadQueueItem[]> {
  const rows = await prisma.lead.findMany({
    where: { status: "NOU", OR: [{ locationId: { in: locationIds } }, { locationId: null }] },
    orderBy: [{ createdAt: "asc" }],
    take: 8,
    select: {
      id: true,
      name: true,
      phone: true,
      source: true,
      createdAt: true,
      comfort: true,
      preferredTime: true,
      service: { select: { name: true } },
      location: { select: { shortName: true } },
      appointments: {
        where: { status: { in: ["PROGRAMAT", "CONFIRMAT"] } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { id: true, startsAt: true, status: true, doctor: { select: { honorific: true, lastName: true } } },
      },
    },
  });
  return rows.map((l) => {
    const a = l.appointments[0];
    return {
      id: l.id,
      name: l.name,
      phone: l.phone,
      source: l.source,
      createdAt: l.createdAt.toISOString(),
      serviceName: l.service?.name ?? null,
      locationName: l.location?.shortName ?? null,
      comfort: l.comfort,
      preferredTime: l.preferredTime,
      appointment: a ? { id: a.id, startsAt: a.startsAt.toISOString(), status: a.status, doctorName: shortDoctorName(a.doctor) } : null,
    };
  });
}

async function recallQueue(locationIds: string[], horizon: Date, own: { doctorId?: string }): Promise<RecallQueueItem[]> {
  const rows = await prisma.recall.findMany({
    where: { status: { in: ["DE_FACUT", "CONTACTAT"] }, dueDate: { lt: horizon }, ...own, OR: [{ locationId: { in: locationIds } }, { locationId: null }] },
    orderBy: [{ dueDate: "asc" }],
    take: 8,
    select: {
      id: true,
      reason: true,
      dueDate: true,
      status: true,
      attempts: true,
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, anonymizedAt: true } },
    },
  });
  return rows
    .filter((r) => !r.patient.anonymizedAt)
    .map((r) => ({
      id: r.id,
      patientId: r.patient.id,
      patientName: personName(r.patient),
      phone: r.patient.phone,
      reason: r.reason,
      dueDate: utcToLocal(r.dueDate).dateISO,
      status: r.status,
      attempts: r.attempts,
    }));
}

/** Patients of the scope with an unpaid invoice and a positive balance, largest first. */
async function balanceQueue(locationIds: string[]): Promise<BalanceQueueItem[]> {
  const unpaid = await prisma.invoice.findMany({
    where: { status: "EMISA", locationId: { in: locationIds }, amountPaid: { lt: prisma.invoice.fields.total } },
    select: { patientId: true },
    distinct: ["patientId"],
    take: 200,
  });
  const ids = unpaid.map((u) => u.patientId);
  if (ids.length === 0) return [];
  const balances = await getPatientBalancesBulk(ids);
  const owing = ids.filter((id) => (balances.get(id)?.balance ?? 0) > 0);
  const patients = await prisma.patient.findMany({
    where: { id: { in: owing }, anonymizedAt: null },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  return patients
    .map((p) => ({ patientId: p.id, name: personName(p), phone: p.phone, balance: balances.get(p.id)?.balance ?? 0 }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 6);
}

async function kpiSummary(user: CurrentUser, locationIds: string[], now: Date): Promise<KpiSummary> {
  const local = utcToLocal(now).dateISO.split("-").map(Number);
  const month = monthRangeUtc(local[0], local[1]);
  const k = await getKpis({ from: month.start, to: now < month.end ? now : month.end, locationIds, now });
  const revenue = can(user, "dashboard.revenue");
  let ownProduction: number | null = null;
  if (user.role === "MEDIC" && user.doctorId) {
    const agg = await prisma.invoiceItem.aggregate({
      where: { doctorId: user.doctorId, invoice: { status: "EMISA", issuedAt: { gte: month.start, lt: month.end } } },
      _sum: { total: true },
    });
    ownProduction = agg._sum.total ?? 0;
  }
  return {
    monthLabel: MONTHS[local[1] - 1],
    appointmentsTotal: k.appointmentsTotal,
    noShowRate: k.noShowRate,
    leadsNew: k.leadsNew,
    leadConversionRate: k.leadConversionRate,
    revenueCollected: revenue ? k.revenueCollected : null,
    revenueInvoiced: revenue ? k.revenueInvoiced : null,
    ownProduction,
  };
}
