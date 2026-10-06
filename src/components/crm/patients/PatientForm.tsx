"use client";

import { useRef, useState, useTransition } from "react";
import { checkDuplicatesAction, createPatientAction, searchPatientsAction } from "@/app/(crm)/crm/(app)/pacienti/actions";
import { updatePatientAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/date/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { PhoneField } from "@/components/ui/PhoneField";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { ActionResult } from "@/lib/actions";
import { formatPhone } from "@/lib/format";
import { COMFORT_LABEL, LEAD_SOURCE_LABEL, SEX_LABEL } from "@/lib/labels";
import type { DuplicateMatch, PatientPersonalDTO, PatientSummary } from "@/server/patients/types";
import { CnpField } from "./CnpField";
import { DuplicateWarning } from "./DuplicateWarning";
import { usePatientAction } from "./use-patient-action";

type Options = { locations: { id: string; name: string }[]; doctors: { id: string; name: string }[] };

export type PatientFormProps =
  | ({ mode: "create"; patient?: undefined; defaultLocationId?: string | null } & Options)
  | ({ mode: "edit"; patient: PatientPersonalDTO; defaultLocationId?: undefined } & Options);

const SOURCES = ["TELEFON", "RECOMANDARE", "FORMULAR_CONTACT", "PROGRAMARE_ONLINE", "APEL_INVERS", "SOCIAL", "ALT"] as const;

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-linie pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="float-left mb-1 w-full text-h3 font-semibold text-cerneala">{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * „Pacient nou” and „Date personale”. Create mode checks for duplicates while typing (phone, CNP,
 * name plus birth date) and again on submit; the user confirms a different person explicitly.
 */
export function PatientForm(props: PatientFormProps) {
  const p = props.patient;
  const create = props.mode === "create";
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmDup, setConfirmDup] = useState(false);
  const [liveDups, setLiveDups] = useState<DuplicateMatch[]>([]);
  const [birthDate, setBirthDate] = useState(p?.birthDate ?? "");
  const [sex, setSex] = useState<string>(p?.sex ?? "");
  const [guardian, setGuardian] = useState<{ id: string; name: string } | null>(p?.guardian ?? null);
  const [, startCheck] = useTransition();

  const action = (create ? createPatientAction : updatePatientAction) as (prev: unknown, fd: FormData) => Promise<ActionResult<unknown>>;
  const { state, formAction, onSubmit, errors, formError } = usePatientAction(action, { toast: !create });
  const submitDups =
    state && !state.ok && state.code === "CONFLICT" ? ((state.details as { duplicates?: DuplicateMatch[] } | undefined)?.duplicates ?? []) : [];
  const dups = submitDups.length > 0 ? submitDups : liveDups;

  function checkDuplicates() {
    if (!create || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const q = {
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      birthDate: String(fd.get("birthDate") ?? ""),
      cnp: String(fd.get("cnp") ?? ""),
    };
    if (!q.phone && !q.cnp && !(q.lastName && q.birthDate) && !q.email) return;
    startCheck(async () => {
      const r = await checkDuplicatesAction(q);
      if (r.ok) setLiveDups(r.data);
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      onBlur={(e) => {
        const name = e.target instanceof HTMLInputElement ? e.target.name : "";
        if (["phone", "cnp", "lastName", "firstName", "birthDate", "email"].includes(name)) checkDuplicates();
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {state && !state.ok && state.code !== "CONFLICT" && <ErrorSummary errors={errors} message={formError} />}
      {state && !state.ok && state.code === "CONFLICT" && submitDups.length === 0 && <ErrorSummary errors={errors} message={state.error} />}
      {p && <input type="hidden" name="id" value={p.id} />}
      {create && <input type="hidden" name="confirmDuplicate" value={confirmDup ? "on" : ""} />}

      {create && dups.length > 0 && !confirmDup && (
        <DuplicateWarning
          matches={dups}
          blocking={submitDups.length > 0}
          onConfirm={() => {
            setConfirmDup(true);
            if (submitDups.length > 0) setTimeout(() => formRef.current?.requestSubmit(), 0);
          }}
        />
      )}

      <Fieldset legend="Identitate">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Prenume" name="firstName" required autoComplete="off" maxLength={80} defaultValue={p?.firstName} error={errors?.firstName} />
          <TextField label="Nume" name="lastName" required autoComplete="off" maxLength={80} defaultValue={p?.lastName} error={errors?.lastName} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <CnpField
            error={errors?.cnp}
            existing={p ? { patientId: p.id, last2: p.cnpLast2 } : null}
            onCnp={(h) => {
              if (!birthDate) setBirthDate(h.birthDate);
              if (!sex) setSex(h.sex);
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput label="Data nașterii" name="birthDate" optional value={birthDate} onChange={(e) => setBirthDate(e.target.value)} error={errors?.birthDate} />
            <Select
              label="Sex"
              name="sex"
              optional
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              placeholder="Alegeți"
              options={(["F", "M"] as const).map((s) => ({ value: s, label: SEX_LABEL[s] }))}
              error={errors?.sex}
            />
          </div>
        </div>
      </Fieldset>

      <Fieldset legend="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <PhoneField label="Telefon" name="phone" optional defaultValue={p?.phone ? formatPhone(p.phone) : undefined} error={errors?.phone} />
          <TextField label="E-mail" name="email" type="email" optional autoComplete="off" defaultValue={p?.email ?? undefined} error={errors?.email} />
        </div>
        {!create && (
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Stradă și număr" name="street" optional maxLength={160} defaultValue={p?.street ?? undefined} error={errors?.street} />
            <TextField label="Localitate" name="city" optional maxLength={80} defaultValue={p?.city ?? undefined} error={errors?.city} />
            <TextField label="Județ" name="county" optional maxLength={80} defaultValue={p?.county ?? undefined} error={errors?.county} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Checkbox name="smsOptIn" label="Primește SMS-uri (confirmări și memento-uri)" defaultChecked={p?.smsOptIn ?? true} />
          <Checkbox name="emailOptIn" label="Primește e-mailuri" defaultChecked={p?.emailOptIn ?? false} />
        </div>
      </Fieldset>

      <Fieldset legend="Clinică">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Clinica preferată"
            name="preferredLocationId"
            optional
            defaultValue={p?.preferredLocation?.id ?? props.defaultLocationId ?? ""}
            placeholder="Alegeți"
            options={props.locations.map((l) => ({ value: l.id, label: l.name }))}
            error={errors?.preferredLocationId}
          />
          <Select
            label="Medic curant"
            name="primaryDoctorId"
            optional
            defaultValue={p?.primaryDoctor?.id ?? ""}
            placeholder="Alegeți"
            options={props.doctors.map((d) => ({ value: d.id, label: d.name }))}
            error={errors?.primaryDoctorId}
          />
          <Select
            label="Cum a aflat de noi"
            name="acquisitionSource"
            optional
            defaultValue={p?.acquisitionSource ?? ""}
            placeholder="Alegeți"
            options={SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABEL[s] }))}
            error={errors?.acquisitionSource}
          />
        </div>
      </Fieldset>

      <Fieldset legend="Aparținător (pentru copii)">
        <GuardianPicker value={guardian} onChange={setGuardian} excludeId={p?.id} error={errors?.guardianId} />
      </Fieldset>

      <Fieldset legend="Confort">
        <RadioGroup
          legend="Cum se simte la dentist"
          name="comfortDefault"
          inline
          defaultValue={p?.comfortDefault ?? ""}
          options={[
            { value: "", label: "Nu știm" },
            ...(["FARA_EMOTII", "EMOTII", "FRICA"] as const).map((c) => ({ value: c, label: COMFORT_LABEL[c] })),
          ]}
          error={errors?.comfortDefault}
        />
        <Checkbox name="prefersSedation" label="Preferă inhalosedare" defaultChecked={p?.prefersSedation ?? false} />
      </Fieldset>

      <Fieldset legend="Observații">
        <TextArea
          label="Observații administrative"
          name="notes"
          optional
          rows={3}
          maxLength={5000}
          hint="Nu scrieți aici date medicale; acestea au locul lor în anamneză."
          defaultValue={p?.notes ?? undefined}
          error={errors?.notes}
        />
      </Fieldset>

      <div className="flex flex-wrap gap-3">
        <SubmitButton icon={create ? "plus" : "check"} pendingLabel="Se salvează">
          {create ? "Creați fișa" : "Salvați datele"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Guardian search: type at least two letters, pick a patient; the id goes in a hidden field. */
function GuardianPicker({
  value,
  onChange,
  excludeId,
  error,
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
  excludeId?: string;
  error?: string[];
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [pending, startTransition] = useTransition();

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="guardianId" value={value.id} />
        <p className="text-corp text-cerneala">
          <span className="text-discret">Aparținător: </span>
          <a href={`/crm/pacienti/${value.id}`} className="font-semibold text-link underline underline-offset-4">
            {value.name}
          </a>
        </p>
        <Button type="button" variant="text" size="s" icon="x" onClick={() => onChange(null)}>
          Eliminați
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <TextField
        label="Căutați aparținătorul"
        name="guardianSearch"
        optional
        autoComplete="off"
        value={q}
        hint="Numele sau telefonul părintelui ori al tutorelui, dacă are deja fișă."
        error={error}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          if (v.trim().length < 2) {
            setResults([]);
            return;
          }
          startTransition(async () => {
            const r = await searchPatientsAction({ q: v, excludeId });
            if (r.ok) setResults(r.data);
          });
        }}
      />
      {q.trim().length >= 2 && (
        <ul className="flex flex-col divide-y divide-linie rounded-control border border-linie" aria-busy={pending}>
          {results.length === 0 ? (
            <li className="px-3 py-2 text-mic text-discret">{pending ? "Se caută…" : "Niciun pacient găsit."}</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-corp text-cerneala hover:bg-adancit focus-visible:bg-adancit"
                  onClick={() => {
                    onChange({ id: r.id, name: r.name });
                    setQ("");
                    setResults([]);
                  }}
                >
                  {r.name}<span className="text-discret">, fișa nr. {r.fileNumber}{r.phone ? `, ${formatPhone(r.phone)}` : ""}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
