"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useNativeDialog } from "./use-dialog";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One plain sentence under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Actions, right-aligned: the main action last. */
  footer?: ReactNode;
  size?: "s" | "m" | "l";
  className?: string;
};

/**
 * A modal on the native <dialog>: focus moves in and returns to the trigger, the page behind is
 * inert, Esc and a click on the backdrop close it. Floats, so it carries the one shadow.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "m", className }: DialogProps) {
  const ref = useNativeDialog(open, onClose);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        "da-overlay fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden p-0",
        "rounded-panou border border-linie bg-suprafata text-cerneala shadow-float",
        "open:flex open:flex-col open:da-rise",
        size === "s" ? "max-w-md" : size === "l" ? "max-w-3xl" : "max-w-xl",
        className,
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-2 sm:px-6">
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 id={titleId} className="text-h3 font-semibold">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-1 text-corp text-discret">
              {description}
            </p>
          )}
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
      {children !== undefined && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">{children}</div>}
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-linie px-5 py-3 sm:px-6">{footer}</div>
      )}
    </dialog>
  );
}
