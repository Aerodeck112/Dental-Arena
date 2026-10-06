import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ABOUT } from "@/content/about";
import { ANNIVERSARY } from "@/content/anniversary";
import { HOME } from "@/content/home";
import { LANDINGS } from "@/content/landing";
import { CONFIDENTIALITATE, COOKIES, TERMENI, fillLegal } from "@/content/legal";
import { SERVICE_LIST, SERVICE_SLUGS, SERVICES, SERVICES_WITH_STEPS, getServiceContent } from "@/content/services";
import { bookingHref, CLINICS } from "@/content/site";

/**
 * Content checks for the public site (architecture §11 WP3): Romanian orthography, no English
 * leftovers, no absolute promises, no invented distances, and the 10 service slugs.
 */

const ROOT = path.resolve(__dirname, "../../..");
const SCANNED = ["src/content", "src/components/site", "src/app/(site)/(pagini)", "src/app/not-found.tsx", "src/server/public"];

function filesUnder(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const child = path.join(rel, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : filesUnder(child);
    return /\.(ts|tsx)$/.test(e.name) ? [path.join(ROOT, child)] : [];
  });
}

const SOURCES = SCANNED.flatMap(filesUnder).map((f) => ({ file: path.relative(ROOT, f), text: readFileSync(f, "utf8") }));

/** Every string reachable from the content objects, for checks that must look at values. */
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}
const CONTENT_STRINGS = strings([HOME, ABOUT, ANNIVERSARY, LANDINGS, SERVICES, TERMENI, CONFIDENTIALITATE, COOKIES, CLINICS]);

function offenders(pattern: RegExp): string[] {
  return SOURCES.filter((s) => pattern.test(s.text)).map((s) => s.file);
}

describe("site copy", () => {
  it("scans the content and page files", () => {
    expect(SOURCES.length).toBeGreaterThan(30);
  });

  it("uses comma-below ș ț, never the cedilla forms ş ţ Ş Ţ", () => {
    expect(offenders(/[ŞşŢţ]/)).toEqual([]);
  });

  it("has no English leftovers from the WordPress theme", () => {
    expect(offenders(/Get in touch|Office Email Address|Reject All|Accept All|Always Active|Something went wrong/i)).toEqual([]);
  });

  it("never promises „100% sigur(ă)”", () => {
    expect(offenders(/100\s*%\s*sigur/i)).toEqual([]);
    expect(CONTENT_STRINGS.filter((s) => /100\s*%\s*sigur/i.test(s))).toEqual([]);
  });

  it("never claims „la 1 km” of Târgu Mureș", () => {
    expect(offenders(/la 1 km/i)).toEqual([]);
  });

  it("uses no exclamation marks in the copy", () => {
    expect(CONTENT_STRINGS.filter((s) => /!(\s|$)/.test(s))).toEqual([]);
  });

  it("uses Romanian quotes, not straight double quotes, in content values", () => {
    expect(CONTENT_STRINGS.filter((s) => /"/.test(s) && !/^https?:/.test(s))).toEqual([]);
  });
});

describe("services", () => {
  it("has exactly the 10 WordPress slugs", () => {
    expect([...SERVICE_SLUGS]).toEqual([
      "consultatie-profilaxie",
      "stomatologie-generala",
      "inhalosedare",
      "implantologie",
      "chirurgie-dento-alveolara",
      "protetica-dentara",
      "pedodontie",
      "ortodontie",
      "parodontologie",
      "estetica-dentara",
    ]);
    for (const slug of SERVICE_SLUGS) expect(SERVICES[slug].slug).toBe(slug);
    expect(getServiceContent("nu-exista")).toBeNull();
  });

  it("gives every page a unique title and description", () => {
    const titles = SERVICE_LIST.map((s) => s.seoTitle);
    const descriptions = SERVICE_LIST.map((s) => s.description);
    expect(new Set(titles).size).toBe(10);
    expect(new Set(descriptions).size).toBe(10);
    // The old site reused the Ortodonție title on Consultație și profilaxie (§12.6).
    expect(SERVICES["consultatie-profilaxie"].seoTitle).not.toMatch(/ortodon/i);
    for (const d of descriptions) expect(d.length).toBeGreaterThanOrEqual(100);
  });

  it("shows „Cum decurge” only on implantologie, ortodonție and inhalosedare", () => {
    expect([...SERVICES_WITH_STEPS].sort()).toEqual(["implantologie", "inhalosedare", "ortodontie"]);
  });

  it("links related services to existing pages, never to itself", () => {
    for (const s of SERVICE_LIST) {
      for (const r of s.related) {
        expect(SERVICE_SLUGS).toContain(r);
        expect(r).not.toBe(s.slug);
      }
    }
  });

  it("keeps the comfort note off the inhalosedare page itself", () => {
    expect(SERVICES.inhalosedare.comfortNote).toBe(false);
    expect(SERVICES.inhalosedare.bookingComfort).toBe("frica");
  });
});

describe("home, about and 15 ani", () => {
  it("has the hero headline in three lines", () => {
    expect(HOME.hero.lines).toEqual(["Fără durere,", "fără frică,", "cu precizie."]);
  });

  it("offers three comfort answers that link into booking", () => {
    expect(HOME.comfort.answers.map((a) => a.value)).toEqual(["fara-emotii", "emotii", "frica"]);
    expect(bookingHref({ confort: "frica" })).toBe("/programare?confort=frica");
  });

  it("pairs „Fără durere” and „Fără frică” with their own texts", () => {
    const [durere, frica, precizie] = ABOUT.principles;
    expect(durere.title).toBe("Fără durere");
    expect(durere.text).toMatch(/fără durere/i);
    expect(frica.title).toBe("Fără frică");
    expect(frica.text).toMatch(/frică/i);
    expect(precizie.text).toMatch(/radiografii/);
  });

  it("tells the 2024 promotion in the past tense", () => {
    const text = strings(ANNIVERSARY).join(" ");
    expect(text).toMatch(/s-a încheiat/);
    expect(text).toMatch(/am pregătit|am sărbătorit|a durat/);
    expect(text).not.toMatch(/\b(beneficiați|profitați|oferim)\b/i);
  });

  it("points the Târgu Mureș landings to Cristești, „lângă Târgu Mureș”", () => {
    for (const l of Object.values(LANDINGS)) expect(strings(l).join(" ")).toMatch(/lângă Târgu Mureș/);
    expect(CLINICS.cristesti.area).toBe("lângă Târgu Mureș");
  });
});

describe("legal drafts", () => {
  it("fills known tokens and marks unknown ones for completion", () => {
    expect(fillLegal("{{legalName}}, CUI {{cui}}", { legalName: "SC Exemplu SRL", cui: "" })).toBe("SC Exemplu SRL, CUI [de completat]");
  });

  it("carries the review note on every page", () => {
    for (const d of [TERMENI, CONFIDENTIALITATE, COOKIES]) expect(d.reviewNote).toMatch(/verificare juridică/);
  });
});
