"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PX_PER_MINUTE, SLOT_MINUTES, clampStart, snapMinutes } from "./layout";

export type DragMode = "move" | "resize";

export type DragState = {
  id: string;
  mode: DragMode;
  columnId: string;
  start: number;
  end: number;
  /** True once the pointer travelled past the threshold (a plain click is not a drag). */
  active: boolean;
};

export type DropTarget = { id: string; mode: DragMode; columnId: string; start: number; end: number };

const THRESHOLD_PX = 4;

/**
 * Pointer drag for calendar blocks: moves snap to 15 minutes and may change column (doctor,
 * cabinet or day, found under the pointer through `data-column-id`); the bottom edge resizes.
 * A drag that moved suppresses the click that follows; Escape cancels. The keyboard alternative
 * is the „Mutați” dialog.
 */
export function useCalendarDrag(o: { dayStart: number; dayEnd: number; onDrop: (t: DropTarget) => void }) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const origin = useRef<{ x: number; y: number; start: number; end: number; columnId: string } | null>(null);
  const live = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const { dayStart, dayEnd, onDrop } = o;

  const update = (next: DragState | null) => {
    live.current = next;
    setDrag(next);
  };

  const begin = useCallback(
    (mode: DragMode) =>
      (e: ReactPointerEvent<HTMLElement>, a: { id: string; startMinute: number; endMinute: number }, columnId: string) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        origin.current = { x: e.clientX, y: e.clientY, start: a.startMinute, end: a.endMinute, columnId };
        update({ id: a.id, mode, columnId, start: a.startMinute, end: a.endMinute, active: false });
      },
    [],
  );

  // The click that ends a drag must not open the drawer. Always attached, so it outlives the drag.
  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick.current) return;
      e.stopPropagation();
      e.preventDefault();
      suppressClick.current = false;
    };
    window.addEventListener("click", onClickCapture, true);
    return () => window.removeEventListener("click", onClickCapture, true);
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const cur = live.current;
      const from = origin.current;
      if (!cur || !from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (!cur.active && Math.hypot(dx, dy) < THRESHOLD_PX) return;
      const delta = snapMinutes(dy / PX_PER_MINUTE, SLOT_MINUTES);
      if (cur.mode === "resize") {
        const end = Math.min(dayEnd, Math.max(from.start + SLOT_MINUTES, snapMinutes(from.end + delta)));
        update({ ...cur, end, active: true });
        return;
      }
      const duration = from.end - from.start;
      const start = clampStart(from.start + delta, duration, dayStart, dayEnd);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const column = el instanceof Element ? el.closest<HTMLElement>("[data-column-id]")?.dataset.columnId : undefined;
      update({ ...cur, start, end: start + duration, columnId: column ?? cur.columnId, active: true });
    };
    const onUp = () => {
      const cur = live.current;
      const from = origin.current;
      update(null);
      origin.current = null;
      if (!cur || !from || !cur.active) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      if (cur.start === from.start && cur.end === from.end && cur.columnId === from.columnId) return;
      onDrop({ id: cur.id, mode: cur.mode, columnId: cur.columnId, start: cur.start, end: cur.end });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        update(null);
        origin.current = null;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // Listeners are attached once per drag; `drag?.id` changes only when a new drag starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, dayStart, dayEnd, onDrop]);

  return { drag, startMove: begin("move"), startResize: begin("resize") };
}
