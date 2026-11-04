"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";
import type { ClinicScope } from "@/lib/clinic-scope";
import { CLINIC_SCOPE_LABEL } from "@/lib/labels";
import { setClinicScope } from "./actions";

/**
 * Clinic switch (design system §6.8): a segmented control Cristești | Luduș | Ambele. The choice
 * persists in the `da_clinica` cookie, so every page keeps it. Works without JavaScript (a form
 * with three submit buttons).
 */
export function ClinicSwitch({ scope, options, className }: { scope: ClinicScope; options: ClinicScope[]; className?: string }) {
  const [state, formAction] = useActionState<ActionResult<{ scope: ClinicScope }> | null, FormData>(
    setClinicScope,
    null,
  );
  const [optimistic, setOptimistic] = useOptimistic(scope);
  const [, startTransition] = useTransition();
  const current = optimistic;

  // An account ticked for a single clinic sees only that clinic: no switch, just its name.
  if (options.length <= 1) {
    return (
      <p className={cn("text-control font-semibold text-cerneala", className)}>
        <span className="sr-only">Clinica afișată: </span>
        {CLINIC_SCOPE_LABEL[scope]}
      </p>
    );
  }

  return (
    <form action={formAction} className={cn("min-w-0", className)}>
      <fieldset className="flex items-center">
        <legend className="sr-only">Clinica afișată</legend>
        <div className="inline-flex rounded-control border border-linie-control bg-suprafata p-0.5">
          {options.map((value) => {
            const selected = current === value;
            return (
              <button
                key={value}
                type="submit"
                name="scope"
                value={value}
                aria-pressed={selected}
                onClick={(e) => {
                  e.preventDefault();
                  if (selected) return;
                  const fd = new FormData();
                  fd.set("scope", value);
                  startTransition(async () => {
                    setOptimistic(value);
                    formAction(fd);
                  });
                }}
                className={cn(
                  "h-8 rounded-bloc px-3 text-control font-medium transition-colors duration-150",
                  selected
                    ? "bg-menta-pal font-semibold text-cerneala ring-[1.5px] ring-inset ring-cerneala"
                    : "text-discret hover:text-cerneala",
                )}
              >
                {CLINIC_SCOPE_LABEL[value]}
              </button>
            );
          })}
        </div>
      </fieldset>
      {state && !state.ok ? (
        <p role="alert" className="mt-1 text-micro text-carmin">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
