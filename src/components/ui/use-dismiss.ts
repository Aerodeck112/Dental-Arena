"use client";

import { useEffect, type RefObject } from "react";

/** Calls `onDismiss` on Escape or on a pointer press outside `ref`, while `active`. */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: (reason: "escape" | "outside") => void) {
  useEffect(() => {
    if (!active) return;
    const onPointer = (e: PointerEvent) => {
      const el = ref.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) onDismiss("outside");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDismiss("escape");
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, active, onDismiss]);
}
