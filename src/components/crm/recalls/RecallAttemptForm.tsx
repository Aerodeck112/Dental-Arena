"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { logRecallAttemptAction } from "@/app/(crm)/crm/(app)/rechemari/actions";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";

/** Logs one call to a recalled patient: the outcome (no answer, will call back, refused) and a note. */
export function RecallAttemptForm({ recallId, patientName, onDone }: { recallId: string; patientName: string; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await logRecallAttemptAction(fd);
      if (r.ok) {
        setErrors(undefined);
        showToast({ kind: "success", message: r.message ?? "Apel notat." });
        onDone?.();
        router.refresh();
      } else {
        setErrors(r.fieldErrors);
        if (!r.fieldErrors) showToast({ kind: "error", message: r.error });
      }
    });
  };
  const idp = `ra-${recallId}`;
  return (
    <form onSubmit={onSubmit} noValidate aria-label={`Apel către ${patientName}`} className="flex flex-col gap-3 rounded-panou border border-linie bg-fundal p-3">
      <input type="hidden" name="id" value={recallId} />
      <RadioGroup
        name="outcome"
        legend="Cum a decurs apelul"
        inline
        error={errors?.outcome}
        options={[
          { value: "FARA_RASPUNS", label: "Nu a răspuns" },
          { value: "REVINE", label: "Revine să se programeze" },
          { value: "REFUZAT", label: "Nu dorește" },
        ]}
      />
      <TextField id={`${idp}-note`} name="note" label="Notă" optional autoComplete="off" error={errors?.note} />
      <div className="flex gap-2">
        <Button type="submit" size="s" loading={pending}>
          Notați apelul
        </Button>
        {onDone && (
          <Button type="button" size="s" variant="text" onClick={onDone}>
            Renunțați
          </Button>
        )}
      </div>
    </form>
  );
}
