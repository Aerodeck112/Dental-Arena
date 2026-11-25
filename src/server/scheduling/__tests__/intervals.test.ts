import { describe, expect, it } from "vitest";
import { clipTo, contains, intersect, normalize, overlaps, subtract, totalMinutes, withBuffer } from "../intervals";

const i = (start: number, end: number) => ({ start, end });

describe("intervals", () => {
  it("overlaps uses the §6.2 predicate: touching intervals do not conflict", () => {
    expect(overlaps(i(0, 10), i(5, 15))).toBe(true);
    expect(overlaps(i(0, 10), i(10, 20))).toBe(false);
    expect(overlaps(i(10, 20), i(0, 10))).toBe(false);
    expect(overlaps(i(0, 30), i(10, 20))).toBe(true);
    expect(overlaps(i(0, 10), i(11, 20))).toBe(false);
  });

  it("normalize sorts, merges overlapping and touching intervals and drops empty ones", () => {
    expect(normalize([i(20, 30), i(0, 10), i(10, 15), i(5, 6), i(40, 40), i(50, 45)])).toEqual([i(0, 15), i(20, 30)]);
  });

  it("subtract cuts every removed interval out of the base", () => {
    expect(subtract([i(0, 100)], [i(10, 20), i(50, 60)])).toEqual([i(0, 10), i(20, 50), i(60, 100)]);
    expect(subtract([i(0, 100)], [i(-10, 5), i(95, 120)])).toEqual([i(5, 95)]);
    expect(subtract([i(0, 100)], [i(0, 100)])).toEqual([]);
    expect(subtract([i(0, 10), i(20, 30)], [i(5, 25)])).toEqual([i(0, 5), i(25, 30)]);
    expect(subtract([i(0, 10)], [])).toEqual([i(0, 10)]);
    expect(subtract([i(0, 10)], [i(10, 20), i(-5, 0)])).toEqual([i(0, 10)]);
  });

  it("clipTo keeps only the parts inside the clip windows", () => {
    expect(clipTo([i(0, 100)], [i(10, 20), i(90, 200)])).toEqual([i(10, 20), i(90, 100)]);
    expect(clipTo([i(0, 100)], [])).toEqual([]);
  });

  it("intersect, contains, withBuffer and totalMinutes", () => {
    expect(intersect(i(0, 10), i(5, 20))).toEqual(i(5, 10));
    expect(intersect(i(0, 10), i(10, 20))).toBeNull();
    expect(contains(i(0, 10), i(0, 10))).toBe(true);
    expect(contains(i(0, 10), i(5, 11))).toBe(false);
    expect(withBuffer(i(0, 60_000), 10)).toEqual(i(0, 660_000));
    expect(withBuffer(i(0, 60_000), 0)).toEqual(i(0, 60_000));
    expect(totalMinutes([i(0, 60_000), i(30_000, 120_000)])).toBe(2);
  });
});
