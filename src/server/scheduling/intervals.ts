/**
 * Half-open time intervals `[start, end)` in epoch milliseconds (docs/architecture.md §6.1).
 * Pure: no Prisma, no clock. Touching intervals (`a.end === b.start`) do not overlap.
 */

export type Interval = { start: number; end: number };

export const MINUTE_MS = 60_000;

export function interval(start: Date | number, end: Date | number): Interval {
  return { start: typeof start === "number" ? start : start.getTime(), end: typeof end === "number" ? end : end.getTime() };
}

export function isEmpty(i: Interval): boolean {
  return !(i.start < i.end);
}

/** §6.2 overlap predicate: `a.start < b.end && b.start < a.end`. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True when `outer` fully contains `inner`. */
export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Intersection of two intervals, or null when they do not overlap. */
export function intersect(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? { start, end } : null;
}

/** Sorts and merges overlapping or touching intervals; drops empty ones. */
export function normalize(list: readonly Interval[]): Interval[] {
  const sorted = list.filter((i) => !isEmpty(i)).sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) {
      if (i.end > last.end) last.end = i.end;
    } else {
      out.push({ start: i.start, end: i.end });
    }
  }
  return out;
}

/** `base` minus every interval in `minus`. The result is sorted and disjoint. */
export function subtract(base: readonly Interval[], minus: readonly Interval[]): Interval[] {
  const cuts = normalize(minus);
  const out: Interval[] = [];
  for (const b of normalize(base)) {
    let cursor = b.start;
    for (const c of cuts) {
      if (c.end <= cursor) continue;
      if (c.start >= b.end) break;
      if (c.start > cursor) out.push({ start: cursor, end: Math.min(c.start, b.end) });
      cursor = Math.max(cursor, c.end);
      if (cursor >= b.end) break;
    }
    if (cursor < b.end) out.push({ start: cursor, end: b.end });
  }
  return out;
}

/** Each interval in `list` clipped to the union of `clip`. */
export function clipTo(list: readonly Interval[], clip: readonly Interval[]): Interval[] {
  const windows = normalize(clip);
  const out: Interval[] = [];
  for (const i of normalize(list)) {
    for (const w of windows) {
      const x = intersect(i, w);
      if (x) out.push(x);
    }
  }
  return normalize(out);
}

/** Expands an interval's end by `minutes` (the buffer after an appointment). */
export function withBuffer(i: Interval, minutes: number): Interval {
  return minutes > 0 ? { start: i.start, end: i.end + minutes * MINUTE_MS } : i;
}

/** Total length in minutes. */
export function totalMinutes(list: readonly Interval[]): number {
  return normalize(list).reduce((sum, i) => sum + (i.end - i.start) / MINUTE_MS, 0);
}
