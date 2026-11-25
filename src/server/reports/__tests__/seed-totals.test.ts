import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Report totals on the real seed data (WP5 acceptance: „Totals equal direct DB sums on the seed
 * data”). Builds its own database, `prisma/test-wp5-seed.db`: migrate deploy, then the seed.
 */
const DB_FILE = path.join(process.cwd(), "prisma", "test-wp5-seed.db");
vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp5-seed.db";
});

import { prisma } from "@/lib/db";
import { addDaysISO, todayISO } from "@/lib/time";
import { getKpis } from "../metrics";
import { filterRange, runReport } from "../reports";
import type { ReportFilterValues } from "../types";

const NOW = new Date();
const filters: ReportFilterValues = { de: addDaysISO(todayISO(NOW), -70), pana: addDaysISO(todayISO(NOW), 20), clinica: "ambele", medic: null };
const admin = { role: "ADMIN" as const, doctorId: null };

beforeAll(() => {
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(DB_FILE + s, { force: true });
  const env = { ...process.env, DATABASE_URL: "file:./prisma/test-wp5-seed.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  const root = process.cwd();
  execFileSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: root, env, stdio: "pipe" });
  execFileSync(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), "prisma/seed.ts"], { cwd: root, env, stdio: "pipe" });
}, 180_000);

describe("reports on the seed data", () => {
  it("has demo data to report on", async () => {
    expect(await prisma.invoice.count()).toBeGreaterThan(50);
    expect(await prisma.appointment.count()).toBeGreaterThan(200);
  });

  it("revenue reports total the direct sum of issued invoice lines", async () => {
    const { from, to } = filterRange(filters);
    const direct = await prisma.invoiceItem.aggregate({ _sum: { total: true }, where: { invoice: { status: "EMISA", issuedAt: { gte: from, lt: to } } } });
    const expected = direct._sum.total ?? 0;
    expect(expected).toBeGreaterThan(0);
    for (const slug of ["venit-medic", "venit-serviciu", "venit-clinica", "venit-lunar"] as const) {
      const r = await runReport(slug, filters, admin, { now: NOW });
      const key = r.columns.find((c) => c.kind === "lei")!.key;
      expect(r.totals?.[key], slug).toBe(expected);
      expect(r.rows.reduce((s, row) => s + Number(row[key] ?? 0), 0), slug).toBe(expected);
    }
    const k = await getKpis({ from, to, now: NOW });
    expect(k.revenueInvoiced).toBe(expected);
  });

  it("payments, appointments, no-shows and leads equal direct counts", async () => {
    const { from, to } = filterRange(filters);
    const paid = await prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { cancelledAt: null, paidAt: { gte: from, lt: to } } });
    const byMethod = await runReport("incasari-metoda", filters, admin, { now: NOW });
    expect(byMethod.totals).toMatchObject({ suma: paid._sum.amount ?? 0, incasari: paid._count });
    expect((await getKpis({ from, to, now: NOW })).revenueCollected).toBe(paid._sum.amount ?? 0);

    const appts = await runReport("programari", filters, admin, { now: NOW });
    expect(appts.totals?.total).toBe(await prisma.appointment.count({ where: { startsAt: { gte: from, lt: to } } }));
    expect(appts.totals?.anulate).toBe(await prisma.appointment.count({ where: { startsAt: { gte: from, lt: to }, status: "ANULAT" } }));

    const noShows = await runReport("neprezentari", filters, admin, { now: NOW });
    expect(noShows.totals?.neprezentari).toBe(
      await prisma.appointment.count({ where: { startsAt: { gte: from, lt: NOW }, status: "NEPREZENTAT" } }),
    );

    const leads = await runReport("conversie-cereri", filters, admin, { now: NOW });
    expect(leads.totals?.cereri).toBe(await prisma.lead.count({ where: { createdAt: { gte: from, lt: to } } }));
  });

  it("a MEDIC's revenue report equals the direct sum of their invoice lines", async () => {
    const doctor = await prisma.doctor.findFirstOrThrow({ where: { invoiceItems: { some: {} } }, select: { id: true } });
    const { from, to } = filterRange(filters);
    const direct = await prisma.invoiceItem.aggregate({
      _sum: { total: true },
      where: { doctorId: doctor.id, invoice: { status: "EMISA", issuedAt: { gte: from, lt: to } } },
    });
    const r = await runReport("venit-medic", filters, { role: "MEDIC", doctorId: doctor.id }, { now: NOW });
    expect(r.rows).toHaveLength(1);
    expect(r.totals?.venit).toBe(direct._sum.total ?? 0);
  });
});
