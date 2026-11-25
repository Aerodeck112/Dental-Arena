import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp4.db";
});

import { prisma } from "@/lib/db";
import { signAppointmentToken } from "@/lib/tokens";
import { localToUtc } from "@/lib/time";
import { buildIcs, escapeText, foldLine } from "../ics";
import { cancelByToken, confirmByToken, getManagedAppointment, icsForToken } from "../links";
import { makeClinic, type Clinic } from "./fixtures";

const DAY = "2027-05-12";
const at = (hhmm: string, day = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return localToUtc(day, h * 60 + m);
};
const NOW = at("08:00", "2027-05-10");

let k: Clinic;

beforeAll(async () => {
  k = await makeClinic(prisma);
});

async function onlineAppointment(from: string, day = DAY) {
  const lead = await prisma.lead.create({
    data: { source: "PROGRAMARE_ONLINE", status: "NOU", name: "Maria Elena Suciu", phone: "+40744123456" },
  });
  const appt = await prisma.appointment.create({
    data: {
      locationId: k.l1.id,
      doctorId: k.doctorA.id,
      cabinetId: k.c1.id,
      leadId: lead.id,
      startsAt: at(from, day),
      endsAt: new Date(at(from, day).getTime() + 30 * 60_000),
      status: "PROGRAMAT",
      source: "ONLINE",
      reason: "Implant sau lucrare dentară",
      comfort: "FRICA",
    },
  });
  return { appt, lead, token: signAppointmentToken(appt) };
}

describe("patient link /p/[token]", () => {
  it("shows only first name, date, time, clinic, address and doctor", async () => {
    const { token } = await onlineAppointment("10:00");
    const view = await getManagedAppointment(token, NOW);
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const a = view.appointment;
    expect(a.firstName).toBe("Maria");
    expect(a.time).toBe("10:00");
    expect(a.dateLabel).toBe("Miercuri, 12 mai");
    expect(a.locationName).toMatch(/^Dental Arena Test/);
    expect(a.address).toBe("str. Test 1, Testești, Mureș");
    expect(a.doctorName).toBe("Dr. Ana Testescu");
    expect(a.canConfirm).toBe(true);
    expect(a.canCancel).toBe(true);
    const json = JSON.stringify(a);
    expect(json).not.toMatch(/Implant|FRICA|Suciu|0744/);
  });

  it("never changes data when read", async () => {
    const { appt, token } = await onlineAppointment("10:30");
    await getManagedAppointment(token, NOW);
    await icsForToken(token, NOW);
    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(after.status).toBe("PROGRAMAT");
    expect(after.updatedAt.getTime()).toBe(appt.updatedAt.getTime());
  });

  it("rejects tampered, expired and stale-version tokens with the invalid-link message", async () => {
    const { appt, token } = await onlineAppointment("11:00");
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    for (const t of [tampered, "nimic", signAppointmentToken({ ...appt, tokenVersion: appt.tokenVersion + 1 })]) {
      const v = await getManagedAppointment(t, NOW);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.message).toMatch(/^Linkul nu mai este valabil\. Pentru modificări sunați la .*Testești, 0265\s000\s001/);
    }
    const expired = await getManagedAppointment(token, new Date(appt.startsAt.getTime() + 25 * 3_600_000));
    expect(expired.ok).toBe(false);
    expect(await icsForToken(tampered, NOW)).toBeNull();
  });

  it("confirms with confirmedVia LINK, audits without an actor and logs the lead activity", async () => {
    const { appt, lead, token } = await onlineAppointment("11:30");
    const v = await confirmByToken(token, NOW);
    expect(v.status).toBe("CONFIRMAT");
    expect(v.canConfirm).toBe(false);
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(row.status).toBe("CONFIRMAT");
    expect(row.confirmedVia).toBe("LINK");
    expect(row.confirmedAt).toEqual(NOW);
    const audit = await prisma.auditLog.findFirst({ where: { action: "appointment.status", entityId: appt.id } });
    expect(audit?.actorId).toBeNull();
    expect(JSON.parse(audit?.metadata ?? "{}")).toEqual({ from: "PROGRAMAT", to: "CONFIRMAT", via: "link" });
    expect(await prisma.leadActivity.count({ where: { leadId: lead.id } })).toBe(1);
    // A second click is harmless, and the link still works after confirming.
    expect((await confirmByToken(token, NOW)).status).toBe("CONFIRMAT");
  });

  it("cancels before the cutoff, bumps tokenVersion (old link dies) and refuses after it", async () => {
    const { appt, token } = await onlineAppointment("14:00");
    const r = await cancelByToken(token, NOW);
    expect(r.appointmentId).toBe(appt.id);
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(row).toMatchObject({ status: "ANULAT", cancelledBy: "PACIENT", tokenVersion: appt.tokenVersion + 1 });
    expect((await getManagedAppointment(token, NOW)).ok).toBe(false);

    const late = await onlineAppointment("15:00");
    const oneHourBefore = new Date(late.appt.startsAt.getTime() - 60 * 60_000);
    const view = await getManagedAppointment(late.token, oneHourBefore);
    expect(view.ok && view.appointment.cancelClosed).toBe(true);
    await expect(cancelByToken(late.token, oneHourBefore)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      message: expect.stringMatching(/doar la telefon: Testești, 0265\s000\s001/),
    });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: late.appt.id } })).status).toBe("PROGRAMAT");
  });

  it("serves a valid iCalendar file without the reason for the visit", async () => {
    const { token } = await onlineAppointment("16:00");
    const ics = await icsForToken(token, NOW);
    expect(ics?.filename).toBe(`programare-dental-arena-${DAY}.ics`);
    const body = ics?.body ?? "";
    expect(body.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain(`DTSTART:${at("16:00").toISOString().replace(/[-:]/g, "").replace(".000", "")}`);
    expect(body).toContain("STATUS:TENTATIVE");
    expect(body).toContain("BEGIN:VALARM");
    expect(body).not.toMatch(/Implant|FRICA/);
    for (const line of body.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("ics helpers", () => {
  it("escapes text and folds long lines on character boundaries", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const long = `DESCRIPTION:${"ș".repeat(60)}`;
    const folded = foldLine(long);
    expect(folded.split("\r\n ").join("")).toBe(long);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
  });

  it("omits the alarm for a cancelled event", () => {
    const body = buildIcs({
      uid: "x@dentalarena.ro",
      startsAt: new Date("2027-01-01T08:00:00Z"),
      endsAt: new Date("2027-01-01T08:30:00Z"),
      stamp: new Date("2026-12-01T08:00:00Z"),
      summary: "Programare",
      location: "Cristești",
      description: "Medic",
      status: "CANCELLED",
      sequence: 2,
      alarmMinutesBefore: 120,
    });
    expect(body).toContain("SEQUENCE:2");
    expect(body).not.toContain("VALARM");
  });
});
