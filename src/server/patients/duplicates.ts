import "server-only";
import { prisma } from "@/lib/db";
import { hmacHash } from "@/lib/pii";
import { normalizeSearch } from "@/lib/search";
import { localDayRangeUtc, isValidDateISO } from "@/lib/time";
import { isValidCnp, normalizePhone } from "@/lib/validation/common";
import { toPatientSummary, PATIENT_SUMMARY_SELECT } from "./summary";
import type { DuplicateMatch, DuplicateReason, PatientSummary } from "./types";

/**
 * Duplicate detection (docs/architecture.md §7.3, WP7 acceptance „Search and create”).
 *
 * A candidate is a duplicate when it has:
 * - the same phone (any input format, compared in E.164)
 * - the same CNP (compared through `cnpHash`, the clear CNP is never stored)
 * - the same name (diacritics-insensitive) and birth date
 * - the same e-mail (a weaker hint, shown with the others)
 *
 * Anonymised patients are never offered as duplicates.
 */

export type DuplicateQuery = {
  phone?: string | null;
  email?: string | null;
  firstName?: string;
  lastName?: string;
  cnp?: string | null;
  /** `YYYY-MM-DD`; only used together with the name. */
  birthDate?: string | null;
  /** The patient being edited, never reported as its own duplicate. */
  excludeId?: string | null;
};

/** Pure: which reasons make `row` a duplicate of `q` (already normalised). */
export function duplicateReasons(
  q: { phone: string | null; email: string | null; nameKey: string | null; birthISO: string | null; cnpHash: string | null },
  row: { phone: string | null; email: string | null; nameKey: string; birthISO: string | null; cnpHash: string | null },
): DuplicateReason[] {
  const reasons: DuplicateReason[] = [];
  if (q.phone && row.phone === q.phone) reasons.push("telefon");
  if (q.cnpHash && row.cnpHash === q.cnpHash) reasons.push("cnp");
  if (q.nameKey && q.birthISO && row.nameKey === q.nameKey && row.birthISO === q.birthISO) reasons.push("nume-data-nasterii");
  if (q.email && row.email === q.email) reasons.push("email");
  return reasons;
}

/** „Maria  Suciu” and „maria suciu” and „Măria Suciu” share one key; first/last order does not matter. */
export function nameKey(firstName: string, lastName: string): string {
  return normalizeSearch(`${firstName} ${lastName}`).split(" ").filter(Boolean).sort().join(" ");
}

export async function findDuplicateMatches(q: DuplicateQuery): Promise<DuplicateMatch[]> {
  const phone = q.phone ? normalizePhone(q.phone) : null;
  const email = q.email && q.email.includes("@") ? q.email.trim().toLowerCase() : null;
  const cnp = q.cnp ? q.cnp.replace(/\s/g, "") : null;
  const cnpHash = cnp && isValidCnp(cnp) ? hmacHash(cnp, "cnp") : null;
  const first = q.firstName?.trim() ?? "";
  const last = q.lastName?.trim() ?? "";
  const key = first && last ? nameKey(first, last) : null;
  const birthISO = q.birthDate && isValidDateISO(q.birthDate) ? q.birthDate : null;

  const or: object[] = [];
  if (phone) or.push({ phone });
  if (cnpHash) or.push({ cnpHash });
  if (email) or.push({ email });
  if (key && birthISO) {
    const { start, end } = localDayRangeUtc(birthISO);
    // Narrow by birth date in SQL, compare names in code (diacritics-insensitive).
    or.push({ birthDate: { gte: start, lt: end } });
  }
  if (or.length === 0) return [];

  const rows = await prisma.patient.findMany({
    where: { OR: or, anonymizedAt: null, ...(q.excludeId ? { id: { not: q.excludeId } } : {}) },
    select: { ...PATIENT_SUMMARY_SELECT, cnpHash: true },
    orderBy: { fileNumber: "asc" },
    take: 50,
  });

  const out: DuplicateMatch[] = [];
  for (const r of rows) {
    const summary = toPatientSummary(r);
    const reasons = duplicateReasons(
      { phone, email, nameKey: key, birthISO, cnpHash },
      { phone: r.phone, email: r.email, nameKey: nameKey(r.firstName, r.lastName), birthISO: summary.birthDate, cnpHash: r.cnpHash },
    );
    if (reasons.length > 0) out.push({ ...summary, reasons });
  }
  // Strongest evidence first: CNP, then phone, then name + birth date, then e-mail.
  const weight = (m: DuplicateMatch) =>
    (m.reasons.includes("cnp") ? 8 : 0) +
    (m.reasons.includes("telefon") ? 4 : 0) +
    (m.reasons.includes("nume-data-nasterii") ? 2 : 0) +
    (m.reasons.includes("email") ? 1 : 0);
  return out.sort((a, b) => weight(b) - weight(a) || a.fileNumber - b.fileNumber).slice(0, 10);
}

/** §7.3 contract: the duplicates of a would-be patient (lead conversion, „Pacient nou”). */
export async function findDuplicatePatients(q: {
  phone?: string | null;
  email?: string | null;
  firstName?: string;
  lastName?: string;
  cnp?: string | null;
  birthDate?: string | null;
}): Promise<PatientSummary[]> {
  const matches = await findDuplicateMatches(q);
  return matches.map((m) => ({ id: m.id, fileNumber: m.fileNumber, name: m.name, phone: m.phone, email: m.email, birthDate: m.birthDate, anonymized: m.anonymized }));
}

export const DUPLICATE_REASON_LABEL: Record<DuplicateReason, string> = {
  telefon: "același telefon",
  cnp: "același CNP",
  "nume-data-nasterii": "același nume și aceeași dată a nașterii",
  email: "același e-mail",
};
