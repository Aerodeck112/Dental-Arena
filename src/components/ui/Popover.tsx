"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";
import { useDismiss } from "./use-dismiss";

export type PopoverProps = {
  /** Content of the trigger button. */
  trigger: ReactNode;
  /** Accessible name of the trigger when it shows only an icon. */
  triggerLabel?: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  triggerClassName?: string;
  /** Accessible name of the panel. */
  label?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
  panelClassName?: string;
};

/**
 * A panel anchored to its trigger (quick-create, filters). Closes on Esc (focus returns to the
 * trigger) and on a click outside. Floats, so it carries the shadow and, in dark mode, a border.
 */
export function Popover({
  trigger,
  triggerLabel,
  triggerVariant = "secondary",
  triggerSize = "m",
  triggerClassName,
  label,
  align = "start",
  side = "bottom",
  open: openProp,
  onOpenChange,
  children,
  className,
  panelClassName,
}: PopoverProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const wrapper = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  useDismiss(wrapper, open, (reason) => {
    setOpen(false);
    if (reason === "escape") triggerRef.current?.focus();
  });

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panelRef.current)?.focus();
  }, [open]);

  return (
    <div ref={wrapper} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        onClick={() => setOpen(!open)}
        className={buttonClasses({ variant: triggerVariant, size: triggerSize, className: triggerClassName })}
      >
        {trigger}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={label ?? triggerLabel}
        tabIndex={-1}
        hidden={!open}
        className={cn(
          "da-rise absolute z-50 min-w-64 rounded-panou border border-linie bg-suprafata p-4 text-cerneala shadow-float",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          align === "start" ? "left-0" : "right-0",
          panelClassName,
        )}
      >
        {open && (typeof children === "function" ? children(close) : children)}
      </div>
    </div>
  );
}
