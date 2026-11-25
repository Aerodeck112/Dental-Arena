"use client";

import { saveMedicalAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/anamneza/actions";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import type { MedicalHistoryDTO } from "@/server/patients/types";
import { usePatientAction } from "./use-patient-action";

/** Checkbox labels (the alert ones also become carmin flags on the header and in the calendar). */
const FIELDS = [
  ["anticoagulants", "Ia anticoagulante (de exemplu Sintrom, Xarelto, aspirină zilnic)", true],
  ["bleedingDisorder", "Tulburări de coagulare", true],
  ["bisphosphonates", "Tratament cu bifosfonați (osteoporoză)", true],
  ["cardiacDisease", "Boală cardiacă", true],
  ["hypertension", "Hipertensiune arterială", true],
  ["diabetes", "Diabet", true],
  ["asthma", "Astm", true],
  ["epilepsy", "Epilepsie", true],
  ["hepatitis", "Hepatită", true],
  ["hiv", "Infecție HIV", true],
  ["pregnancy", "Sarcină în curs", true],
  ["smoker", "Fumător", false],
] as const;

/**
 * Anamneză. Saving always marks it as reviewed now (`lastReviewedAt`) and writes the
 * `medical.update` audit, even when nothing changed: the doctor confirmed it with the patient.
 */
export function MedicalHistoryForm({ patientId, history, readOnly }: { patientId: string; history: MedicalHistoryDTO | null; readOnly?: boolean }) {
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(saveMedicalAction);
  const h = history;
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
      <input type="hidden" name="id" value={patientId} />
      <fieldset disabled={readOnly} className="flex flex-col gap-5">
        <TextArea
          label="Alergii"
          name="allergies"
          optional
          rows={2}
          maxLength={500}
          hint="Separați cu virgulă: „penicilină, latex”. Scrieți „nu” dacă pacientul nu are alergii."
          defaultValue={h?.allergies ?? undefined}
          error={errors?.allergies}
        />
        <TextArea label="Medicamente luate în prezent" name="medications" optional rows={2} maxLength={1000} defaultValue={h?.medications ?? undefined} error={errors?.medications} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-control font-semibold text-cerneala">Afecțiuni și tratamente</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {FIELDS.map(([name, label, alert]) => (
              <Checkbox
                key={name}
                name={name}
                label={label}
                description={alert ? undefined : "Nu apare ca atenționare."}
                defaultChecked={h ? h[name] : false}
              />
            ))}
          </div>
        </fieldset>
        <TextArea label="Alte afecțiuni sau observații" name="otherConditions" optional rows={3} maxLength={2000} defaultValue={h?.otherConditions ?? undefined} error={errors?.otherConditions} />
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton icon="check" pendingLabel="Se salvează">
            Salvați și marcați revizuită
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
