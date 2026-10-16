"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The header menus are native <details> disclosures, so they open without JavaScript. With
 * JavaScript this adds what a menu needs: Esc closes and returns focus to the trigger, a click or
 * focus outside closes, and a navigation closes.
 */
export function useDetailsDismiss<T extends HTMLDetailsElement>() {
  const ref = useRef<T>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const summary = () => details.querySelector("summary");
    const onPointer = (e: PointerEvent) => {
      if (details.open && !details.contains(e.target as Node)) details.open = false;
    };
    const onFocus = (e: FocusEvent) => {
      if (details.open && e.target instanceof Node && !details.contains(e.target)) details.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && details.open) {
        e.preventDefault();
        details.open = false;
        summary()?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      // A link inside the panel was followed: close at once (same-page anchors included).
      if ((e.target as HTMLElement).closest("a")) details.open = false;
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    details.addEventListener("keydown", onKey);
    details.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
      details.removeEventListener("keydown", onKey);
      details.removeEventListener("click", onClick);
    };
  }, []);

  return ref;
}
