/**
 * Pure calendar geometry (design system §5.3, §6.8): 15-minute rows of 24 px (96 px per hour),
 * snapping, and lanes for overlapping blocks. No React, no DOM: unit-tested.
 */

export const SLOT_MINUTES = 15;
export const SLOT_PX = 24;
export const PX_PER_MINUTE = SLOT_PX / SLOT_MINUTES;

/** Vertical offset (px) of a local minute in a grid that starts at `dayStart`. */
export function minuteToY(minute: number, dayStart: number): number {
  return (minute - dayStart) * PX_PER_MINUTE;
}

/** Rounds to the nearest multiple of `step` (default 15 minutes). */
export function snapMinutes(minute: number, step: number = SLOT_MINUTES): number {
  return Math.round(minute / step) * step;
}

/** Local minute under a vertical offset, snapped down to the grid (for clicks on an empty slot). */
export function yToSlotMinute(y: number, dayStart: number, step: number = SLOT_MINUTES): number {
  return dayStart + Math.floor(y / PX_PER_MINUTE / step) * step;
}

/** Clamps a start so that `[start, start + duration)` stays inside `[dayStart, dayEnd)`. */
export function clampStart(start: number, duration: number, dayStart: number, dayEnd: number): number {
  return Math.max(dayStart, Math.min(start, dayEnd - duration));
}

/** „s” under 30 minutes (icon and edge only, no status word), „m” under an hour, „l” from an hour. */
export function blockSize(durationMinutes: number): "s" | "m" | "l" {
  if (durationMinutes < 30) return "s";
  if (durationMinutes < 60) return "m";
  return "l";
}

export type LaneItem = { id: string; start: number; end: number };
export type LanePlacement = { lane: number; lanes: number };

/**
 * Lays overlapping items out side by side. Items that overlap (directly or through a chain) form
 * a cluster; inside a cluster each item takes the first free lane, in start order (longer first
 * on equal starts), and every item of the cluster shares the cluster's lane count. Touching
 * intervals (`a.end === b.start`) do not overlap.
 */
export function layoutLanes(items: readonly LaneItem[]): Map<string, LanePlacement> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const out = new Map<string, LanePlacement>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd && cluster.length > 0) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ id: item.id, lane });
    clusterEnd = Math.max(clusterEnd === -Infinity ? item.end : clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();
  return out;
}

/** Hour labels of the time gutter: „08:00”, „09:00” … for `[dayStart, dayEnd)`. */
export function hourMarks(dayStart: number, dayEnd: number): number[] {
  const marks: number[] = [];
  for (let m = Math.ceil(dayStart / 60) * 60; m < dayEnd; m += 60) marks.push(m);
  return marks;
}
