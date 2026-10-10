import { describe, expect, it, vi } from "vitest";

vi.hoisted(async () => {
  const { isolatedTestDb } = await import("./isolated-db");
  process.env.DATABASE_URL = isolatedTestDb("flags");
});

import { prisma } from "@/lib/db";
import { allergyLabel, derivePatientFlags, getPatientFlagsBulk, type FlagMedicalInput } from "../flags";
import { rawPatient } from "./fixtures";

const noMedical: FlagMedicalInput = {
  allergies: null,
  anticoagulants: false,
  bleedingDisorder: false,
  cardiacDisease: false,
  hypertension: false,
  diabetes: false,
  asthma: false,
  epilepsy: false,
  hepatitis: false,
  hiv: false,
  bisphosphonates: false,
  pregnancy: false,
};
const now = new Date("2026-10-06T10:00:00Z");

describe("allergyLabel", () => {
  it("formats free text and ignores „nu”", () => {
    expect(allergyLabel("Penicilină, latex")).toBe("Alergie: penicilină, latex");
    expect(allergyLabel("AINS; Penicilină.")).toBe("Alergie: AINS, penicilină");
    expect(allergyLabel("nu")).toBeNull();
    expect(allergyLabel(" - ")).toBeNull();
    expect(allergyLabel(null)).toBeNull();
  });
});

describe("derivePatientFlags", () => {
  it("returns nothing for a healthy adult without comfort needs", () => {
    expect(
      derivePatientFlags({ birthDate: new Date("1980-01-01"), comfortDefault: "FARA_EMOTII", prefersSedation: false, medical: noMedical }, now),
    ).toEqual([]);
  });

  it("derives alerts, comfort, sedation and child flags in order", () => {
    const flags = derivePatientFlags(
      {
        birthDate: new Date("2019-03-01"),
        comfortDefault: "FRICA",
        prefersSedation: true,
        medical: { ...noMedical, allergies: "penicilină", anticoagulants: true, pregnancy: false, diabetes: true },
      },
      now,
    );
    expect(flags).toEqual([
      { kind: "alerta", label: "Alergie: penicilină" },
      { kind: "alerta", label: "Anticoagulante" },
      { kind: "alerta", label: "Diabet" },
      { kind: "confort", label: expect.any(String) },
      { kind: "sedare", label: "Preferă inhalosedare" },
      { kind: "copil", label: "Copil, 7 ani" },
    ]);
  });

  it("a patient without anamneză gets no medical alerts", () => {
    expect(derivePatientFlags({ birthDate: null, comfortDefault: null, prefersSedation: false, medical: null }, now)).toEqual([]);
  });

  it("an 18-year-old is not a child", () => {
    const f = derivePatientFlags({ birthDate: new Date("2008-10-01"), comfortDefault: null, prefersSedation: false, medical: null }, now);
    expect(f.find((x) => x.kind === "copil")).toBeUndefined();
  });
});

describe("getPatientFlagsBulk", () => {
  it("loads flags for many patients and skips unknown ids", async () => {
    const a = await rawPatient();
    const b = await rawPatient();
    await prisma.medicalHistory.create({ data: { patientId: a.id, allergies: "latex", anticoagulants: true } });
    await prisma.patient.update({ where: { id: b.id }, data: { comfortDefault: "EMOTII" } });
    const map = await getPatientFlagsBulk([a.id, b.id, "inexistent", a.id]);
    expect(map.get(a.id)?.map((f) => f.label)).toEqual(["Alergie: latex", "Anticoagulante"]);
    expect(map.get(b.id)?.map((f) => f.kind)).toEqual(["confort"]);
    expect(map.has("inexistent")).toBe(false);
    expect((await getPatientFlagsBulk([])).size).toBe(0);
  });
});
