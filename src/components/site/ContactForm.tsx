"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { ConsentCheckbox } from "@/components/ui/ConsentCheckbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Icon } from "@/components/ui/Icon";
import { PhoneField } from "@/components/ui/PhoneField";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { ActionResult } from "@/lib/actions";
import { CLINIC_ORDER, CLINICS } from "@/content/site";
import { sendContactMessage } from "@/app/(site)/(pagini)/contact/actions";

type State = ActionResult<null> | null;

/**
 * „Scrieți-ne” on `/contact`: name, phone or e-mail, the clinic (optional), the message and the
 * required consent. A real <form> posting to a Server Action, so it works before (and without)
 * JavaScript; with JavaScript the typed values survive a validation error.
 */
export function ContactForm({ honeypot }: { honeypot: ReactNode }) {
  const [state, action] = useActionState<State, FormData>(sendContactMessage, null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state?.ok) doneRef.current?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <div className="rounded-panou bg-menta-pal p-6">
        <p ref={doneRef} tabIndex={-1} role="status" className="flex items-start gap-3 text-h3 font-semibold text-cerneala outline-none">
          <Icon name="check" size={24} className="mt-0.5 shrink-0" />
          {state.message ?? "Mesajul a fost trimis. Vă răspundem în cel mult o zi lucrătoare."}
        </p>
        <p className="mt-3 text-corp text-cerneala">Dacă este urgent, sunați direct la clinica la care veniți.</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // React resets a form after an `action` submit; keep what the visitor typed.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {state && !state.ok && <ErrorSummary errors={errors} message={errors ? null : state.error} />}
      {honeypot}
      <input type="hidden" name="sourcePath" value="/contact" />
      <TextField label="Nume și prenume" name="name" autoComplete="name" required maxLength={80} error={errors?.name} />
      <div className="grid gap-6 sm:grid-cols-2">
        <PhoneField label="Telefon" name="phone" optional maxLength={20} error={errors?.phone} />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          optional
          maxLength={254}
          error={errors?.email}
        />
      </div>
      <p className="-mt-3 text-mic text-discret">Lăsați-ne cel puțin un telefon sau un e-mail, ca să vă putem răspunde.</p>
      <RadioGroup
        legend="Despre ce clinică ne scrieți?"
        name="location"
        inline
        error={errors?.location}
        options={[
          ...CLINIC_ORDER.map((s) => ({ value: s, label: CLINICS[s].shortName })),
          { value: "", label: "Nu contează" },
        ]}
      />
      <TextArea label="Mesajul dumneavoastră" name="message" required rows={6} maxLength={2000} error={errors?.message} />
      <ConsentCheckbox name="consentGdpr" required error={errors?.consentGdpr}>
        Sunt de acord ca Dental Arena să folosească aceste date ca să îmi răspundă, conform{" "}
        <Link href="/politica-de-confidentialitate" className="text-link underline underline-offset-4">
          Politicii de confidențialitate
        </Link>
      </ConsentCheckbox>
      <div>
        <SubmitButton size="l" pendingLabel="Se trimite">
          Trimiteți mesajul
        </SubmitButton>
      </div>
    </form>
  );
}
