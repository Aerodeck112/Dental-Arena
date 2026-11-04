"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { applyTheme } from "@/components/crm/shell/AppShell";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { changePassword, updateAppearance, updateProfile } from "./actions";

type Result = ActionResult<unknown> | null;

const inputClass =
  "h-control w-full rounded-control border border-linie-control bg-suprafata px-3 text-control text-cerneala aria-[invalid=true]:border-carmin";
const buttonClass =
  "apasat inline-flex h-control items-center justify-center rounded-control bg-actiune px-4 text-control font-medium text-pe-actiune transition-colors duration-150 hover:bg-actiune-apasat disabled:cursor-progress disabled:opacity-80";

function Panel({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-panou border border-linie bg-suprafata p-5">
      <h2 id={id} className="mb-4 text-h3 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Success or error line under a form; errors take focus (design system §11.2). */
function FormStatus({ state }: { state: Result }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state && !state.ok) ref.current?.focus();
  }, [state]);
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p role="status" className="text-mic text-actiune">
        {state.message}
      </p>
    ) : null;
  }
  return (
    <p ref={ref} tabIndex={-1} role="alert" className="text-mic text-carmin outline-none">
      {state.error}
    </p>
  );
}

function TextInput({
  label,
  name,
  state,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  state: Result;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  const id = `cont-${name}`;
  const describedBy = [hint ? `${id}-indiciu` : null, errors ? `${id}-eroare` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-control font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-indiciu`} className="text-mic text-discret">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputClass}
        {...rest}
      />
      {errors ? (
        <ul id={`${id}-eroare`} className="text-mic text-carmin">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ProfileForm({ firstName, lastName, phone }: { firstName: string; lastName: string; phone: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(updateProfile, null);
  return (
    <Panel title="Date personale" id="cont-date">
      <form action={action} className="flex max-w-md flex-col gap-4">
        <TextInput label="Prenume" name="firstName" state={state} defaultValue={firstName} autoComplete="given-name" required />
        <TextInput label="Nume" name="lastName" state={state} defaultValue={lastName} autoComplete="family-name" required />
        <TextInput
          label="Telefon (opțional)"
          name="phone"
          state={state}
          defaultValue={phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass} disabled={pending}>
            {pending ? "Se salvează…" : "Salvați datele"}
          </button>
          <FormStatus state={state} />
        </div>
      </form>
    </Panel>
  );
}

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState<Result, FormData>(changePassword, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <Panel title="Parola" id="cont-parola">
      {forced ? (
        <p className="mb-4 rounded-control bg-mustar-pal px-3 py-2 text-corp text-cerneala">
          Contul a fost creat cu o parolă temporară. Alegeți o parolă nouă înainte de a continua.
        </p>
      ) : null}
      <form ref={formRef} action={action} className="flex max-w-md flex-col gap-4">
        <TextInput label="Parola actuală" name="currentPassword" state={state} type="password" autoComplete="current-password" required />
        <TextInput
          label="Parola nouă"
          name="newPassword"
          state={state}
          type="password"
          autoComplete="new-password"
          hint="Cel puțin 10 caractere. Nu folosiți adresa de e-mail sau o parolă ușor de ghicit."
          minLength={10}
          required
        />
        <TextInput label="Repetați parola nouă" name="confirmPassword" state={state} type="password" autoComplete="new-password" required />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass} disabled={pending}>
            {pending ? "Se schimbă parola…" : "Schimbați parola"}
          </button>
          <FormStatus state={state} />
        </div>
      </form>
    </Panel>
  );
}

const THEME_OPTIONS = [
  { value: "SISTEM", label: "Sistem", description: "Urmează setarea dispozitivului." },
  { value: "LUMINOS", label: "Luminos", description: "Fundal deschis, la fel ca pe site." },
  { value: "INTUNECAT", label: "Întunecat", description: "Fundal închis, pentru lumină slabă." },
] as const;

const DENSITY_OPTIONS = [
  { value: "COMPACT", label: "Compact", description: "Rânduri de 36 px, pentru birou." },
  { value: "CONFORTABIL", label: "Confortabil", description: "Rânduri de 44 px, pentru tableta de la recepție." },
] as const;

function ChoiceGroup<V extends string>({
  legend,
  name,
  value,
  options,
}: {
  legend: string;
  name: string;
  value: V;
  options: readonly { value: V; label: string; description: string }[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-control font-medium">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-control border border-linie-control px-3 py-2 has-[:checked]:border-cerneala has-[:checked]:bg-menta-pal",
          )}
        >
          <input type="radio" name={name} value={o.value} defaultChecked={value === o.value} className="mt-1 size-4 accent-[var(--da-actiune)]" />
          <span className="flex flex-col">
            <span className="font-medium">{o.label}</span>
            <span className="text-mic text-discret">{o.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function AppearanceForm({
  theme,
  density,
}: {
  theme: "SISTEM" | "LUMINOS" | "INTUNECAT";
  density: "COMPACT" | "CONFORTABIL";
}) {
  const [state, action, pending] = useActionState<ActionResult<{ theme: typeof theme; density: typeof density }> | null, FormData>(
    updateAppearance,
    null,
  );
  useEffect(() => {
    if (state?.ok) applyTheme(state.data.theme);
  }, [state]);
  return (
    <Panel title="Aspect" id="cont-aspect">
      <form action={action} className="flex max-w-md flex-col gap-5">
        <ChoiceGroup legend="Tema" name="theme" value={theme} options={THEME_OPTIONS} />
        <ChoiceGroup legend="Densitate" name="density" value={density} options={DENSITY_OPTIONS} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass} disabled={pending}>
            {pending ? "Se salvează…" : "Salvați aspectul"}
          </button>
          <FormStatus state={state} />
        </div>
      </form>
    </Panel>
  );
}
