"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useNativeDialog } from "./use-dialog";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Width in px on larger screens (full width on phones). Default 400. */
  width?: number;
  children?: ReactNode;
  /** Sticky actions at the bottom. */
  footer?: ReactNode;
  /** A small line under the title (e.g. the appointment time). */
  subtitle?: ReactNode;
  /** Non-modal drawers leave the page usable (the calendar behind stays clickable). */
  modal?: boolean;
  className?: string;
};

/** A side panel from the right on the native <dialog> (CRM appointment drawer). 180ms in. */
export function Drawer({
  open,
  onClose,
  title,
  width = 400,
  children,
  footer,
  subtitle,
  modal = true,
  className,
}: DrawerProps) {
  const ref = useNativeDialog(open, onClose, modal);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      style={{ width: `min(100vw, ${width}px)` }}
      className={cn(
        "da-overlay fixed inset-y-0 right-0 left-auto z-40 m-0 h-dvh max-h-dvh max-w-none overflow-hidden p-0",
        "border-l border-linie bg-suprafata text-cerneala shadow-float",
        "open:flex open:flex-col open:da-drawer",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-linie px-5 py-3">
        <div className="min-w-0 flex-1 pt-1">
          <h2 id={titleId} className="text-h3 font-semibold">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-mic text-discret cifre">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închideți"
          className="apasat -mr-2 inline-flex size-control shrink-0 items-center justify-center rounded-control text-discret hover:bg-adancit hover:text-cerneala"
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex flex-wrap items-center gap-3 border-t border-linie px-5 py-3">{footer}</div>}
    </dialog>
  );
}
