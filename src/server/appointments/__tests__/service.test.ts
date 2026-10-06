import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp6.db";
});

import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { addDaysISO, localToUtc, todayISO, utcToLocal } from "@/lib/time";
import { makeClinic, makePatient, testUser, type Clinic } from "@/server/scheduling/__tests__/fixtures";
import { statusAfterAttempt } from "@/server/recalls/service";
import { createAppointment, createRecallForCompleted, moveAppointment, recallDueDateISO, recallReason, updateAppointment } from "../service";
import { appointmentFlags, mergeRanges, subtractRanges } from "../calendar";

const NOW = new Date();
const DAY = addDaysISO(todayISO(NOW), 4);
const reception = testUser("RECEPTIE");

describe("pure helpers", () => {
  it("computes recall due dates and reasons", () => {
    expect(recallDueDateISO(new Date("2026-08-31T09:00:00Z"), 6)).toBe("2027-02-28");
    expect(recallReason("Detartraj", 6)).toBe("Control la 6 luni după detartraj");
    expect(recallReason("Igienizare", 1)).toBe("Control la 1 lună după igienizare");
  });

  it("moves a recall by call outcome", () => {
    expect(statusAfterAttempt("DE_FACUT", "FARA_RASPUNS")).toBe("DE_FACUT");
    expect(statusAfterAttempt("DE_FACUT", "REVINE")).toBe("CONTACTAT");
    expect(statusAfterAttempt("CONTACTAT", "REFUZAT")).toBe("REFUZAT");
  });

  it("merges shifts and removes breaks", () => {
    expect(mergeRanges([[600, 700], [540, 610], [800, 900]])).toEqual([[540, 700], [800, 900]]);
    expect(subtractRanges([[540, 1020]], [[720, 750]])).toEqual([[540, 720], [750, 1020]]);
  });

  it("builds overlays: alert first, booking comfort, sedation, child of a lead, online", () => {
    const flags = appointmentFlags(
      { source: "ONLINE", comfort: "FRICA", wantsSedation: true, lead: { name: "Ana", phone: null, forChild: true, childFirstName: "Ioana", childAge: 8 } },
      [{ kind: "alerta", label: "Alergie: penicilină" }],
    );
    expect(flags.map((f) => f.kind)).toEqual(["alerta", "confort", "sedare", "copil", "online"]);
    expect(flags.find((f) => f.kind === "copil")?.label).toBe("Copil, Ioana, 8 ani");
  });
});

describe("appointments (integration)", () => {
  let c: Clinic;
  beforeAll(async () => {
    c = await makeClinic(prisma);
  });

  async function book(minute: number, status: "PROGRAMAT" | "CONFIRMAT" = "PROGRAMAT") {
    const p = await makePatient(prisma);
    const r = await createAppointment(
      { locationId: c.l1.id, doctorId: c.doctorA.id, cabinetId: c.c1.id, patientId: p.id, serviceId: c.service.id, date: DAY, time: minute, durationMinutes: 30, wantsSedation: false, acknowledgeWarnings: false },
      reception,
      NOW,
    );
    if (status === "CONFIRMAT") await prisma.appointment.update({ where: { id: r.id }, data: { status: "CONFIRMAT", confirmedAt: NOW, confirmedVia: "TELEFON", reminderSentAt: NOW } });
    return { id: r.id, patientId: p.id };
  }

  it("refuses a double booking and needs acknowledgement for warnings", async () => {
    await book(600);
    const p = await makePatient(prisma);
    const base = { locationId: c.l1.id, doctorId: c.doctorA.id, patientId: p.id, date: DAY, durationMinutes: 30, wantsSedation: false };
    await expect(createAppointment({ ...base, time: 615, acknowledgeWarnings: true }, reception, NOW)).rejects.toMatchObject({ code: "CONFLICT" });
    // 12:00–12:30 is a break: a warning.
    await expect(createAppointment({ ...base, time: 720, acknowledgeWarnings: false }, reception, NOW)).rejects.toMatchObject({ code: "CONFLICT" });
    const ok = await createAppointment({ ...base, time: 720, acknowledgeWarnings: true }, reception, NOW);
    expect(ok.warnings.map((w) => w.kind)).toContain("ON_BREAK");
  });

  it("requires a patient or a lead, and books a MEDIC only for themselves", async () => {
    await expect(
      createAppointment({ locationId: c.l1.id, doctorId: c.doctorA.id, date: DAY, time: 900, durationMinutes: 30, wantsSedation: false, acknowledgeWarnings: false }, reception, NOW),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const p = await makePatient(prisma);
    const medic = testUser("MEDIC", c.doctorB.id);
    const r = await createAppointment(
      { locationId: c.l1.id, doctorId: c.doctorA.id, patientId: p.id, date: DAY, time: 900, durationMinutes: 30, wantsSedation: false, acknowledgeWarnings: false },
      medic,
      NOW,
    );
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: r.id } })).doctorId).toBe(c.doctorB.id);
  });

  it("moves: tokenVersion++, reminder reset, back to Programat, STALE on an old version, undo restores Confirmat", async () => {
    const { id } = await book(840, "CONFIRMAT");
    const before = await prisma.appointment.findUniqueOrThrow({ where: { id } });
    const moved = await moveAppointment(
      { id, expectedUpdatedAt: before.updatedAt.toISOString(), date: DAY, time: 870, confirmed: false, acknowledgeWarnings: false, undo: false },
      reception,
      NOW,
    );
    const after = await prisma.appointment.findUniqueOrThrow({ where: { id } });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
    expect(after.reminderSentAt).toBeNull();
    expect(after.status).toBe("PROGRAMAT");
    expect(after.confirmedAt).toBeNull();
    expect(utcToLocal(after.startsAt).minute).toBe(870);
    expect(after.endsAt.getTime() - after.startsAt.getTime()).toBe(30 * 60_000);
    expect(moved.previous).toMatchObject({ time: "14:00", durationMinutes: 30, confirmed: true });

    await expect(
      moveAppointment({ id, expectedUpdatedAt: before.updatedAt.toISOString(), date: DAY, time: 900, confirmed: false, acknowledgeWarnings: false, undo: false }, reception, NOW),
    ).rejects.toMatchObject({ code: "STALE" });

    await moveAppointment(
      { id, expectedUpdatedAt: moved.updatedAt, date: moved.previous.date, time: 840, confirmed: moved.previous.confirmed, acknowledgeWarnings: false, undo: true },
      reception,
      NOW,
    );
    const undone = await prisma.appointment.findUniqueOrThrow({ where: { id } });
    expect(undone.status).toBe("CONFIRMAT");
    expect(utcToLocal(undone.startsAt).minute).toBe(840);
    expect(await prisma.auditLog.count({ where: { entityId: id, action: "appointment.move" } })).toBe(2);
  });

  it("moving to another doctor takes that doctor's cabinet; a MEDIC cannot move others' appointments", async () => {
    const { id } = await book(960);
    const a = await prisma.appointment.findUniqueOrThrow({ where: { id } });
    await expect(
      moveAppointment({ id, expectedUpdatedAt: a.updatedAt.toISOString(), date: DAY, time: 960, confirmed: false, acknowledgeWarnings: false, undo: false }, testUser("MEDIC", c.doctorB.id), NOW),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await moveAppointment(
      { id, expectedUpdatedAt: a.updatedAt.toISOString(), date: DAY, time: 960, doctorId: c.doctorB.id, confirmed: false, acknowledgeWarnings: false, undo: false },
      reception,
      NOW,
    );
    const b = await prisma.appointment.findUniqueOrThrow({ where: { id } });
    expect(b.doctorId).toBe(c.doctorB.id);
    expect(b.cabinetId).toBe(c.c2.id);
  });

  it("refuses to reschedule a finished visit, but edits its notes", async () => {
    const { id } = await book(990);
    await prisma.appointment.update({ where: { id }, data: { status: "FINALIZAT", completedAt: NOW } });
    const a = await prisma.appointment.findUniqueOrThrow({ where: { id } });
    const base = {
      id,
      locationId: c.l1.id,
      doctorId: c.doctorA.id,
      cabinetId: c.c1.id,
      serviceId: c.service.id,
      date: DAY,
      durationMinutes: 30,
      wantsSedation: false,
      acknowledgeWarnings: false,
      confirmed: false,
      expectedUpdatedAt: a.updatedAt.toISOString(),
    };
    await expect(updateAppointment({ ...base, time: 1000 }, reception, NOW)).rejects.toBeInstanceOf(DomainError);
    const r = await updateAppointment({ ...base, time: 990, notes: "A adus radiografia." }, reception, NOW);
    expect(r.moved).toBe(false);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id } })).notes).toBe("A adus radiografia.");
  });

  it("creates one recall after FINALIZAT when the service has recallMonths", async () => {
    await prisma.service.update({ where: { id: c.service.id }, data: { recallMonths: 6 } });
    const p = await makePatient(prisma);
    const done = await prisma.appointment.create({
      data: {
        locationId: c.l1.id,
        doctorId: c.doctorA.id,
        patientId: p.id,
        serviceId: c.service.id,
        startsAt: localToUtc("2026-03-02", 600),
        endsAt: localToUtc("2026-03-02", 630),
        status: "FINALIZAT",
        completedAt: localToUtc("2026-03-02", 630),
        source: "TELEFON",
      },
    });
    const id = await createRecallForCompleted(done.id);
    expect(id).not.toBeNull();
    const recall = await prisma.recall.findUniqueOrThrow({ where: { id: id! } });
    expect(utcToLocal(recall.dueDate).dateISO).toBe("2026-09-02");
    expect(recall.reason).toBe("Control la 6 luni după consultație test");
    // An open recall for the same service already exists: no second one.
    expect(await createRecallForCompleted(done.id)).toBeNull();
    await prisma.service.update({ where: { id: c.service.id }, data: { recallMonths: null } });
  });
});
