"use client";

import { saveComfortAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/date/actions";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Comfort } from "@/generated/prisma/enums";
import { COMFORT_LABEL } from "@/lib/labels";
import { usePatientAction } from "./use-patient-action";

/**
 * The comfort answer („Cum vă simțiți când mergeți la dentist?”) and the inhalosedation
 * preference. Mustard marks them in the calendar and on the header (design system §3.4).
 */
export function ComfortEditor({ patientId, comfort, prefersSedation }: { patientId: string; comfort: Comfort | null; prefersSedation: boolean }) {
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(saveComfortAction);
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
      <input type="hidden" name="id" value={patientId} />
      <RadioGroup
        legend="Cum se simte la dentist"
        name="comfortDefault"
        inline
        defaultValue={comfort ?? ""}
        options={[
          { value: "", label: "Nu știm" },
          ...(["FARA_EMOTII", "EMOTII", "FRICA"] as const).map((c) => ({ value: c, label: COMFORT_LABEL[c] })),
        ]}
        error={errors?.comfortDefault}
      />
      <Checkbox name="prefersSedation" label="Preferă inhalosedare" defaultChecked={prefersSedation} description="Se rezervă aparatul la programările noi." />
      <div>
        <SubmitButton size="s" variant="secondary" pendingLabel="Se salvează">
          Salvați confortul
        </SubmitButton>
      </div>
    </form>
  );
}
