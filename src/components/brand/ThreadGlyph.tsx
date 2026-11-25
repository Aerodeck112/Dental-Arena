import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { BAND_PARTS, CROWN_PARTS, MARK, MARK_BOXES, type MarkPart } from "./logo-paths";

/**
 * Filetul (the thread): a progress glyph built from the logo's own implant screw (§7).
 * The bands are the traced bands of the mark, never redrawn. It is always aria-hidden:
 * the meaning lives in the <ol> rendered by ThreadSteps next to it.
 */

export type ThreadState = "done" | "current" | "future";
export type ThreadSegment = { part: MarkPart; state: ThreadState };

/** The thread supports 1–5 steps: four traced bands, and the apex as a fifth step. */
export const THREAD_MAX_STEPS = 5;

/**
 * Which part of the screw stands for each step.
 * Five steps use the four bands and the apex (implant plan: radiografii, implant, vindecare, bont,
 * coroană). Four or fewer use the bands nearest the apex, so the screw stays contiguous and
 * tapered, and the apex is drawn as the tip, not as a step.
 */
export function threadParts(count: number): { steps: MarkPart[]; tip: MarkPart | null } {
  const n = Math.max(1, Math.min(THREAD_MAX_STEPS, Math.round(count)));
  if (n === THREAD_MAX_STEPS) return { steps: [...BAND_PARTS, "apex"], tip: null };
  return { steps: BAND_PARTS.slice(BAND_PARTS.length - n), tip: "apex" };
}

/** Step state from a 0-based `current` index. `current >= count` means every step is done. */
export function stepState(index: number, current: number): ThreadState {
  if (index < current) return "done";
  if (index === current) return "current";
  return "future";
}

/** The segments to draw for a sequence of `count` steps at position `current`. */
export function threadSegments(count: number, current: number): ThreadSegment[] {
  const { steps, tip } = threadParts(count);
  const segments: ThreadSegment[] = steps.map((part, i) => ({ part, state: stepState(i, current) }));
  if (tip) segments.push({ part: tip, state: current >= steps.length ? "done" : "future" });
  return segments;
}

/** viewBox around some parts of the mark, with room for the outline stroke. */
export function partsViewBox(parts: MarkPart[], opts: { padX?: number; padY?: number; spanX?: MarkPart[] } = {}): string {
  const boxes = parts.map((p) => MARK_BOXES[p]);
  const spanBoxes = (opts.spanX ?? parts).map((p) => MARK_BOXES[p]);
  const minX = Math.min(...spanBoxes.map((b) => b[0]));
  const maxX = Math.max(...spanBoxes.map((b) => b[2]));
  const minY = Math.min(...boxes.map((b) => b[1]));
  const maxY = Math.max(...boxes.map((b) => b[3]));
  const padX = opts.padX ?? 6;
  const padY = opts.padY ?? 6;
  const r = (v: number) => Math.round(v * 10) / 10;
  return `${r(minX - padX)} ${r(minY - padY)} ${r(maxX - minX + 2 * padX)} ${r(maxY - minY + 2 * padY)}`;
}

const STATE_CLASS: Record<ThreadState, string> = {
  done: "fill-menta stroke-menta",
  current: "fill-transparent stroke-cerneala",
  future: "fill-transparent stroke-linie-control",
};
const STATE_STROKE: Record<ThreadState, number> = { done: 1, current: 1.5, future: 1.25 };

type ThreadGlyphProps = {
  /** Number of steps in the sequence (1–5). */
  count: number;
  /** 0-based index of the current step. `count` (or more) = all done; -1 = nothing started. */
  current: number;
  /** Draw the crown on top of the screw: the full Dental Arena mark (booking confirmation). */
  crown?: boolean;
  /** Animate the crown outline drawing on (700ms, `ease-filet`); instant under reduced motion. */
  crownAnimated?: boolean;
  /** The bands fill in sequence: the loading indicator for slow availability (>600ms). */
  loading?: boolean;
  /** Draw explicit segments instead of count/current (odontogram, list rows). */
  segments?: ThreadSegment[];
  /** Override the viewBox (used by the list rows to keep a shared width). */
  viewBox?: string;
  className?: string;
  style?: CSSProperties;
};

export function ThreadGlyph({
  count,
  current,
  crown = false,
  crownAnimated = false,
  loading = false,
  segments,
  viewBox,
  className,
  style,
}: ThreadGlyphProps) {
  const segs = segments ?? threadSegments(count, current);
  const parts = segs.map((s) => s.part);
  const box =
    viewBox ??
    partsViewBox(crown ? [...CROWN_PARTS, ...parts] : parts, crown ? { padX: 6, padY: 6 } : undefined);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={box}
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0 overflow-visible", className)}
      style={style}
      data-thread=""
    >
      {segs.map((s, i) => (
        <path
          key={s.part}
          d={MARK[s.part]}
          vectorEffect="non-scaling-stroke"
          strokeWidth={STATE_STROKE[s.state]}
          strokeLinejoin="round"
          data-state={s.state}
          className={cn(
            "transition-[fill,stroke] duration-[220ms] ease-filet",
            loading ? "da-band-loading fill-transparent stroke-linie-control" : STATE_CLASS[s.state],
          )}
          style={loading ? { animationDelay: `${i * 160}ms` } : undefined}
        />
      ))}
      {crown &&
        CROWN_PARTS.map((part) => (
          <path
            key={part}
            d={MARK[part]}
            pathLength={1}
            strokeWidth={4}
            strokeLinejoin="round"
            className={cn("fill-menta stroke-menta", crownAnimated && "da-crown-draw")}
          />
        ))}
    </svg>
  );
}
