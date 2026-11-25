import { describe, expect, it } from "vitest";
import { safeNextPath } from "../next-path";

describe("safeNextPath (login ?next=)", () => {
  it.each([
    ["/crm", "/crm"],
    ["/crm/pacienti", "/crm/pacienti"],
    ["/crm/pacienti?q=ana%20pop", "/crm/pacienti?q=ana%20pop"],
    ["/crm/programari?zi=2026-10-05#ora-9", "/crm/programari?zi=2026-10-05#ora-9"],
    ["/crm?clinica=ludus", "/crm?clinica=ludus"],
  ])("keeps %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it.each([
    [undefined],
    [null],
    [""],
    ["https://evil.example/crm"],
    ["//evil.example/crm"],
    ["/\\evil.example"],
    ["/crm\\@evil.example"],
    ["/crm//evil.example"],
    ["/crmx"],
    ["/crm-evil"],
    ["/crm/../admin"],
    ["/"],
    ["/despre-noi"],
    ["javascript:alert(1)"],
    ["/crm/login"],
    ["/crm/login?next=/crm"],
    ["/crm/\u0000x"],
    ["/crm/" + "a".repeat(1200)],
  ])("falls back to /crm for %s", (next) => {
    expect(safeNextPath(next)).toBe("/crm");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.example", "/crm/cont")).toBe("/crm/cont");
  });
});
