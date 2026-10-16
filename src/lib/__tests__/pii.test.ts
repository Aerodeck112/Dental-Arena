import { describe, expect, it } from "vitest";
import { cnpHashKey, hmacHex, parseAesKey } from "../crypto";
import { buildPatientSearchText, decryptPii, encryptPii, hmacHash, normalizeSearch } from "../pii";

const CNP = "1960523264411";

describe("CNP encryption (AES-256-GCM)", () => {
  it("round-trips", () => {
    expect(decryptPii(encryptPii(CNP))).toBe(CNP);
    expect(decryptPii(encryptPii("Ștefan Mașca, alergie la penicilină"))).toBe("Ștefan Mașca, alergie la penicilină");
  });

  it("stores iv.ciphertext.tag in base64url and never the clear text", () => {
    const blob = encryptPii(CNP);
    expect(blob).toMatch(/^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/);
    expect(blob).not.toContain(CNP);
  });

  it("uses a fresh IV every time", () => {
    expect(encryptPii(CNP)).not.toBe(encryptPii(CNP));
  });

  it("detects tampering", () => {
    const [iv, ciphertext, tag] = encryptPii(CNP).split(".");
    const flipped = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1);
    expect(() => decryptPii([iv, flipped(ciphertext), tag].join("."))).toThrow();
    expect(() => decryptPii([iv, ciphertext, flipped(tag)].join("."))).toThrow();
    expect(() => decryptPii([flipped(iv), ciphertext, tag].join("."))).toThrow();
    expect(() => decryptPii("nu-este-criptat")).toThrow();
  });
});

describe("hmacHash", () => {
  it("is deterministic per purpose and hex encoded", () => {
    const h = hmacHash(CNP, "cnp");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacHash(CNP, "cnp")).toBe(h);
    expect(hmacHash(` ${CNP} `, "cnp")).toBe(h);
  });

  it("separates purposes and values", () => {
    expect(hmacHash(CNP, "ip")).not.toBe(hmacHash(CNP, "cnp"));
    expect(hmacHash("6100214260012", "cnp")).not.toBe(hmacHash(CNP, "cnp"));
    expect(hmacHash("203.0.113.7", "ip")).not.toBe(hmacHash("203.0.113.8", "ip"));
  });

  it("matches the derivation the seed uses for Patient.cnpHash", () => {
    const key = parseAesKey(process.env.PII_ENCRYPTION_KEY ?? "");
    expect(hmacHex(cnpHashKey(key), CNP)).toBe(hmacHash(CNP, "cnp"));
  });
});

describe("search re-exports", () => {
  it("are available from the PII module", () => {
    expect(normalizeSearch("Mașca Ştefan")).toBe("masca stefan");
    expect(buildPatientSearchText({ firstName: "Ana", lastName: "Pop" })).toBe("ana pop");
  });
});
