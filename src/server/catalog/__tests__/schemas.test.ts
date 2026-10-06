import { describe, expect, it } from "vitest";
import { SETTINGS_FORM_SCHEMAS } from "@/components/crm/admin/settings-schemas";
import { SETTINGS_SCHEMAS } from "@/lib/settings-schema";
import { serviceSchema } from "../schemas";

const base = {
  categoryId: "cmuw5huc80000u77divbvrxg1",
  name: "Implant Neodent",
  unit: "ACT",
  durationMinutes: "90",
  sortOrder: "0",
};

describe("serviceSchema", () => {
  it("turns the price text into catalog fields", () => {
    const r = serviceSchema.safeParse({ ...base, price: "de la 2.200" });
    expect(r.success && { min: r.data.priceMin, max: r.data.priceMax, from: r.data.priceFrom }).toEqual({ min: 220000, max: null, from: true });
  });

  it("reports a bad price on the price field and requires the online label", () => {
    const bad = serviceSchema.safeParse({ ...base, price: "mult" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].path).toEqual(["price"]);
    const online = serviceSchema.safeParse({ ...base, price: "100", bookableOnline: "on" });
    expect(online.error?.issues[0].path).toEqual(["onlineLabel"]);
  });

  it("keeps durations on the 5-minute grid", () => {
    expect(serviceSchema.safeParse({ ...base, price: "", durationMinutes: "33" }).success).toBe(false);
  });
});

describe("settings form schemas", () => {
  it("produce values the strict settings schemas accept", () => {
    const clinic = SETTINGS_FORM_SCHEMAS.clinic.parse({
      displayName: "Dental Arena Clinic",
      email: "office@dentalarena.ro",
      dpoEmail: "office@dentalarena.ro",
      foundedYear: "2009",
      iban: "",
      facebookUrl: "",
    });
    expect(clinic.cui).toBe("[de completat]");
    expect(clinic.iban).toBeNull();
    expect(SETTINGS_SCHEMAS.clinic.strict().safeParse(clinic).success).toBe(true);

    const booking = SETTINGS_FORM_SCHEMAS.booking.parse({
      slotStepMinutes: "15",
      minLeadMinutes: "120",
      horizonDays: "30",
      maxDaysPerRequest: "14",
      bufferMinutes: "0",
      cancelCutoffHours: "2",
      morningEndsAtMinute: "13:00",
      homeServiceCode: "CON-CONSULT",
      unsureServiceCode: "CON-CONSULT",
      onlineEnabled: "on",
    });
    expect(booking.morningEndsAtMinute).toBe(780);
    expect(SETTINGS_SCHEMAS.booking.strict().safeParse(booking).success).toBe(true);
  });

  it("explains errors in Romanian", () => {
    const r = SETTINGS_FORM_SCHEMAS.invoicing.safeParse({ invoiceSeries: "da-1", receiptSeries: "DAC", defaultVatRate: "abc", vatExemptionNote: "", paymentTermDays: "0" });
    const messages = r.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Seria are 1–8 majuscule, de exemplu DA.");
    expect(messages.some((m) => m.startsWith("Completați cota TVA"))).toBe(true);
  });
});
