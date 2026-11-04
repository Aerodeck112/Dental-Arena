import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  cnpHashKey,
  deriveKey,
  fromBase64Url,
  hmacHex,
  ipHashKey,
  parseAesKey,
  safeEqual,
  toBase64Url,
} from "../crypto";

describe("crypto primitives", () => {
  it("parses only 32-byte AES keys", () => {
    const key = randomBytes(32);
    expect(parseAesKey(key.toString("base64")).equals(key)).toBe(true);
    expect(() => parseAesKey(randomBytes(16).toString("base64"))).toThrow("32 de octeți");
    expect(() => parseAesKey("")).toThrow();
  });

  it("encrypts a CNP so only the same key decrypts it", () => {
    const key = randomBytes(32);
    const other = randomBytes(32);
    const blob = aesGcmEncrypt("1960523264411", key);
    expect(aesGcmDecrypt(blob, key)).toBe("1960523264411");
    expect(() => aesGcmDecrypt(blob, other)).toThrow();
    expect(() => aesGcmDecrypt("a.b", key)).toThrow("Format criptat invalid.");
  });

  it("derives distinct sub-keys per purpose", () => {
    const secret = "un-secret-de-test-suficient-de-lung-0123456789";
    expect(deriveKey(secret, "session").equals(deriveKey(secret, "session"))).toBe(true);
    expect(deriveKey(secret, "session").equals(deriveKey(secret, "apt-link"))).toBe(false);
    expect(ipHashKey(secret).equals(deriveKey(secret, "ip-hash"))).toBe(true);
    const aes = randomBytes(32);
    expect(cnpHashKey(aes).equals(deriveKey(aes, "cnp-hash"))).toBe(true);
  });

  it("hashes CNPs for duplicate detection without revealing them", () => {
    const key = cnpHashKey(randomBytes(32));
    const a = hmacHex(key, "1960523264411");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacHex(key, "1960523264411")).toBe(a);
    expect(hmacHex(key, "6100214260012")).not.toBe(a);
  });

  it("compares strings in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("round-trips base64url", () => {
    const text = "cmgd3k2x40000qz8l5f1h2j3k/ăîșț";
    const encoded = toBase64Url(text);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url(encoded).toString("utf8")).toBe(text);
  });
});
