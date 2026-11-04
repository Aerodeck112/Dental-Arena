"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { login } from "./actions";

const RATE_LIMITED_MESSAGE = "Prea multe încercări de autentificare. Încercați din nou peste 15 minute.";

const inputClass =
  "h-control w-full rounded-control border border-linie-control bg-suprafata px-3 text-control text-cerneala aria-[invalid=true]:border-carmin";

/**
 * „Intrați în cont”. Works without JavaScript: the form posts to the Server Action directly.
 * Errors are announced and focused (design system §11.2).
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<ActionResult<unknown> | null, FormData>(login, null);
  const alertRef = useRef<HTMLDivElement>(null);

  const failure = state && !state.ok ? state : null;
  const message = failure ? (failure.code === "RATE_LIMITED" ? RATE_LIMITED_MESSAGE : failure.error) : null;
  const emailErrors = failure?.fieldErrors?.email;
  const passwordErrors = failure?.fieldErrors?.password;

  useEffect(() => {
    if (failure) alertRef.current?.focus();
  }, [failure]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {message ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="rounded-control border border-carmin bg-carmin-pal px-3 py-2 text-corp text-cerneala outline-none"
        >
          {message}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-control font-medium">
          E-mail
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          aria-invalid={emailErrors ? true : undefined}
          aria-describedby={emailErrors ? "login-email-eroare" : undefined}
          className={inputClass}
        />
        {emailErrors ? (
          <p id="login-email-eroare" className="text-mic text-carmin">
            {emailErrors[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-parola" className="text-control font-medium">
          Parola
        </label>
        <input
          id="login-parola"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordErrors ? true : undefined}
          aria-describedby={passwordErrors ? "login-parola-eroare" : undefined}
          className={inputClass}
        />
        {passwordErrors ? (
          <p id="login-parola-eroare" className="text-mic text-carmin">
            {passwordErrors[0]}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={cn(
          "apasat mt-2 inline-flex h-control items-center justify-center rounded-control bg-actiune px-4 text-control font-medium text-pe-actiune transition-colors duration-150 hover:bg-actiune-apasat",
          pending && "cursor-progress opacity-80",
        )}
      >
        {pending ? "Se verifică…" : "Intrați în cont"}
      </button>
    </form>
  );
}
