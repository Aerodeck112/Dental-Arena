"use client";

import { useState } from "react";
import { recordConsentAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/consimtaminte/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { CONSENT_METHOD_LABEL, CONSENT_TYPE_LABEL } from "@/lib/labels";
import { CONSENT_METHOD_VALUES, CONSENT_TYPE_VALUES } from "@/server/patients/schemas";
import { usePatientAction } from "./use-patient-action";

type Props = {
  patientId: string;
  defaultTextVersion: string;
  documents: { id: string; title: string }[];
  plans: { id: string; title: string }[];
};

/** „Înregistrați un consimțământ”: type, granted or refused, method, text version, optional scan. */
export function ConsentForm({ patientId, defaultTextVersion, documents, plans, onDone }: Props & { onDone?: () => void }) {
  const [type, setType] = useState<string>("GDPR_DATE_SANATATE");
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(recordConsentAction, { onSuccess: () => onDone?.() });
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
      <input type="hidden" name="id" value={patientId} />
      <Select
        label="Tipul"
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={CONSENT_TYPE_VALUES.map((t) => ({ value: t, label: CONSENT_TYPE_LABEL[t] }))}
        error={errors?.type}
      />
      <RadioGroup
        legend="Decizia pacientului"
        name="granted"
        inline
        defaultValue="da"
        options={[
          { value: "da", label: "Și-a dat acordul" },
          { value: "nu", label: "Refuză" },
        ]}
        error={errors?.granted}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Cum a fost exprimat"
          name="method"
          defaultValue="SEMNAT_HARTIE"
          options={CONSENT_METHOD_VALUES.filter((m) => m !== "FORMULAR_ONLINE").map((m) => ({ value: m, label: CONSENT_METHOD_LABEL[m] }))}
          error={errors?.method}
        />
        <TextField
          label="Versiunea textului"
          name="textVersion"
          required
          maxLength={60}
          defaultValue={defaultTextVersion}
          hint="Versiunea formularului semnat, de exemplu gdpr-2026-10."
          error={errors?.textVersion}
        />
      </div>
      <Select
        label="Formularul scanat"
        name="documentId"
        optional
        placeholder="Fără document atașat"
        options={documents.map((d) => ({ value: d.id, label: d.title }))}
        hint={documents.length === 0 ? "Încărcați scanul în „Documente”, apoi îl puteți lega aici." : undefined}
        error={errors?.documentId}
      />
      {(type === "TRATAMENT" || type === "INHALOSEDARE") && plans.length > 0 && (
        <Select
          label="Planul de tratament"
          name="treatmentPlanId"
          optional
          placeholder="Fără plan"
          options={plans.map((p) => ({ value: p.id, label: p.title }))}
          error={errors?.treatmentPlanId}
        />
      )}
      <TextField label="Observații" name="notes" optional maxLength={1000} error={errors?.notes} />
      <div className="flex justify-end gap-3">
        <SubmitButton icon="check" pendingLabel="Se înregistrează">
          Înregistrați consimțământul
        </SubmitButton>
      </div>
    </form>
  );
}

export function ConsentFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="s" icon="plus" onClick={() => setOpen(true)}>
        Înregistrați un consimțământ
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Consimțământ nou" description="O decizie nouă o înlocuiește pe cea anterioară de același tip; istoricul rămâne.">
        <ConsentForm {...props} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
