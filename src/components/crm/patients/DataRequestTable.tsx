"use client";

import Link from "next/link";
import { useState } from "react";
import { createDataRequestAction, updateDataRequestAction } from "@/app/(crm)/crm/(app)/gdpr/actions";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DateInput } from "@/components/ui/DateInput";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDateRo } from "@/lib/format";
import { DATA_REQUEST_STATUS_LABEL, DATA_REQUEST_TYPE_LABEL } from "@/lib/labels";
import { DATA_REQUEST_STATUS_VALUES, DATA_REQUEST_TYPE_VALUES } from "@/server/patients/schemas";
import type { DataRequestDTO } from "@/server/patients/types";
import { usePatientAction } from "./use-patient-action";

function Deadline({ r }: { r: DataRequestDTO }) {
  const open = r.status === "PRIMITA" || r.status === "IN_LUCRU";
  if (!open) return <span className="text-discret">{r.completedAt ? `Închisă ${formatDateRo(r.completedAt, "short")}` : "Închisă"}</span>;
  if (r.overdue) {
    return (
      <span className="font-semibold text-carmin">
        Depășit cu {Math.abs(r.daysLeft)} {Math.abs(r.daysLeft) === 1 ? "zi" : "zile"}
      </span>
    );
  }
  return (
    <span className={r.daysLeft <= 5 ? "font-semibold text-cerneala" : "text-cerneala"}>
      {r.daysLeft === 0 ? "Azi" : `Peste ${r.daysLeft} ${r.daysLeft === 1 ? "zi" : "zile"}`}
    </span>
  );
}

/** The register of data-subject requests, open ones first, overdue ones in carmin. */
export function DataRequestTable({ rows, showPatient = true }: { rows: DataRequestDTO[]; showPatient?: boolean }) {
  const [editing, setEditing] = useState<DataRequestDTO | null>(null);
  const columns: DataTableColumn<DataRequestDTO>[] = [
    {
      key: "type",
      header: "Cerere",
      render: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold text-cerneala">{DATA_REQUEST_TYPE_LABEL[r.type]}</span>
          <span className="text-mic text-discret">{r.requesterName}{r.contact ? `, ${r.contact}` : ""}</span>
        </span>
      ),
    },
    ...(showPatient
      ? [
          {
            key: "patient",
            header: "Pacient",
            render: (r: DataRequestDTO) =>
              r.patient ? (
                <Link href={`/crm/pacienti/${r.patient.id}/gdpr`} className="text-link underline underline-offset-4">
                  {r.patient.name}
                </Link>
              ) : (
                "–"
              ),
          },
        ]
      : []),
    { key: "received", header: "Primită", className: "cifre whitespace-nowrap", render: (r) => formatDateRo(r.receivedAt, "short") },
    { key: "due", header: "Termen", className: "cifre whitespace-nowrap", render: (r) => formatDateRo(r.dueAt, "short") },
    { key: "left", header: "Timp rămas", render: (r) => <Deadline r={r} /> },
    { key: "status", header: "Stare", render: (r) => DATA_REQUEST_STATUS_LABEL[r.status] },
    {
      key: "actions",
      header: <span className="sr-only">Acțiuni</span>,
      render: (r) => (
        <Button size="s" variant="text" onClick={() => setEditing(r)}>
          Actualizați
        </Button>
      ),
    },
  ];
  return (
    <>
      <DataTable
        caption="Cererile GDPR, cele deschise primele"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title="Nicio cerere înregistrată. Înregistrați aici orice cerere de acces, export, rectificare sau ștergere." />}
      />
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="Actualizați cererea" description={editing ? `${DATA_REQUEST_TYPE_LABEL[editing.type]}, ${editing.requesterName}` : undefined}>
        {editing && <UpdateForm request={editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}

function UpdateForm({ request, onDone }: { request: DataRequestDTO; onDone: () => void }) {
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(updateDataRequestAction, { onSuccess: onDone });
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
      <input type="hidden" name="requestId" value={request.id} />
      {request.details && <p className="text-corp text-discret">{request.details}</p>}
      <Select
        label="Starea"
        name="status"
        defaultValue={request.status}
        options={DATA_REQUEST_STATUS_VALUES.map((s) => ({ value: s, label: DATA_REQUEST_STATUS_LABEL[s] }))}
        error={errors?.status}
      />
      <TextArea label="Răspunsul dat" name="outcome" optional rows={3} maxLength={2000} defaultValue={request.outcome ?? undefined} hint="Obligatoriu la închidere." error={errors?.outcome} />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Se salvează">Salvați</SubmitButton>
      </div>
    </form>
  );
}

/** „Cerere nouă”: received date (default today), type, who asked and how to reach them. */
export function DataRequestForm({ patient, today }: { patient?: { id: string; name: string } | null; today: string }) {
  const [open, setOpen] = useState(false);
  const { onSubmit, formAction, errors, formError, state } = usePatientAction(createDataRequestAction, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button size="s" icon="plus" onClick={() => setOpen(true)}>
        Cerere nouă
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cerere GDPR nouă" description="Termenul legal de răspuns este de 30 de zile de la primire.">
        <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {state && !state.ok && <ErrorSummary errors={errors} message={formError} />}
          {patient && <input type="hidden" name="patientId" value={patient.id} />}
          <Select
            label="Tipul cererii"
            name="type"
            defaultValue="ACCES"
            options={DATA_REQUEST_TYPE_VALUES.map((t) => ({ value: t, label: DATA_REQUEST_TYPE_LABEL[t] }))}
            error={errors?.type}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Cine a cerut" name="requesterName" required maxLength={160} defaultValue={patient?.name} error={errors?.requesterName} />
            <TextField label="Contact" name="contact" optional maxLength={160} hint="Telefon sau e-mail pentru răspuns." error={errors?.contact} />
          </div>
          <DateInput label="Primită pe" name="receivedAt" defaultValue={today} max={today} error={errors?.receivedAt} />
          <TextArea label="Detalii" name="details" optional rows={3} maxLength={2000} error={errors?.details} />
          <div className="flex justify-end">
            <SubmitButton icon="check" pendingLabel="Se înregistrează">
              Înregistrați cererea
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
