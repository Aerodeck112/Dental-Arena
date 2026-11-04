import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp4.db";
});

import type { AppointmentStatus, Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { ALLOWED_TRANSITIONS, BLOCKING_STATUSES, allowedTargets, canTransition, isUndo } from "../rules";
import { transitionAppointment, transitionData } from "../status";
import { makeClinic, testUser, type Clinic } from "./fixtures";

const ALL: AppointmentStatus[] = ["PROGRAMAT", "CONFIRMAT", "SOSIT", "IN_TRATAMENT", "FINALIZAT", "ANULAT", "NEPREZENTAT"];

/** §6.4, row by row: the ✓ cells. */
const TABLE: Record<AppointmentStatus, AppointmentStatus[]> = {
  PROGRAMAT: ["CONFIRMAT", "SOSIT", "ANULAT", "NEPREZENTAT"],
  CONFIRMAT: ["PROGRAMAT", "SOSIT", "ANULAT", "NEPREZENTAT"],
  SOSIT: ["CONFIRMAT", "IN_TRATAMENT", "FINALIZAT", "ANULAT"],
  IN_TRATAMENT: ["SOSIT", "FINALIZAT"],
  FINALIZAT: ["IN_TRATAMENT"],
  ANULAT: ["PROGRAMAT"],
  NEPREZENTAT: ["PROGRAMAT", "SOSIT"],
};

const NOW = new Date("2026-10-06T10:00:00.000Z");
const HOUR = 3_600_000;

describe("status rules", () => {
  it("BLOCKING_STATUSES matches §3.2 invariant 2", () => {
    expect([...BLOCKING_STATUSES].sort()).toEqual(["CONFIRMAT", "FINALIZAT", "IN_TRATAMENT", "PROGRAMAT", "SOSIT"]);
  });

  it("ALLOWED_TRANSITIONS is exactly the §6.4 table", () => {
    for (const from of ALL) expect([...ALLOWED_TRANSITIONS[from]].sort()).toEqual([...TABLE[from]].sort());
  });

  it("rejects every transition outside the table, for every role", () => {
    for (const role of ["ADMIN", "RECEPTIE", "MEDIC"] as Role[]) {
      for (const from of ALL) {
        for (const to of ALL) {
          if (TABLE[from].includes(to)) continue;
          expect(canTransition(from, to, role, NOW, NOW), `${role} ${from}→${to}`).toBe(false);
        }
      }
    }
  });

  it("lets ADMIN and RECEPTIE make every table transition except reopening a finished visit", () => {
    for (const role of ["ADMIN", "RECEPTIE"] as Role[]) {
      for (const from of ALL) {
        for (const to of TABLE[from]) {
          if (from === "FINALIZAT") continue;
          expect(canTransition(from, to, role, null, NOW), `${role} ${from}→${to}`).toBe(true);
        }
      }
    }
  });

  it("reopens FINALIZAT only for ADMIN and only within 24 hours", () => {
    const completed = new Date(NOW.getTime() - 3 * HOUR);
    expect(canTransition("FINALIZAT", "IN_TRATAMENT", "ADMIN", completed, NOW)).toBe(true);
    expect(canTransition("FINALIZAT", "IN_TRATAMENT", "RECEPTIE", completed, NOW)).toBe(false);
    expect(canTransition("FINALIZAT", "IN_TRATAMENT", "MEDIC", completed, NOW)).toBe(false);
    expect(canTransition("FINALIZAT", "IN_TRATAMENT", "ADMIN", new Date(NOW.getTime() - 25 * HOUR), NOW)).toBe(false);
    expect(canTransition("FINALIZAT", "IN_TRATAMENT", "ADMIN", null, NOW)).toBe(false);
  });

  it("lets a MEDIC confirm, cancel and run SOSIT → IN_TRATAMENT → FINALIZAT, but not no-shows or restores", () => {
    const ok: [AppointmentStatus, AppointmentStatus][] = [
      ["PROGRAMAT", "CONFIRMAT"],
      ["SOSIT", "IN_TRATAMENT"],
      ["IN_TRATAMENT", "FINALIZAT"],
      ["SOSIT", "FINALIZAT"],
      ["IN_TRATAMENT", "SOSIT"],
      ["PROGRAMAT", "ANULAT"],
      ["CONFIRMAT", "ANULAT"],
    ];
    for (const [f, t] of ok) expect(canTransition(f, t, "MEDIC", null, NOW), `${f}→${t}`).toBe(true);
    const no: [AppointmentStatus, AppointmentStatus][] = [
      ["PROGRAMAT", "NEPREZENTAT"],
      ["CONFIRMAT", "NEPREZENTAT"],
      ["ANULAT", "PROGRAMAT"],
      ["NEPREZENTAT", "PROGRAMAT"],
      ["NEPREZENTAT", "SOSIT"],
    ];
    for (const [f, t] of no) expect(canTransition(f, t, "MEDIC", null, NOW), `${f}→${t}`).toBe(false);
  });

  it("allowedTargets hides NEPREZENTAT before the start", () => {
    const later = new Date(NOW.getTime() + HOUR);
    const earlier = new Date(NOW.getTime() - HOUR);
    expect(allowedTargets("PROGRAMAT", "RECEPTIE", { startsAt: later, now: NOW })).toEqual(["CONFIRMAT", "SOSIT", "ANULAT"]);
    expect(allowedTargets("PROGRAMAT", "RECEPTIE", { startsAt: earlier, now: NOW })).toContain("NEPREZENTAT");
  });

  it("knows which transitions are undos", () => {
    expect(isUndo("CONFIRMAT", "PROGRAMAT")).toBe(true);
    expect(isUndo("IN_TRATAMENT", "SOSIT")).toBe(true);
    expect(isUndo("PROGRAMAT", "CONFIRMAT")).toBe(false);
  });
});

describe("transition side effects (§6.4)", () => {
  const actor = { id: "u1" } as never;
  const base = { confirmedAt: null };

  it("sets the timestamp of the target status", () => {
    expect(transitionData({ ...base, status: "PROGRAMAT" }, "CONFIRMAT", { actor, via: "TELEFON" }, NOW)).toMatchObject({
      status: "CONFIRMAT",
      confirmedAt: NOW,
      confirmedVia: "TELEFON",
      updatedById: "u1",
    });
    expect(transitionData({ ...base, status: "PROGRAMAT" }, "CONFIRMAT", { actor: null }, NOW)).toMatchObject({ confirmedVia: "LINK", updatedById: null });
    expect(transitionData({ ...base, status: "CONFIRMAT" }, "SOSIT", { actor }, NOW)).toMatchObject({ arrivedAt: NOW });
    expect(transitionData({ ...base, status: "SOSIT" }, "IN_TRATAMENT", { actor }, NOW)).toMatchObject({ startedAt: NOW });
    expect(transitionData({ ...base, status: "IN_TRATAMENT" }, "FINALIZAT", { actor }, NOW)).toMatchObject({ completedAt: NOW });
    expect(transitionData({ ...base, status: "PROGRAMAT" }, "NEPREZENTAT", { actor }, NOW)).toMatchObject({ noShowAt: NOW });
  });

  it("cancelling records who and why, bumps tokenVersion and resets the reminder", () => {
    expect(transitionData({ ...base, status: "CONFIRMAT" }, "ANULAT", { actor, reason: "Pacientul a sunat" }, NOW)).toMatchObject({
      cancelledAt: NOW,
      cancelledBy: "CLINICA",
      cancelReason: "Pacientul a sunat",
      tokenVersion: { increment: 1 },
      reminderSentAt: null,
    });
    expect(transitionData({ ...base, status: "PROGRAMAT" }, "ANULAT", { actor: null }, NOW)).toMatchObject({ cancelledBy: "PACIENT" });
  });

  it("undo clears the timestamp it reverts", () => {
    expect(transitionData({ ...base, status: "CONFIRMAT" }, "PROGRAMAT", { actor }, NOW)).toMatchObject({ confirmedAt: null, confirmedVia: null });
    expect(transitionData({ confirmedAt: NOW, status: "SOSIT" }, "CONFIRMAT", { actor }, NOW)).toEqual({
      status: "CONFIRMAT",
      updatedById: "u1",
      arrivedAt: null,
    });
    expect(transitionData({ ...base, status: "IN_TRATAMENT" }, "SOSIT", { actor }, NOW)).toMatchObject({ startedAt: null });
    expect(transitionData({ ...base, status: "FINALIZAT" }, "IN_TRATAMENT", { actor }, NOW)).toMatchObject({ completedAt: null });
    expect(transitionData({ ...base, status: "ANULAT" }, "PROGRAMAT", { actor }, NOW)).toMatchObject({
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
    });
    expect(transitionData({ ...base, status: "NEPREZENTAT" }, "PROGRAMAT", { actor }, NOW)).toMatchObject({ noShowAt: null });
    expect(transitionData({ ...base, status: "NEPREZENTAT" }, "SOSIT", { actor }, NOW)).toMatchObject({ noShowAt: null, arrivedAt: NOW });
  });
});

describe("transitionAppointment (database)", () => {
  let k: Clinic;
  const DAY = "2027-05-12";
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return localToUtc(DAY, h * 60 + m);
  };
  const BEFORE = at("08:00");
  const AFTER = at("18:00");

  beforeAll(async () => {
    k = await makeClinic(prisma);
  });

  const create = (from: string, to: string, doctorId = k.doctorA.id, status: AppointmentStatus = "PROGRAMAT") =>
    prisma.appointment.create({
      data: { locationId: k.l1.id, doctorId, startsAt: at(from), endsAt: at(to), status, source: "TELEFON", reminderSentAt: BEFORE },
    });

  it("confirms, writes the timestamps and the audit row", async () => {
    const a = await create("09:00", "09:30");
    const r = await transitionAppointment(a.id, "CONFIRMAT", { actor: testUser("RECEPTIE"), via: "TELEFON", now: BEFORE });
    expect(r.status).toBe("CONFIRMAT");
    expect(r.confirmedAt?.toISOString()).toBe(BEFORE.toISOString());
    expect(r.confirmedVia).toBe("TELEFON");
    const log = await prisma.auditLog.findFirst({ where: { action: "appointment.status", entityId: a.id } });
    expect(JSON.parse(log?.metadata ?? "{}")).toEqual({ from: "PROGRAMAT", to: "CONFIRMAT" });
    expect(log?.actorRole).toBe("RECEPTIE");
  });

  it("rejects illegal transitions with INVALID_TRANSITION and changes nothing", async () => {
    const a = await create("09:30", "10:00");
    await expect(transitionAppointment(a.id, "FINALIZAT", { actor: testUser("ADMIN"), now: BEFORE })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(transitionAppointment(a.id, "NEPREZENTAT", { actor: testUser("RECEPTIE"), now: BEFORE })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      message: "Puteți marca pacientul ca neprezentat după ora programării.",
    });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("PROGRAMAT");
    const r = await transitionAppointment(a.id, "NEPREZENTAT", { actor: testUser("RECEPTIE"), now: AFTER });
    expect(r.noShowAt?.toISOString()).toBe(AFTER.toISOString());
  });

  it("limits a MEDIC to their own appointments", async () => {
    const a = await create("10:00", "10:30");
    await expect(transitionAppointment(a.id, "CONFIRMAT", { actor: testUser("MEDIC", k.doctorB.id), now: BEFORE })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const r = await transitionAppointment(a.id, "CONFIRMAT", { actor: testUser("MEDIC", k.doctorA.id), now: BEFORE });
    expect(r.status).toBe("CONFIRMAT");
  });

  it("runs the visit: SOSIT, IN_TRATAMENT, FINALIZAT, and ADMIN may reopen within 24 h", async () => {
    const a = await create("10:30", "11:00");
    const admin = testUser("ADMIN");
    await transitionAppointment(a.id, "SOSIT", { actor: admin, now: at("10:25") });
    await transitionAppointment(a.id, "IN_TRATAMENT", { actor: testUser("MEDIC", k.doctorA.id), now: at("10:32") });
    const done = await transitionAppointment(a.id, "FINALIZAT", { actor: testUser("MEDIC", k.doctorA.id), now: at("11:00") });
    expect(done.arrivedAt && done.startedAt && done.completedAt).toBeTruthy();
    await expect(transitionAppointment(a.id, "IN_TRATAMENT", { actor: testUser("RECEPTIE"), now: at("12:00") })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const reopened = await transitionAppointment(a.id, "IN_TRATAMENT", { actor: admin, now: at("12:00") });
    expect(reopened.status).toBe("IN_TRATAMENT");
    expect(reopened.completedAt).toBeNull();
  });

  it("cancelling bumps tokenVersion and clears reminderSentAt; repeating the status is a no-op", async () => {
    const a = await create("11:00", "11:30");
    const r = await transitionAppointment(a.id, "ANULAT", { actor: testUser("RECEPTIE"), reason: "A sunat", now: BEFORE });
    expect(r.tokenVersion).toBe(a.tokenVersion + 1);
    expect(r.reminderSentAt).toBeNull();
    expect(r.cancelledBy).toBe("CLINICA");
    const again = await transitionAppointment(a.id, "ANULAT", { actor: testUser("RECEPTIE"), now: BEFORE });
    expect(again.tokenVersion).toBe(r.tokenVersion);
  });

  it("restores a cancelled appointment only when its slot is still free", async () => {
    const a = await create("13:00", "13:30");
    await transitionAppointment(a.id, "ANULAT", { actor: testUser("RECEPTIE"), now: BEFORE });
    await create("13:15", "13:45");
    await expect(transitionAppointment(a.id, "PROGRAMAT", { actor: testUser("RECEPTIE"), now: BEFORE })).rejects.toMatchObject({ code: "CONFLICT" });

    const b = await create("14:00", "14:30");
    await transitionAppointment(b.id, "ANULAT", { actor: testUser("RECEPTIE"), now: BEFORE });
    const restored = await transitionAppointment(b.id, "PROGRAMAT", { actor: testUser("RECEPTIE"), now: BEFORE });
    expect(restored.status).toBe("PROGRAMAT");
    expect(restored.cancelledAt).toBeNull();
  });

  it("lets the patient link only confirm or cancel", async () => {
    const a = await create("15:00", "15:30");
    await expect(transitionAppointment(a.id, "SOSIT", { actor: null, now: BEFORE })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const c = await transitionAppointment(a.id, "CONFIRMAT", { actor: null, via: "LINK", now: BEFORE });
    expect(c.confirmedVia).toBe("LINK");
    const log = await prisma.auditLog.findFirst({ where: { action: "appointment.status", entityId: a.id } });
    expect(log?.actorId).toBeNull();
    expect(JSON.parse(log?.metadata ?? "{}")).toMatchObject({ via: "link" });
    const x = await transitionAppointment(a.id, "ANULAT", { actor: null, now: BEFORE });
    expect(x.cancelledBy).toBe("PACIENT");
  });

  it("returns NOT_FOUND for an unknown id", async () => {
    await expect(transitionAppointment("ckunknownunknownunknown0", "CONFIRMAT", { actor: testUser("ADMIN") })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
