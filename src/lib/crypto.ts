import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Framework-free crypto primitives shared by sessions, appointment links, PII encryption,
 * form timestamps and the seed. Keys are passed in explicitly, so this file has no env access
 * and can run under plain Node (`tsx prisma/seed.ts`). Server code only.
 */

/** Sub-key derivation: HMAC-SHA256(secret, purpose), docs/architecture.md §1. */
export function deriveKey(secret: string | Buffer, purpose: string): Buffer {
  return createHmac("sha256", secret).update(purpose).digest();
}

export function hmacSha256(key: Buffer | string, payload: string): Buffer {
  return createHmac("sha256", key).update(payload).digest();
}

export function toBase64Url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

export function fromBase64Url(data: string): Buffer {
  return Buffer.from(data, "base64url");
}

/** Constant-time comparison of two strings; false for different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Decodes a base64 32-byte AES-256 key. Throws on a wrong length. */
export function parseAesKey(base64: string): Buffer {
  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) throw new Error("Cheia AES trebuie să aibă 32 de octeți.");
  return key;
}

/** AES-256-GCM. Output: `iv.ciphertext.tag`, each part base64url (docs/architecture.md §3.2 invariant 7). */
export function aesGcmEncrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((b) => b.toString("base64url")).join(".");
}

export function aesGcmDecrypt(blob: string, key: Buffer): string {
  const parts = blob.split(".");
  if (parts.length !== 3) throw new Error("Format criptat invalid.");
  const [iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** HMAC-SHA256 hex digest, used for CNP duplicate detection and IP hashing. */
export function hmacHex(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

/** Key for `Patient.cnpHash`, derived from the PII AES key. Shared by `src/lib/pii.ts` and the seed. */
export function cnpHashKey(aesKey: Buffer): Buffer {
  return deriveKey(aesKey, "cnp-hash");
}

/** Key for IP hashing, derived from AUTH_SECRET. */
export function ipHashKey(authSecret: string): Buffer {
  return deriveKey(authSecret, "ip-hash");
}
