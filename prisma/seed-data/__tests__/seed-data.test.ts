import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePhone } from "../../../src/lib/validation/common";
import { DEMO_HOURS, LOCATIONS } from "../locations";
import { DEMO_SEED, createRandom, mulberry32 } from "../random";
import { CATEGORIES, SERVICES, lei } from "../services";
import { DEFAULT_SEED_PASSWORD, DEMO_SHIFTS, DEMO_TIME_OFF, DOCTORS, STAFF_USERS } from "../team";

const doc = readFileSync(path.join(process.cwd(), "docs/architecture.md"), "utf8");

/** A markdown table that starts with the given header row, as arrays of trimmed cells. */
function table(headerStart: string): string[][] {
  const start = doc.indexOf(headerStart);
  expect(start, headerStart).toBeGreaterThan(0);
  const rows: string[][] = [];
  for (const line of doc.slice(start).split("\n").slice(2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.split("|").slice(1, -1).map((c) => c.trim()));
  }
  return rows;
}

const num = (s: string) => Number(s.replace(/\./g, ""));

type SpecPrice = { price: number | null; priceMax?: number; priceFrom?: boolean };
function parsePrice(cell: string): SpecPrice {
  if (cell.startsWith("null")) return { price: null };
  const from = /^de la (.+)$/.exec(cell);
  if (from) return { price: num(from[1]), priceFrom: true };
  const range = /^(.+) \/ (.+)$/.exec(cell);
  if (range) return { price: num(range[1]), priceMax: num(range[2]) };
  return { price: num(cell) };
}

describe("catalog (§10.3)", () => {
  const specCategories = table("| # | Category slug |");
  const specServices = table("| code | category | name | price (lei) |");

  it("has the 10 categories in order", () => {
    expect(CATEGORIES.map((c) => [c.sortOrder, c.slug, c.name])).toEqual(
      specCategories.map(([n, slug, name]) => [Number(n), slug.replace(/`/g, ""), name]),
    );
  });

  it("has every price item of the spec, and nothing else", () => {
    expect(specServices.length).toBe(66);
    expect(SERVICES.map((s) => s.code)).toEqual(specServices.map((r) => r[0]));
  });

  it.each(table("| code | category | name | price (lei) |").map((r) => [r[0], r]))("matches %s", (_code, row) => {
    const [code, category, name, priceCell, unit, minutes, flags] = row as string[];
    const s = SERVICES.find((x) => x.code === code)!;
    expect(s.category).toBe(category);
    expect(s.name).toBe(name);
    const spec = parsePrice(priceCell);
    expect(s.price).toBe(spec.price);
    expect(s.priceMax).toBe(spec.priceMax);
    expect(Boolean(s.priceFrom)).toBe(Boolean(spec.priceFrom));
    expect(s.unit ?? "ACT").toBe(unit);
    expect(s.durationMinutes).toBe(Number(minutes));
    expect(Boolean(s.representative)).toBe(flags.includes("**R**"));
    const online = /Online „([^”]+)”/.exec(flags);
    expect(s.online?.label).toBe(online?.[1]);
    if (flags.includes("`toothSpecific`")) expect(s.toothSpecific).toBe(true);
    const recall = /`recallMonths (\d+)`/.exec(flags);
    if (recall) expect(s.recallMonths).toBe(Number(recall[1]));
  });

  it("passes the acceptance spot checks in bani", () => {
    const byCode = (code: string) => SERVICES.find((s) => s.code === code)!;
    expect(lei(byCode("IMP-NEODENT").price!)).toBe(220000);
    expect([lei(byCode("PR-ZR").price!), lei(byCode("PR-ZR").priceMax!)]).toEqual([90000, 120000]);
    expect([lei(byCode("INH-ORA").price!), byCode("INH-ORA").unit]).toEqual([15000, "ORA"]);
    expect(byCode("CON-CONSULT").price).toBeNull();
    expect(byCode("SG-URGENTA").publicVisible).toBe(false);
  });

  it("writes every name with comma-below diacritics", () => {
    const text = [...CATEGORIES.map((c) => `${c.name} ${c.summary}`), ...SERVICES.map((s) => `${s.name} ${s.online?.label ?? ""}`)].join(" ");
    expect(text).not.toMatch(/[şţŞŢ]/);
  });
});

describe("locations and team (§10.1, §10.2)", () => {
  it("seeds both clinics with their phones and cabinets", () => {
    expect(LOCATIONS.map((l) => [l.slug, l.name, normalizePhone(l.phone), l.cabinets.length, l.sedationUnits])).toEqual([
      ["cristesti", "Dental Arena Cristești", "+40265326316", 3, 1],
      ["ludus", "Dental Arena Luduș", "+40365430125", 2, 1],
    ]);
    expect(DEMO_HOURS).toHaveLength(5);
    expect(DEMO_HOURS.every((h) => h.openMinute === 540 && h.closeMinute === 1140)).toBe(true);
  });

  it("seeds the five doctors and the eight accounts", () => {
    expect(DOCTORS.map((d) => d.slug)).toEqual([
      "andrei-marcoci",
      "mihail-dan-masca",
      "paul-bologa",
      "victoria-ana-podar",
      "ana-maria-fertea",
    ]);
    const emails = [...STAFF_USERS.map((u) => u.email), ...DOCTORS.map((d) => d.email)];
    expect(emails).toEqual([
      "admin@dentalarena.ro",
      "receptie.cristesti@dentalarena.ro",
      "receptie.ludus@dentalarena.ro",
      "andrei.marcoci@dentalarena.ro",
      "mihail.masca@dentalarena.ro",
      "paul.bologa@dentalarena.ro",
      "victoria.podar@dentalarena.ro",
      "anamaria.fertea@dentalarena.ro",
    ]);
    expect(DEFAULT_SEED_PASSWORD).toBe("parola-demo-2026");
  });

  it("never puts two shifts in the same cabinet at the same time, and keeps breaks inside shifts", () => {
    const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
    const slots = DEMO_SHIFTS.flatMap((s) => s.weekdays.map((weekday) => ({ ...s, weekday })));
    expect(slots).toHaveLength(19);
    for (const [i, a] of slots.entries()) {
      for (const b of slots.slice(i + 1)) {
        const overlap = minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
        const sameDay = a.weekday === b.weekday && overlap;
        if (sameDay && a.location === b.location) expect(a.cabinet === b.cabinet, `${a.doctor}/${b.doctor}`).toBe(false);
        if (sameDay) expect(a.doctor === b.doctor, `${a.doctor} în două locuri`).toBe(false);
      }
      for (const br of a.breaks) {
        expect(minutes(br.start)).toBeGreaterThanOrEqual(minutes(a.start));
        expect(minutes(br.end)).toBeLessThanOrEqual(minutes(a.end));
      }
    }
  });

  it("plans Fertea's leave and the 1 December closure", () => {
    expect(DEMO_TIME_OFF).toHaveLength(3);
    expect(DEMO_TIME_OFF[0]).toMatchObject({ doctor: "ana-maria-fertea", kind: "CONCEDIU", fromDayOffset: 10, days: 3 });
    expect(DEMO_TIME_OFF.filter((t) => t.kind === "SARBATOARE").map((t) => t.location)).toEqual(["cristesti", "ludus"]);
  });
});

describe("demo randomness", () => {
  it("is deterministic (mulberry32, seed 20261005)", () => {
    expect(DEMO_SEED).toBe(20261005);
    const a = mulberry32(DEMO_SEED);
    const b = mulberry32(DEMO_SEED);
    const seqA = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    const r = createRandom();
    for (let i = 0; i < 100; i += 1) {
      const n = r.int(8, 12);
      expect(n).toBeGreaterThanOrEqual(8);
      expect(n).toBeLessThanOrEqual(12);
    }
  });
});
