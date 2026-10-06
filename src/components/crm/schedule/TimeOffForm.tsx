"use client";

import { startTransition, useActionState, useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { TimeInput } from "@/components/ui/TimeInput";
import { showToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";
import { labelOptions, TIME_OFF_KIND_LABEL } from "@/lib/labels";
import { createTimeOffAction } from "@/app/(crm)/crm/(app)/absente/actions";

/** The „Toată clinica (închisă)” choice: no doctor, a location closure. */
const CLOSURE = "__inchis__";

type Result = ActionResult<{ id: string; affectedAppointments: number }> | null;

/**
 * „Absență nouă”: leave, training, a blocked interval or a public holiday, for a doctor or as a
 * clinic closure. RECEPTIE and ADMIN choose any doctor (or the whole clinic); a MEDIC adds time
 * off only for themselves, so the doctor is fixed.
 */
export function TimeOffForm({
  doctors,
  locations,
  fixedDoctor,
  defaultDoctorId,
  today,
}: {
  doctors: { id: string; name: string }[];
  locations: { id: string; shortName: string }[];
  /** A MEDIC's own doctor profile: no choice. */
  fixedDoctor: { id: string; name: string } | null;
  defaultDoctorId?: string | null;
  today: string;
}) {
  const [allDay, setAllDay] = useState(true);
  const [doctorId, setDoctorId] = useState(fixedDoctor?.id ?? defaultDoctorId ?? "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [kind, setKind] = useState("CONCEDIU");
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useActionState<Result, FormData>(async (prev, fd) => {
    const r = (await createTimeOffAction(prev, fd)) as Result;
    if (r?.ok) {
      showToast({ kind: "success", message: r.message ?? "Absența a fost adăugată." });
      setStartDate(today);
      setEndDate(today);
      setKind(doctorId === CLOSURE ? "SARBATOARE" : "CONCEDIU");
      setFormKey((k) => k + 1);
    }
    return r;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const closure = !fixedDoctor && doctorId === CLOSURE;

  return (
    <form key={formKey} action={action} onSubmit={(e) => {
        // Keep the visitor's ticks and choices: React resets a form after an `action` submit.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={errors ? null : state.error} />}
      <div className="grid gap-4 md:grid-cols-3">
        {fixedDoctor ? (
          <div className="flex flex-col gap-1">
            <span className="text-control font-medium text-cerneala">Medic</span>
            <span className="flex min-h-control items-center text-corp text-cerneala">{fixedDoctor.name}</span>
            <input type="hidden" name="doctorId" value={fixedDoctor.id} />
          </div>
        ) : (
          <>
            <Select
              id="field-doctorId"
              label="Medic"
              name="doctorChoice"
              value={doctorId}
              onChange={(e) => {
                const next = e.target.value;
                setDoctorId(next);
                // A closure is usually a public holiday; a doctor's absence usually leave. Only the
                // untouched default follows the choice.
                if (next === CLOSURE && kind === "CONCEDIU") setKind("SARBATOARE");
                if (next !== CLOSURE && doctorId === CLOSURE && kind === "SARBATOARE") setKind("CONCEDIU");
              }}
              placeholder="Alegeți"
              options={[...doctors.map((d) => ({ value: d.id, label: d.name })), { value: CLOSURE, label: "Toată clinica (închisă)" }]}
              error={errors?.doctorId}
            />
            <input type="hidden" name="doctorId" value={doctorId === CLOSURE ? "" : doctorId} />
          </>
        )}
        <Select
          label="Clinica"
          name="locationId"
          placeholder={closure ? "Alegeți clinica" : "Ambele clinici"}
          defaultValue=""
          options={locations.map((l) => ({ value: l.id, label: l.shortName }))}
          error={errors?.locationId}
          required={closure}
        />
        <Select
          label="Tipul"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={labelOptions(TIME_OFF_KIND_LABEL)}
          error={errors?.kind}
        />
        <DateInput label="Prima zi" name="startDate" required value={startDate} onChange={(e) => {
          setStartDate(e.target.value);
          if (e.target.value > endDate) setEndDate(e.target.value);
        }} error={errors?.startDate} />
        <DateInput label="Ultima zi" name="endDate" required value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} error={errors?.endDate} />
        <div className="flex items-end">
          <Checkbox name="allDay" label="Toată ziua" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        </div>
        {!allDay && (
          <>
            <TimeInput label="De la ora" name="startTime" required step={300} defaultValue="09:00" error={errors?.startTime} />
            <TimeInput label="Până la ora" name="endTime" required step={300} defaultValue="13:00" error={errors?.endTime} />
          </>
        )}
        <TextField label="Motiv" name="reason" optional maxLength={200} error={errors?.reason} className={allDay ? "md:col-span-3" : ""} hint="Apare în calendar, nu și pe site." />
      </div>
      <div>
        <SubmitButton icon="plus" pendingLabel="Se salvează">
          Adăugați absența
        </SubmitButton>
      </div>
    </form>
  );
}
