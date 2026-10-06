"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Drawer } from "@/components/ui/Drawer";
import { FlagTag } from "@/components/ui/FlagTag";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDateRo, formatPhone, formatTime, telHref } from "@/lib/format";
import { APPOINTMENT_SOURCE_LABEL } from "@/lib/labels";
import { minutesToHHMM } from "@/lib/time";
import type { CalendarAppointment } from "@/server/appointments/types";
import { chairMinutes } from "./AppointmentBlock";
import { StatusActions } from "./StatusActions";

/** The appointment as the drawer and the deep-link page show it: patient, status, overlays, details. */
export function AppointmentDetails({ a, now }: { a: CalendarAppointment; now: Date }) {
  const minutes = chairMinutes(a, now);
  const tentative = !a.patientId && !!a.leadId;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={a.status} detail={minutes !== null ? `${minutes} min` : undefined} />
        {a.flags.map((f) => (
          <FlagTag key={`${f.kind}-${f.label}`} kind={f.kind}>
            {f.label}
          </FlagTag>
        ))}
      </div>
      {a.comfortNote && (
        <p className="rounded-panou bg-mustar-pal px-3 py-2 text-corp text-cerneala">
          La programare a scris: „{a.comfortNote}”
        </p>
      )}
      {tentative && (
        <p className="rounded-panou bg-menta-pal px-3 py-2 text-corp">
          Programare online: pacientul nu are încă fișă.{" "}
          <Link href={`/crm/cereri/${a.leadId}`} className="font-semibold text-link underline underline-offset-4">
            Deschideți cererea
          </Link>{" "}
          ca să o confirmați și să creați fișa.
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-corp">
        <Row label="Ora">
          <span className="cifre">
            {minutesToHHMM(a.startMinute)}–{minutesToHHMM(a.endMinute)}
          </span>
        </Row>
        <Row label="Medic">{a.doctorName}</Row>
        <Row label="Clinica">
          {a.locationName}
          {a.cabinetName ? `, ${a.cabinetName}` : ""}
        </Row>
        {(a.serviceName || a.reason) && <Row label="Motivul">{[a.serviceName, a.reason].filter(Boolean).join(", ")}</Row>}
        {a.phone && (
          <Row label="Telefon">
            <a href={telHref(a.phone)} className="telefon text-link underline underline-offset-4" aria-label={`Sunați pe ${a.title}, ${formatPhone(a.phone)}`}>
              {formatPhone(a.phone)}
            </a>
          </Row>
        )}
        {a.fileNumber !== null && <Row label="Fișa">nr. {a.fileNumber}</Row>}
        <Row label="Sursa">{APPOINTMENT_SOURCE_LABEL[a.source]}</Row>
        {a.confirmedAt && <Row label="Confirmată">{`${formatDateRo(new Date(a.confirmedAt), "weekday")}, ${formatTime(new Date(a.confirmedAt))}`}</Row>}
        {a.cancelReason && <Row label="Motiv anulare">{a.cancelReason}</Row>}
        {a.notes && <Row label="Observații">{a.notes}</Row>}
      </dl>
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

/**
 * The right-hand drawer of the calendar (400 px, design system §6.8): details, status actions in
 * visit order, „Mutați” and links to the patient file and the full page.
 */
export function AppointmentDrawer({
  appointment,
  open,
  onClose,
  onMove,
  now,
}: {
  appointment: CalendarAppointment | null;
  open: boolean;
  onClose: () => void;
  onMove: (a: CalendarAppointment) => void;
  now: Date;
}) {
  const a = appointment;
  const movable = !!a && a.canManage && (a.status === "PROGRAMAT" || a.status === "CONFIRMAT");
  return (
    <Drawer
      open={open && !!a}
      onClose={onClose}
      title={a?.title ?? "Programare"}
      subtitle={a ? `${formatDateRo(a.dateISO, "long")}, ${minutesToHHMM(a.startMinute)}–${minutesToHHMM(a.endMinute)}` : undefined}
      footer={
        a ? (
          <>
            {movable && (
              <Button variant="secondary" size="s" icon="calendar" onClick={() => onMove(a)}>
                Mutați
              </Button>
            )}
            {a.patientId && (
              <ButtonLink href={`/crm/pacienti/${a.patientId}`} variant="secondary" size="s" icon="user">
                Fișa pacientului
              </ButtonLink>
            )}
            <ButtonLink href={`/crm/programari/${a.id}`} variant="text" size="s">
              {a.canManage ? "Editați" : "Pagina programării"}
            </ButtonLink>
          </>
        ) : null
      }
    >
      {a && (
        <div className="flex flex-col gap-5">
          <AppointmentDetails a={a} now={now} />
          {a.canManage && a.actions.length > 0 && (
            <section aria-label="Schimbați statusul" className="border-t border-linie pt-4">
              <StatusActions appointment={a} variant="panel" />
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
