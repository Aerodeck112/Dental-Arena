import { describe, expect, it } from "vitest";
import {
  callbackSchema,
  comfortFromParam,
  contactLeadSchema,
  onlineBookingSchema,
  slotsQuerySchema,
} from "../schemas";

const ID_A = "ckabcdefghijklmnopqrstu1";
const ID_B = "ckabcdefghijklmnopqrstu2";
const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e";

function booking(over: Record<string, unknown> = {}) {
  return {
    serviceId: ID_A,
    locationId: ID_B,
    startsAt: "2026-10-07T07:30:00.000Z",
    name: "  Maria   Suciu ",
    phone: "0744 123 456",
    consentGdpr: "on",
    idempotencyKey: KEY,
    ...over,
  };
}

function fieldErrors(r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const out: Record<string, string[]> = {};
  for (const i of r.error?.issues ?? []) (out[i.path.map(String).join(".")] ??= []).push(i.message);
  return out;
}

describe("onlineBookingSchema", () => {
  it("accepts a minimal booking and normalises it", () => {
    const r = onlineBookingSchema.parse(booking());
    expect(r.name).toBe("Maria Suciu");
    expect(r.phone).toBe("+40744123456");
    expect(r.startsAt).toBeInstanceOf(Date);
    expect(r.startsAt.toISOString()).toBe("2026-10-07T07:30:00.000Z");
    expect(r.forWhom).toBe("eu");
    expect(r.wantsSedation).toBe(false);
    expect(r.consentSms).toBe(false);
    expect(r.doctorId).toBeUndefined();
    expect(r.email).toBeUndefined();
  });

  it("strips unknown keys and treats empty optional fields as missing", () => {
    const r = onlineBookingSchema.parse(booking({ doctorId: "", email: "", note: "  ", extra: "x", website: "" }));
    expect(r.doctorId).toBeUndefined();
    expect(r.email).toBeUndefined();
    expect(r.note).toBeUndefined();
    expect("extra" in r).toBe(false);
  });

  it("requires the GDPR consent, with the §12.4 wording", () => {
    const r = onlineBookingSchema.safeParse(booking({ consentGdpr: undefined }));
    expect(r.success).toBe(false);
    expect(fieldErrors(r).consentGdpr?.[0]).toMatch(/acordul dumneavoastră/);
  });

  it("asks for the name when it is missing or too short, instead of a generic message", () => {
    for (const name of [undefined, "", "   ", "A"]) {
      const r = onlineBookingSchema.safeParse(booking({ name }));
      expect(fieldErrors(r).name).toEqual(["Scrieți numele și prenumele."]);
    }
    expect(fieldErrors(onlineBookingSchema.safeParse(booking({ name: "x".repeat(81) }))).name?.[0]).toMatch(/80/);
  });

  it("explains a bad phone number with an example", () => {
    const r = onlineBookingSchema.safeParse(booking({ phone: "12" }));
    expect(fieldErrors(r).phone).toEqual(["Introduceți un număr de telefon, de exemplu 0745 123 456."]);
  });

  it("asks for the child's first name and age when booking for a child", () => {
    const r = onlineBookingSchema.safeParse(booking({ forWhom: "copil" }));
    const e = fieldErrors(r);
    expect(e.childFirstName).toEqual(["Scrieți prenumele copilului."]);
    expect(e.childAge?.[0]).toMatch(/vârsta copilului/);
    const ok = onlineBookingSchema.parse(booking({ forWhom: "copil", childFirstName: "Ioana", childAge: "7" }));
    expect(ok.childAge).toBe(7);
    expect(onlineBookingSchema.safeParse(booking({ forWhom: "copil", childFirstName: "Ion", childAge: "18" })).success).toBe(false);
  });

  it("accepts the comfort values and the sedation checkbox", () => {
    const r = onlineBookingSchema.parse(booking({ comfort: "FRICA", wantsSedation: "on", comfortNote: "Am avut o extracție grea." }));
    expect(r.comfort).toBe("FRICA");
    expect(r.wantsSedation).toBe(true);
    expect(onlineBookingSchema.safeParse(booking({ comfort: "PANICA" })).success).toBe(false);
  });

  it("rejects a missing or malformed idempotency key, start and ids", () => {
    expect(onlineBookingSchema.safeParse(booking({ idempotencyKey: "abc" })).success).toBe(false);
    expect(onlineBookingSchema.safeParse(booking({ startsAt: "mâine la 10" })).success).toBe(false);
    expect(onlineBookingSchema.safeParse(booking({ startsAt: "2026-10-07" })).success).toBe(false);
    expect(onlineBookingSchema.safeParse(booking({ serviceId: "1; drop table" })).success).toBe(false);
  });

  it("limits free text and keeps only a relative source path", () => {
    expect(onlineBookingSchema.safeParse(booking({ note: "x".repeat(2001) })).success).toBe(false);
    expect(onlineBookingSchema.parse(booking({ sourcePath: "https://evil.example/" })).sourcePath).toBeUndefined();
    expect(onlineBookingSchema.parse(booking({ sourcePath: "//evil.example" })).sourcePath).toBeUndefined();
    expect(onlineBookingSchema.parse(booking({ sourcePath: "/programare" })).sourcePath).toBe("/programare");
  });
});

describe("contactLeadSchema", () => {
  const base = { name: "Ion Pop", message: "Aș vrea o programare pentru copil.", consentGdpr: true };

  it("needs an e-mail or a phone number", () => {
    const r = contactLeadSchema.safeParse(base);
    expect(fieldErrors(r).email?.[0]).toMatch(/e-mail sau un număr de telefon/);
    expect(contactLeadSchema.safeParse({ ...base, email: "ION@Example.com " }).success).toBe(true);
    expect(contactLeadSchema.parse({ ...base, email: "ION@Example.com " }).email).toBe("ion@example.com");
    expect(contactLeadSchema.parse({ ...base, phone: "0265.326.316" }).phone).toBe("+40265326316");
  });

  it("accepts only the two clinics and requires the message and consent", () => {
    expect(contactLeadSchema.safeParse({ ...base, phone: "0744123456", location: "ludus" }).success).toBe(true);
    expect(contactLeadSchema.safeParse({ ...base, phone: "0744123456", location: "cluj" }).success).toBe(false);
    expect(contactLeadSchema.safeParse({ ...base, phone: "0744123456", message: "" }).success).toBe(false);
    expect(contactLeadSchema.safeParse({ ...base, phone: "0744123456", consentGdpr: false }).success).toBe(false);
  });
});

describe("callbackSchema", () => {
  it("needs a name, a phone and the consent; the rest is optional", () => {
    const r = callbackSchema.parse({ name: "Ana Man", phone: "+40 744 123 456", consentGdpr: "on", preferredTime: "după ora 16" });
    expect(r.phone).toBe("+40744123456");
    expect(r.preferredTime).toBe("după ora 16");
    expect(r.idempotencyKey).toBeUndefined();
    expect(callbackSchema.safeParse({ name: "Ana Man", phone: "0744123456" }).success).toBe(false);
  });
});

describe("comfortFromParam", () => {
  it("reads the URL and sessionStorage forms", () => {
    expect(comfortFromParam("fara-emotii")).toBe("FARA_EMOTII");
    expect(comfortFromParam("emotii")).toBe("EMOTII");
    expect(comfortFromParam("FRICA")).toBe("FRICA");
    expect(comfortFromParam("fara_emotii")).toBe("FARA_EMOTII");
    expect(comfortFromParam("altceva")).toBeNull();
    expect(comfortFromParam(null)).toBeNull();
  });
});

describe("slotsQuerySchema", () => {
  it("validates the public API parameters", () => {
    expect(slotsQuerySchema.parse({ clinica: "cristesti", serviciu: "CON-CONSULT", de: "2026-10-07", zile: "7" })).toEqual({
      clinica: "cristesti",
      serviciu: "CON-CONSULT",
      de: "2026-10-07",
      zile: 7,
    });
    expect(slotsQuerySchema.safeParse({ clinica: "cristesti", serviciu: "X", de: "7 oct" }).success).toBe(false);
    expect(slotsQuerySchema.safeParse({ clinica: "cristesti", serviciu: "X", de: "2026-10-07", zile: "15" }).success).toBe(false);
    expect(slotsQuerySchema.safeParse({ serviciu: "X", de: "2026-10-07" }).success).toBe(false);
  });
});
