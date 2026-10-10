import bcrypt from "bcryptjs";

/**
 * Passwords (docs/architecture.md §5.1): bcryptjs, cost 12. Policy: at least 10 characters,
 * not equal to the e-mail, not in a short local deny list.
 */

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 10;

const DENY_LIST = new Set([
  "parola1234",
  "parola12345",
  "parola123456",
  "1234567890",
  "12345678910",
  "0123456789",
  "qwertyuiop",
  "qwerty1234",
  "password12",
  "password123",
  "passw0rd123",
  "dentalarena",
  "dentalarena1",
  "dentalarena123",
  "dental12345",
  "stomatologie",
  "cabinet1234",
  "clinica1234",
  "romania1234",
  "administrator",
  "admin12345",
  "receptie123",
  "aaaaaaaaaa",
  "1111111111",
  "parola-demo-2026",
]);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * A valid bcrypt hash (cost 12) of a random string. Login compares against it when the e-mail is
 * unknown, so response time does not reveal which accounts exist.
 */
export const DUMMY_PASSWORD_HASH = "$2b$12$d9wdGSipnf4oZhUzBggzCep23V68IKakGSqCEWk69Sw0g9CDNERYS";

/**
 * Policy problems, as Romanian sentences; [] means the password is acceptable.
 * The seed's demo password is on the deny list on purpose: staff must choose their own.
 */
export function passwordProblems(plain: string, email: string): string[] {
  const problems: string[] = [];
  if (plain.length < MIN_PASSWORD_LENGTH) {
    problems.push(`Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`);
  }
  if (plain.length > 128) {
    problems.push("Parola poate avea cel mult 128 de caractere.");
  }
  const lower = plain.toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail && (lower === normalizedEmail || lower === normalizedEmail.split("@")[0])) {
    problems.push("Parola nu poate fi adresa de e-mail.");
  }
  if (DENY_LIST.has(lower)) {
    problems.push("Parola este prea ușor de ghicit. Alegeți alta.");
  }
  return problems;
}
