import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "../Logo";
import { BAND_PARTS, CROWN_PARTS, MARK, MARK_BOXES, SUBLINE, WORDMARK } from "../logo-paths";
import { partsViewBox, stepState, threadParts, threadSegments, ThreadGlyph, THREAD_MAX_STEPS } from "../ThreadGlyph";
import { stepCounterText, ThreadSteps } from "../ThreadSteps";

/**
 * Brand components (docs/design-system.md §7, §9.4): the traced logo in every variant, and the
 * thread (Filetul) built from the mark's own bands, never redrawn.
 */
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("logo geometry", () => {
  it("keeps the mark as separate traced parts: two crown strokes, four bands and the apex", () => {
    expect(Object.keys(MARK)).toEqual(["crownLeft", "crownRight", "band1", "band2", "band3", "band4", "apex"]);
    expect(CROWN_PARTS).toEqual(["crownLeft", "crownRight"]);
    expect(BAND_PARTS).toEqual(["band1", "band2", "band3", "band4"]);
    for (const d of [...Object.values(MARK), WORDMARK, SUBLINE]) expect(d).toMatch(/^M[\d.-]+ [\d.-]+c[\d\s.,-]+z/);
  });

  it("stacks the bands top to bottom and narrows them towards the apex", () => {
    const parts = [...BAND_PARTS, "apex"] as const;
    for (let i = 1; i < parts.length; i++) {
      const [x0, y0, x1, y1] = MARK_BOXES[parts[i]];
      const [px0, py0, px1, py1] = MARK_BOXES[parts[i - 1]];
      expect(y0, `${parts[i]} starts below ${parts[i - 1]}`).toBeGreaterThan(py0);
      expect(y1).toBeGreaterThan(py1);
      expect(x1 - x0, `${parts[i]} is narrower`).toBeLessThan(px1 - px0);
    }
  });

  it("keeps the master proportions: the mark is about 1.66 times taller than wide", () => {
    const xs = Object.values(MARK_BOXES).flatMap((b) => [b[0], b[2]]);
    const ys = Object.values(MARK_BOXES).flatMap((b) => [b[1], b[3]]);
    const ratio = (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs));
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(1.72);
  });
});

describe("Logo", () => {
  it("is an image named „Dental Arena” by default", () => {
    const out = html(<Logo />);
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Dental Arena"');
    expect(out).not.toContain("<text");
  });

  it("is hidden from screen readers when it sits inside a labelled link", () => {
    const out = html(<Logo title="" />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain("role=");
  });

  it("draws the parts each lockup needs", () => {
    const count = (s: string) => (s.match(/<path/g) ?? []).length + (s.match(/<rect/g) ?? []).length;
    expect(count(html(<Logo variant="mark" />))).toBe(7);
    expect(count(html(<Logo variant="compact" />))).toBe(8);
    expect(count(html(<Logo variant="full" />))).toBe(10);
    expect(count(html(<Logo variant="mark" simplified />))).toBe(5);
  });

  it("uses the fixed logo colours; reversed is white text, mono is one colour", () => {
    const full = html(<Logo variant="full" />);
    expect(full).toContain('fill="var(--da-logo-marca)"');
    expect(full).toContain('fill="var(--da-logo-text)"');
    const reversed = html(<Logo variant="reversed" lockup="compact" />);
    expect(reversed).toContain('fill="var(--da-logo-marca)"');
    expect(reversed).toContain('fill="var(--da-logo-invers)"');
    const mono = html(<Logo variant="mono" />);
    expect(mono).not.toContain("var(--da-logo");
    expect(mono).toContain('fill="currentColor"');
  });

  it("has a default size at or above the documented minimum (220px full, 140px compact, 16px mark)", () => {
    const width = (s: string) => Number(s.match(/width="([\d.]+)"/)?.[1]);
    const height = (s: string) => Number(s.match(/height="([\d.]+)"/)?.[1]);
    expect(width(html(<Logo variant="full" />))).toBeGreaterThanOrEqual(220);
    expect(width(html(<Logo variant="compact" />))).toBeGreaterThanOrEqual(140);
    expect(height(html(<Logo variant="mark" />))).toBeGreaterThanOrEqual(16);
  });

  it("frames every part of its lockup inside the viewBox", () => {
    const box = (s: string) => s.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);
    const [mx, my, mw, mh] = box(html(<Logo variant="mark" />));
    for (const [x0, y0, x1, y1] of Object.values(MARK_BOXES)) {
      expect(x0).toBeGreaterThanOrEqual(mx);
      expect(y0).toBeGreaterThanOrEqual(my);
      expect(x1).toBeLessThanOrEqual(mx + mw);
      expect(y1).toBeLessThanOrEqual(my + mh);
    }
  });
});

describe("thread (Filetul)", () => {
  it("supports 1–5 steps with the bands nearest the apex, and the apex as the fifth step", () => {
    expect(THREAD_MAX_STEPS).toBe(5);
    expect(threadParts(5)).toEqual({ steps: ["band1", "band2", "band3", "band4", "apex"], tip: null });
    expect(threadParts(4)).toEqual({ steps: ["band1", "band2", "band3", "band4"], tip: "apex" });
    expect(threadParts(3)).toEqual({ steps: ["band2", "band3", "band4"], tip: "apex" });
    expect(threadParts(9).steps).toHaveLength(5);
    expect(threadParts(0).steps).toHaveLength(1);
  });

  it("marks steps done, current and future", () => {
    expect([0, 1, 2, 3].map((i) => stepState(i, 1))).toEqual(["done", "current", "future", "future"]);
    expect(threadSegments(4, 4).map((s) => s.state)).toEqual(["done", "done", "done", "done", "done"]);
    expect(threadSegments(4, -1).map((s) => s.state)).toEqual(["future", "future", "future", "future", "future"]);
  });

  it("frames a set of parts with room for the outline", () => {
    const [x, y, w, h] = partsViewBox(["band4"]).split(" ").map(Number);
    const [bx0, by0, bx1, by1] = MARK_BOXES.band4;
    expect(x).toBeLessThan(bx0);
    expect(y).toBeLessThan(by0);
    expect(x + w).toBeGreaterThan(bx1);
    expect(y + h).toBeGreaterThan(by1);
  });

  it("is aria-hidden and styles each band by state (filled done, cerneala current, linie-control future)", () => {
    const out = html(<ThreadGlyph count={4} current={1} />);
    expect(out).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(out.match(/data-state="done"[^>]*fill-menta/g)).toHaveLength(1);
    expect(out.match(/data-state="current"[^>]*stroke-cerneala/g)).toHaveLength(1);
    expect(out.match(/data-state="future"[^>]*stroke-linie-control/g)).toHaveLength(3);
    expect(out).toContain('stroke-width="1.5"');
    expect(out).toContain('stroke-width="1.25"');
  });

  it("draws the crown on top for the confirmation, animated only when asked", () => {
    const still = html(<ThreadGlyph count={4} current={4} crown />);
    expect(still.match(/pathLength="1"/g)).toHaveLength(2);
    expect(still).not.toContain("da-crown-draw");
    expect(html(<ThreadGlyph count={4} current={4} crown crownAnimated />)).toContain("da-crown-draw");
  });

  it("says where the person is, in words", () => {
    expect(stepCounterText(1, 4)).toBe("Pasul 2 din 4");
    expect(stepCounterText(-1, 4)).toBe("Pasul 1 din 4");
    expect(stepCounterText(4, 4)).toBe("Toți cei 4 pași sunt încheiați.");
  });

  const steps = ["Motivul și clinica", "Ziua și ora", "Cum vă simțiți", "Datele dumneavoastră"];

  it.each(["rail", "inline", "list", "plan", "mini"] as const)("%s: an ordered list with aria-current on the current step", (variant) => {
    const out = html(<ThreadSteps variant={variant} steps={steps} current={1} label="Pașii programării" />);
    expect(out).toContain('aria-label="Pașii programării"');
    expect(out.match(/<li/g)).toHaveLength(4);
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="step"[\s\S]*?Ziua și ora/);
    expect(out).toContain('aria-hidden="true"');
  });

  it("shows „Pasul 2 din 4” beside the rail and the inline glyph", () => {
    expect(html(<ThreadSteps variant="rail" steps={steps} current={1} />)).toContain("Pasul 2 din 4");
    expect(html(<ThreadSteps variant="inline" steps={steps} current={1} />)).toContain("Pasul 2 din 4");
  });

  it("turns completed rail steps into links back when they have an href", () => {
    const out = html(
      <ThreadSteps variant="rail" steps={[{ label: "Motivul", href: "/programare?pas=1" }, { label: "Ziua" }]} current={1} />,
    );
    expect(out).toContain('href="/programare?pas=1"');
  });
});
