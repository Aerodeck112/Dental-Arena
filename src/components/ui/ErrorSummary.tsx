"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { fieldId } from "./field-ids";

export type ErrorSummaryProps = {
  /** Field errors from ActionResult.fieldErrors, keyed by field name. */
  errors?: Record<string, string[] | undefined> | null;
  /** A general error without a field (ActionResult.error). */
  message?: string | null;
  title?: string;
  /** Map a field name to the id of its control when it is not `field-<name>`. */
  idFor?: (name: string) => string;
  /** Take focus when the errors appear or change (default). Off only for static previews. */
  autoFocus?: boolean;
  className?: string;
};

/**
 * The list of what to fix, on carmin-pal. It takes focus whenever it appears or changes, and each
 * line links to (and focuses) its field. Errors say what to do; they do not apologise.
 */
export function ErrorSummary({
  errors,
  message,
  title = "Corectați datele de mai jos",
  idFor = fieldId,
  autoFocus = true,
  className,
}: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const entries = Object.entries(errors ?? {}).filter(
    (e): e is [string, string[]] => Array.isArray(e[1]) && e[1].length > 0,
  );
  const hasContent = entries.length > 0 || !!message;
  const signature = JSON.stringify([message ?? null, entries]);

  useEffect(() => {
    if (hasContent && autoFocus) ref.current?.focus();
  }, [signature, hasContent, autoFocus]);

  if (!hasContent) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={autoFocus ? "alert" : undefined}
      aria-labelledby={headingId}
      className={cn("rounded-panou border-2 border-carmin bg-carmin-pal p-4 text-cerneala sm:p-5", className)}
    >
      <h2 id={headingId} className="flex items-center gap-2 text-h3 font-semibold">
        <Icon name="alert-triangle" size={22} className="text-carmin" />
        {title}
      </h2>
      {message && <p className="mt-2 text-corp">{message}</p>}
      {entries.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {entries.flatMap(([name, messages]) =>
            messages.map((m, i) => (
              <li key={`${name}-${i}`}>
                <a
                  href={`#${idFor(name)}`}
                  onClick={(e) => {
                    const target = document.getElementById(idFor(name));
                    if (!target) return;
                    e.preventDefault();
                    target.scrollIntoView({ block: "center" });
                    target.focus({ preventScroll: true });
                  }}
                  className="text-corp font-medium text-carmin underline underline-offset-4 hover:decoration-2"
                >
                  {m}
                </a>
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}
