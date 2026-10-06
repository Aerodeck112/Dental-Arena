"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { showToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";

type Action<T> = (prev: unknown, fd: FormData) => Promise<ActionResult<T>>;

/**
 * A Server Action bound to a form: success toast, field errors, and values kept after submit
 * (React resets a form after an `action` submit, so we submit through a transition instead).
 * The form still posts natively before hydration.
 */
export function useActionForm<T>(action: Action<T>, opts: { onSuccess?: (data: T) => void; toast?: boolean } = {}) {
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
