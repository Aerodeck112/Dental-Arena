import "server-only";
import type { Comfort } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { ageFromBirthDate } from "@/lib/format";
import { COMFORT_TAG } from "@/lib/labels";

/**
 * Patient alert flags (docs/architecture.md §5.2, §7.3; design system §3.4).
 *
 * Every role sees them, RECEPTIE included: they are the only clinical information reception gets.
 * - „alerta” (carmin): allergies, anticoagulants and the conditions that change how a doctor treats
 * - „confort” (muștar): the patient's comfort answer, when it is not „N-am emoții”
 * - „sedare” (muștar): the patient prefers inhalosedare
 * - „copil” (neutral): under 18, „Copil, 7 ani”
 *
 * `derivePatientFlags` is pure (unit-tested); the async functions only load the inputs.
 */

export type PatientFlag = { kind: "alerta" | "confort" | "copil" | "sedare"; label: string };

/** The medical-history fields the flags depend on. */
export type FlagMedicalInput = {
  allergies: string | null;
  anticoagulants: boolean;
  bleedingDisorder: boolean;
  cardiacDisease: boolean;
  hypertension: boolean;
  diabetes: boolean;
  asthma: boolean;
  epilepsy: boolean;
  hepatitis: boolean;
  hiv: boolean;
  bisphosphonates: boolean;
  pregnancy: boolean;
};

export type FlagInput = {
  birthDate: Date | null;
  comfortDefault: Comfort | null;
  prefersSedation: boolean;
  medical: FlagMedicalInput | null;
};

/** Boolean anamneză fields that raise an alert, in display order. */
export const MEDICAL_ALERT_LABEL: Record<Exclude<keyof FlagMedicalInput, "allergies">, string> = {
  anticoagulants: "Anticoagulante",
  bleedingDisorder: "Tulburări de coagulare",
  bisphosphonates: "Bifosfonați",
  cardiacDisease: "Boală cardiacă",
  hypertension: "Hipertensiune",
  diabetes: "Diabet",
  asthma: "Astm",
  epilepsy: "Epilepsie",
  hepatitis: "Hepatită",
  hiv: "Infecție HIV",
  pregnancy: "Sarcină",
};

const ALERT_KEYS = Object.keys(MEDICAL_ALERT_LABEL) as (keyof typeof MEDICAL_ALERT_LABEL)[];

/** Ages below this get the „Copil” tag. */
export const CHILD_AGE_LIMIT = 18;

/** Lowercases the first letter unless the word looks like an acronym („AINS”). */
function lowerFirst(s: string): string {
  if (s.length > 1 && s[1] === s[1].toUpperCase() && s[1] !== s[1].toLowerCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * „penicilină, latex” → „Alergie: penicilină, latex”. Free text is split on commas, semicolons and
 * new lines; „nu”, „nu are”, „-” and similar mean no allergy.
 */
export function allergyLabel(allergies: string | null | undefined): string | null {
  if (!allergies) return null;
  const parts = allergies
    .split(/[,;\n]+/)
    .map((p) => p.replace(/\s+/g, " ").trim().replace(/\.$/, ""))
    .filter((p) => p.length > 0);
  const meaningful = parts.filter((p) => !/^(nu|nu are|nu e cazul|fără|fara|niciuna|nicio|nimic|-+|—|n\/a)$/i.test(p));
  if (meaningful.length === 0) return null;
  const text = meaningful.map(lowerFirst).join(", ");
  const clipped = text.length > 60 ? `${text.slice(0, 59).trimEnd()}…` : text;
  return `Alergie: ${clipped}`;
}

export function derivePatientFlags(p: FlagInput, now: Date = new Date()): PatientFlag[] {
  const flags: PatientFlag[] = [];
  if (p.medical) {
    const allergy = allergyLabel(p.medical.allergies);
    if (allergy) flags.push({ kind: "alerta", label: allergy });
    for (const key of ALERT_KEYS) {
      if (p.medical[key]) flags.push({ kind: "alerta", label: MEDICAL_ALERT_LABEL[key] });
    }
  }
  if (p.comfortDefault && p.comfortDefault !== "FARA_EMOTII") {
    flags.push({ kind: "confort", label: COMFORT_TAG[p.comfortDefault] });
  }
  if (p.prefersSedation) flags.push({ kind: "sedare", label: "Preferă inhalosedare" });
  if (p.birthDate) {
    const age = ageFromBirthDate(p.birthDate, now);
    if (age >= 0 && age < CHILD_AGE_LIMIT) {
      flags.push({ kind: "copil", label: `Copil, ${age} ${age === 1 ? "an" : "ani"}` });
    }
  }
  return flags;
}

const FLAG_SELECT = {
  id: true,
  birthDate: true,
  comfortDefault: true,
  prefersSedation: true,
  medicalHistory: {
    select: {
      allergies: true,
      anticoagulants: true,
      bleedingDisorder: true,
      cardiacDisease: true,
      hypertension: true,
      diabetes: true,
      asthma: true,
      epilepsy: true,
      hepatitis: true,
      hiv: true,
      bisphosphonates: true,
      pregnancy: true,
    },
  },
} as const;

/** Flags for many patients at once (the calendar, the Azi list). Unknown ids are absent from the map. */
export async function getPatientFlagsBulk(patientIds: string[]): Promise<Map<string, PatientFlag[]>> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  const out = new Map<string, PatientFlag[]>();
  if (ids.length === 0) return out;
  const now = new Date();
  // Chunk to stay well below SQLite's bound-parameter limit.
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await prisma.patient.findMany({ where: { id: { in: ids.slice(i, i + 500) } }, select: FLAG_SELECT });
    for (const r of rows) {
      out.set(
        r.id,
        derivePatientFlags(
          { birthDate: r.birthDate, comfortDefault: r.comfortDefault, prefersSedation: r.prefersSedation, medical: r.medicalHistory },
          now,
        ),
      );
    }
  }
  return out;
}

export async function getPatientFlags(patientId: string): Promise<PatientFlag[]> {
  return (await getPatientFlagsBulk([patientId])).get(patientId) ?? [];
}
