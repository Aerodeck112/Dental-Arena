import "server-only";
import { deriveKey, hmacSha256, safeEqual } from "./crypto";
import { env } from "./env";

/**
 * Bot protection for public forms (docs/architecture.md §8.2): a hidden honeypot field plus an
 * HMAC-signed render timestamp. A submission is treated as a bot when the honeypot is filled, the
 * timestamp is missing or forged, the form was filled in under 3 seconds, or the timestamp is
 * older than 2 hours. Bots get a fake success from `publicAction`.
 */

export const HONEYPOT_FIELD = "website";
export const FORM_TS_FIELD = "_ts";

/** Maximum age of a signed form timestamp. */
export const FORM_TS_MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** Minimum fill time. */
export const FORM_MIN_FILL_MS = 3000;

let tsKey: Buffer | null = null;
function key(): Buffer {
  tsKey ??= deriveKey(env.AUTH_SECRET, "form-ts");
  return tsKey;
}

function signature(payload: string): string {
  return hmacSha256(key(), `form|${payload}`).toString("base64url").slice(0, 22);
}

/** `<render time in ms, base36>.<signature>`. */
export function signFormTimestamp(now: Date = new Date()): string {
  const payload = now.getTime().toString(36);
  return `${payload}.${signature(payload)}`;
}

/** Render time of a signed timestamp, or null when it is missing or forged. */
export function readFormTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || !/^[0-9a-z]{1,12}$/.test(payload)) return null;
  if (!safeEqual(sig, signature(payload))) return null;
  const ms = parseInt(payload, 36);
  return Number.isFinite(ms) ? ms : null;
}

function field(input: FormData | Record<string, unknown>, name: string): unknown {
  if (typeof FormData !== "undefined" && input instanceof FormData) return input.get(name);
  const value = (input as Record<string, unknown>)[name];
  return Array.isArray(value) ? value[0] : value;
}

/** True when the submission looks automated (see the file comment). */
export function isLikelyBot(
  fd: FormData | Record<string, unknown>,
  minMs: number = FORM_MIN_FILL_MS,
  now: Date = new Date(),
): boolean {
  const honeypot = field(fd, HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return true;
  if (honeypot !== undefined && honeypot !== null && typeof honeypot !== "string") return true;
  const renderedAt = readFormTimestamp(field(fd, FORM_TS_FIELD));
  if (renderedAt === null) return true;
  const age = now.getTime() - renderedAt;
  return age < minMs || age > FORM_TS_MAX_AGE_MS;
}
