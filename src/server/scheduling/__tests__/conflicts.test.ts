import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp4.db";
});

import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { localToUtc } from "@/lib/time";
import { assertConflictsAllowed, assertValidInterval, cabinetArticled, findConflicts, intervalProblem, maxConcurrent, withSchedulingTx } from "../conflicts";
import type { Conflict } from "../types";
import { makeClinic, makePatient, testUser, type Clinic } from "./fixtures";

const DAY = "2027-03-10"; // a Wednesday, well in the future
const at = (hhmm: string, day = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return localToUtc(day, h * 60 + m);
};
const NOW = at("08:00", "2027-03-01");

let k: Clinic;

beforeAll(async () => {
  k = await makeClinic(prisma);
});

function kinds(list: Conflict[]) {
  return list.map((c) => c.kind).sort();
}

async function book(p: {
  doctorId: string;
  locationId?: string;
  cabinetId?: string | null;
  from: string;
  to: string;
  day?: string;
  status?: "PROGRAMAT" | "ANULAT" | "NEPREZENTAT" | "FINALIZAT";
  patientId?: string | null;
  wantsSedation?: boolean;
}) {
  return prisma.appointment.create({
    data: {
      locationId: p.locationId ?? k.l1.id,
      doctorId: p.doctorId,
      cabinetId: p.cabinetId ?? null,
      patientId: p.patientId ?? null,
      startsAt: at(p.from, p.day),
      endsAt: at(p.to, p.day),
      status: p.status ?? "PROGRAMAT",
      source: "RECEPTIE",
      wantsSedation: p.wantsSedation ?? false,
    },
  });
}

describe("findConflicts", () => {
  it("finds nothing for a free slot inside the shift", async () => {
    const c = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, cabinetId: k.c1.id, startsAt: at("09:00", "2027-03-11"), endsAt: at("09:30", "2027-03-11") }, { now: NOW });
    expect(c).toEqual([]);
  });

  it("blocks a doctor booked at the other clinic, with the §6.2 message", async () => {
    await book({ doctorId: k.doctorA.id, locationId: k.l2.id, from: "10:00", to: "10:30" });
    const c = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("10:15"), endsAt: at("10:45") }, { now: NOW });
    expect(kinds(c)).toEqual(["DOCTOR_OVERLAP"]);
    expect(c[0]).toMatchObject({ severity: "block", message: "Dr. Testescu are deja o programare la 10:00. Alegeți altă oră sau alt medic." });
    expect(c[0].appointmentId).toBeTruthy();
  });

  it("does not report touching intervals, cancelled appointments or the appointment being edited", async () => {
    const own = await book({ doctorId: k.doctorA.id, from: "13:00", to: "13:30" });
    await book({ doctorId: k.doctorA.id, from: "13:30", to: "14:00", status: "ANULAT" });
    await book({ doctorId: k.doctorA.id, from: "13:30", to: "14:00", status: "NEPREZENTAT" });
    const touching = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("13:30"), endsAt: at("14:00") }, { now: NOW });
    expect(touching).toEqual([]);
    const editing = await findConflicts(prisma, { appointmentId: own.id, locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("13:00"), endsAt: at("13:30") }, { now: NOW });
    expect(editing).toEqual([]);
  });

  it("blocks a cabinet used by another doctor", async () => {
    await book({ doctorId: k.doctorB.id, cabinetId: k.c1.id, from: "11:00", to: "11:30" });
    const c = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, cabinetId: k.c1.id, startsAt: at("11:15"), endsAt: at("11:45") }, { now: NOW });
    expect(kinds(c)).toEqual(["CABINET_OVERLAP"]);
    expect(c[0].message).toBe("Cabinetul 1 este ocupat la 11:00. Alegeți alt cabinet sau altă oră.");
  });

  it("blocks time off: a doctor's leave and a location closure", async () => {
    const day = "2027-03-12";
    await prisma.timeOff.create({ data: { doctorId: k.doctorB.id, kind: "CONCEDIU", startsAt: at("00:00", day), endsAt: at("00:00", "2027-03-13") } });
    const leave = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorB.id, startsAt: at("10:00", day), endsAt: at("10:30", day) }, { now: NOW });
    expect(kinds(leave)).toEqual(["TIME_OFF"]);
    expect(leave[0].message).toBe("Dr. Probă este în concediu în această zi. Alegeți altă zi sau alt medic.");

    const closed = "2027-03-15";
    await prisma.timeOff.create({ data: { locationId: k.l1.id, kind: "SARBATOARE", reason: "Ziua clinicii", startsAt: at("00:00", closed), endsAt: at("00:00", "2027-03-16") } });
    const closure = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("10:00", closed), endsAt: at("10:30", closed) }, { now: NOW });
    expect(kinds(closure)).toEqual(["TIME_OFF"]);
    expect(closure[0].message).toBe("Clinica din Testești este închisă în această zi (Ziua clinicii). Alegeți altă zi.");
    // The closure of L1 does not affect L2.
    const elsewhere = await findConflicts(prisma, { locationId: k.l2.id, doctorId: k.doctorA.id, startsAt: at("10:00", closed), endsAt: at("10:30", closed) }, { now: NOW });
    expect(kinds(elsewhere)).toEqual(["OUTSIDE_SHIFT"]);
  });

  it("warns outside the shift and on a break", async () => {
    const day = "2027-03-17";
    const outside = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("16:45", day), endsAt: at("17:15", day) }, { now: NOW });
    expect(outside).toEqual([{ kind: "OUTSIDE_SHIFT", severity: "warn", message: "Dr. Testescu nu are program la Testești la această oră." }]);
    const onBreak = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("11:45", day), endsAt: at("12:15", day) }, { now: NOW });
    expect(onBreak).toEqual([{ kind: "ON_BREAK", severity: "warn", message: "Ora se suprapune cu pauza Dr. Testescu (12:00–12:30)." }]);
  });

  it("warns when the patient already has an overlapping appointment", async () => {
    const day = "2027-03-18";
    const patient = await makePatient(prisma);
    await book({ doctorId: k.doctorB.id, patientId: patient.id, from: "14:00", to: "14:30", day });
    const c = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, patientId: patient.id, startsAt: at("14:15", day), endsAt: at("14:45", day) }, { now: NOW });
    expect(kinds(c)).toEqual(["PATIENT_OVERLAP"]);
    expect(c[0].message).toBe("Pacientul are deja o programare la 14:00, la Dr. Probă.");
  });

  it("warns when every sedation unit is taken", async () => {
    const day = "2027-03-19";
    await book({ doctorId: k.doctorB.id, from: "15:00", to: "16:00", day, wantsSedation: true });
    const busy = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("15:30", day), endsAt: at("16:00", day), wantsSedation: true }, { now: NOW });
    expect(kinds(busy)).toEqual(["SEDATION_UNIT_BUSY"]);
    const free = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("16:00", day), endsAt: at("16:30", day), wantsSedation: true }, { now: NOW });
    expect(free).toEqual([]);
  });

  it("warns for a start in the past", async () => {
    const c = await findConflicts(prisma, { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: at("09:00", "2027-02-26"), endsAt: at("09:30", "2027-02-26") }, { now: NOW });
    expect(kinds(c)).toEqual(["IN_PAST"]);
  });
});

describe("assertConflictsAllowed", () => {
  const block: Conflict = { kind: "DOCTOR_OVERLAP", severity: "block", message: "Dr. X are deja o programare la 10:30." };
  const outside: Conflict = { kind: "OUTSIDE_SHIFT", severity: "warn", message: "În afara programului." };
  const onBreak: Conflict = { kind: "ON_BREAK", severity: "warn", message: "Pauză." };
  const err = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      return e as DomainError;
    }
    return null;
  };

  it("always rejects a block, even acknowledged", () => {
    const e = err(() => assertConflictsAllowed([block, outside], { acknowledgeWarnings: true, user: testUser("ADMIN"), doctorId: "d1" }));
    expect(e?.code).toBe("CONFLICT");
    expect(e?.message).toBe(block.message);
    expect(e?.details?.conflicts).toHaveLength(2);
  });

  it("rejects warnings unless acknowledged by someone allowed to override", () => {
    expect(err(() => assertConflictsAllowed([outside], { user: testUser("RECEPTIE"), doctorId: "d1" }))?.code).toBe("CONFLICT");
    expect(err(() => assertConflictsAllowed([outside, onBreak], { acknowledgeWarnings: true, user: testUser("RECEPTIE"), doctorId: "d1" }))).toBeNull();
    expect(err(() => assertConflictsAllowed([], { user: null, doctorId: "d1" }))).toBeNull();
  });

  it("lets a MEDIC override only OUTSIDE_SHIFT and IN_PAST on their own appointments", () => {
    const medic = testUser("MEDIC", "d1");
    expect(err(() => assertConflictsAllowed([outside], { acknowledgeWarnings: true, user: medic, doctorId: "d1" }))).toBeNull();
    expect(err(() => assertConflictsAllowed([onBreak], { acknowledgeWarnings: true, user: medic, doctorId: "d1" }))?.code).toBe("CONFLICT");
    expect(err(() => assertConflictsAllowed([outside], { acknowledgeWarnings: true, user: medic, doctorId: "d2" }))?.code).toBe("CONFLICT");
  });
});

describe("interval rules and helpers", () => {
  it("assertValidInterval enforces §3.2 invariant 1", () => {
    expect(intervalProblem(at("10:00"), at("10:30"))).toBeNull();
    expect(intervalProblem(at("10:30"), at("10:00"))).toMatch(/după ora de început/);
    expect(intervalProblem(at("10:02"), at("10:30"))).toMatch(/din 5 în 5 minute/);
    expect(intervalProblem(at("10:00"), at("10:00"))).toMatch(/după ora de început/);
    expect(intervalProblem(at("08:00"), at("16:05"))).toMatch(/între 5 minute și 8 ore/);
    expect(intervalProblem(at("23:30"), at("00:30", "2027-03-11"))).toMatch(/aceeași zi/);
    expect(intervalProblem(at("23:30"), at("00:00", "2027-03-11"))).toBeNull();
    expect(() => assertValidInterval(at("10:30"), at("10:00"))).toThrow(DomainError);
  });

  it("maxConcurrent counts simultaneous overlaps inside a window", () => {
    const w = { start: 0, end: 100 };
    expect(maxConcurrent([{ start: 0, end: 50 }, { start: 50, end: 100 }], w)).toBe(1);
    expect(maxConcurrent([{ start: 0, end: 60 }, { start: 50, end: 100 }], w)).toBe(2);
    expect(maxConcurrent([{ start: 200, end: 300 }], w)).toBe(0);
  });

  it("cabinetArticled", () => {
    expect(cabinetArticled("Cabinet 2")).toBe("Cabinetul 2");
    expect(cabinetArticled("Sala mare")).toBe("Sala mare");
  });
});

describe("withSchedulingTx", () => {
  it("commits the callback's writes and returns its value", async () => {
    const id = await withSchedulingTx(async (tx) => {
      const a = await tx.appointment.create({
        data: { locationId: k.l1.id, doctorId: k.doctorB.id, startsAt: at("09:00", "2027-04-01"), endsAt: at("09:30", "2027-04-01"), source: "TELEFON" },
      });
      return a.id;
    });
    expect(await prisma.appointment.count({ where: { id } })).toBe(1);
  });

  it("rolls back on a domain error and passes it through", async () => {
    const before = await prisma.appointment.count({ where: { doctorId: k.doctorB.id } });
    await expect(
      withSchedulingTx(async (tx) => {
        await tx.appointment.create({
          data: { locationId: k.l1.id, doctorId: k.doctorB.id, startsAt: at("10:00", "2027-04-01"), endsAt: at("10:30", "2027-04-01"), source: "TELEFON" },
        });
        throw new DomainError("CONFLICT", "nu");
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.appointment.count({ where: { doctorId: k.doctorB.id } })).toBe(before);
  });

  it("retries write conflicts (P2034) three times, then raises SLOT_TAKEN", async () => {
    let attempts = 0;
    await expect(
      withSchedulingTx(async () => {
        attempts += 1;
        throw Object.assign(new Error("write conflict"), { code: "P2034" });
      }),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    expect(attempts).toBe(3);

    let tries = 0;
    const value = await withSchedulingTx(async () => {
      tries += 1;
      if (tries < 2) throw Object.assign(new Error("write conflict"), { code: "P2034" });
      return "ok";
    });
    expect(value).toBe("ok");
    expect(tries).toBe(2);
  });
});
