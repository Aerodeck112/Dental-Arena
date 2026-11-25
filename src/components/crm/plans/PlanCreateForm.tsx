"use client";

import { createPlanAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/planuri/actions";
import { usePatientAction } from "@/components/crm/patients/use-patient-action";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";

/** „Plan nou”: a title and the doctor; the plan opens in the editor as a draft (Ciornă). */
export function PlanCreateForm({ patientId, doctors, defaultDoctorId }: { patientId: string; doctors: { id: string; name: string }[]; defaultDoctorId: string | null }) {
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(createPlanAction, { toast: false });
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
      <input type="hidden" name="id" value={patientId} />
      <TextField label="Titlu" name="title" required maxLength={120} placeholder="Plan implant 36" error={errors?.title} />
      <Select
        label="Medicul"
        name="doctorId"
        optional
        defaultValue={defaultDoctorId ?? ""}
        placeholder="Alegeți"
        options={doctors.map((d) => ({ value: d.id, label: d.name }))}
        error={errors?.doctorId}
      />
      <div>
        <SubmitButton icon="plus" pendingLabel="Se creează">
          Creați planul
        </SubmitButton>
      </div>
    </form>
  );
}
