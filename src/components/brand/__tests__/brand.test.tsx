import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "../Logo";
import { BAND_PARTS, CROWN_PARTS, MARK, MARK_BOXES } from "../logo-paths";
import { partsViewBox, stepState, threadParts, threadSegments, ThreadGlyph, THREAD_MAX_STEPS } from "../ThreadGlyph";
import { stepCounterText, ThreadSteps } from "../ThreadSteps";

/**
 * Brand components (docs/design-system.md §7, §9.4): the traced logo in every variant, and the
 * thread (Filetul) built from the mark's own bands, never redrawn.
 */
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("thread glyph geometry (from the mark)", () => {
  it("keeps the mark as separate traced parts: two crown strokes, four bands and the apex", () => {
    expect(Object.keys(MARK)).toEqual(["crownLeft", "crownRight", "band1", "band2", "band3", "band4", "apex"]);
    expect(CROWN_PARTS).toEqual(["crownLeft", "crownRight"]);
    expect(BAND_PARTS).toEqual(["band1", "band2", "band3", "band4"]);
    for (const d of Object.values(MARK)) expect(d).toMatch(/^M[\d.-]+ [\d.-]+c[\d\s.,-]+z/);
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
  it("shows the original logo of dentalarena.ro, named „Dental Arena” by default", () => {
    const out = html(<Logo />);
    // Served through the image optimiser at the displayed size: /_next/image?url=%2Fbrand%2F…
    expect(decodeURIComponent(out)).toContain("/brand/logo-dental-arena.webp");
    expect(out).toContain('alt="Dental Arena"');
    expect(out).not.toContain("<svg");
  });

  it("is hidden from screen readers when it sits inside a labelled link", () => {
    const out = html(<Logo title="" />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('alt=""');
  });

  it("uses the original tooth mark alone for the mark variant", () => {
    expect(decodeURIComponent(html(<Logo variant="mark" />))).toContain("/brand/semn-dental-arena.png");
    expect(decodeURIComponent(html(<Logo variant="reversed" lockup="mark" />))).toContain("/brand/semn-dental-arena.png");
    expect(decodeURIComponent(html(<Logo variant="full" />))).toContain("/brand/logo-dental-arena.webp");
  });

  it("keeps the original proportions", () => {
    const dims = (s: string) => [Number(s.match(/width="(\d+)"/)![1]), Number(s.match(/height="(\d+)"/)![1])];
    const [w, h] = dims(html(<Logo variant="full" />));
    expect(w / h).toBeCloseTo(1640 / 617, 1);
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
