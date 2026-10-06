import { describe, expect, it } from "vitest";
import { blockSize, clampStart, hourMarks, layoutLanes, minuteToY, snapMinutes, yToSlotMinute } from "../layout";

describe("calendar geometry", () => {
  it("draws 15-minute rows at 24 px (96 px per hour)", () => {
    expect(minuteToY(540, 480)).toBe(96);
    expect(minuteToY(495, 480)).toBe(24);
  });

  it("snaps drags to 15 minutes and clicks to the slot above", () => {
    expect(snapMinutes(547)).toBe(540);
    expect(snapMinutes(553)).toBe(555);
    expect(yToSlotMinute(23, 480)).toBe(480);
    expect(yToSlotMinute(24, 480)).toBe(495);
    expect(yToSlotMinute(100, 480)).toBe(540);
  });

  it("keeps a moved block inside the visible day", () => {
    expect(clampStart(460, 30, 480, 1200)).toBe(480);
    expect(clampStart(1190, 30, 480, 1200)).toBe(1170);
    expect(clampStart(600, 30, 480, 1200)).toBe(600);
  });

  it("drops the status word under 30 minutes", () => {
    expect(blockSize(15)).toBe("s");
    expect(blockSize(25)).toBe("s");
    expect(blockSize(30)).toBe("m");
    expect(blockSize(60)).toBe("l");
  });

  it("lists the hours of the gutter", () => {
    expect(hourMarks(480, 720)).toEqual([480, 540, 600, 660]);
  });
});

describe("layoutLanes", () => {
  it("gives a lone block the full width", () => {
    expect(layoutLanes([{ id: "a", start: 540, end: 570 }]).get("a")).toEqual({ lane: 0, lanes: 1 });
  });

  it("does not treat touching blocks as overlapping", () => {
    const m = layoutLanes([
      { id: "a", start: 540, end: 570 },
      { id: "b", start: 570, end: 600 },
    ]);
    expect(m.get("a")).toEqual({ lane: 0, lanes: 1 });
    expect(m.get("b")).toEqual({ lane: 0, lanes: 1 });
  });

  it("puts two overlapping blocks side by side", () => {
    const m = layoutLanes([
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 555, end: 585 },
    ]);
    expect(m.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(m.get("b")).toEqual({ lane: 1, lanes: 2 });
  });

  it("reuses a freed lane inside a chained cluster", () => {
    // a overlaps b, b overlaps c, a and c do not overlap: two lanes for all three.
    const m = layoutLanes([
      { id: "a", start: 540, end: 570 },
      { id: "b", start: 555, end: 615 },
      { id: "c", start: 570, end: 600 },
    ]);
    expect(m.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(m.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(m.get("c")).toEqual({ lane: 0, lanes: 2 });
  });

  it("uses three lanes when three blocks share an instant, and resets after the cluster", () => {
    const m = layoutLanes([
      { id: "c", start: 560, end: 580 },
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 545, end: 590 },
      { id: "d", start: 600, end: 630 },
    ]);
    expect(m.get("a")).toEqual({ lane: 0, lanes: 3 });
    expect(m.get("b")).toEqual({ lane: 1, lanes: 3 });
    expect(m.get("c")).toEqual({ lane: 2, lanes: 3 });
    expect(m.get("d")).toEqual({ lane: 0, lanes: 1 });
  });

  it("places the longer block first on equal starts", () => {
    const m = layoutLanes([
      { id: "short", start: 540, end: 555 },
      { id: "long", start: 540, end: 600 },
    ]);
    expect(m.get("long")?.lane).toBe(0);
    expect(m.get("short")?.lane).toBe(1);
  });
});
