"use client";

import { setTagsAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/date/actions";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { usePatientAction } from "./use-patient-action";

/** Patient tags („Familie”, „Implant în curs”): tick existing ones or add a new one. */
export function TagEditor({ patientId, tags, selected }: { patientId: string; tags: { id: string; name: string }[]; selected: string[] }) {
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(setTagsAction);
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
      <input type="hidden" name="id" value={patientId} />
      {tags.length > 0 ? (
        <fieldset>
          <legend className="sr-only">Etichete existente</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {tags.map((t) => (
              <Checkbox key={t.id} name="tagIds" value={t.id} label={t.name} defaultChecked={selected.includes(t.id)} />
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-corp text-discret">Nu există etichete încă.</p>
      )}
      <TextField label="Etichetă nouă" name="newTag" optional maxLength={40} hint="De exemplu „Familie” sau „Ortodonție în curs”." error={errors?.newTag} />
      <div>
        <SubmitButton size="s" variant="secondary" pendingLabel="Se salvează">
          Salvați etichetele
        </SubmitButton>
      </div>
    </form>
  );
}
