import { describe, expect, it } from "vitest";
import {
  ADULT_ROWS,
  CHILD_ROWS,
  canonicalSurfaces,
  innerSurface,
  isFdiTooth,
  neighbourTooth,
  parseFdi,
  surfacesFor,
  toothKind,
  toothName,
} from "../fdi";
import { LEGEND, LEGEND_BY_CONDITION } from "../legend";

describe("FDI validation", () => {
  it("accepts the 32 permanent and 20 primary teeth only", () => {
    const all = Array.from({ length: 100 }, (_, i) => i).filter(isFdiTooth);
    expect(all).toHaveLength(52);
    expect(isFdiTooth(36)).toBe(true);
    expect(isFdiTooth(85)).toBe(true);
    for (const bad of [10, 19, 39, 49, 56, 66, 86, 91, 0, 3.6, NaN]) expect(isFdiTooth(bad)).toBe(false);
    expect(isFdiTooth("36")).toBe(false);
  });
  it("parses two-digit input", () => {
    expect(parseFdi("36")).toBe(36);
    expect(parseFdi(" 11 ")).toBe(11);
    expect(parseFdi("9")).toBeNull();
    expect(parseFdi("59")).toBeNull();
    expect(parseFdi(null)).toBeNull();
  });
  it("lays out both dentitions completely, from the patient's right", () => {
    expect(ADULT_ROWS.flat().sort()).toEqual(Array.from({ length: 100 }, (_, i) => i).filter((n) => isFdiTooth(n) && n < 50));
    expect(CHILD_ROWS.flat()).toHaveLength(20);
    expect(ADULT_ROWS[0][0]).toBe(18);
    expect(ADULT_ROWS[1][15]).toBe(38);
  });
});

describe("tooth names and surfaces", () => {
  it("names teeth in Romanian", () => {
    expect(toothName(36)).toBe("36, primul molar inferior stâng");
    expect(toothName(11)).toBe("11, incisiv central superior drept");
    expect(toothName(45)).toBe("45, al doilea premolar inferior drept");
    expect(toothName(65)).toBe("65, al doilea molar temporar superior stâng");
    expect(toothKind(53)).toBe("canin");
  });
  it("uses P on upper teeth and L on lower teeth", () => {
    expect(innerSurface(16)).toBe("P");
    expect(innerSurface(46)).toBe("L");
    expect(surfacesFor(16)).toEqual(["M", "O", "D", "V", "P"]);
    expect(canonicalSurfaces(16, "dlm")).toBe("MDP");
    expect(canonicalSurfaces(46, "P o")).toBe("OL");
    expect(canonicalSurfaces(46, "")).toBeNull();
  });
});

describe("keyboard navigation", () => {
  it("moves along and across the arches and stops at the edges", () => {
    expect(neighbourTooth(11, "ArrowRight")).toBe(21);
    expect(neighbourTooth(11, "ArrowLeft")).toBe(12);
    expect(neighbourTooth(18, "ArrowLeft")).toBe(18);
    expect(neighbourTooth(36, "ArrowUp")).toBe(26);
    expect(neighbourTooth(26, "ArrowDown")).toBe(36);
    expect(neighbourTooth(51, "ArrowRight")).toBe(61);
    expect(neighbourTooth(44, "Home")).toBe(48);
  });
});

describe("legend", () => {
  it("gives every finding a unique letter and a pattern", () => {
    const letters = LEGEND.map((l) => l.letter);
    expect(new Set(letters).size).toBe(letters.length);
    expect(LEGEND_BY_CONDITION.IMPLANT.pattern).toBe("thread");
    expect(Object.keys(LEGEND_BY_CONDITION)).toHaveLength(17);
  });
});
