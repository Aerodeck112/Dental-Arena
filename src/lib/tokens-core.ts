import { fromBase64Url, hmacSha256, safeEqual, toBase64Url } from "./crypto";

/**
 * Appointment-link token format (docs/architecture.md §6.6), with the key passed in. Framework
 * free, so the seed can sign demo links too; application code uses `src/lib/tokens.ts`.
 *
 *   token = b64url(appointmentId) "." tokenVersion "." exp(base36 unix seconds) "." sig
 *   sig   = b64url(HMAC-SHA256(key, "apt|id|ver|exp"))[0..22]
 */

export const LINK_TTL_AFTER_START_SECONDS = 24 * 60 * 60;
const SIG_LENGTH = 22;

function signature(key: Buffer, id: string, version: number, exp: string): string {
  return toBase64Url(hmacSha256(key, `apt|${id}|${version}|${exp}`)).slice(0, SIG_LENGTH);
}

export function signAppointmentTokenWithKey(key: Buffer, a: { id: string; tokenVersion: number; startsAt: Date }): string {
  const exp = (Math.floor(a.startsAt.getTime() / 1000) + LINK_TTL_AFTER_START_SECONDS).toString(36);
  return [toBase64Url(a.id), String(a.tokenVersion), exp, signature(key, a.id, a.tokenVersion, exp)].join(".");
}

export function verifyAppointmentTokenWithKey(
  key: Buffer,
  token: string,
  now: Date = new Date(),
): { appointmentId: string; tokenVersion: number } | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [idPart, versionPart, expPart, sig] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(idPart) || !/^\d{1,6}$/.test(versionPart) || !/^[0-9a-z]{1,10}$/.test(expPart)) {
    return null;
  }
  const appointmentId = fromBase64Url(idPart).toString("utf8");
  if (!/^[a-z0-9]{10,40}$/i.test(appointmentId)) return null;
  const tokenVersion = Number(versionPart);
  if (!safeEqual(sig, signature(key, appointmentId, tokenVersion, expPart))) return null;
  const exp = parseInt(expPart, 36);
  if (!Number.isFinite(exp) || exp * 1000 <= now.getTime()) return null;
  return { appointmentId, tokenVersion };
}
