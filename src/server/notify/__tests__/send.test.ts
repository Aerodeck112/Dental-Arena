import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp5.db";
});

import { prisma } from "@/lib/db";
import { localToUtc } from "@/lib/time";
import { sendManualFromStaff } from "../log";
import { notifyClinicCancellation, notifyClinicNewLead, sendAppointmentMessage, templateKeyFor } from "../send";

const tag = `snd${process.pid}${Date.now().toString(36)}`;
const START = localToUtc("2033-05-10", 10 * 60 + 30);
let info: ReturnType<typeof vi.spyOn>;
let locationId: string;
let doctorId: string;
let fileNumber = 700_000 + Math.floor(Math.random() * 90_000);

async function patient(o: { phone?: string; email?: string; smsOptIn?: boolean }) {
  fileNumber += 1;
  return prisma.patient.create({
    data: { fileNumber, firstName: "Ioana", lastName: "Man", searchText: "ioana man", phone: o.phone ?? null, email: o.email ?? null, smsOptIn: o.smsOptIn ?? false },
  });
}

async function appointment(patientId: string | null, leadId: string | null = null, status: "PROGRAMAT" | "CONFIRMAT" = "PROGRAMAT") {
  return prisma.appointment.create({
    data: { locationId, doctorId, patientId, leadId, status, source: "ONLINE", startsAt: START, endsAt: new Date(START.getTime() + 30 * 60_000), reason: "Durere la măseaua 36" },
  });
}

beforeAll(async () => {
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  locationId = (
    await prisma.location.create({
      data: { slug: `${tag}-l`, name: "Dental Arena Luduș", shortName: "Luduș", street: "str. Gheorghe Barițiu nr. 6", city: "Luduș", phone: "+40365430125", sortOrder: 96 },
    })
  ).id;
  doctorId = (await prisma.doctor.create({ data: { slug: `${tag}-d`, firstName: "Ana", lastName: "Mașca", publicName: "Dr. Ana Mașca", roleLine: "Medic" } })).id;
});

afterAll(() => vi.restoreAllMocks());

describe("templateKeyFor", () => {
  it("maps kinds and channels to template keys", () => {
    expect(templateKeyFor("CONFIRMARE_PROGRAMARE", "EMAIL", "PROGRAMAT")).toBe("booking.received.email");
    expect(templateKeyFor("CONFIRMARE_PROGRAMARE", "EMAIL", "CONFIRMAT")).toBe("booking.confirmed.email");
    expect(templateKeyFor("CONFIRMARE_PROGRAMARE", "SMS", "CONFIRMAT")).toBe("booking.confirmed.sms");
    expect(templateKeyFor("REMINDER", "SMS")).toBe("reminder.sms");
    expect(templateKeyFor("ANULARE", "EMAIL")).toBe("cancel.email");
    expect(templateKeyFor("MODIFICARE", "SMS")).toBe("moved.sms");
  });
});

describe("sendAppointmentMessage", () => {
  it("sends SMS only with consent, logs SIMULAT without SMTP and prints to the console in dev", async () => {
    const p = await patient({ phone: "+40744555001", email: "ioana@example.com", smsOptIn: false });
    const a = await appointment(p.id);
    const before = info.mock.calls.length;
    const r = await sendAppointmentMessage("CONFIRMARE_PROGRAMARE", a.id);
    expect(r).toEqual([{ channel: "EMAIL", status: "SIMULAT" }]);
    expect(info.mock.calls.length).toBeGreaterThan(before);
    const log = await prisma.messageLog.findFirstOrThrow({ where: { appointmentId: a.id } });
    expect(log).toMatchObject({ channel: "EMAIL", kind: "CONFIRMARE_PROGRAMARE", status: "SIMULAT", provider: "console", to: "ioana@example.com", patientId: p.id });
    expect(log.subject).toBe("Am primit cererea de programare: marți, 10 mai, ora 10:30");
    expect(log.body).toContain("/p/");
    // Never the reason for the visit.
    expect(log.body).not.toContain("măseaua");
    expect(log.body).not.toContain("Durere");
  });

  it("transliterates SMS text and uses the lead when there is no patient", async () => {
    const lead = await prisma.lead.create({ data: { source: "PROGRAMARE_ONLINE", name: "Gheorghe Moldovan", phone: "+40744555002", consentSms: true } });
    const a = await appointment(null, lead.id, "CONFIRMAT");
    const r = await sendAppointmentMessage("CONFIRMARE_PROGRAMARE", a.id, { channels: ["SMS"] });
    expect(r).toEqual([{ channel: "SMS", status: "SIMULAT" }]);
    const log = await prisma.messageLog.findFirstOrThrow({ where: { appointmentId: a.id } });
    expect(log.body).toBe("Programarea de marti, 10 mai, ora 10:30, la Dental Arena Ludus este confirmata. Daca nu mai puteti veni, sunati la 0365 430 125.");
    expect(log.leadId).toBe(lead.id);
  });

  it("sends nothing for an anonymised patient or a missing appointment", async () => {
    const p = await patient({ phone: "+40744555003", email: "x@example.com", smsOptIn: true });
    await prisma.patient.update({ where: { id: p.id }, data: { anonymizedAt: new Date() } });
    const a = await appointment(p.id);
    expect(await sendAppointmentMessage("REMINDER", a.id)).toEqual([]);
    expect(await sendAppointmentMessage("REMINDER", "nu-exista")).toEqual([]);
  });
});

describe("clinic notifications", () => {
  it("new lead: name and source only, with a link to the CRM", async () => {
    const lead = await prisma.lead.create({
      data: { source: "FORMULAR_CONTACT", name: "Elena Rus", phone: "+40744555004", message: "Am o infecție la gingie.", locationId },
    });
    await notifyClinicNewLead(lead.id);
    const log = await prisma.messageLog.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(log).toMatchObject({ kind: "NOTIFICARE_CLINICA", to: "office@dentalarena.ro", subject: "Cerere nouă din site: Elena Rus, Formular de contact" });
    expect(log.body).toContain(`http://localhost:3000/crm/cereri/${lead.id}`);
    expect(log.body).not.toContain("infecție");
  });

  it("cancellation through a link", async () => {
    const p = await patient({ phone: "+40744555005" });
    const a = await appointment(p.id);
    await notifyClinicCancellation(a.id);
    const log = await prisma.messageLog.findFirstOrThrow({ where: { appointmentId: a.id, kind: "NOTIFICARE_CLINICA" } });
    expect(log.subject).toBe("Programare anulată de pacient: marți, 10 mai, ora 10:30");
    expect(log.body).toContain("Ioana Man a anulat prin link");
    expect(log.body).toContain(`/crm/programari/${a.id}`);
  });
});

describe("manual messages", () => {
  it("take the recipient from the patient record and require SMS consent", async () => {
    const p = await patient({ phone: "+40744555006", email: "manual@example.com", smsOptIn: false });
    await expect(sendManualFromStaff({ channel: "SMS", body: "Test", patientId: p.id }, "user-1")).rejects.toMatchObject({ code: "VALIDATION" });
    const r = await sendManualFromStaff({ channel: "EMAIL", to: "altcineva@example.com", subject: "Rezultate", body: "Vă rugăm să ne sunați.", patientId: p.id }, "user-1");
    expect(r.status).toBe("SIMULAT");
    const log = await prisma.messageLog.findFirstOrThrow({ where: { patientId: p.id, kind: "MANUAL" } });
    expect(log).toMatchObject({ to: "manual@example.com", sentById: "user-1", subject: "Rezultate" });
  });

  it("validate a free recipient for the channel", async () => {
    await expect(sendManualFromStaff({ channel: "SMS", to: "123", body: "Test" }, "user-1")).rejects.toMatchObject({ fieldErrors: { to: expect.any(Array) } });
    await expect(sendManualFromStaff({ channel: "EMAIL", to: "nu-e-email", subject: "S", body: "Test" }, "user-1")).rejects.toMatchObject({ code: "VALIDATION" });
    const r = await sendManualFromStaff({ channel: "SMS", to: "0744 555 007", body: "Vă așteptăm mâine." }, "user-1");
    expect(r.status).toBe("SIMULAT");
    const log = await prisma.messageLog.findFirstOrThrow({ where: { to: "+40744555007" } });
    expect(log.body).toBe("Va asteptam maine.");
  });
});
