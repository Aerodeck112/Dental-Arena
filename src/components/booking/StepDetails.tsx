"use client";

import Link from "next/link";
import { ConsentCheckbox } from "@/components/ui/ConsentCheckbox";
import { PhoneField } from "@/components/ui/PhoneField";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { BookingState, ForWhom } from "./useBookingState";

export type FieldErrors = Record<string, string[] | undefined>;

/**
 * Step 4 „Datele dumneavoastră”: the fields of the booking form (the wizard renders the <form>,
 * the hidden choices of steps 1–3, the honeypot and the submit button around them). Labels are
 * always visible; errors sit next to their field and in the summary above.
 */
export function StepDetails({
  state,
  update,
  errors,
}: {
  state: BookingState;
  update: (patch: Partial<BookingState>) => void;
  errors: FieldErrors;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-h2 text-cerneala">Cum vă putem contacta?</h2>

      <TextField
        label="Nume și prenume"
        name="name"
        autoComplete="name"
        required
        maxLength={80}
        value={state.name}
        onChange={(e) => update({ name: e.target.value })}
        error={errors.name}
        className="max-w-xl"
      />
      <PhoneField
        label="Telefon"
        name="phone"
        required
        maxLength={20}
        value={state.phone}
        onChange={(e) => update({ phone: e.target.value })}
        error={errors.phone}
        hint="Vă sunăm de la clinică ca să confirmăm ora."
        className="max-w-sm"
      />
      <TextField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        optional
        maxLength={254}
        value={state.email}
        onChange={(e) => update({ email: e.target.value })}
        error={errors.email}
        hint="Pentru confirmarea scrisă."
        className="max-w-xl"
      />

      <RadioGroup
        legend="Pentru cine este programarea?"
        name="forWhom"
        inline
        value={state.forWhom}
        onChange={(v) => update({ forWhom: v as ForWhom })}
        options={[
          { value: "eu", label: "Pentru mine" },
          { value: "copil", label: "Pentru copilul meu" },
        ]}
        error={errors.forWhom}
      />
      {state.forWhom === "copil" && (
        <div className="da-fade grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <TextField
            label="Prenumele copilului"
            name="childFirstName"
            required
            maxLength={60}
            autoComplete="off"
            value={state.childFirstName}
            onChange={(e) => update({ childFirstName: e.target.value })}
            error={errors.childFirstName}
          />
          <TextField
            label="Vârsta (ani)"
            name="childAge"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            maxLength={2}
            autoComplete="off"
            value={state.childAge}
            onChange={(e) => update({ childAge: e.target.value.replace(/[^\d]/g, "") })}
            error={errors.childAge}
            inputClassName="cifre"
          />
        </div>
      )}

      <TextArea
        label="Ceva ce ar trebui să știm?"
        name="note"
        optional
        rows={3}
        maxLength={2000}
        value={state.note}
        onChange={(e) => update({ note: e.target.value })}
        error={errors.note}
        hint="De exemplu, un tratament pe care îl urmați sau o alergie."
        className="max-w-2xl"
      />

      <div className="flex flex-col gap-2">
        <ConsentCheckbox
          name="consentGdpr"
          required
          checked={state.consentGdpr}
          onChange={(e) => update({ consentGdpr: e.target.checked })}
          error={errors.consentGdpr}
        >
          Sunt de acord ca Dental Arena să folosească datele mele, inclusiv cele despre sănătate, pentru această programare, conform{" "}
          <Link href="/politica-de-confidentialitate" target="_blank" className="text-link underline underline-offset-4">
            Politicii de confidențialitate
          </Link>
        </ConsentCheckbox>
        <ConsentCheckbox name="consentSms" checked={state.consentSms} onChange={(e) => update({ consentSms: e.target.checked })}>
          Vreau să primesc prin SMS o reamintire cu o zi înainte de programare
        </ConsentCheckbox>
      </div>
    </div>
  );
}
