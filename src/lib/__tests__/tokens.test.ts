import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { toBase64Url } from "../crypto";
import { appointmentManageUrl, signAppointmentToken, verifyAppointmentToken } from "../tokens";
import { LINK_TTL_AFTER_START_SECONDS, verifyAppointmentTokenWithKey } from "../tokens-core";

const NOW = new Date("2026-10-05T08:00:00Z");
const appointment = {
  id: "cmgd3k2x40000qz8l5f1h2j3k",
  tokenVersion: 3,
  startsAt: new Date("2026-10-08T07:30:00Z"),
};

/** Replaces one dot-separated part of a token. */
function withPart(token: string, index: number, value: string): string {
  const parts = token.split(".");
  parts[index] = value;
  return parts.join(".");
}

describe("appointment link tokens", () => {
  it("round-trips the id and version", () => {
    const token = signAppointmentToken(appointment);
    expect(token).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(verifyAppointmentToken(token, NOW)).toEqual({ appointmentId: appointment.id, tokenVersion: 3 });
  });

  it("builds the manage URL on APP_URL", () => {
    const url = appointmentManageUrl(appointment);
    expect(url).toBe(`http://localhost:3000/p/${signAppointmentToken(appointment)}`);
  });

  describe("tampering", () => {
    const token = signAppointmentToken(appointment);
    const [, , , sig] = token.split(".");

    it("rejects a changed signature", () => {
      const forged = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
      expect(verifyAppointmentToken(withPart(token, 3, forged), NOW)).toBeNull();
    });

    it("rejects another appointment id under the same signature", () => {
      expect(verifyAppointmentToken(withPart(token, 0, toBase64Url("cmgd3k2x40000qz8l5f1h2zzz")), NOW)).toBeNull();
    });

    it("rejects a changed version or expiry", () => {
      expect(verifyAppointmentToken(withPart(token, 1, "4"), NOW)).toBeNull();
      const exp = parseInt(token.split(".")[2], 36);
      expect(verifyAppointmentToken(withPart(token, 2, (exp + 86_400).toString(36)), NOW)).toBeNull();
    });

    it("rejects a token signed with another key", () => {
      expect(verifyAppointmentTokenWithKey(randomBytes(32), token, NOW)).toBeNull();
    });

    it.each(["", "abc", "a.b.c", "a.b.c.d.e", "x".repeat(300), `${token}.`, token.replace(/\./g, "_")])(
      "rejects malformed input %#",
      (bad) => {
        expect(verifyAppointmentToken(bad, NOW)).toBeNull();
      },
    );
  });

  describe("expiry", () => {
    const token = signAppointmentToken(appointment);
    const expiresAt = appointment.startsAt.getTime() + LINK_TTL_AFTER_START_SECONDS * 1000;

    it("stays valid until 24 hours after the appointment starts", () => {
      expect(LINK_TTL_AFTER_START_SECONDS).toBe(24 * 60 * 60);
      expect(verifyAppointmentToken(token, new Date(expiresAt - 1000))).not.toBeNull();
    });

    it("expires afterwards", () => {
      expect(verifyAppointmentToken(token, new Date(expiresAt))).toBeNull();
      expect(verifyAppointmentToken(token, new Date(expiresAt + 60_000))).toBeNull();
    });
  });

  describe("version mismatch", () => {
    it("reports the signed version, so a rescheduled appointment (version bumped) rejects old links", () => {
      const oldToken = signAppointmentToken({ ...appointment, tokenVersion: 3 });
      const currentVersion = 4; // Appointment.tokenVersion after a reschedule or cancellation
      const verified = verifyAppointmentToken(oldToken, NOW);
      expect(verified?.tokenVersion).toBe(3);
      expect(verified?.tokenVersion === currentVersion).toBe(false);
    });

    it("signs each version differently", () => {
      const v3 = signAppointmentToken({ ...appointment, tokenVersion: 3 });
      const v4 = signAppointmentToken({ ...appointment, tokenVersion: 4 });
      expect(v3).not.toBe(v4);
      expect(verifyAppointmentToken(v4, NOW)?.tokenVersion).toBe(4);
    });
  });
});
