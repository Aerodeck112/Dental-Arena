import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const { isolatedTestDb } = await import("./isolated-db");
  process.env.DATABASE_URL = isolatedTestDb("duplicates");
});

import type { CurrentUser } from "@/lib/auth/dal";
import { cnpControlDigit } from "@/lib/validation/common";
import { duplicateReasons, findDuplicateMatches, findDuplicatePatients, nameKey } from "../duplicates";
import { createPatient } from "../service";
import { prisma } from "@/lib/db";
import { makeUsers, runTag } from "./fixtures";

const tag = runTag();
let admin: CurrentUser;

/** A valid CNP for 1990-05-12, county 26 (Mureș), with a serial number from 001 to 999. */
function cnp(serial: number): string {
  const first12 = `190051226${String((serial % 999) + 1).padStart(3, "0")}`;
  return first12 + cnpControlDigit(first12);
}
const phone = `+40799${String(Date.now() % 1_000_000).padStart(6, "0")}`;
const theCnp = cnp(Number(String(process.pid).slice(-3) + String(Date.now() % 100)));

beforeAll(async () => {
  ({ admin } = await makeUsers(tag));
  await createPatient(prisma, { firstName: "Ioana", lastName: `Măn${tag}`, phone, birthDate: "1990-05-12", cnp: theCnp }, admin);
});

describe("pure rules", () => {
  it("name keys ignore diacritics, case, spacing and order", () => {
    expect(nameKey("Măria", "Suciu")).toBe(nameKey("maria", " SUCIU "));
    expect(nameKey("Suciu", "Maria")).toBe(nameKey("Maria", "Suciu"));
  });
  it("collects every matching reason", () => {
    const q = { phone: "+40744000000", email: "a@b.ro", nameKey: "a b", birthISO: "1990-01-01", cnpHash: "h" };
    expect(duplicateReasons(q, { phone: "+40744000000", email: "a@b.ro", nameKey: "a b", birthISO: "1990-01-01", cnpHash: "h" })).toEqual([
      "telefon",
      "cnp",
      "nume-data-nasterii",
      "email",
    ]);
    expect(duplicateReasons(q, { phone: null, email: null, nameKey: "a b", birthISO: "1991-01-01", cnpHash: null })).toEqual([]);
  });
});

describe("findDuplicatePatients", () => {
  it("matches the same phone in any format", async () => {
    const local = "0" + phone.slice(3);
    const spaced = `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
    const m = await findDuplicateMatches({ phone: spaced });
    expect(m).toHaveLength(1);
    expect(m[0].reasons).toEqual(["telefon"]);
  });
  it("matches the same CNP through its hash", async () => {
    const m = await findDuplicateMatches({ cnp: theCnp });
    expect(m.map((x) => x.reasons)).toEqual([["cnp"]]);
  });
  it("matches the same name and birth date without diacritics", async () => {
    const m = await findDuplicatePatients({ firstName: "ioana", lastName: `man${tag}`, birthDate: "1990-05-12" });
    expect(m).toHaveLength(1);
    expect(m[0]).not.toHaveProperty("reasons");
    const none = await findDuplicatePatients({ firstName: "ioana", lastName: `man${tag}`, birthDate: "1990-05-13" });
    expect(none).toHaveLength(0);
  });
  it("rejects a second patient with the same CNP", async () => {
    await expect(createPatient(prisma, { firstName: "Alt", lastName: "Pacient", cnp: theCnp }, admin)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("never offers anonymised patients", async () => {
    const m = await findDuplicateMatches({ phone });
    await prisma.patient.update({ where: { id: m[0].id }, data: { anonymizedAt: new Date() } });
    expect(await findDuplicateMatches({ phone })).toHaveLength(0);
  });
});
