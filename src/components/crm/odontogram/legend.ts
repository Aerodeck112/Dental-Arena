import type { ToothConditionType } from "@/generated/prisma/enums";
import { TOOTH_CONDITION_LABEL, TOOTH_CONDITION_LETTER } from "@/lib/labels";

/**
 * How each finding is drawn (design system §6.8): colour **and** pattern **and** letter, so the
 * chart reads in greyscale and for colour-blind users. Role tokens only. Mustard is never used here
 * (it means emotional comfort); carmin marks active pathology that needs treatment.
 *
 * - `scope: "surface"` paints the chosen faces; with no faces it paints the whole crown.
 * - `scope: "tooth"` is drawn over the whole tooth (crown ring, extraction cross, implant thread).
 */

export type ToothPattern = "solid" | "hatch" | "crosshatch" | "dots" | "ring" | "cross" | "dashed" | "thread" | "bar" | "root" | "wave";
export type ToothTone = "carmin" | "actiune" | "menta" | "cerneala" | "discret";

export type LegendEntry = {
  condition: ToothConditionType;
  label: string;
  letter: string;
  tone: ToothTone;
  pattern: ToothPattern;
  scope: "surface" | "tooth";
  /** Pathology still to treat (drawn in carmin) vs. existing work or a state. */
  group: "patologie" | "lucrare" | "stare";
};

const E = (
  condition: ToothConditionType,
  tone: ToothTone,
  pattern: ToothPattern,
  scope: LegendEntry["scope"],
  group: LegendEntry["group"],
): LegendEntry => ({
  condition,
  label: TOOTH_CONDITION_LABEL[condition],
  letter: TOOTH_CONDITION_LETTER[condition],
  tone,
  pattern,
  scope,
  group,
});

/** Legend order: the common findings first (C, O, E, Cr, X, I), then the rest. */
export const LEGEND: LegendEntry[] = [
  E("CARIE", "carmin", "hatch", "surface", "patologie"),
  E("OBTURATIE", "actiune", "solid", "surface", "lucrare"),
  E("ENDODONTIE", "actiune", "root", "tooth", "lucrare"),
  E("COROANA", "cerneala", "ring", "tooth", "lucrare"),
  E("EXTRAS", "discret", "cross", "tooth", "stare"),
  E("IMPLANT", "menta", "thread", "tooth", "lucrare"),
  E("FRACTURA", "carmin", "crosshatch", "surface", "patologie"),
  E("RADACINA_RESTANTA", "carmin", "dots", "tooth", "patologie"),
  E("PARODONTOPATIE", "carmin", "wave", "tooth", "patologie"),
  E("MOBILITATE", "discret", "wave", "tooth", "stare"),
  E("SIGILARE", "menta", "dots", "surface", "lucrare"),
  E("FATETA", "actiune", "hatch", "surface", "lucrare"),
  E("PUNTE", "cerneala", "bar", "tooth", "lucrare"),
  E("PROTEZA", "discret", "bar", "tooth", "lucrare"),
  E("LIPSA", "discret", "dashed", "tooth", "stare"),
  E("INCLUS", "discret", "dashed", "tooth", "stare"),
  E("ALTA", "discret", "dots", "surface", "stare"),
];

export const LEGEND_BY_CONDITION: Record<ToothConditionType, LegendEntry> = Object.fromEntries(
  LEGEND.map((l) => [l.condition, l]),
) as Record<ToothConditionType, LegendEntry>;

/** Tailwind classes per tone (fill and stroke use the role tokens). */
export const TONE_FILL: Record<ToothTone, string> = {
  carmin: "fill-carmin",
  actiune: "fill-actiune",
  menta: "fill-menta",
  cerneala: "fill-cerneala",
  discret: "fill-discret",
};
export const TONE_STROKE: Record<ToothTone, string> = {
  carmin: "stroke-carmin",
  actiune: "stroke-actiune",
  menta: "stroke-menta",
  cerneala: "stroke-cerneala",
  discret: "stroke-discret",
};
export const TONE_TEXT: Record<ToothTone, string> = {
  carmin: "text-carmin",
  actiune: "text-actiune",
  menta: "text-cerneala",
  cerneala: "text-cerneala",
  discret: "text-discret",
};

/** Conditions that make the tooth absent from the mouth (the crown is drawn faded). */
export const ABSENT_CONDITIONS: ToothConditionType[] = ["EXTRAS", "LIPSA", "IMPLANT"];

/** Default order of letters under a tooth: pathology first. */
export function sortForDisplay<T extends { condition: ToothConditionType }>(rows: T[]): T[] {
  const rank = (c: ToothConditionType) => LEGEND.findIndex((l) => l.condition === c);
  const g = { patologie: 0, lucrare: 1, stare: 2 } as const;
  return [...rows].sort(
    (a, b) =>
      g[LEGEND_BY_CONDITION[a.condition].group] - g[LEGEND_BY_CONDITION[b.condition].group] || rank(a.condition) - rank(b.condition),
  );
}
