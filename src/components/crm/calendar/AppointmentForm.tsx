"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createAppointmentAction,
  createPatientInlineAction,
  searchPatientsAction,
  updateAppointmentAction,
} from "@/app/(crm)/crm/(app)/programari/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Icon } from "@/components/ui/Icon";
import { PhoneField } from "@/components/ui/PhoneField";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TimeInput } from "@/components/ui/TimeInput";
import { showToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";
import type { ConflictInfo } from "@/lib/errors";
import { formatDateRo, formatPhone } from "@/lib/format";
import { COMFORT_LABEL } from "@/lib/labels";
import type { AppointmentStatus, Comfort } from "@/generated/prisma/enums";
import type { AppointmentFormOptions, PatientPick } from "@/server/appointments/types";
import type { PatientSummary } from "@/server/patients/types";
import { ConflictNotice } from "./ConflictNotice";

export type AppointmentFormInitial = {
  id?: string;
  expectedUpdatedAt?: string;
  status?: AppointmentStatus;
  locationId: string;
  doctorId: string | null;
  cabinetId: string | null;
  date: string;
  /** "HH:MM". */
  time: string;
  durationMinutes: number;
  serviceId?: string | null;
  reason?: string | null;
  comfort?: Comfort | null;
  comfortNote?: string | null;
  wantsSedation?: boolean;
  notes?: string | null;
  patient?: PatientPick | null;
  /** A tentative online booking without a patient yet. */
  leadId?: string | null;
  leadName?: string | null;
  recallId?: string | null;
};

export type AppointmentFormProps = {
  /** quick: the popover from an empty slot (clinic, doctor and day fixed by the column). */
  mode: "quick" | "create" | "edit";
  options: AppointmentFormOptions;
  initial: AppointmentFormInitial;
  idPrefix: string;
  onSuccess?: (r: { id: string; dateISO?: string }) => void;
  onCancel?: () => void;
  className?: string;
};

const DURATIONS = [15, 20, 30, 45, 60, 90, 120, 180, 240];

function durationLabel(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

type SaveData = { id: string; dateISO?: string };

/**
 * The appointment form: quick-create from a slot, the full form (`/crm/programari/noua`) and the
 * edit form (`/crm/programari/[id]`). The service presets the duration; conflicts come back as
 * §6.2 messages, and warnings can be saved with „Salvați oricum” by those allowed.
 */
export function AppointmentForm({ mode, options, initial, idPrefix, onSuccess, onCancel, className }: AppointmentFormProps) {
  const [patient, setPatient] = useState<PatientPick | null>(initial.patient ?? null);
  const [locationId, setLocationId] = useState(initial.locationId);
  const [serviceId, setServiceId] = useState(initial.serviceId ?? "");
  const [duration, setDuration] = useState(initial.durationMinutes);
  const [doctorId, setDoctorId] = useState(options.forcedDoctorId ?? initial.doctorId ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<ActionResult<SaveData> | null, FormData>(async (_prev, fd) => {
    const r: ActionResult<SaveData> = mode === "edit" ? await updateAppointmentAction(fd) : await createAppointmentAction(fd);
    if (r.ok) {
      showToast({ kind: "success", message: r.message ?? "Programarea a fost salvată." });
      onSuccess?.(r.data);
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
  const formError = state && !state.ok && !conflicts && !fieldErrors ? state.error : null;
  const err = (name: string) => fieldErrors?.[name];

  const durations = useMemo(() => {
    const list = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);
    return list.map((m) => ({ value: String(m), label: durationLabel(m) }));
  }, [duration]);

  const serviceOptions = options.services.map((s) => ({ value: s.id, label: `${s.name} (${s.categoryName.toLowerCase()})` }));
  const doctorsHere = options.doctors.filter((d) => d.locationIds.length === 0 || d.locationIds.includes(locationId) || d.id === doctorId);
  const cabinetsHere = options.cabinets.filter((c) => c.locationId === locationId);
  const fixedDoctor = options.doctors.find((d) => d.id === (options.forcedDoctorId ?? initial.doctorId));
  const fixedLocation = options.locations.find((l) => l.id === initial.locationId);
  const isMoveable = mode !== "edit" || initial.status === "PROGRAMAT" || initial.status === "CONFIRMAT";
  const needsPatient = mode !== "edit" && !initial.leadId;
  const p = (name: string) => `${idPrefix}-${name}`;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className={cn("flex flex-col gap-4", className)}>
      {mode === "edit" && (
        <>
          <input type="hidden" name="id" value={initial.id} />
          <input type="hidden" name="expectedUpdatedAt" value={initial.expectedUpdatedAt} />
        </>
      )}
      {initial.leadId && mode !== "edit" && <input type="hidden" name="leadId" value={initial.leadId} />}
      {initial.recallId && <input type="hidden" name="recallId" value={initial.recallId} />}
      {patient && mode !== "edit" && <input type="hidden" name="patientId" value={patient.id} />}

      <ErrorSummary errors={fieldErrors} message={formError} idFor={(n) => p(n)} />

      {needsPatient ? (
        <PatientPicker idPrefix={idPrefix} value={patient} onChange={setPatient} error={err("patientId")} autoFocus={mode === "quick"} />
      ) : mode !== "edit" && initial.leadName ? (
        <p className="text-corp">
          <span className="text-discret">Pentru cererea lui </span>
          <span className="font-semibold">{initial.leadName}</span>
        </p>
      ) : null}

      {mode === "quick" ? (
        <>
          <input type="hidden" name="locationId" value={initial.locationId} />
          {initial.doctorId && <input type="hidden" name="doctorId" value={options.forcedDoctorId ?? initial.doctorId} />}
          {initial.cabinetId && <input type="hidden" name="cabinetId" value={initial.cabinetId} />}
          <input type="hidden" name="date" value={initial.date} />
          <p className="text-mic text-discret">
            {[fixedDoctor?.name, fixedLocation?.shortName, formatDateRo(initial.date, "long")].filter(Boolean).join(", ")}
          </p>
          {!initial.doctorId && (
            <Select
              id={p("doctorId")}
              name="doctorId"
              label="Medic"
              placeholder="Alegeți medicul"
              options={doctorsHere.map((d) => ({ value: d.id, label: d.name }))}
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              error={err("doctorId")}
            />
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id={p("locationId")}
            name="locationId"
            label="Clinica"
            options={options.locations.map((l) => ({ value: l.id, label: l.shortName }))}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={!isMoveable}
            error={err("locationId")}
          />
          {options.forcedDoctorId ? (
            <>
              <input type="hidden" name="doctorId" value={options.forcedDoctorId} />
              <TextField id={p("doctorName")} name="doctorName" label="Medic" value={fixedDoctor?.name ?? ""} readOnly />
            </>
          ) : (
            <Select
              id={p("doctorId")}
              name="doctorId"
              label="Medic"
              placeholder="Alegeți medicul"
              options={doctorsHere.map((d) => ({ value: d.id, label: d.name }))}
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              disabled={!isMoveable}
              error={err("doctorId")}
            />
          )}
          <DateInput id={p("date")} name="date" label="Ziua" defaultValue={initial.date} disabled={!isMoveable} error={err("date")} />
          <Select
            id={p("cabinetId")}
            name="cabinetId"
            label="Cabinet"
            optional
            placeholder="Fără cabinet"
            options={cabinetsHere.map((c) => ({ value: c.id, label: c.name }))}
            defaultValue={initial.cabinetId ?? ""}
            disabled={!isMoveable}
            error={err("cabinetId")}
          />
          {!isMoveable && (
            <>
              <input type="hidden" name="locationId" value={locationId} />
              {!options.forcedDoctorId && <input type="hidden" name="doctorId" value={doctorId} />}
              <input type="hidden" name="date" value={initial.date} />
              {initial.cabinetId && <input type="hidden" name="cabinetId" value={initial.cabinetId} />}
              <input type="hidden" name="time" value={initial.time} />
              <input type="hidden" name="durationMinutes" value={duration} />
            </>
          )}
        </div>
      )}

      <Select
        id={p("serviceId")}
        name="serviceId"
        label="Motivul vizitei"
        placeholder="Alegeți serviciul"
        hint={mode === "quick" ? undefined : "Durata se completează din lista de prețuri."}
        options={serviceOptions}
        value={serviceId}
        onChange={(e) => {
          setServiceId(e.target.value);
          const s = options.services.find((x) => x.id === e.target.value);
          if (s && isMoveable) setDuration(s.durationMinutes);
        }}
        error={err("serviceId")}
      />

      <div className="grid grid-cols-2 gap-4">
        <TimeInput id={p("time")} name="time" label="Ora" defaultValue={initial.time} step={300} disabled={!isMoveable} error={err("time") ?? err("startsAt")} />
        <Select
          id={p("durationMinutes")}
          name="durationMinutes"
          label="Durata"
          options={durations}
          value={String(duration)}
          onChange={(e) => setDuration(Number(e.target.value))}
          disabled={!isMoveable}
          error={err("durationMinutes")}
        />
      </div>

      {mode !== "quick" && (
        <TextField id={p("reason")} name="reason" label="Detalii despre motiv" optional defaultValue={initial.reason ?? ""} maxLength={200} error={err("reason")} />
      )}

      <Checkbox
        id={p("wantsSedation")}
        name="wantsSedation"
        label="Inhalosedare"
        description="Rezervă aparatul de inhalosedare pe durata programării."
        defaultChecked={initial.wantsSedation ?? false}
      />

      {mode !== "quick" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id={p("comfort")}
            name="comfort"
            label="Cum se simte pacientul"
            optional
            placeholder="Nu știm"
            options={(Object.keys(COMFORT_LABEL) as Comfort[]).map((c) => ({ value: c, label: COMFORT_LABEL[c] }))}
            defaultValue={initial.comfort ?? ""}
          />
          <TextField id={p("comfortNote")} name="comfortNote" label="Cuvintele pacientului" optional defaultValue={initial.comfortNote ?? ""} maxLength={500} />
        </div>
      )}

      <TextArea id={p("notes")} name="notes" label="Observații pentru recepție" optional rows={2} defaultValue={initial.notes ?? ""} maxLength={2000} error={err("notes")} />

      {mode === "edit" && initial.status === "CONFIRMAT" && (
        <Checkbox
          id={p("confirmed")}
          name="confirmed"
          label="Pacientul a confirmat noua oră"
          description="Dacă mutați programarea fără confirmare, statusul revine la Programat."
        />
      )}

      <ConflictNotice conflicts={conflicts} canOverride={options.canOverride} role={options.role} idPrefix={idPrefix} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={needsPatient && !patient}>
          {mode === "edit" ? "Salvați modificările" : "Programați"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Renunțați
          </Button>
        )}
        {needsPatient && !patient && <span className="text-mic text-discret">Alegeți mai întâi pacientul.</span>}
      </div>
    </form>
  );
}

// ───────────────────────────── Patient picker ─────────────────────────────

export function PatientPicker({
  idPrefix,
  value,
  onChange,
  error,
  autoFocus,
}: {
  idPrefix: string;
  value: PatientPick | null;
  onChange: (p: PatientPick | null) => void;
  error?: string[];
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const listId = useId();
  const inputId = `${idPrefix}-patientId`;
  const active = !value && q.trim().length >= 2;
  const shown = active ? results : [];

  useEffect(() => {
    if (value || q.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchPatientsAction({ q });
      if (cancelled) return;
      setSearching(false);
      setResults(r.ok ? r.data : []);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, value]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-control border border-linie-control bg-menta-pal px-3 py-2">
        <Icon name="user" size={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{value.name}</p>
          <p className="text-mic text-discret cifre">
            Fișa nr. {value.fileNumber}
            {value.phone ? `, ${formatPhone(value.phone)}` : ""}
          </p>
        </div>
        <Button type="button" variant="text" size="s" onClick={() => onChange(null)}>
          Schimbați
        </Button>
      </div>
    );
  }

  if (creating) {
    return <NewPatientInline idPrefix={idPrefix} initialName={q} onCreated={(pick) => { onChange(pick); setCreating(false); }} onCancel={() => setCreating(false)} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        id={inputId}
        name="patientSearch"
        label="Pacient"
        hint="Căutați după nume sau telefon."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={listId}
        error={error}
      />
      {shown.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Pacienți găsiți" className="flex max-h-56 flex-col overflow-y-auto rounded-control border border-linie">
          {shown.map((r) => (
            <li key={r.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => onChange(r)}
                className="flex w-full items-baseline justify-between gap-3 border-b border-linie px-3 py-2 text-left last:border-b-0 hover:bg-adancit focus-visible:bg-adancit"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-mic text-discret cifre">{r.phone ? formatPhone(r.phone) : `Fișa nr. ${r.fileNumber}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {active && !searching && shown.length === 0 && <p className="text-mic text-discret">Niciun pacient găsit.</p>}
      <div>
        <Button type="button" variant="text" size="s" icon="plus" onClick={() => setCreating(true)}>
          Pacient nou
        </Button>
      </div>
    </div>
  );
}

/** „Pacient nou” inline: duplicates are checked first (WP7 `findDuplicatePatients`). Not a nested form. */
function NewPatientInline({
  idPrefix,
  initialName,
  onCreated,
  onCancel,
}: {
  idPrefix: string;
  initialName: string;
  onCreated: (p: PatientPick) => void;
  onCancel: () => void;
}) {
  const guess = /\d/.test(initialName) ? { first: "", last: "" } : splitName(initialName);
  const [firstName, setFirstName] = useState(guess.first);
  const [lastName, setLastName] = useState(guess.last);
  const [phone, setPhone] = useState(/\d/.test(initialName) ? initialName.trim() : "");
  const [birthDate, setBirthDate] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PatientSummary[] | null>(null);
  const p = (n: string) => `${idPrefix}-np-${n}`;

  const submit = async (ignoreDuplicates: boolean) => {
    setPending(true);
    const r = await createPatientInlineAction({ firstName, lastName, phone, email: undefined, birthDate, ignoreDuplicates });
    setPending(false);
    if (r.ok) {
      showToast({ kind: "success", message: "Pacient adăugat" });
      onCreated(r.data);
      return;
    }
    const dups = (r.details as { duplicates?: PatientSummary[] } | undefined)?.duplicates;
    if (r.code === "CONFLICT" && dups) {
      setDuplicates(dups);
      setErrors(undefined);
      setMessage(null);
      return;
    }
    setErrors(r.fieldErrors);
    setMessage(r.fieldErrors ? null : r.error);
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-panou border border-linie p-3">
      <legend className="px-1 text-h3 font-semibold">Pacient nou</legend>
      <ErrorSummary errors={errors} message={message} idFor={(n) => p(n)} />
      <div className="grid grid-cols-2 gap-3">
        <TextField id={p("firstName")} name="np-firstName" label="Prenume" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" error={errors?.firstName} />
        <TextField id={p("lastName")} name="np-lastName" label="Nume" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" error={errors?.lastName} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PhoneField id={p("phone")} name="np-phone" label="Telefon" optional value={phone} onChange={(e) => setPhone(e.target.value)} error={errors?.phone} />
        <DateInput id={p("birthDate")} name="np-birthDate" label="Data nașterii" optional value={birthDate} onChange={(e) => setBirthDate(e.target.value)} error={errors?.birthDate} />
      </div>
      {duplicates && duplicates.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-control border border-linie-control bg-adancit p-3">
          <p className="font-semibold">Există deja {duplicates.length === 1 ? "o fișă" : "fișe"} cu aceleași date</p>
          <ul className="flex flex-col gap-1.5">
            {duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {d.name}
                  <span className="text-mic text-discret cifre">
                    , fișa nr. {d.fileNumber}
                    {d.phone ? `, ${formatPhone(d.phone)}` : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  size="s"
                  variant="secondary"
                  onClick={() => onCreated({ id: d.id, fileNumber: d.fileNumber, name: d.name, phone: d.phone, birthDate: d.birthDate })}
                >
                  Folosiți pacientul existent
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {duplicates && duplicates.length > 0 ? (
          <Button type="button" size="s" variant="secondary" loading={pending} onClick={() => submit(true)}>
            Creați pacient nou
          </Button>
        ) : (
          <Button type="button" size="s" loading={pending} onClick={() => submit(false)}>
            Adăugați pacientul
          </Button>
        )}
        <Button type="button" size="s" variant="text" onClick={onCancel}>
          Înapoi la căutare
        </Button>
      </div>
    </fieldset>
  );
}

function splitName(s: string): { first: string; last: string } {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * The form as a page (`/crm/programari/noua`, `/crm/programari/[id]`): after a create it opens
 * the calendar on that day; after an edit it stays and refreshes. „Renunțați” goes back.
 */
export function AppointmentFormPage(props: Omit<AppointmentFormProps, "onSuccess" | "onCancel"> & { backHref: string }) {
  const router = useRouter();
  const { backHref, ...rest } = props;
  return (
    <AppointmentForm
      {...rest}
      onSuccess={(r) => {
        if (props.mode === "edit") router.refresh();
        else router.push(r.dateISO ? `/crm/programari?zi=${r.dateISO}` : backHref);
      }}
      onCancel={() => router.push(backHref)}
    />
  );
}
