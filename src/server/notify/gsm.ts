import "server-only";

/**
 * GSM-7 helpers for SMS (docs/architecture.md §9.2). With `smsStripDiacritics`, Romanian text is
 * transliterated so one segment holds 160 characters instead of 70 (UCS-2).
 */

/** Characters of the GSM 03.38 basic set (one septet each). */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** Characters of the extension table (two septets each: ESC + char). */
const GSM7_EXTENDED = "^{}\\[~]|€\f";

const BASIC = new Set(Array.from(GSM7_BASIC));
const EXTENDED = new Set(Array.from(GSM7_EXTENDED));

/** Transliteration applied before sending (Romanian letters, typographic quotes and dashes). */
const TRANSLITERATION: Record<string, string> = {
  ă: "a",
  Ă: "A",
  â: "a",
  Â: "A",
  î: "i",
  Î: "I",
  ș: "s",
  Ș: "S",
  ş: "s",
  Ş: "S",
  ț: "t",
  Ț: "T",
  ţ: "t",
  Ţ: "T",
  "„": '"',
  "”": '"',
  "“": '"',
  "«": '"',
  "»": '"',
  "‘": "'",
  "’": "'",
  "‚": "'",
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "...",
  " ": " ",
  " ": " ",
  " ": " ",
  "\t": " ",
};

/**
 * Transliterates Romanian text to the GSM-7 alphabet: ă→a, â→a, î→i, ș/ş→s, ț/ţ→t, „ ”→",
 * –→-, no-break spaces → spaces. Any other character outside GSM-7 becomes „?”.
 */
export function toGsm7(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const mapped = TRANSLITERATION[ch] ?? ch;
    for (const c of mapped) {
      out += BASIC.has(c) || EXTENDED.has(c) ? c : "?";
    }
  }
  return out;
}

/** True when every character fits the GSM-7 alphabet (basic or extension table). */
export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!BASIC.has(ch) && !EXTENDED.has(ch)) return false;
  }
  return true;
}

export type SmsInfo = {
  encoding: "GSM-7" | "UCS-2";
  /** Length in the encoding's units (septets for GSM-7, UTF-16 code units for UCS-2). */
  units: number;
  segments: number;
  /** Units available per segment for this message (160/153 or 70/67). */
  perSegment: number;
};

/** Encoding, length and number of segments of an SMS text, as a carrier counts them. */
export function smsInfo(text: string): SmsInfo {
  if (isGsm7(text)) {
    let units = 0;
    for (const ch of text) units += EXTENDED.has(ch) ? 2 : 1;
    const single = units <= 160;
    return { encoding: "GSM-7", units, segments: units === 0 ? 0 : single ? 1 : Math.ceil(units / 153), perSegment: single ? 160 : 153 };
  }
  const units = text.length;
  const single = units <= 70;
  return { encoding: "UCS-2", units, segments: units === 0 ? 0 : single ? 1 : Math.ceil(units / 67), perSegment: single ? 70 : 67 };
}
