import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp5.db";
});

// A controllable SMS provider: succeeds (simulated) unless `sms.fail` is set.
const sms = vi.hoisted(() => ({ fail: false, sent: [] as { to: string; text: string }[] }));
vi.mock("@/server/notify/sms", () => ({
  getSmsProvider: () => ({
    name: "test",
    simulated: true,
    async send(to: string, text: string) {
      if (sms.fail) throw new Error("Furnizor indisponibil");
      sms.sent.push({ to, text });
      return { providerMessageId: `sms-${sms.sent.length}` };
    },
  }),
}));

import { prisma } from "@/lib/db";
import { SETTINGS_DEFAULTS } from "@/lib/settings";
import { addDaysISO, localToUtc } from "@/lib/time";
import { verifyAppointmentToken } from "@/lib/tokens";
import { GET as cronReminders, POST as cronRemindersPost } from "@/app/api/cron/reminders/route";
import { GET as cronMaintenance } from "@/app/api/cron/maintenance/route";
import { MAX_REMINDER_ERRORS, findReminderCandidates, isQuietTime, runReminders } from "../reminders";

const HOUR = 60 * 60 * 1000;
const settings = { ...SETTINGS_DEFAULTS.reminders };

// Each run uses its own day far in the future, so leftovers from other runs or files never match.
const DAY = addDaysISO("2031-03-02", Math.floor(Math.random() * 3000));
const NOW = localToUtc(DAY, 10 * 60); // 10:00 local, outside the quiet window
const tag = `rem${process.pid}${Date.now().toString(36)}`;

type Ids = Record<"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h", string>;
let ids: Ids;
let locationId: string;
let doctorId: string;

async function appointment(o: {
  hoursAhead: number;
  patientId?: string | null;
  leadId?: string | null;
  status?: "PROGRAMAT" | "CONFIRMAT" | "ANULAT";
  createdHoursBefore?: number;
  reminderSentAt?: Date | null;
}) {
  const startsAt = new Date(NOW.getTime() + o.hoursAhead * HOUR);
  const a = await prisma.appointment.create({
    data: {
      locationId,
      doctorId,
      patientId: o.patientId ?? null,
      leadId: o.leadId ?? null,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status: o.status ?? "PROGRAMAT",
      source: "TELEFON",
      reminderSentAt: o.reminderSentAt ?? null,
      createdAt: new Date(NOW.getTime() - (o.createdHoursBefore ?? 48) * HOUR),
    },
  });
  return a.id;
}

let fileNumber = 900_000 + Math.floor(Math.random() * 90_000);
async function patient(o: { phone?: string | null; email?: string | null; smsOptIn?: boolean; smsConsent?: boolean }) {
  fileNumber += 1;
  const p = await prisma.patient.create({
    data: {
      fileNumber,
      firstName: "Maria",
      lastName: `Suciu${fileNumber}`,
      searchText: `maria suciu${fileNumber}`,
      phone: o.phone ?? null,
      email: o.email ?? null,
      smsOptIn: o.smsOptIn ?? false,
    },
  });
  if (o.smsConsent) {
    await prisma.consent.create({ data: { patientId: p.id, type: "SMS", granted: true, method: "VERBAL", textVersion: "sms-v1" } });
  }
  return p.id;
}

beforeAll(async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const loc = await prisma.location.create({
    data: { slug: `${tag}-cr`, name: "Dental Arena Cristești", shortName: "Cristești", street: "str. Principală 536J/1", city: "Cristești", phone: "+40265326316", sortOrder: 95 },
  });
  locationId = loc.id;
  const doc = await prisma.doctor.create({
    data: { slug: `${tag}-dr`, firstName: "Andrei", lastName: "Marcoci", publicName: "Dr. Andrei Marcoci", roleLine: "Medic dentist" },
  });
  doctorId = doc.id;

  const pBoth = await patient({ phone: "+40744000101", email: "ana@example.com", smsOptIn: true });
  const pEmailOnly = await patient({ phone: "+40744000102", email: "ion@example.com", smsOptIn: false });
  const pConsent = await patient({ phone: "+40744000103", smsConsent: true });
  const lead = await prisma.lead.create({
    data: { source: "PROGRAMARE_ONLINE", name: "Elena Rus", phone: "+40744000104", consentSms: true },
  });

  ids = {
    a: await appointment({ hoursAhead: 20, patientId: pBoth }), // SMS + e-mail
    b: await appointment({ hoursAhead: 23.5, patientId: pEmailOnly, status: "CONFIRMAT" }), // e-mail only (no SMS consent)
    c: await appointment({ hoursAhead: 1.5, patientId: pBoth }), // too soon (< 2 h)
    d: await appointment({ hoursAhead: 25, patientId: pBoth }), // beyond 24 h
    e: await appointment({ hoursAhead: 5, patientId: pBoth, createdHoursBefore: 0.5 }), // booked less than 6 h before the visit
    f: await appointment({ hoursAhead: 20, patientId: pBoth, status: "ANULAT" }), // cancelled
    g: await appointment({ hoursAhead: 21, patientId: pConsent, reminderSentAt: new Date(NOW.getTime() - HOUR) }), // already sent
    h: await appointment({ hoursAhead: 12, leadId: lead.id }), // tentative online booking: the lead is the contact
  };
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  sms.fail = false;
  sms.sent = [];
});

describe("quiet hours", () => {
  it("wrap past midnight with the defaults (21:00–08:00 local)", () => {
    expect(isQuietTime(localToUtc(DAY, 21 * 60), settings)).toBe(true);
    expect(isQuietTime(localToUtc(DAY, 2 * 60), settings)).toBe(true);
    expect(isQuietTime(localToUtc(DAY, 7 * 60 + 59), settings)).toBe(true);
    expect(isQuietTime(localToUtc(DAY, 8 * 60), settings)).toBe(false);
    expect(isQuietTime(localToUtc(DAY, 20 * 60 + 59), settings)).toBe(false);
    expect(isQuietTime(NOW, { quietStartMinute: 600, quietEndMinute: 660 })).toBe(true);
    expect(isQuietTime(NOW, { quietStartMinute: 600, quietEndMinute: 600 })).toBe(false);
  });

  it("skip the run without touching anything", async () => {
    const r = await runReminders(localToUtc(DAY, 22 * 60), { settings });
    expect(r).toMatchObject({ skipped: "quiet-hours" });
    expect(await prisma.appointment.count({ where: { id: { in: [ids.a, ids.b, ids.h] }, reminderSentAt: { not: null } } })).toBe(0);
  });
});

describe("runReminders", () => {
  it("selects exactly the §6.6 candidates", async () => {
    const candidates = await findReminderCandidates(NOW, settings);
    expect(candidates.map((c) => c.id).sort()).toEqual([ids.a, ids.b, ids.h].sort());
  });

  it("sends on the allowed channels, logs every message and links to /p/[token]", async () => {
    const r = await runReminders(NOW, { settings });
    expect(r).toEqual({ now: NOW.toISOString(), considered: 3, sent: { sms: 2, email: 2 }, failed: 0, skipped: 0 });

    const logs = await prisma.messageLog.findMany({
      where: { appointmentId: { in: Object.values(ids) }, kind: "REMINDER" },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => `${l.appointmentId === ids.a ? "a" : l.appointmentId === ids.b ? "b" : "h"}:${l.channel}`).sort()).toEqual([
      "a:EMAIL",
      "a:SMS",
      "b:EMAIL",
      "h:SMS",
    ]);
    for (const l of logs) {
      expect(l.status).toBe("SIMULAT");
      const token = /\/p\/([A-Za-z0-9_.-]+)/.exec(l.body)?.[1];
      expect(token, l.body).toBeTruthy();
      expect(verifyAppointmentToken(token!, NOW)?.appointmentId).toBe(l.appointmentId);
    }

    const smsA = logs.find((l) => l.appointmentId === ids.a && l.channel === "SMS")!;
    expect(smsA.to).toBe("+40744000101");
    expect(smsA.body).toMatch(/^Dental Arena: va reamintim programarea de \S+, \d+ \S+, ora \d\d:\d\d, la Dental Arena Cristesti\. Confirmati sau anulati: http/);
    expect(smsA.body).not.toMatch(/[ăâîșțşţ„”]/);

    const emailA = logs.find((l) => l.appointmentId === ids.a && l.channel === "EMAIL")!;
    expect(emailA.to).toBe("ana@example.com");
    expect(emailA.subject).toMatch(/^Vă reamintim programarea de /);
    expect(emailA.body).toContain("Bună ziua, Maria,");
    expect(emailA.body).toContain("buletinul și lista medicamentelor");
    expect(emailA.body).toContain("str. Principală 536J/1, Cristești, jud. Mureș");

    expect(logs.find((l) => l.appointmentId === ids.h)!.to).toBe("+40744000104");
    expect(sms.sent).toHaveLength(2);

    const claimed = await prisma.appointment.findMany({ where: { id: { in: [ids.a, ids.b, ids.h] } }, select: { reminderSentAt: true } });
    expect(claimed.every((a) => a.reminderSentAt?.getTime() === NOW.getTime())).toBe(true);
  });

  it("sends nothing on a second run", async () => {
    const before = await prisma.messageLog.count({ where: { appointmentId: { in: Object.values(ids) } } });
    const r = await runReminders(new Date(NOW.getTime() + 60 * 1000), { settings });
    expect(r).toMatchObject({ considered: 0, sent: { sms: 0, email: 0 }, failed: 0 });
    expect(await prisma.messageLog.count({ where: { appointmentId: { in: Object.values(ids) } } })).toBe(before);
    expect(sms.sent).toHaveLength(0);
  });

  it("never sends twice when two runs race", async () => {
    const p = await patient({ phone: "+40744000105", smsOptIn: true });
    const id = await appointment({ hoursAhead: 22, patientId: p });
    const [r1, r2] = await Promise.all([runReminders(NOW, { settings }), runReminders(NOW, { settings })]);
    const total = (x: typeof r1) => ("sent" in x ? x.sent.sms : 0);
    expect(total(r1) + total(r2)).toBe(1);
    expect(await prisma.messageLog.count({ where: { appointmentId: id } })).toBe(1);
  });

  it("releases the claim when every channel fails and stops after 3 errors", async () => {
    const p = await patient({ phone: "+40744000106", smsOptIn: true });
    const id = await appointment({ hoursAhead: 20, patientId: p });
    sms.fail = true;
    for (let i = 1; i <= MAX_REMINDER_ERRORS; i++) {
      const r = await runReminders(new Date(NOW.getTime() + i * HOUR), { settings: { ...settings, hoursBefore: 24 } });
      expect(r).toMatchObject({ failed: 1 });
      const a = await prisma.appointment.findUniqueOrThrow({ where: { id }, select: { reminderSentAt: true } });
      // Released after the 1st and 2nd error, kept after the 3rd.
      expect(a.reminderSentAt === null).toBe(i < MAX_REMINDER_ERRORS);
    }
    const errors = await prisma.messageLog.findMany({ where: { appointmentId: id, status: "EROARE" } });
    expect(errors).toHaveLength(MAX_REMINDER_ERRORS);
    expect(errors[0].error).toContain("Furnizor indisponibil");
    const r = await runReminders(new Date(NOW.getTime() + 4 * HOUR), { settings });
    expect("considered" in r && r.considered).toBe(0);
  });

  it("does nothing when reminders are switched off", async () => {
    expect(await runReminders(NOW, { settings: { ...settings, enabled: false } })).toMatchObject({ skipped: "disabled" });
  });
});

describe("cron routes", () => {
  const req = (auth?: string) =>
    new Request("http://localhost:3000/api/cron/reminders", { headers: auth ? { authorization: auth } : {} });

  it("return 401 without the bearer token or with a wrong one", async () => {
    for (const handler of [cronReminders, cronRemindersPost, cronMaintenance]) {
      expect((await handler(req())).status).toBe(401);
      expect((await handler(req("Bearer nu-este-secretul"))).status).toBe(401);
      expect((await handler(req("test-cron-secret"))).status).toBe(401);
      expect((await handler(req("Basic test-cron-secret"))).status).toBe(401);
    }
    const body = await (await cronReminders(req())).json();
    expect(body).toEqual({ error: "Lipsește tokenul de acces sau nu este corect." });
  });

  it("run with the correct token and return a summary", async () => {
    const res = await cronReminders(req("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.now).toBe("string");
    expect("skipped" in body || "considered" in body).toBe(true);
  });
});
