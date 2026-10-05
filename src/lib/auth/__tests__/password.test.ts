import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  passwordProblems,
  verifyPassword,
} from "../password";

describe("password hashing", () => {
  it("hashes with bcrypt cost 12 and verifies", async () => {
    const hash = await hashPassword("o-parola-buna-2026");
    expect(BCRYPT_COST).toBe(12);
    expect(bcrypt.getRounds(hash)).toBe(12);
    expect(await verifyPassword("o-parola-buna-2026", hash)).toBe(true);
    expect(await verifyPassword("O-parola-buna-2026", hash)).toBe(false);
  });

  it("never throws on a malformed hash", async () => {
    expect(await verifyPassword("orice", "nu-este-un-hash")).toBe(false);
  });

  it("has a real cost-12 dummy hash for unknown e-mails (constant-time login)", async () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(12);
    expect(await verifyPassword("parola-demo-2026", DUMMY_PASSWORD_HASH)).toBe(false);
  });
});

describe("passwordProblems", () => {
  const email = "receptie.cristesti@dentalarena.ro";

  it("accepts a long, unusual password", () => {
    expect(passwordProblems("Cireșe-roșii-la-Luduș", email)).toEqual([]);
  });

  it("requires at least 10 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(passwordProblems("scurta-1", email)).toEqual(["Parola trebuie să aibă cel puțin 10 caractere."]);
    expect(passwordProblems("exact-10ch", email)).toEqual([]);
  });

  it("refuses the e-mail address or its local part", () => {
    expect(passwordProblems(email, email)).toContain("Parola nu poate fi adresa de e-mail.");
    expect(passwordProblems("Receptie.Cristesti", email)).toContain("Parola nu poate fi adresa de e-mail.");
  });

  it("refuses passwords from the deny list, including the demo password", () => {
    for (const weak of ["parola1234", "1234567890", "Qwertyuiop", "dentalarena123", "parola-demo-2026"]) {
      expect(passwordProblems(weak, email)).toContain("Parola este prea ușor de ghicit. Alegeți alta.");
    }
  });

  it("caps the length", () => {
    expect(passwordProblems("x".repeat(129), email)).toContain("Parola poate avea cel mult 128 de caractere.");
  });

  it("writes every message with comma-below diacritics", () => {
    const all = [
      ...passwordProblems("abc", email),
      ...passwordProblems(email, email),
      ...passwordProblems("parola1234", email),
      ...passwordProblems("x".repeat(129), email),
    ].join(" ");
    expect(all).not.toMatch(/[şţŞŢ]/);
  });
});
