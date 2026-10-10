/**
 * Legal pages: structured drafts for the clinic's legal adviser (architecture §4.1, design-system
 * §14 item 11). `{{token}}` placeholders are filled at render time from the clinic settings
 * (Setări → Datele clinicii), so the legal entity, CUI and registry number appear as soon as an
 * administrator enters them; until then they read „[de completat]”.
 */

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; caption: string; head: string[]; rows: string[][] };

export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

export type LegalDoc = {
  slug: "termeni-si-conditii" | "politica-de-confidentialitate" | "politica-cookies";
  title: string;
  seoTitle: string;
  description: string;
  /** ISO date of this version. */
  updated: string;
  /** Shown above the text until the clinic's legal adviser signs it off. */
  reviewNote: string;
  intro: string;
  sections: LegalSection[];
};

/** Tokens the legal texts may use. */
export type LegalValues = {
  legalName: string;
  cui: string;
  regCom: string;
  registeredAddress: string;
  email: string;
  dpoEmail: string;
  leadRetentionDays: string;
  messageBodyRetentionDays: string;
  cancelCutoffHours: string;
  consentTextVersion: string;
};

export const REVIEW_NOTE =
  "Text în curs de verificare juridică. Datele societății și termenele de păstrare se completează de clinică înainte de publicarea finală.";

/** Replaces `{{token}}` with its value; unknown tokens become „[de completat]”. */
export function fillLegal(text: string, values: Partial<LegalValues>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = (values as Record<string, string | undefined>)[key];
    return v && v.trim() !== "" ? v : "[de completat]";
  });
}
