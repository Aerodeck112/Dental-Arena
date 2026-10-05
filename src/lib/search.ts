/**
 * Portable, diacritics-insensitive search (docs/architecture.md §3.2 invariant 6).
 * Pure: safe in client components (for example the `/preturi` client-side search).
 */

/** Lowercase, strip diacritics (ă→a, â→a, î→i, ș/ş→s, ț/ţ→t), collapse whitespace, trim. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits of a phone number, in E.164 digits and in the local form: "+40744123456" → ["40744123456", "0744123456"]. */
function phoneForms(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];
  const forms = [digits];
  if (digits.startsWith("40") && digits.length === 11) forms.push(`0${digits.slice(2)}`);
  return forms;
}

/** `Patient.searchText`: name, phone digits, local phone and e-mail, normalised. */
export function buildPatientSearchText(p: {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
}): string {
  const parts = [p.firstName, p.lastName, ...(p.phone ? phoneForms(p.phone) : []), p.email ?? ""];
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

/**
 * Normalises a free-text query for `contains` matching against `searchText`.
 * A phone-like query („0744 123 456”, „+40 744 123 456”) becomes its local digits („0744123456”).
 */
export function normalizeSearchQuery(q: string): string {
  const trimmed = q.trim();
  if (/^[+\d][\d\s.\-()/]{3,}$/.test(trimmed)) {
    let digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("0040")) digits = `0${digits.slice(4)}`;
    else if (digits.startsWith("40") && digits.length === 11) digits = `0${digits.slice(2)}`;
    return digits;
  }
  return normalizeSearch(trimmed);
}

/**
 * Splits a query into normalised tokens. Match every token with `contains` (AND), so that
 * „suciu maria” finds „Maria Suciu”.
 */
export function searchTokens(q: string): string[] {
  const normalized = normalizeSearchQuery(q);
  if (!normalized) return [];
  if (/^\d+$/.test(normalized)) return [normalized];
  return normalized.split(" ").filter(Boolean);
}
