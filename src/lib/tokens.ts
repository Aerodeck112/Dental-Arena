import "server-only";
import { deriveKey } from "./crypto";
import { env } from "./env";
import { signAppointmentTokenWithKey, verifyAppointmentTokenWithKey } from "./tokens-core";

/**
 * Signed appointment links for SMS and e-mail (docs/architecture.md §6.6):
 *
 *   token = b64url(appointmentId) "." tokenVersion "." exp(base36 unix seconds) "." sig
 *   sig   = b64url(HMAC-SHA256(HMAC(AUTH_SECRET, "apt-link"), "apt|id|ver|exp"))[0..22]
 *   exp   = appointment.startsAt + 24h
 *
 * Verification here covers signature and expiry; the caller must still check that the
 * appointment exists and that `tokenVersion` matches the database.
 */

let linkKey: Buffer | null = null;
function key(): Buffer {
  linkKey ??= deriveKey(env.AUTH_SECRET, "apt-link");
  return linkKey;
}

export function signAppointmentToken(a: { id: string; tokenVersion: number; startsAt: Date }): string {
  return signAppointmentTokenWithKey(key(), a);
}

export function verifyAppointmentToken(
  token: string,
  now: Date = new Date(),
): { appointmentId: string; tokenVersion: number } | null {
  return verifyAppointmentTokenWithKey(key(), token, now);
}

/** `${APP_URL}/p/${token}`. */
export function appointmentManageUrl(a: { id: string; tokenVersion: number; startsAt: Date }): string {
  return `${env.APP_URL}/p/${signAppointmentToken(a)}`;
}
