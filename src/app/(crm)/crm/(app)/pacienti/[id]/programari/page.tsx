import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { requirePermission } from "@/lib/auth/dal";
import { formatDateRo, formatTime, pluralRo } from "@/lib/format";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getPatientAppointments, getPatientHeader } from "@/server/patients/service";
import type { PatientAppointmentDTO } from "@/server/patients/types";

export const metadata: Metadata = { title: "Istoricul programărilor" };

/** Every appointment of the patient, newest first, with its status chip. */
export default async function PatientAppointmentsPage({ params }: PageProps<"/crm/pacienti/[id]/programari">) {
  const user = await requirePermission("appointments.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, rows] = await Promise.all([getPatientHeader(id), getPatientAppointments(id)]);
  if (!patient) notFound();
  const done = rows.filter((r) => r.status === "FINALIZAT").length;
  const noShow = rows.filter((r) => r.status === "NEPREZENTAT").length;
  const canBook = can(user, ["appointments.manage", "appointments.manageOwn"]) && !patient.anonymized;

  const columns: DataTableColumn<PatientAppointmentDTO>[] = [
    {
      key: "date",
      header: "Data",
      className: "cifre whitespace-nowrap",
      render: (r) => `${formatDateRo(r.startsAt, "short")}, ${formatTime(new Date(r.startsAt))}`,
    },
    { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} size="s" /> },
    {
      key: "reason",
      header: "Motiv",
      render: (r) => (
        <span className="flex flex-col">
          <span>{r.serviceName ?? r.reason ?? "–"}</span>
          {r.cancelReason && <span className="text-mic text-discret">{r.cancelReason}</span>}
        </span>
      ),
    },
    { key: "doctor", header: "Medic", render: (r) => r.doctorName },
    { key: "location", header: "Clinica", render: (r) => r.locationName },
  ];

  return (
    <Panel
      title="Istoricul programărilor"
      actions={
        canBook && (
          <ButtonLink href={`/crm/programari/noua?pacient=${id}`} size="s" icon="calendar-plus">
            Programați
          </ButtonLink>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {rows.length > 0 && (
          <p className="text-corp text-discret">
            {pluralRo(rows.length, "programare", "programări")}, {pluralRo(done, "vizită finalizată", "vizite finalizate")}
            {noShow > 0 ? `, ${pluralRo(noShow, "neprezentare", "neprezentări")}` : ""}.
          </p>
        )}
        <DataTable
          caption="Programările pacientului, cele mai noi primele"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/crm/programari/${r.id}`}
          empty={<EmptyState title="Nicio programare încă." />}
        />
      </div>
    </Panel>
  );
}
