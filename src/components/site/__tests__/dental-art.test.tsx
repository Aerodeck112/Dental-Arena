import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SERVICE_SLUGS } from "@/content/services";
import { DentalArt, SERVICE_ART } from "../DentalArt";

/** The line drawings (docs/design-system.md §9.6). */
describe("DentalArt", () => {
  it("has a drawing for every service page", () => {
    for (const slug of SERVICE_SLUGS) expect(SERVICE_ART[slug]).toBeTruthy();
  });

  it("is decorative: hidden from screen readers and out of the tab order", () => {
    const out = renderToStaticMarkup(<DentalArt name="implant" />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('focusable="false"');
  });

  it("draws in the parent's colour, with a hairline", () => {
    const out = renderToStaticMarkup(<DentalArt name="molar" className="text-menta" />);
    expect(out).toContain('stroke="currentColor"');
    expect(out).toContain('stroke-width="1.5"');
    expect(out).toContain('class="desen text-menta"');
  });

  it("uses a wider canvas for the compositions", () => {
    expect(renderToStaticMarkup(<DentalArt name="pereche" />)).toContain('viewBox="0 0 220 120"');
    expect(renderToStaticMarkup(<DentalArt name="tava" />)).toContain('viewBox="0 0 240 150"');
    expect(renderToStaticMarkup(<DentalArt name="oglinda" />)).toContain('viewBox="0 0 120 120"');
  });
});
