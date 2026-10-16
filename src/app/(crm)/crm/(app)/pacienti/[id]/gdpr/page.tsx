import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataRequestForm, DataRequestTable } from "@/components/crm/patients/DataRequestTable";
import { GdprPanel } from "@/components/crm/patients/GdprPanel";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { AUDIT_ACTION_LABEL, type AuditAction } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { todayISO } from "@/lib/time";
import { zId } from "@/lib/validation/common";
import { getPatientAuditTrail, listDataRequests } from "@/server/patients/gdpr";
import { getPatientHeader } from "@/server/patients/service";
import type { AuditEntryDTO } from "@/server/patients/types";

export const metadata: Metadata = { title: "GDPR pacient" };

/** Export (JSON), anonymisation, this patient's requests and audit trail. ADMIN only. */
export default async function PatientGdprPage({ params }: PageProps<"/crm/pacienti/[id]/gdpr">) {
  const user = await requirePermission("gdpr.manage");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, requests, trail] = await Promise.all([getPatientHeader(id), listDataRequests(user, { patientId: id }), getPatientAuditTrail(user, id)]);
  if (!patient) notFound();

  const columns: DataTableColumn<AuditEntryDTO>[] = [
    { key: "at", header: "Când", className: "cifre whitespace-nowrap", render: (r) => formatDateTime(new Date(r.at)) },
    { key: "action", header: "Ce", render: (r) => AUDIT_ACTION_LABEL[r.action as AuditAction] ?? r.action },
    {
      key: "actor",
      header: "Cine",
      render: (r) => (r.actorName ? `${r.actorName}${r.actorRole ? `, ${ROLE_LABEL[r.actorRole]}` : ""}` : "Sistem sau pacientul, prin link"),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <GdprPanel patientId={id} fileNumber={patient.fileNumber} anonymized={patient.anonymized} />
      <Panel title="Cererile pacientului" actions={<DataRequestForm patient={{ id, name: patient.name }} today={todayISO()} />}>
        <DataRequestTable rows={requests} showPatient={false} />
      </Panel>
      <Panel title="Cine a accesat fișa">
        <DataTable caption="Jurnalul de acces al fișei, cele mai noi primele" columns={columns} rows={trail} rowKey={(r) => r.id} empty={<EmptyState title="Nicio înregistrare în jurnal." />} />
      </Panel>
    </div>
  );
}
