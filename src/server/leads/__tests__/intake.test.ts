import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp4.db";
});
vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);
const sent = vi.hoisted(() => ({ messages: [] as string[], leads: [] as string[] }));
vi.mock("@/server/notify/send", () => ({
  sendAppointmentMessage: async (kind: string, id: string) => {
    sent.messages.push(`${kind}:${id}`);
    return [];
  },
  notifyClinicNewLead: async (id: string) => {
    sent.leads.push(id);
  },
  notifyClinicCancellation: async () => {},
}));

import { randomUUID } from "node:crypto";
import { resetRequest } from "@/lib/__tests__/helpers/next-request";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { FORM_TS_FIELD, HONEYPOT_FIELD, signFormTimestamp } from "@/lib/honeypot";
import { addDaysISO, localToUtc, todayISO } from "@/lib/time";
import { requestCallback, submitBooking } from "@/app/(site)/programare/actions";
import { makeClinic, type Clinic } from "@/server/scheduling/__tests__/fixtures";
import { createCallbackRequest, createContactLead, createOnlineBooking } from "../intake";
import { onlineBookingSchema, type OnlineBookingInput } from "../schemas";

const DAY = "2027-04-14"; // a Wednesday, inside the 30-day horizon of NOW
const NOW = localToUtc("2027-04-05", 8 * 60);
const at = (hhmm: string, day = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return localToUtc(day, h * 60 + m);
};
const META = { ipHash: "test-ip-hash", now: NOW };

let k: Clinic;
let phoneSeq = 700_000 + Math.floor(Math.random() * 200_000);

function phone(): string {
  phoneSeq += 1;
  return `+40744${String(phoneSeq).padStart(6, "0")}`;
}

function input(over: Partial<OnlineBookingInput> & { startsAt: Date }): OnlineBookingInput {
  return onlineBookingSchema.parse({
    serviceId: k.service.id,
    locationId: k.l1.id,
    name: "Maria Suciu",
    phone: phone(),
    consentGdpr: true,
    idempotencyKey: randomUUID(),
    ...over,
    startsAt: over.startsAt.toISOString(),
  });
}

beforeAll(async () => {
  k = await makeClinic(prisma);
});

beforeEach(() => {
  resetRequest({ "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}` });
});

describe("createOnlineBooking", () => {
  it("creates Lead(PROGRAMARE_ONLINE, NOU) and Appointment(PROGRAMAT, ONLINE) without a patient", async () => {
    const i = input({ doctorId: k.doctorA.id, startsAt: at("09:00"), comfort: "FRICA", comfortNote: "Mi-e teamă de ac.", email: "maria@example.com", consentSms: true });
    const r = await createOnlineBooking(i, META);
    expect(r.replayed).toBe(false);
    expect(r.localTime).toBe("09:00");
    expect(r.localDateLabel).toBe("Miercuri, 14 aprilie");
    expect(r.doctorName).toBe("Dr. Ana Testescu");
    expect(r.manageUrl).toMatch(/^http:\/\/localhost:3000\/p\/[\w.-]+$/);

    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: r.appointmentId }, include: { lead: true } });
    expect(appt).toMatchObject({
      status: "PROGRAMAT",
      source: "ONLINE",
      patientId: null,
      leadId: r.leadId,
      doctorId: k.doctorA.id,
      cabinetId: k.c1.id,
      serviceId: k.service.id,
      reason: "Consultație sau control",
      comfort: "FRICA",
      comfortNote: "Mi-e teamă de ac.",
    });
    expect(appt.endsAt.getTime() - appt.startsAt.getTime()).toBe(30 * 60_000);
    expect(appt.lead).toMatchObject({
      source: "PROGRAMARE_ONLINE",
      status: "NOU",
      phone: i.phone,
      email: "maria@example.com",
      consentSms: true,
      consentTextVersion: "gdpr-2026-10",
      ipHash: "test-ip-hash",
      idempotencyKey: i.idempotencyKey,
    });
    expect(appt.lead?.consentGdprAt).toBeInstanceOf(Date);

    const activity = await prisma.leadActivity.findMany({ where: { leadId: r.leadId } });
    expect(activity.map((a) => a.body)).toContain("Programare online creată");
    const auditRow = await prisma.auditLog.findFirst({ where: { action: "booking.create", entityId: r.appointmentId } });
    expect(auditRow?.actorId).toBeNull();
    expect(JSON.parse(auditRow?.metadata ?? "{}")).toMatchObject({ channel: "online" });

    await vi.waitFor(() => {
      expect(sent.messages).toContain(`CONFIRMARE_PROGRAMARE:${r.appointmentId}`);
      expect(sent.leads).toContain(r.leadId);
    });
  });

  it("for „Oricare medic” picks the doctor with the fewest booked minutes, then the lowest sortOrder", async () => {
    const first = await createOnlineBooking(input({ startsAt: at("10:00") }), META);
    const a1 = await prisma.appointment.findUniqueOrThrow({ where: { id: first.appointmentId } });
    // A already has 09:00 (30 min) from the previous test, B has nothing: B is chosen.
    expect(a1.doctorId).toBe(k.doctorB.id);
    expect(a1.cabinetId).toBe(k.c2.id);
    const second = await createOnlineBooking(input({ startsAt: at("11:00") }), META);
    const a2 = await prisma.appointment.findUniqueOrThrow({ where: { id: second.appointmentId } });
    // Now both have 30 minutes: the tie goes to A (sortOrder 1).
    expect(a2.doctorId).toBe(k.doctorA.id);
  });

  it("gives exactly one success for two concurrent submits of the same doctor and slot", async () => {
    const start = at("14:00");
    const results = await Promise.allSettled([
      createOnlineBooking(input({ doctorId: k.doctorA.id, startsAt: start }), META),
      createOnlineBooking(input({ doctorId: k.doctorA.id, startsAt: start }), META),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    const err = failed[0].reason as DomainError;
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe("SLOT_TAKEN");
    expect(err.message).toBe("Ora de 14:00 tocmai a fost ocupată. Alegeți altă oră; celelalte date au rămas completate.");
    const count = await prisma.appointment.count({ where: { doctorId: k.doctorA.id, startsAt: start, status: "PROGRAMAT" } });
    expect(count).toBe(1);
  });

  it("books two concurrent „Oricare medic” requests for the same time with different doctors", async () => {
    const start = at("15:00");
    const [x, y] = await Promise.all([
      createOnlineBooking(input({ startsAt: start }), META),
      createOnlineBooking(input({ startsAt: start }), META),
    ]);
    const rows = await prisma.appointment.findMany({ where: { id: { in: [x.appointmentId, y.appointmentId] } } });
    expect(new Set(rows.map((r) => r.doctorId)).size).toBe(2);
    await expect(createOnlineBooking(input({ startsAt: start }), META)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
  });

  it("returns the first result for a repeated idempotency key, also when the repeats race", async () => {
    const i = input({ doctorId: k.doctorB.id, startsAt: at("16:00") });
    const first = await createOnlineBooking(i, META);
    const again = await createOnlineBooking({ ...i }, META);
    expect(again.replayed).toBe(true);
    expect(again.appointmentId).toBe(first.appointmentId);
    expect(again.manageUrl).toBe(first.manageUrl);

    const j = input({ doctorId: k.doctorB.id, startsAt: at("16:30") });
    const [p, q] = await Promise.all([createOnlineBooking(j, META), createOnlineBooking({ ...j }, META)]);
    expect(p.appointmentId).toBe(q.appointmentId);
    expect(await prisma.lead.count({ where: { idempotencyKey: { in: [i.idempotencyKey, j.idempotencyKey] } } })).toBe(2);
  });

  it("re-validates the rules: lead time, horizon, grid, break, offline service and doctor", async () => {
    const soon = new Date(NOW.getTime() + 60 * 60_000);
    await expect(createOnlineBooking(input({ startsAt: soon }), META)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createOnlineBooking(input({ startsAt: at("10:00", "2027-06-01") }), META)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createOnlineBooking(input({ startsAt: at("10:07") }), META)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await expect(createOnlineBooking(input({ doctorId: k.doctorA.id, startsAt: at("12:00") }), META)).rejects.toMatchObject({ code: "SLOT_TAKEN" });
    await expect(createOnlineBooking(input({ serviceId: k.offline.id, startsAt: at("13:00") }), META)).rejects.toMatchObject({ code: "VALIDATION" });
    await prisma.doctor.update({ where: { id: k.doctorB.id }, data: { acceptsOnlineBooking: false } });
    try {
      await expect(createOnlineBooking(input({ doctorId: k.doctorB.id, startsAt: at("13:00") }), META)).rejects.toMatchObject({ code: "VALIDATION" });
    } finally {
      await prisma.doctor.update({ where: { id: k.doctorB.id }, data: { acceptsOnlineBooking: true } });
    }
  });

  it("still books when the sedation unit is busy, and flags it for reception", async () => {
    const day = "2027-04-15";
    await prisma.appointment.create({
      data: { locationId: k.l1.id, doctorId: k.doctorB.id, cabinetId: k.c2.id, startsAt: at("09:00", day), endsAt: at("10:00", day), status: "CONFIRMAT", source: "RECEPTIE", wantsSedation: true },
    });
    const r = await createOnlineBooking(input({ doctorId: k.doctorA.id, startsAt: at("09:30", day), wantsSedation: true }), META);
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: r.appointmentId } });
    expect(appt.wantsSedation).toBe(true);
    expect(appt.notes).toMatch(/inhalosedare/);
    const audit = await prisma.auditLog.findFirst({ where: { action: "booking.create", entityId: r.appointmentId } });
    expect(JSON.parse(audit?.metadata ?? "{}")).toMatchObject({ warning: "SEDATION_UNIT_BUSY" });
  });
});

describe("callback and contact leads", () => {
  it("creates an APEL_INVERS lead with the wizard context, idempotent by key", async () => {
    const key = randomUUID();
    const p = phone();
    const r = await createCallbackRequest(
      { name: "Ana Man", phone: p, preferredTime: "după ora 16", locationId: k.l1.id, serviceId: k.service.id, comfort: "EMOTII", consentGdpr: true, idempotencyKey: key },
      { ipHash: "h" },
    );
    const again = await createCallbackRequest(
      { name: "Ana Man", phone: p, preferredTime: undefined, consentGdpr: true, idempotencyKey: key },
      { ipHash: "h" },
    );
    expect(again.leadId).toBe(r.leadId);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.leadId } });
    expect(lead).toMatchObject({ source: "APEL_INVERS", status: "NOU", preferredTime: "după ora 16", locationId: k.l1.id, serviceId: k.service.id, comfort: "EMOTII" });
  });

  it("creates a FORMULAR_CONTACT lead with the message and consent", async () => {
    const r = await createContactLead(
      { name: "Ion Pop", email: "ion@example.com", message: "Bună ziua, aș vrea o ofertă.", consentGdpr: true, location: undefined },
      { ipHash: "h", sourcePath: "/contact" },
    );
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.leadId } });
    expect(lead).toMatchObject({ source: "FORMULAR_CONTACT", status: "NOU", message: "Bună ziua, aș vrea o ofertă.", sourcePath: "/contact" });
    expect(lead.consentGdprAt).toBeInstanceOf(Date);
  });
});

describe("booking actions (publicAction guards)", () => {
  const liveDay = addDaysISO(todayISO(), 6);

  function form(entries: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, v] of Object.entries(entries)) fd.append(key, v);
    return fd;
  }

  function bookingForm(over: Record<string, string> = {}) {
    return form({
      serviceId: k.service.id,
      locationId: k.l1.id,
      doctorId: k.doctorA.id,
      startsAt: localToUtc(liveDay, 10 * 60).toISOString(),
      name: "Elena Rus",
      phone: phone(),
      consentGdpr: "on",
      idempotencyKey: randomUUID(),
      [HONEYPOT_FIELD]: "",
      [FORM_TS_FIELD]: signFormTimestamp(new Date(Date.now() - 10_000)),
      ...over,
    });
  }

  it("gives a filled honeypot a fake success and writes no rows", async () => {
    const p = phone();
    const r = await submitBooking(bookingForm({ phone: p, [HONEYPOT_FIELD]: "https://spam.example" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.localTime).toBe("10:00");
      expect(r.data.manageUrl).toBe("");
    }
    expect(await prisma.lead.count({ where: { phone: p } })).toBe(0);
  });

  it("treats a form sent faster than 3 seconds as a bot too", async () => {
    const p = phone();
    const r = await submitBooking(bookingForm({ phone: p, [FORM_TS_FIELD]: signFormTimestamp(new Date()) }));
    expect(r.ok).toBe(true);
    expect(await prisma.lead.count({ where: { phone: p } })).toBe(0);
  });

  it("books through the action and maps a taken slot to SLOT_TAKEN", async () => {
    const start = localToUtc(liveDay, 11 * 60).toISOString();
    const r = await submitBooking(bookingForm({ startsAt: start }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.localTime).toBe("11:00");
      expect(r.data.manageUrl).toMatch(/\/p\//);
      expect(r.data).not.toHaveProperty("appointmentId");
    }
    resetRequest({ "x-forwarded-for": "198.51.100.251" });
    const taken = await submitBooking(bookingForm({ startsAt: start }));
    expect(taken.ok).toBe(false);
    if (!taken.ok) {
      expect(taken.code).toBe("SLOT_TAKEN");
      expect(taken.error).toBe("Ora de 11:00 tocmai a fost ocupată. Alegeți altă oră; celelalte date au rămas completate.");
    }
  });

  it("limits bookings per phone number to 3 per day", async () => {
    const p = phone();
    const codes: string[] = [];
    for (let i = 0; i < 4; i++) {
      resetRequest({ "x-forwarded-for": `203.0.113.${10 + i}` });
      // Invalid start (past) so nothing is booked; the phone bucket still counts the attempt.
      const r = await submitBooking(bookingForm({ phone: p, startsAt: localToUtc(addDaysISO(todayISO(), -1), 600).toISOString() }));
      codes.push(r.ok ? "OK" : r.code);
    }
    expect(codes).toEqual(["VALIDATION", "VALIDATION", "VALIDATION", "RATE_LIMITED"]);
  });

  it("creates a callback lead through „Prefer să mă sunați”", async () => {
    const p = phone();
    const r = await requestCallback(
      form({ name: "Vasile Boț", phone: p, consentGdpr: "on", locationId: k.l1.id, [HONEYPOT_FIELD]: "", [FORM_TS_FIELD]: signFormTimestamp(new Date(Date.now() - 8000)) }),
    );
    expect(r).toMatchObject({ ok: true, message: "Vă sunăm noi în cel mult o zi lucrătoare." });
    expect(await prisma.lead.findFirst({ where: { phone: p } })).toMatchObject({ source: "APEL_INVERS" });
  });
});
