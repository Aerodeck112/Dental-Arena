import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp4.db";
});
vi.mock("next/headers", async () => (await import("@/lib/__tests__/helpers/next-request")).nextHeadersMock);

import { NextRequest } from "next/server";
import { resetRequest } from "@/lib/__tests__/helpers/next-request";
import { prisma } from "@/lib/db";
import { addDaysISO, localToUtc, todayISO } from "@/lib/time";
import { GET } from "@/app/api/public/slots/route";
import type { DaySlots } from "../types";
import { makeClinic, type Clinic } from "./fixtures";

let k: Clinic;
const day = addDaysISO(todayISO(), 5);

beforeAll(async () => {
  k = await makeClinic(prisma);
});

beforeEach(() => {
  resetRequest({ "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250)}` });
});

function call(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/public/slots");
  for (const [key, v] of Object.entries(params)) url.searchParams.set(key, v);
  return GET(new NextRequest(url));
}

describe("GET /api/public/slots", () => {
  it("returns the slots of the shifts, without breaks, booked times or time off", async () => {
    await prisma.appointment.create({
      data: { locationId: k.l1.id, doctorId: k.doctorA.id, startsAt: localToUtc(day, 600), endsAt: localToUtc(day, 660), status: "CONFIRMAT", source: "TELEFON" },
    });
    await prisma.timeOff.create({
      data: { doctorId: k.doctorA.id, kind: "BLOCAJ", startsAt: localToUtc(day, 900), endsAt: localToUtc(day, 960) },
    });
    const res = await call({ clinica: k.l1.slug, serviciu: k.service.code ?? "", medic: k.doctorA.slug, de: day, zile: "2" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as DaySlots[];
    expect(body.map((d) => d.dateISO)).toEqual([day, addDaysISO(day, 1)]);
    const times = body[0].slots.map((s) => s.localTime);
    expect(times[0]).toBe("09:00");
    expect(times.at(-1)).toBe("16:30");
    for (const t of ["10:00", "10:30", "12:00", "15:00", "15:30"]) expect(times).not.toContain(t);
    expect(times).toContain("09:30");
    expect(times).toContain("11:00");
    expect(body[0].slots.every((s) => s.doctorIds.length === 1 && s.doctorIds[0] === k.doctorA.id)).toBe(true);
    expect(body[0].slots[0].period).toBe("dimineata");
    expect(body[0].slots.at(-1)?.period).toBe("dupa-amiaza");
  });

  it("merges „Oricare medic” and accepts ids as well as slugs and codes", async () => {
    const res = await call({ clinica: k.l1.id, serviciu: k.service.id, de: day, zile: "1" });
    const body = (await res.json()) as DaySlots[];
    const noon = body[0].slots.find((s) => s.localTime === "12:00");
    expect(noon?.doctorIds).toEqual([k.doctorB.id]);
    const nine = body[0].slots.find((s) => s.localTime === "09:00");
    expect(nine?.doctorIds).toEqual([k.doctorA.id, k.doctorB.id]);
  });

  it("never offers a slot inside the lead time", async () => {
    const res = await call({ clinica: k.l1.slug, serviciu: k.service.id, de: todayISO(), zile: "1" });
    const body = (await res.json()) as DaySlots[];
    const limit = Date.now() + 120 * 60_000;
    expect(body[0].slots.every((s) => Date.parse(s.startsAt) >= limit)).toBe(true);
  });

  it("returns empty days for a service that is not bookable online", async () => {
    const res = await call({ clinica: k.l1.slug, serviciu: k.offline.id, de: day, zile: "3" });
    const body = (await res.json()) as DaySlots[];
    expect(body).toHaveLength(3);
    expect(body.every((d) => d.slots.length === 0)).toBe(true);
  });

  it("returns 400 on bad parameters, with a JSON error", async () => {
    const cases: Record<string, string>[] = [
      { clinica: k.l1.slug, serviciu: k.service.id },
      { clinica: k.l1.slug, serviciu: k.service.id, de: "7 octombrie" },
      { clinica: k.l1.slug, serviciu: k.service.id, de: day, zile: "30" },
      { clinica: "cluj", serviciu: k.service.id, de: day },
      { clinica: k.l1.slug, serviciu: "NU-EXISTA", de: day },
      { clinica: k.l1.slug, serviciu: k.service.id, de: "2027-02-31" },
    ];
    for (const params of cases) {
      const res = await call(params);
      expect(res.status).toBe(400);
      expect(typeof ((await res.json()) as { error: string }).error).toBe("string");
    }
  });

  it("returns 429 over 60 requests a minute from one IP", async () => {
    resetRequest({ "x-forwarded-for": "192.0.2.254" });
    let status = 0;
    for (let i = 0; i < 61; i++) status = (await call({ clinica: "x", serviciu: "y" })).status;
    expect(status).toBe(429);
  });
});
