"use client";

import { useState } from "react";
import { anonymizePatientAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/gdpr/actions";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Panel } from "@/components/ui/Panel";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { usePatientAction } from "./use-patient-action";

/**
 * Patient-level GDPR tools (ADMIN): the JSON export (a download through the audited route) and
 * erasure, which needs the file number typed in to confirm (§3.2 invariant 11).
 */
export function GdprPanel({ patientId, fileNumber, anonymized }: { patientId: string; fileNumber: number; anonymized: boolean }) {
  const [typed, setTyped] = useState("");
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(anonymizePatientAction);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Panel title="Exportul datelor" level={2}>
        <div className="flex flex-col gap-3">
          <p className="text-corp text-cerneala">
            Un singur fișier JSON cu datele personale (inclusiv CNP-ul), anamneza, consimțămintele, odontograma, planurile, programările, facturile,
            plățile, notele, lista documentelor, mesajele trimise și jurnalul de acces.
          </p>
          <p className="text-mic text-discret">Exportul se înregistrează în jurnal. Trimiteți fișierul pacientului pe un canal sigur.</p>
          <div>
            <ButtonLink href={`/api/crm/pacienti/${patientId}/export`} variant="secondary" icon="download" prefetch={false}>
              Descărcați exportul
            </ButtonLink>
          </div>
        </div>
      </Panel>
      <Panel title="Anonimizare" level={2}>
        {anonymized ? (
          <p className="text-corp text-discret">Fișa este deja anonimizată.</p>
        ) : (
          <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
            {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
            <input type="hidden" name="id" value={patientId} />
            <p className="text-corp text-cerneala">
              Șterge numele, CNP-ul, telefonul, e-mailul și adresa, golește textele cererilor, notele administrative și mesajele trimise, și șterge
              fișierele documentelor. Fișa clinică și documentele financiare se păstrează, cum cere legea. Nu se poate reveni.
            </p>
            <TextField
              label={`Tastați numărul fișei, ${fileNumber}, pentru confirmare`}
              name="confirmFileNumber"
              inputMode="numeric"
              autoComplete="off"
              required
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              error={errors?.confirmFileNumber}
              inputClassName="cifre max-w-40"
            />
            <div>
              <SubmitButton variant="danger" disabled={typed.trim() !== String(fileNumber)} pendingLabel="Se anonimizează">
                Anonimizați fișa
              </SubmitButton>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
