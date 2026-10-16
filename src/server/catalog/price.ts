import { formatAmount } from "@/lib/format";
import { parseLei } from "@/lib/validation/common";

/**
 * Price text ⇄ catalog fields (WP8 `PriceInput`). Pure and client-safe.
 *
 * - „1.200” → { priceMin: 120000, priceMax: null, priceFrom: false }
 * - „900 / 1.100” → { priceMin: 90000, priceMax: 110000, priceFrom: false }
 * - „de la 200” → { priceMin: 20000, priceMax: null, priceFrom: true }
 * - „” → all null/false: „Prețul îl aflați la telefon”
 *
 * „lei” at the end is tolerated; „–” and „-” also separate a range.
 */

export type PriceFields = { priceMin: number | null; priceMax: number | null; priceFrom: boolean };

export type PriceParse = { ok: true; value: PriceFields } | { ok: false; error: string };

export const PRICE_INPUT_HINT = "De exemplu 1.200, 900 / 1.100 sau de la 200. Lăsați gol dacă prețul se stabilește la consultație.";
const PRICE_ERROR = "Prețul nu are un format recunoscut. Scrieți, de exemplu, 1.200, 900 / 1.100 sau de la 200.";

export function parsePriceText(input: string | null | undefined): PriceParse {
  let s = (input ?? "").replace(/ /g, " ").trim().toLowerCase();
  if (s === "") return { ok: true, value: { priceMin: null, priceMax: null, priceFrom: false } };
  s = s.replace(/\s*lei\s*$/, "").trim();
  let from = false;
  const fromMatch = s.match(/^de\s+la\s+(.+)$/);
  if (fromMatch) {
    from = true;
    s = fromMatch[1].trim();
  }
  const parts = s.split(/\s*(?:\/|–|—|\s-\s)\s*/).map((p) => p.replace(/\s*lei$/, "").trim());
  if (parts.length > 2 || parts.some((p) => p === "")) return { ok: false, error: PRICE_ERROR };
  const values = parts.map((p) => parseLei(p));
  if (values.some((v) => v === null)) return { ok: false, error: PRICE_ERROR };
  const [min, max] = values as number[];
  if (max !== undefined) {
    if (from) return { ok: false, error: "Folosiți fie „de la”, fie un interval, nu amândouă." };
    if (max <= min) return { ok: false, error: "În interval, al doilea preț trebuie să fie mai mare decât primul." };
    return { ok: true, value: { priceMin: min, priceMax: max, priceFrom: false } };
  }
  return { ok: true, value: { priceMin: min, priceMax: null, priceFrom: from } };
}

/** Inverse of `parsePriceText`, for prefilling the input. */
export function formatPriceText(p: PriceFields): string {
  if (p.priceMin === null) return "";
  if (p.priceMax !== null && p.priceMax !== p.priceMin) return `${formatAmount(p.priceMin)} / ${formatAmount(p.priceMax)}`;
  return `${p.priceFrom ? "de la " : ""}${formatAmount(p.priceMin)}`;
}
