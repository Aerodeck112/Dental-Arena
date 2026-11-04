import { describe, expect, it } from "vitest";
import {
  FORM_MIN_FILL_MS,
  FORM_TS_FIELD,
  FORM_TS_MAX_AGE_MS,
  HONEYPOT_FIELD,
  isLikelyBot,
  readFormTimestamp,
  signFormTimestamp,
} from "../honeypot";

const NOW = new Date("2026-10-05T08:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("honeypot and signed fill time", () => {
  it("uses the field names of §7.2", () => {
    expect(HONEYPOT_FIELD).toBe("website");
    expect(FORM_TS_FIELD).toBe("_ts");
    expect(FORM_MIN_FILL_MS).toBe(3000);
    expect(FORM_TS_MAX_AGE_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("reads back a signed timestamp and rejects forged ones", () => {
    const signed = signFormTimestamp(NOW);
    expect(readFormTimestamp(signed)).toBe(NOW.getTime());
    const [payload, sig] = signed.split(".");
    expect(readFormTimestamp(`${(NOW.getTime() - 60_000).toString(36)}.${sig}`)).toBeNull();
    expect(readFormTimestamp(`${payload}.${sig.slice(0, -1)}${sig.endsWith("x") ? "y" : "x"}`)).toBeNull();
    expect(readFormTimestamp(payload)).toBeNull();
    expect(readFormTimestamp(undefined)).toBeNull();
    expect(readFormTimestamp(42)).toBeNull();
  });

  it("lets a person through after a normal fill time", () => {
    expect(isLikelyBot({ [HONEYPOT_FIELD]: "", [FORM_TS_FIELD]: signFormTimestamp(ago(8_000)) }, undefined, NOW)).toBe(false);
    expect(isLikelyBot({ [FORM_TS_FIELD]: signFormTimestamp(ago(60 * 60_000)) }, undefined, NOW)).toBe(false);
  });

  it("flags a filled honeypot", () => {
    expect(isLikelyBot({ [HONEYPOT_FIELD]: "https://spam.example", [FORM_TS_FIELD]: signFormTimestamp(ago(8_000)) }, undefined, NOW)).toBe(true);
    expect(isLikelyBot({ [HONEYPOT_FIELD]: true, [FORM_TS_FIELD]: signFormTimestamp(ago(8_000)) }, undefined, NOW)).toBe(true);
  });

  it("flags a missing, forged, too fast or too old timestamp", () => {
    expect(isLikelyBot({}, undefined, NOW)).toBe(true);
    expect(isLikelyBot({ [FORM_TS_FIELD]: "abc.def" }, undefined, NOW)).toBe(true);
    expect(isLikelyBot({ [FORM_TS_FIELD]: signFormTimestamp(ago(1_000)) }, undefined, NOW)).toBe(true);
    expect(isLikelyBot({ [FORM_TS_FIELD]: signFormTimestamp(ago(3 * 60 * 60_000)) }, undefined, NOW)).toBe(true);
  });

  it("honours a custom minimum fill time", () => {
    const ts = signFormTimestamp(ago(5_000));
    expect(isLikelyBot({ [FORM_TS_FIELD]: ts }, 10_000, NOW)).toBe(true);
    expect(isLikelyBot({ [FORM_TS_FIELD]: ts }, 1_000, NOW)).toBe(false);
  });

  it("reads FormData as well as plain objects", () => {
    const fd = new FormData();
    fd.set(HONEYPOT_FIELD, "");
    fd.set(FORM_TS_FIELD, signFormTimestamp(ago(8_000)));
    expect(isLikelyBot(fd, undefined, NOW)).toBe(false);
    fd.set(HONEYPOT_FIELD, "bot");
    expect(isLikelyBot(fd, undefined, NOW)).toBe(true);
  });
});
