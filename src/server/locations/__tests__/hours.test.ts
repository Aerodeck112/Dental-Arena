import { describe, expect, it } from "vitest";
import { hoursProblems, hoursSchema } from "../schemas";

describe("hoursProblems", () => {
  it("accepts split days and closed days", () => {
    expect(
      hoursProblems([
        { weekday: 1, openMinute: 540, closeMinute: 780 },
        { weekday: 1, openMinute: 840, closeMinute: 1140 },
        { weekday: 6, openMinute: 540, closeMinute: 720 },
      ]),
    ).toEqual([]);
  });

  it("flags inverted, off-grid and overlapping intervals", () => {
    expect(hoursProblems([{ weekday: 2, openMinute: 600, closeMinute: 540 }])).toContain(
      "Ziua 2: ora de închidere trebuie să fie după ora de deschidere.",
    );
    expect(hoursProblems([{ weekday: 3, openMinute: 541, closeMinute: 600 }])).toContain("Ziua 3: orele se rotunjesc la 5 minute.");
    expect(
      hoursProblems([
        { weekday: 4, openMinute: 540, closeMinute: 800 },
        { weekday: 4, openMinute: 780, closeMinute: 900 },
      ]),
    ).toContain("Ziua 4: intervalele se suprapun.");
  });

  it("parses the JSON hidden field", () => {
    const r = hoursSchema.safeParse({ locationId: "cmuw5huc80000u77divbvrxg1", hours: '[{"weekday":1,"openMinute":540,"closeMinute":1020}]' });
    expect(r.success && r.data.hours).toEqual([{ weekday: 1, openMinute: 540, closeMinute: 1020 }]);
  });
});
