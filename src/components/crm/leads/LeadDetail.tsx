"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { addLeadActivityAction, changeLeadStatusAction } from "@/app/(crm)/crm/(app)/cereri/actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FlagTag } from "@/components/ui/FlagTag";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { StatusChip } from "@/components/ui/StatusChip";
import { TextArea } from "@/components/ui/TextArea";
import { showToast } from "@/components/ui/Toast";
import { formatDateRo, formatPhone, formatTime, telHref } from "@/lib/format";
import { COMFORT_LABEL, LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL } from "@/lib/labels";
import type { LeadStatus } from "@/generated/prisma/enums";
import type { AppointmentFormOptions, LeadDetailDTO } from "@/server/appointments/types";
import type { PatientSummary } from "@/server/patients/types";
import { AssignSelect } from "./AssignSelect";
import { ConvertLeadForm } from "./ConvertLeadForm";
import { LeadActivityList } from "./LeadActivityList";

const at = (iso: string) => `${formatDateRo(new Date(iso), "weekday")}, ${formatTime(new Date(iso))}`;

/**
 * One request (WP6): contact and what they asked, who handles it, the status (Pierdut asks for a
 * reason), the history with a note or call form, and the conversion into patient and appointment.
 */
export function LeadDetail({
  lead,
  assignees,
  options,
  duplicates,
  canManage,
  defaultDate,
}: {
  lead: LeadDetailDTO;
  assignees: { id: string; name: string }[];
  options: AppointmentFormOptions | null;
  duplicates: PatientSummary[];
  canManage: boolean;
  defaultDate: string;
}) {
  const converted = !!lead.convertedAt && !!lead.patientId;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-5">
        <Panel title="Cererea">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-corp">
            <Row label="Status">{LEAD_STATUS_LABEL[lead.status]}</Row>
            {lead.phone && (
              <Row label="Telefon">
                <a href={telHref(lead.phone)} className="telefon text-link underline underline-offset-4">
                  {formatPhone(lead.phone)}
                </a>
              </Row>
            )}
            {lead.email && <Row label="E-mail">{lead.email}</Row>}
            <Row label="Sursa">{LEAD_SOURCE_LABEL[lead.source]}</Row>
            <Row label="Primită">{at(lead.createdAt)}</Row>
            {lead.serviceName && <Row label="Motivul">{lead.serviceName}</Row>}
            {lead.locationName && <Row label="Clinica">{lead.locationName}</Row>}
            {lead.preferredTime && <Row label="Preferă">{lead.preferredTime}</Row>}
            {lead.comfort && <Row label="Confort">{COMFORT_LABEL[lead.comfort]}</Row>}
            <Row label="Acorduri">
              {[lead.consentGdprAt ? `date personale (${formatDateRo(new Date(lead.consentGdprAt), "short")})` : "fără acord pentru date", lead.consentSms ? "SMS" : null]
                .filter(Boolean)
                .join(", ")}
            </Row>
            {lead.lostReason && <Row label="Motiv pierdere">{lead.lostReason}</Row>}
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {lead.comfort && lead.comfort !== "FARA_EMOTII" && <FlagTag kind="confort">{COMFORT_LABEL[lead.comfort]}</FlagTag>}
            {lead.wantsSedation && <FlagTag kind="sedare">Preferă inhalosedare</FlagTag>}
            {lead.forChild && <FlagTag kind="copil">{lead.childLabel ?? "Copil"}</FlagTag>}
          </div>
          {lead.message && <p className="mt-3 whitespace-pre-line rounded-panou bg-adancit px-3 py-2 text-corp">„{lead.message}”</p>}
          {lead.comfortNote && <p className="mt-3 rounded-panou bg-mustar-pal px-3 py-2 text-corp">La programare a scris: „{lead.comfortNote}”</p>}
          {canManage && (
            <div className="mt-4 border-t border-linie pt-3">
              <AssignSelect leadId={lead.id} value={lead.assignedToId} assignees={assignees} />
            </div>
          )}
        </Panel>

        {lead.appointments.length > 0 && (
          <Panel title="Programări">
            <ul className="flex flex-col gap-2">
              {lead.appointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-corp">
                  <StatusChip status={a.status} size="s" />
                  <Link href={`/crm/programari/${a.id}`} className="cifre text-link underline underline-offset-4">
                    {at(a.startsAt)}
                  </Link>
                  <span className="text-discret">
                    {a.doctorName}, {a.locationName}
                    {a.tentative ? ", fără fișă" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {canManage && <StatusPanel lead={lead} />}
      </div>

      <div className="flex flex-col gap-5">
        {converted ? (
          <Panel title="Pacient" tone="menta-pal">
            <p className="text-corp">
              Cererea a fost convertită pe {formatDateRo(new Date(lead.convertedAt!), "long")}: {lead.patientName}, fișa nr. {lead.patientFileNumber}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href={`/crm/pacienti/${lead.patientId}`} variant="secondary" icon="user" size="s">
                Fișa pacientului
              </ButtonLink>
              <ButtonLink href={`/crm/programari/noua?pacient=${lead.patientId}`} variant="text" icon="calendar-plus" size="s">
                Altă programare
              </ButtonLink>
            </div>
          </Panel>
        ) : (
          canManage &&
          options && (
            <Panel title="Convertiți în pacient">
              <ConvertLeadForm lead={lead} options={options} duplicates={duplicates} defaultDate={defaultDate} />
            </Panel>
          )
        )}
        <Panel title="Istoric">
          {canManage && <ActivityForm leadId={lead.id} />}
          <LeadActivityList items={lead.activities} />
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-discret">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** A note, or a contact line (call, SMS, e-mail). Contacting a new request marks it Contactat. */
function ActivityForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addLeadActivityAction(fd);
      if (r.ok) {
        setError(null);
        ref.current?.reset();
        showToast({ kind: "success", message: r.message ?? "Salvat" });
        router.refresh();
      } else setError(r.fieldErrors?.body?.[0] ?? r.error);
    });
  };
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="mb-4 flex flex-col gap-3 border-b border-linie pb-4">
      <input type="hidden" name="id" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Select
          id="act-type"
          name="type"
          label="Ce notați"
          defaultValue="APEL"
          options={[
            { value: "APEL", label: "Apel" },
            { value: "NOTA", label: "Notă" },
            { value: "SMS", label: "SMS" },
            { value: "EMAIL", label: "E-mail" },
          ]}
        />
        <TextArea id="act-body" name="body" label="Ce s-a discutat" rows={2} error={error} />
      </div>
      <div>
        <Button type="submit" size="s" variant="secondary" loading={pending}>
          Adăugați în istoric
        </Button>
      </div>
    </form>
  );
}

/** Manual status: Contactat, back to Nou, or Pierdut with a reason. „Programat” comes from the conversion. */
function StatusPanel({ lead }: { lead: LeadDetailDTO }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (status: LeadStatus, lostReason?: string) =>
    start(async () => {
      const r = await changeLeadStatusAction({ id: lead.id, status, lostReason });
      if (r.ok) {
        setLosing(false);
        setError(null);
        showToast({ kind: "success", message: r.message ?? "Salvat" });
        router.refresh();
      } else setError(r.fieldErrors?.lostReason?.[0] ?? r.error);
    });
  const targets: { to: LeadStatus; label: string }[] = [];
  if (lead.status === "NOU") targets.push({ to: "CONTACTAT", label: "Marcați Contactat" });
  if (lead.status === "CONTACTAT" || lead.status === "PIERDUT") targets.push({ to: "NOU", label: "Readuceți la Nou" });
  if (lead.status === "PIERDUT") targets.push({ to: "CONTACTAT", label: "Redeschideți ca Contactat" });
  if (lead.status === "PIERDUT" && lead.patientId) targets.push({ to: "PROGRAMAT", label: "Readuceți la Programat" });
  return (
    <Panel title="Statusul">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => (
            <Button key={t.to} size="s" variant="secondary" disabled={pending} onClick={() => run(t.to)}>
              {t.label}
            </Button>
          ))}
          {lead.status !== "PIERDUT" && !losing && (
            <Button size="s" variant="danger" disabled={pending} onClick={() => setLosing(true)}>
              Marcați Pierdut
            </Button>
          )}
        </div>
        {losing && (
          <div className="flex flex-col gap-2">
            <TextArea
              id="lost-reason"
              name="lostReason"
              label="De ce nu vine"
              hint="De exemplu: a ales altă clinică, prețul, nu răspunde de o săptămână."
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={error}
            />
            <div className="flex gap-2">
              <Button size="s" variant="danger" loading={pending} onClick={() => run("PIERDUT", reason)}>
                Marcați Pierdut
              </Button>
              <Button size="s" variant="text" onClick={() => setLosing(false)}>
                Renunțați
              </Button>
            </div>
          </div>
        )}
        {!losing && error && <p className="text-mic text-carmin">{error}</p>}
      </div>
    </Panel>
  );
}
