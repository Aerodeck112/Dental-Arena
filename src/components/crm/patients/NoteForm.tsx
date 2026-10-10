"use client";

import { useState } from "react";
import { addNoteAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/note/actions";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { usePatientAction } from "./use-patient-action";

/** A new note. Clinical notes are offered only to ADMIN and MEDIC (the service enforces it too). */
export function NoteForm({ patientId, canClinical }: { patientId: string; canClinical: boolean }) {
  const [key, setKey] = useState(0);
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(addNoteAction, { onSuccess: () => setKey((k) => k + 1) });
  return (
    <form key={key} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
      <input type="hidden" name="id" value={patientId} />
      <TextArea label="Notă nouă" name="body" required rows={3} maxLength={5000} error={errors?.body} />
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {canClinical && <Checkbox name="clinical" label="Notă clinică" description="Vizibilă doar medicilor și administratorilor." />}
        <Checkbox name="pinned" label="Fixați nota" description="Apare în „Prezentare”." />
      </div>
      <div>
        <SubmitButton size="s" icon="plus" pendingLabel="Se adaugă">
          Adăugați nota
        </SubmitButton>
      </div>
    </form>
  );
}
