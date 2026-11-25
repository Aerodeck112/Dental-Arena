"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { convertLeadAction } from "@/app/(crm)/crm/(app)/cereri/actions";
import { ConflictNotice } from "@/components/crm/calendar/ConflictNotice";
import { PatientPicker } from "@/components/crm/calendar/AppointmentForm";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { TimeInput } from "@/components/ui/TimeInput";
import { showToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";
import type { ConflictInfo } from "@/lib/errors";
import { formatDateRo, formatPhone, formatTime } from "@/lib/format";
import type { AppointmentFormOptions, LeadDetailDTO, PatientPick } from "@/server/appointments/types";
import type { PatientSummary } from "@/server/patients/types";

type ConvertData = { patientId: string; appointmentId: string; createdPatient: boolean };

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

function dupLabel(d: PatientSummary): string {
  return [d.name, `fișa nr. ${d.fileNumber}`, d.phone ? formatPhone(d.phone) : null, d.birthDate ? `născut(ă) ${formatDateRo(d.birthDate, "short")}` : null]
    .filter(Boolean)
    .join(", ");
}

/**
 * Converts a request into a patient and an appointment (WP6):
 * 1. duplicates first: „Folosiți pacientul existent” or „Creați pacient nou”;
 * 2. the consents from the request are copied to the file (server);
 * 3. a tentative online appointment is linked, otherwise a new one is created here, with the §6.2
 *    conflict messages and „Salvați oricum” where allowed.
 */
export function ConvertLeadForm({
  lead,
  options,
  duplicates: initialDuplicates,
  defaultDate,
}: {
  lead: LeadDetailDTO;
  options: AppointmentFormOptions;
  duplicates: PatientSummary[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [duplicates, setDuplicates] = useState(initialDuplicates);
  const [choice, setChoice] = useState<string>(initialDuplicates.length > 0 ? `p:${initialDuplicates[0].id}` : "nou");
  const [picked, setPicked] = useState<PatientPick | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [locationId, setLocationId] = useState(lead.locationId ?? options.locations[0]?.id ?? "");
  const service = options.services.find((s) => s.name === lead.serviceName);
  const [duration, setDuration] = useState(service?.durationMinutes ?? 30);

  const tentative = lead.appointments.find((a) => a.tentative && (a.status === "PROGRAMAT" || a.status === "CONFIRMAT"));

  const [state, formAction, pending] = useActionState<ActionResult<ConvertData> | null, FormData>(async (_prev, fd) => {
    const r: ActionResult<ConvertData> = await convertLeadAction(fd);
    if (r.ok) {
      showToast({ kind: "success", message: r.message ?? "Cererea a fost convertită." });
      router.refresh();
    } else if (r.code === "CONFLICT" && Array.isArray(r.details?.duplicates)) {
      const found = r.details.duplicates as PatientSummary[];
      setDuplicates(found);
      setChoice(`p:${found[0]?.id ?? ""}`);
    }
    return r;
  }, null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };

  const conflicts: ConflictInfo[] | undefined = state && !state.ok && state.code === "CONFLICT" ? state.details?.conflicts : undefined;
  const fieldErrors = state && !state.ok && !conflicts ? state.fieldErrors : undefined;
  const dupRefusal = state && !state.ok && state.code === "CONFLICT" && !conflicts;
  const formError = state && !state.ok && !conflicts && !fieldErrors && !dupRefusal ? state.error : null;
  const err = (n: string) => fieldErrors?.[n];

  const mode = choice === "nou" ? "nou" : "existent";
  const existingId = choice.startsWith("p:") ? choice.slice(2) : choice === "cauta" ? (picked?.id ?? "") : "";
  const id = (n: string) => `conv-${n}`;
  const doctorsHere = options.doctors.filter((d) => d.locationIds.length === 0 || d.locationIds.includes(locationId));

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="leadId" value={lead.id} />
      <input type="hidden" name="mode" value={mode} />
      {mode === "existent" && <input type="hidden" name="patientId" value={existingId} />}
      {mode === "nou" && (confirmNew || duplicates.length > 0) && <input type="hidden" name="ignoreDuplicates" value="on" />}

      <ErrorSummary errors={fieldErrors} message={formError} idFor={id} />

      <RadioGroup
        name="choice"
        legend="Fișa pacientului"
        value={choice}
        onChange={(v) => {
          setChoice(v);
          if (v === "nou" && duplicates.length > 0) setConfirmNew(true);
        }}
        hint={duplicates.length > 0 ? "Există deja pacienți cu aceleași date. Verificați înainte de a crea o fișă nouă." : undefined}
        error={err("patientId")}
        options={[
          ...duplicates.map((d) => ({ value: `p:${d.id}`, label: "Folosiți pacientul existent", description: dupLabel(d) })),
          { value: "cauta", label: "Căutați alt pacient existent" },
          { value: "nou", label: "Creați pacient nou", description: duplicates.length > 0 ? "O fișă separată, deși datele seamănă." : undefined },
        ]}
      />

      {choice === "cauta" && <PatientPicker idPrefix="conv" value={picked} onChange={setPicked} error={err("patientId")} />}

      {mode === "nou" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={id("firstName")} name="firstName" label="Prenumele" defaultValue={lead.suggested.firstName} autoComplete="off" error={err("firstName")} />
          <TextField id={id("lastName")} name="lastName" label="Numele" defaultValue={lead.suggested.lastName} autoComplete="off" error={err("lastName")} />
          <TextField id={id("phone")} name="phone" type="tel" label="Telefon" optional defaultValue={lead.suggested.phone ?? ""} error={err("phone")} />
          <TextField id={id("email")} name="email" type="email" label="E-mail" optional defaultValue={lead.suggested.email ?? ""} error={err("email")} />
          <DateInput id={id("birthDate")} name="birthDate" label="Data nașterii" optional error={err("birthDate")} />
        </div>
      )}

      <fieldset className="flex flex-col gap-4 border-t border-linie pt-4">
        <legend className="pt-4 text-corp font-semibold">Programarea</legend>
        {tentative ? (
          <p className="rounded-panou bg-menta-pal px-3 py-2 text-corp">
            Programarea online de {formatDateRo(new Date(tentative.startsAt), "weekday")}, ora {formatTime(new Date(tentative.startsAt))}, la {tentative.doctorName}, se leagă de fișă.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id={id("locationId")}
              name="locationId"
              label="Clinica"
              options={options.locations.map((l) => ({ value: l.id, label: l.shortName }))}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              error={err("locationId")}
            />
            {options.forcedDoctorId ? (
              <input type="hidden" name="doctorId" value={options.forcedDoctorId} />
            ) : (
              <Select
                id={id("doctorId")}
                name="doctorId"
                label="Medic"
                placeholder="Alegeți medicul"
                options={doctorsHere.map((d) => ({ value: d.id, label: d.name }))}
                error={err("doctorId")}
              />
            )}
            <Select
              id={id("serviceId")}
              name="serviceId"
              label="Motivul vizitei"
              optional
              placeholder="Alegeți serviciul"
              defaultValue={service?.id ?? ""}
              options={options.services.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(e) => {
                const s = options.services.find((x) => x.id === e.target.value);
                if (s) setDuration(s.durationMinutes);
              }}
              error={err("serviceId")}
            />
            <DateInput id={id("date")} name="date" label="Ziua" defaultValue={defaultDate} error={err("date")} />
            <TimeInput id={id("time")} name="time" label="Ora" step={300} defaultValue="09:00" error={err("time")} />
            <Select
              id={id("durationMinutes")}
              name="durationMinutes"
              label="Durata"
              value={String(duration)}
              onChange={(e) => setDuration(Number(e.target.value))}
              options={[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((m) => ({ value: String(m), label: `${m} min` }))}
              error={err("durationMinutes")}
            />
          </div>
        )}
        <ConflictNotice conflicts={conflicts} canOverride={options.canOverride} role={options.role} idPrefix="conv" />
      </fieldset>

      <p className="text-mic text-discret">
        Acordurile din cerere ({lead.consentGdprAt ? "date personale" : "fără acord GDPR"}
        {lead.consentSms ? ", SMS" : ""}) se copiază în fișă. Cererea devine Programat.
      </p>
      <div>
        <Button type="submit" loading={pending} disabled={mode === "existent" && !existingId}>
          {mode === "nou" ? "Creați pacientul și programarea" : "Legați de pacientul existent"}
        </Button>
      </div>
    </form>
  );
}
