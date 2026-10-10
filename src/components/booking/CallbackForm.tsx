"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { ConsentCheckbox } from "@/components/ui/ConsentCheckbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { PhoneField } from "@/components/ui/PhoneField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import type { ActionResult } from "@/lib/actions";
import { requestCallback } from "@/app/(site)/programare/actions";

/**
 * „Nu găsesc o oră potrivită. Prefer să mă sunați.” (§6.5): a short form that creates an
 * `APEL_INVERS` lead with the wizard's clinic, reason and doctor. A real <form> posting to a
 * Server Action, so it also works before the page's JavaScript has loaded.
 */
export function CallbackForm({
  honeypot,
  context,
  defaults,
  idempotencyKey,
}: {
  /** <HoneypotFields /> rendered by the server page. */
  honeypot: ReactNode;
  context: { locationId?: string | null; serviceId?: string | null; doctorId?: string | null; comfort?: string | null };
  defaults?: { name?: string; phone?: string };
  idempotencyKey: string;
}) {
  const [state, action] = useActionState<ActionResult<null> | null, FormData>(requestCallback, null);
  const [name, setName] = useState(defaults?.name ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const doneRef = useRef<HTMLParagraphElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) doneRef.current?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <div className="rounded-panou bg-menta-pal p-5">
        <p ref={doneRef} tabIndex={-1} role="status" className="text-h3 font-semibold text-cerneala outline-none">
          {state.message ?? "Vă sunăm noi în cel mult o zi lucrătoare."}
        </p>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={(e) => {
        // Keep the visitor's ticks and choices: React resets a form after an `action` submit.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }} className="flex flex-col gap-5 rounded-panou border border-linie bg-suprafata p-5" noValidate>
      <div>
        <h3 className="text-h3 font-semibold text-cerneala">Vă sunăm noi</h3>
        <p className="text-corp text-discret masura">Lăsați-ne numele și telefonul. Vă propunem o oră la telefon.</p>
      </div>
      {state && !state.ok && (
        <ErrorSummary errors={errors} message={errors ? null : state.error} idFor={(n) => `field-cb-${n}`} />
      )}
      {honeypot}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="sourcePath" value="/programare" />
      {context.locationId && <input type="hidden" name="locationId" value={context.locationId} />}
      {context.serviceId && <input type="hidden" name="serviceId" value={context.serviceId} />}
      {context.doctorId && <input type="hidden" name="doctorId" value={context.doctorId} />}
      {context.comfort && <input type="hidden" name="comfort" value={context.comfort} />}
      <TextField
        id="field-cb-name"
        label="Nume și prenume"
        name="name"
        autoComplete="name"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors?.name}
        className="max-w-xl"
      />
      <PhoneField
        id="field-cb-phone"
        label="Telefon"
        name="phone"
        required
        maxLength={20}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors?.phone}
        className="max-w-sm"
      />
      <TextField
        id="field-cb-preferredTime"
        label="Când vă putem suna?"
        name="preferredTime"
        optional
        maxLength={120}
        hint="De exemplu: după ora 16 sau marți dimineața."
        error={errors?.preferredTime}
        className="max-w-xl"
      />
      <ConsentCheckbox id="field-cb-consentGdpr" name="consentGdpr" required error={errors?.consentGdpr}>
        Sunt de acord ca Dental Arena să folosească aceste date ca să mă sune, conform{" "}
        <Link href="/politica-de-confidentialitate" target="_blank" className="text-link underline underline-offset-4">
          Politicii de confidențialitate
        </Link>
      </ConsentCheckbox>
      <div>
        <SubmitButton pendingLabel="Se trimite">Sunați-mă</SubmitButton>
      </div>
    </form>
  );
}
