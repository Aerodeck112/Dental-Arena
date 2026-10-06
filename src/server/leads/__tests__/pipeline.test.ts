import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp6.db";
});

import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { addDaysISO, localToUtc, todayISO } from "@/lib/time";
import { makeClinic, uniq, type Clinic } from "@/server/scheduling/__tests__/fixtures";
import {
  addLeadActivity,
  assignLead,
  changeLeadStatus as changeLeadStatusStrict,
  convertLead as convertLeadStrict,
  leadConsentRows,
  leadStatusProblem,
  listLeads,
  splitLeadName,
  suggestedPatient,
  type ConvertLeadInput,
} from "../pipeline";

/** Parsed inputs leave optional fields undefined; tests pass only what matters. */
type Loose<T> = { [K in keyof T]?: T[K] };
type Tail<F extends (...a: never[]) => unknown> = Parameters<F> extends [unknown, ...infer R] ? R : never;
type StatusInput = Parameters<typeof changeLeadStatusStrict>[0];
const changeLeadStatus = (i: Loose<StatusInput>, ...rest: Tail<typeof changeLeadStatusStrict>) => changeLeadStatusStrict(i as StatusInput, ...rest);
const convertLead = (i: Loose<ConvertLeadInput>, ...rest: Tail<typeof convertLeadStrict>) => convertLeadStrict(i as ConvertLeadInput, ...rest);

const NOW = new Date();
const DAY = addDaysISO(todayISO(NOW), 3);

async function makeUser(role: "ADMIN" | "RECEPTIE", doctorId: string | null = null): Promise<CurrentUser> {
  const tag = uniq("u");
  const u = await prisma.user.create({
    data: { email: `${tag}@example.com`, passwordHash: "x", role, firstName: "Ana", lastName: tag },
  });
  return {
    id: u.id,
    role,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    displayName: `${u.firstName} ${u.lastName}`,
    doctorId,
    homeLocationId: null,
    theme: "SISTEM",
    density: "COMPACT",
    mustChangePassword: false,
  };
}

let phoneCounter = Math.floor(Math.random() * 900_000);
function phone(): string {
  phoneCounter += 1;
  return `+40799${String(phoneCounter).padStart(6, "0")}`;
}

async function onlineLead(c: Clinic, o: { withAppointment?: boolean; consentSms?: boolean; minute?: number } = {}) {
  const lead = await prisma.lead.create({
    data: {
      source: "PROGRAMARE_ONLINE",
      name: `Elena ${uniq("Rus")}`,
      phone: phone(),
      locationId: c.l1.id,
      serviceId: c.service.id,
      comfort: "FRICA",
      consentGdprAt: new Date(NOW.getTime() - 3_600_000),
      consentTextVersion: "gdpr-test",
      consentSms: o.consentSms ?? true,
      ipHash: "hash-ip",
    },
  });
  let appointmentId: string | null = null;
  if (o.withAppointment !== false) {
    const minute = o.minute ?? 600;
    const appt = await prisma.appointment.create({
      data: {
        locationId: c.l1.id,
        doctorId: c.doctorA.id,
        cabinetId: c.c1.id,
        leadId: lead.id,
        serviceId: c.service.id,
        startsAt: localToUtc(DAY, minute),
        endsAt: localToUtc(DAY, minute + 30),
        status: "PROGRAMAT",
        source: "ONLINE",
      },
    });
    appointmentId = appt.id;
  }
  return { lead, appointmentId };
}

describe("pure rules", () => {
  it("refuses Programat without conversion and Pierdut without a reason", () => {
    expect(leadStatusProblem("NOU", "PROGRAMAT", { hasPatient: false })).toMatch(/convertiți/);
    expect(leadStatusProblem("CONTACTAT", "PROGRAMAT", { hasPatient: true })).toBeNull();
    expect(leadStatusProblem("NOU", "PIERDUT", { hasPatient: false, lostReason: "  " })).toMatch(/motivul/);
    expect(leadStatusProblem("NOU", "PIERDUT", { hasPatient: false, lostReason: "A ales altă clinică" })).toBeNull();
    expect(leadStatusProblem("PIERDUT", "CONTACTAT", { hasPatient: false })).toBeNull();
    expect(leadStatusProblem("NOU", "NOU", { hasPatient: false })).not.toBeNull();
  });

  it("splits a name on the first word and suggests the child for a child booking", () => {
    expect(splitLeadName("  Maria   Suciu ")).toEqual({ firstName: "Maria", lastName: "Suciu" });
    expect(splitLeadName("Ion Pop Vasile")).toEqual({ firstName: "Ion", lastName: "Pop Vasile" });
    expect(splitLeadName("Ion")).toEqual({ firstName: "Ion", lastName: "" });
    expect(suggestedPatient({ name: "Ana Man", phone: "+40700000001", email: null, forChild: true, childFirstName: "Ioana" })).toEqual({
      firstName: "Ioana",
      lastName: "Man",
      phone: "+40700000001",
      email: null,
    });
  });

  it("copies GDPR and SMS consents as online-form evidence", () => {
    const at = new Date("2026-10-01T08:00:00Z");
    const rows = leadConsentRows(
      { consentGdprAt: at, consentTextVersion: "gdpr-2026-10", consentSms: true, ipHash: "h", createdAt: at, source: "PROGRAMARE_ONLINE" },
      "p1",
      "u1",
      "fallback",
    );
    expect(rows.map((r) => [r.type, r.method, r.textVersion, r.granted])).toEqual([
      ["GDPR_DATE_SANATATE", "FORMULAR_ONLINE", "gdpr-2026-10", true],
      ["SMS", "FORMULAR_ONLINE", "gdpr-2026-10", true],
    ]);
    expect(rows[0].grantedAt).toBe(at);
    expect(leadConsentRows({ consentGdprAt: null, consentTextVersion: null, consentSms: false, ipHash: null, createdAt: at, source: "FORMULAR_CONTACT" }, "p", "u", "v")).toEqual([]);
  });
});

describe("pipeline (integration)", () => {
  let c: Clinic;
  let reception: CurrentUser;
  let admin: CurrentUser;

  beforeAll(async () => {
    c = await makeClinic(prisma);
    reception = await makeUser("RECEPTIE");
    admin = await makeUser("ADMIN");
  });

  it("assigns, logs a call (Nou → Contactat) and marks a lead lost with a reason", async () => {
    const { lead } = await onlineLead(c, { withAppointment: false });
    await assignLead(lead.id, reception.id, admin);
    await addLeadActivity({ id: lead.id, type: "APEL", body: "Nu răspunde, revin după 16." }, reception);
    let fresh = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: true } });
    expect(fresh.assignedToId).toBe(reception.id);
    expect(fresh.status).toBe("CONTACTAT");
    expect(fresh.contactedAt).not.toBeNull();
    expect(fresh.activities.map((a) => a.type).sort()).toEqual(["APEL", "ATRIBUIRE", "STATUS"]);

    await expect(changeLeadStatus({ id: lead.id, status: "PIERDUT" }, reception)).rejects.toBeInstanceOf(DomainError);
    await changeLeadStatus({ id: lead.id, status: "PIERDUT", lostReason: "A ales altă clinică" }, reception);
    fresh = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: true } });
    expect(fresh.status).toBe("PIERDUT");
    expect(fresh.lostReason).toBe("A ales altă clinică");
    const audits = await prisma.auditLog.count({ where: { entityId: lead.id, action: "lead.update" } });
    expect(audits).toBe(3); // assign, call, lost (the refused change writes nothing)
  });

  it("converts an online lead into a new patient: consents, tentative appointment, status, audit", async () => {
    const { lead, appointmentId } = await onlineLead(c);
    const r = await convertLead(
      { leadId: lead.id, mode: "nou", firstName: "Elena", lastName: uniq("Rus"), phone: lead.phone!, ignoreDuplicates: true, acknowledgeWarnings: false },
      reception,
      NOW,
    );
    expect(r.createdPatient).toBe(true);
    expect(r.appointmentId).toBe(appointmentId);

    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId! } });
    expect(appt.patientId).toBe(r.patientId);

    const fresh = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.status).toBe("PROGRAMAT");
    expect(fresh.convertedAt).not.toBeNull();
    expect(fresh.patientId).toBe(r.patientId);

    const consents = await prisma.consent.findMany({ where: { patientId: r.patientId }, orderBy: { type: "asc" } });
    expect(consents.map((x) => [x.type, x.method, x.textVersion])).toEqual([
      ["GDPR_DATE_SANATATE", "FORMULAR_ONLINE", "gdpr-test"],
      ["SMS", "FORMULAR_ONLINE", "gdpr-test"],
    ]);
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: r.patientId } });
    expect(patient.smsOptIn).toBe(true);
    expect(patient.comfortDefault).toBe("FRICA");
    expect(patient.acquisitionSource).toBe("PROGRAMARE_ONLINE");

    expect(await prisma.auditLog.count({ where: { entityId: lead.id, action: "lead.convert" } })).toBe(1);
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id, type: "CONVERSIE" } })).toBe(1);

    // A second conversion is refused.
    await expect(
      convertLead({ leadId: lead.id, mode: "existent", patientId: r.patientId, ignoreDuplicates: false, acknowledgeWarnings: false }, reception, NOW),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const board = await listLeads({ status: "PROGRAMAT", locationIds: [c.l1.id] });
    expect(board.some((l) => l.id === lead.id && l.patientId === r.patientId)).toBe(true);
  });

  it("offers the existing patient when the phone matches, then uses it", async () => {
    const { lead } = await onlineLead(c, { minute: 660 });
    const existing = await prisma.patient.create({
      data: { fileNumber: 800_000 + Math.floor(Math.random() * 99_999), firstName: "Elena", lastName: "Existentă", phone: lead.phone, searchText: "elena existenta" },
    });
    const err = await convertLead(
      { leadId: lead.id, mode: "nou", firstName: "Elena", lastName: "Nouă", phone: lead.phone!, ignoreDuplicates: false, acknowledgeWarnings: false },
      reception,
      NOW,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    const details = (err as DomainError).details as { duplicates?: { id: string }[] };
    expect(details.duplicates?.map((d) => d.id)).toContain(existing.id);

    const r = await convertLead({ leadId: lead.id, mode: "existent", patientId: existing.id, ignoreDuplicates: false, acknowledgeWarnings: false }, reception, NOW);
    expect(r).toMatchObject({ patientId: existing.id, createdPatient: false });
  });

  it("creates the appointment when the lead has none, with the conflict check", async () => {
    const { lead } = await onlineLead(c, { withAppointment: false, consentSms: false });
    // Doctor A is busy 09:00–09:30 on DAY.
    const blocker = await onlineLead(c, { minute: 540 });
    await expect(
      convertLead(
        { leadId: lead.id, mode: "nou", firstName: "Dan", lastName: uniq("Pop"), ignoreDuplicates: true, locationId: c.l1.id, doctorId: c.doctorA.id, date: DAY, time: 540, durationMinutes: 30, acknowledgeWarnings: false },
        reception,
        NOW,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(blocker.appointmentId).not.toBeNull();

    const r = await convertLead(
      { leadId: lead.id, mode: "nou", firstName: "Dan", lastName: uniq("Pop"), ignoreDuplicates: true, locationId: c.l1.id, doctorId: c.doctorA.id, date: DAY, time: 570, durationMinutes: 30, acknowledgeWarnings: false },
      reception,
      NOW,
    );
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: r.appointmentId } });
    expect(appt.leadId).toBe(lead.id);
    expect(appt.patientId).toBe(r.patientId);
    expect(appt.status).toBe("PROGRAMAT");
    expect(await prisma.consent.count({ where: { patientId: r.patientId, type: "SMS" } })).toBe(0);
  });
});
