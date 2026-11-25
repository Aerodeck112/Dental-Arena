import "server-only";
import { aesGcmDecrypt, aesGcmEncrypt, cnpHashKey, hmacHex, ipHashKey, parseAesKey } from "./crypto";
import { env } from "./env";

export { normalizeSearch, buildPatientSearchText } from "./search";

/**
 * Personal data protection (docs/architecture.md §3.2 invariant 7, §8.4).
 * - The CNP is encrypted with AES-256-GCM under PII_ENCRYPTION_KEY: `iv.ciphertext.tag` in base64url.
 * - `hmacHash(value, "cnp")` is the duplicate-detection hash (`Patient.cnpHash`).
 * - `hmacHash(ip, "ip")` is the only form in which IP addresses are stored.
 */

let aesKey: Buffer | null = null;
function key(): Buffer {
  aesKey ??= parseAesKey(env.PII_ENCRYPTION_KEY);
  return aesKey;
}

export function encryptPii(plain: string): string {
  return aesGcmEncrypt(plain, key());
}

export function decryptPii(blob: string): string {
  return aesGcmDecrypt(blob, key());
}

/**
 * HMAC-SHA256 hex digest with a purpose-specific key:
 * - "cnp": keyed with the PII key, so a leaked database cannot be matched against CNP lists
 * - "ip": keyed with HMAC(AUTH_SECRET, "ip-hash"), docs/architecture.md §1
 */
export function hmacHash(value: string, purpose: "cnp" | "ip"): string {
  const k = purpose === "cnp" ? cnpHashKey(key()) : ipHashKey(env.AUTH_SECRET);
  return hmacHex(k, value.trim());
}
