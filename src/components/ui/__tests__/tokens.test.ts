import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRAST_PAIRS, contrastRatio, parseColor, type RoleToken } from "../contrast";

/**
 * Design tokens (docs/design-system.md §3.2, §5.2, §11.1), checked against the real
 * src/app/globals.css: both themes meet every contrast pair, the dark values are declared
 * identically for the explicit choice and for the system preference, and no WP2 file uses raw
 * hex colours, Tailwind's default palette or cedilla ş ţ.
 */

const root = path.resolve(__dirname, "../../../..");
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--da-([a-z-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function block(re: RegExp): Record<string, string> {
  const m = css.match(re);
  if (!m) throw new Error(`Block not found: ${re}`);
  return declarations(m[1]);
}

const light = block(/(?:^|\n):root\s*\{([^}]*)\}/);
const dark = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
const darkSystem = block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/);

function ratio(theme: Record<string, string>, fg: RoleToken, bg: RoleToken): number {
  const a = parseColor(theme[fg] ?? "");
  const b = parseColor(theme[bg] ?? "");
  if (!a || !b) throw new Error(`Missing colour for ${fg} or ${bg}`);
  return contrastRatio(a, b);
}

describe("globals.css tokens", () => {
  it("declares every role token in both themes", () => {
    const roles = new Set(CONTRAST_PAIRS.flatMap((p) => [p.fg, p.bg]));
    for (const role of roles) {
      expect(light[role], `light ${role}`).toMatch(/^#[0-9A-F]{6}$/i);
      expect(dark[role], `dark ${role}`).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("uses the §3.2 values for the anchor roles", () => {
    expect(light).toMatchObject({ fundal: "#F4F7F5", cerneala: "#252E2C", actiune: "#1F6B4C", menta: "#7DC9A1", mustar: "#E0AC2B" });
    expect(dark).toMatchObject({ fundal: "#1B2422", cerneala: "#E6EDEA", actiune: "#7DC9A1", link: "#8FD6B1", carmin: "#F0877D" });
  });

  it("declares the system dark theme exactly like the explicit dark theme", () => {
    expect(darkSystem).toEqual(dark);
  });

  it("removes Tailwind's default palette", () => {
    expect(css).toMatch(/--color-\*:\s*initial/);
  });

  it("keeps the logo colours fixed (§3.1): Mentă mark, Ardezie wordmark, white wordmark in dark mode", () => {
    expect(light["logo-marca"]).toBe("#7DC9A1");
    expect(light["logo-text"]).toBe("#5C6765");
    expect(dark["logo-text"]).toBe("#FFFFFF");
  });
});

describe("contrast (§11.1)", () => {
  it.each(CONTRAST_PAIRS.map((p) => [p.label, p] as const))("light: %s", (_, pair) => {
    expect(ratio(light, pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
  });

  it.each(CONTRAST_PAIRS.map((p) => [p.label, p] as const))("dark: %s", (_, pair) => {
    expect(ratio(dark, pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
  });

  it("matches the ratios published in the design system", () => {
    const published: [Record<string, string>, RoleToken, RoleToken, number][] = [
      [light, "cerneala", "fundal", 12.93],
      [light, "discret", "suprafata", 5.86],
      [light, "pe-actiune", "actiune", 6.43],
      [light, "pe-menta", "menta", 7.13],
      [light, "mustar-text", "mustar-pal", 5.79],
      [light, "carmin", "carmin-pal", 5.61],
      [light, "linie-control", "adancit", 3.1],
      [dark, "cerneala", "fundal", 13.36],
      [dark, "pe-actiune", "actiune", 8.28],
      [dark, "link", "mustar-pal", 7.5],
      [dark, "linie-control", "adancit", 3.5],
    ];
    for (const [theme, fg, bg, expected] of published) {
      expect(ratio(theme, fg, bg), `${fg} on ${bg}`).toBeCloseTo(expected, 1);
    }
  });

  it("keeps the forbidden pairs forbidden: Mentă and Muștar are never text on light grounds", () => {
    expect(ratio(light, "menta", "suprafata")).toBeLessThan(3);
    expect(ratio(light, "mustar", "suprafata")).toBeLessThan(3);
  });

  it("parses the colour formats the gallery reads back from computed styles", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255]);
    expect(parseColor("rgb(31, 107, 76)")).toEqual([31, 107, 76]);
    expect(parseColor("rgb(31 107 76 / 0.5)")).toEqual([31, 107, 76]);
    expect(parseColor("transparent")).toBeNull();
  });
});

/* ── Source hygiene for the files WP2 owns ──────────────────────────────────────────── */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const wp2Files = [
  ...walk(path.join(root, "src/components/ui")),
  ...walk(path.join(root, "src/components/brand")),
  ...walk(path.join(root, "src/app/(crm)/crm/(app)/ui")),
  path.join(root, "src/app/layout.tsx"),
  path.join(root, "src/app/fonts.ts"),
  path.join(root, "src/lib/cn.ts"),
];

describe("WP2 source hygiene", () => {
  it("finds the files", () => {
    expect(wp2Files.length).toBeGreaterThan(40);
  });

  it("has no raw hex colours outside globals.css", () => {
    const offenders = wp2Files.filter((f) => /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b(?![-\w])/i.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it("never uses Tailwind's default palette", () => {
    const palette = /\b(?:bg|text|border|fill|stroke|ring|outline|from|to|via|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black)(?:-\d{2,3})?\b/;
    const offenders = wp2Files.filter((f) => palette.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it("writes Romanian with comma-below ș ț, never the cedilla forms", () => {
    const offenders = wp2Files.filter((f) => /[ŞşŢţ]/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it("loads both families with latin-ext (ș ț live at U+0218–021B)", () => {
    const fonts = readFileSync(path.join(root, "src/app/fonts.ts"), "utf8");
    expect(fonts.match(/subsets:\s*\["latin", "latin-ext"\]/g)).toHaveLength(2);
    expect(fonts).toContain("Forum(");
    expect(fonts).toContain("Red_Hat_Text(");
  });

  it("sets lang=ro and the CRM-only theme script in the root layout", () => {
    const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('lang="ro"');
    expect(layout).toContain("suppressHydrationWarning");
    expect(layout).toContain('localStorage.getItem("da-theme")');
    expect(layout).toMatch(/\\\\\/crm/);
  });
});
