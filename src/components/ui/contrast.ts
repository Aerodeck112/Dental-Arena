/**
 * WCAG 2.x contrast helpers and the role-token pairs of design system §11.1, so the component
 * gallery can show live ratios and the unit test can check both themes from globals.css.
 */

export type Rgb = [number, number, number];

/** Parses #RGB, #RRGGBB, rgb(r g b) and rgb(r, g, b). */
export function parseColor(input: string): Rgb | null {
  const s = input.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type RoleToken =
  | "fundal" | "suprafata" | "adancit" | "cerneala" | "discret" | "actiune" | "actiune-apasat" | "pe-actiune"
  | "link" | "focus" | "menta" | "pe-menta" | "menta-pal" | "linie" | "linie-control" | "mustar" | "mustar-pal"
  | "mustar-text" | "carmin" | "carmin-pal" | "subsol" | "pe-subsol";

export type ContrastPair = { label: string; fg: RoleToken; bg: RoleToken; min: 3 | 4.5 };

/** §11.1: every pair that must pass, in both themes. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  { label: "Text pe pagină", fg: "cerneala", bg: "fundal", min: 4.5 },
  { label: "Text pe panouri și câmpuri", fg: "cerneala", bg: "suprafata", min: 4.5 },
  { label: "Text pe suprafețe adâncite, Finalizat", fg: "cerneala", bg: "adancit", min: 4.5 },
  { label: "Text secundar pe pagină", fg: "discret", bg: "fundal", min: 4.5 },
  { label: "Text secundar pe panouri", fg: "discret", bg: "suprafata", min: 4.5 },
  { label: "Eticheta Finalizat", fg: "discret", bg: "adancit", min: 4.5 },
  { label: "Text secundar pe Mentă pal", fg: "discret", bg: "menta-pal", min: 4.5 },
  { label: "Linkuri pe pagină", fg: "link", bg: "fundal", min: 4.5 },
  { label: "Linkuri pe panouri", fg: "link", bg: "suprafata", min: 4.5 },
  { label: "Linkuri pe Mentă pal", fg: "link", bg: "menta-pal", min: 4.5 },
  { label: "Link în răspunsul de confort", fg: "link", bg: "mustar-pal", min: 4.5 },
  { label: "Eticheta butonului principal", fg: "pe-actiune", bg: "actiune", min: 4.5 },
  { label: "Butonul principal apăsat", fg: "pe-actiune", bg: "actiune-apasat", min: 4.5 },
  { label: "Text pe Mentă (oră aleasă, Sosit)", fg: "pe-menta", bg: "menta", min: 4.5 },
  { label: "Text pe Mentă pal (Confirmat)", fg: "cerneala", bg: "menta-pal", min: 4.5 },
  { label: "Text pe panoul de confort", fg: "cerneala", bg: "mustar-pal", min: 4.5 },
  { label: "Eticheta de confort pe fond pal", fg: "mustar-text", bg: "mustar-pal", min: 4.5 },
  { label: "Eticheta de confort pe panouri", fg: "mustar-text", bg: "suprafata", min: 4.5 },
  { label: "Text pe un răspuns de confort ales", fg: "pe-menta", bg: "mustar", min: 4.5 },
  { label: "Erori și alerte pe panouri", fg: "carmin", bg: "suprafata", min: 4.5 },
  { label: "Erori pe pagină", fg: "carmin", bg: "fundal", min: 4.5 },
  { label: "Eticheta Neprezentat", fg: "carmin", bg: "carmin-pal", min: 4.5 },
  { label: "Text pe un bloc Neprezentat", fg: "cerneala", bg: "carmin-pal", min: 4.5 },
  { label: "Text în subsol", fg: "pe-subsol", bg: "subsol", min: 4.5 },
  { label: "Contur de câmp pe panouri", fg: "linie-control", bg: "suprafata", min: 3 },
  { label: "Contur de câmp pe pagină", fg: "linie-control", bg: "fundal", min: 3 },
  { label: "Contur de câmp pe suprafețe adâncite", fg: "linie-control", bg: "adancit", min: 3 },
  { label: "Inel de focus pe pagină", fg: "focus", bg: "fundal", min: 3 },
  { label: "Inel de focus pe panouri", fg: "focus", bg: "suprafata", min: 3 },
  { label: "Inel de focus pe Mentă pal", fg: "focus", bg: "menta-pal", min: 3 },
  { label: "Bara Confirmat", fg: "actiune", bg: "menta-pal", min: 3 },
  { label: "Bara Neprezentat", fg: "carmin", bg: "carmin-pal", min: 3 },
  { label: "Marginea punctată Programat", fg: "discret", bg: "suprafata", min: 3 },
  { label: "Conturul de 2px al controlului ales", fg: "cerneala", bg: "suprafata", min: 3 },
];
