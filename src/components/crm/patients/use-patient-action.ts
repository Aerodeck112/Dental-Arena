"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { showToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";

/**
 * A Server Action bound to a form of the patient file: success toast, field errors next to the
 * fields, and values kept after submit (a transition submit; React would reset an `action` form).
 * The form still posts natively before hydration.
 */
export function usePatientAction<T>(
  action: (prev: unknown, fd: FormData) => Promise<ActionResult<T>>,
  opts: { onSuccess?: (data: T) => void; toast?: boolean } = {},
) {
  const [state, formAction, pending] = useActionState<ActionResult<T> | null, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) {
      if (opts.toast !== false) showToast({ kind: "success", message: r.message ?? "Modificările au fost salvate." });
      opts.onSuccess?.(r.data);
    }
    return r;
  }, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const formError = state && !state.ok && !errors ? state.error : null;
  return { state, formAction, onSubmit, pending, errors, formError };
}

/** Runs an action outside a form (buttons): toast on success, error toast on failure. */
export async function runPatientAction<T>(p: Promise<ActionResult<T>>, okMessage?: string): Promise<ActionResult<T>> {
  const r = await p;
  if (r.ok) showToast({ kind: "success", message: r.message ?? okMessage ?? "Modificările au fost salvate." });
  else showToast({ kind: "error", message: r.error });
  return r;
}
