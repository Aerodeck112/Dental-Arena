/**
 * FDI two-digit tooth notation (ISO 3950), pure and client-safe. The first digit is the quadrant
 * (1–4 permanent, 5–8 primary; clockwise from the patient's upper right), the second the position
 * from the midline (1–8 permanent, 1–5 primary). The chart is drawn from the dentist's view:
 * the patient's right is on the left of the screen.
 */

export type Dentition = "adult" | "copil";

/** Rows as drawn: upper arch then lower arch, each from the patient's right to left. */
export const ADULT_ROWS: readonly (readonly number[])[] = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
];
export const CHILD_ROWS: readonly (readonly number[])[] = [
  [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
];

export function rowsFor(d: Dentition): readonly (readonly number[])[] {
  return d === "adult" ? ADULT_ROWS : CHILD_ROWS;
}

export function isFdiTooth(n: unknown): n is number {
  if (typeof n !== "number" || !Number.isInteger(n)) return false;
  const q = Math.floor(n / 10);
  const p = n % 10;
  if (q >= 1 && q <= 4) return p >= 1 && p <= 8;
  if (q >= 5 && q <= 8) return p >= 1 && p <= 5;
  return false;
}

/** „36” → 36; anything else → null. */
export function parseFdi(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!/^\d{2}$/.test(s)) return null;
  const n = Number(s);
  return isFdiTooth(n) ? n : null;
}

export function quadrantOf(tooth: number): number {
  return Math.floor(tooth / 10);
}
export function positionOf(tooth: number): number {
  return tooth % 10;
}
export function isPrimaryTooth(tooth: number): boolean {
  return quadrantOf(tooth) >= 5;
}
export function isUpperTooth(tooth: number): boolean {
  return [1, 2, 5, 6].includes(quadrantOf(tooth));
}
export function dentitionOf(tooth: number): Dentition {
  return isPrimaryTooth(tooth) ? "copil" : "adult";
}

export type ToothKind = "incisiv" | "canin" | "premolar" | "molar";

export function toothKind(tooth: number): ToothKind {
  const p = positionOf(tooth);
  if (p <= 2) return "incisiv";
  if (p === 3) return "canin";
  if (isPrimaryTooth(tooth)) return "molar";
  return p <= 5 ? "premolar" : "molar";
}

const KIND_NAME: Record<ToothKind, string> = { incisiv: "incisiv", canin: "canin", premolar: "premolar", molar: "molar" };
const ORDINAL: Record<number, string> = { 1: "primul", 2: "al doilea", 3: "al treilea" };

/** „36, primul molar inferior stâng”, „11, incisiv central superior drept”, „65, al doilea molar temporar…”. */
export function toothName(tooth: number): string {
  if (!isFdiTooth(tooth)) return String(tooth);
  const kind = toothKind(tooth);
  const p = positionOf(tooth);
  const arch = isUpperTooth(tooth) ? "superior" : "inferior";
  const side = [1, 4, 5, 8].includes(quadrantOf(tooth)) ? "drept" : "stâng";
  const temp = isPrimaryTooth(tooth) ? " temporar" : "";
  let name: string;
  if (kind === "incisiv") name = `incisiv ${p === 1 ? "central" : "lateral"}${temp}`;
  else if (kind === "canin") name = `canin${temp}`;
  else if (kind === "premolar") name = `${ORDINAL[p - 3]} premolar`;
  else {
    const idx = isPrimaryTooth(tooth) ? p - 3 : p - 5;
    name = `${ORDINAL[idx] ?? ""} ${KIND_NAME.molar}${temp}`.trim();
  }
  return `${tooth}, ${name} ${arch} ${side}`;
}

/** Surface letters: M mezial, O ocluzal (incizal on front teeth), D distal, V vestibular, L lingual / P palatinal. */
export type Surface = "M" | "O" | "D" | "V" | "L" | "P";

/** The inner face is palatal on upper teeth and lingual on lower teeth. */
export function innerSurface(tooth: number): "L" | "P" {
  return isUpperTooth(tooth) ? "P" : "L";
}

export function surfacesFor(tooth: number): Surface[] {
  return ["M", "O", "D", "V", innerSurface(tooth)];
}

export const SURFACE_LABEL: Record<Surface, string> = {
  M: "Mezial",
  O: "Ocluzal",
  D: "Distal",
  V: "Vestibular",
  L: "Lingual",
  P: "Palatinal",
};

export function surfaceLabel(s: Surface, tooth: number): string {
  if (s === "O" && toothKind(tooth) !== "molar" && toothKind(tooth) !== "premolar") return "Incizal";
  return SURFACE_LABEL[s];
}

/**
 * Canonical surface string „MOD” for a tooth: order M O D V L/P, and L/P mapped to the tooth's
 * own inner face (a „L” on an upper tooth is stored as „P”).
 */
export function canonicalSurfaces(tooth: number, input: string | null | undefined): string | null {
  if (!input) return null;
  const set = new Set(input.toUpperCase().replace(/[^MODVLP]/g, "").split(""));
  const inner = innerSurface(tooth);
  if (set.has("L") || set.has("P")) {
    set.delete("L");
    set.delete("P");
    set.add(inner);
  }
  const out = (["M", "O", "D", "V", inner] as const).filter((s) => set.has(s)).join("");
  return out || null;
}

/**
 * Keyboard navigation of the chart (arrow keys). Left and right move along the arch, up and down
 * jump to the tooth in the same column of the other arch. Returns the same tooth at an edge.
 */
export function neighbourTooth(tooth: number, key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End", d: Dentition = dentitionOf(tooth)): number {
  const rows = rowsFor(d);
  const r = rows.findIndex((row) => row.includes(tooth));
  if (r < 0) return tooth;
  const c = rows[r].indexOf(tooth);
  switch (key) {
    case "ArrowLeft":
      return rows[r][Math.max(0, c - 1)];
    case "ArrowRight":
      return rows[r][Math.min(rows[r].length - 1, c + 1)];
    case "ArrowUp":
      return rows[Math.max(0, r - 1)][c];
    case "ArrowDown":
      return rows[Math.min(rows.length - 1, r + 1)][c];
    case "Home":
      return rows[r][0];
    case "End":
      return rows[r][rows[r].length - 1];
  }
}
