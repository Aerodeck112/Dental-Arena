import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConsentFormDialog } from "@/components/crm/patients/ConsentForm";
import { ConsentList } from "@/components/crm/patients/ConsentList";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { CONSENT_TYPE_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { zId } from "@/lib/validation/common";
import { currentConsents, listConsents } from "@/server/patients/consents";
import { listDocuments } from "@/server/patients/documents";
import { listPlans } from "@/server/patients/plans";
import { getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Consimțăminte" };

/** Consents with timestamps, method and text version; record or revoke (`consents.manage`). */
export default async function ConsentsPage({ params }: PageProps<"/crm/pacienti/[id]/consimtaminte">) {
  const user = await requirePermission("patients.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, rows, gdpr] = await Promise.all([getPatientHeader(id), listConsents(id), getSettings("gdpr")]);
  if (!patient) notFound();
  const canManage = can(user, "consents.manage") && !patient.anonymized;
  const [documents, plans] = canManage
    ? await Promise.all([
        can(user, "documents.view") ? listDocuments(user, id) : Promise.resolve([]),
        can(user, "plans.view") ? listPlans(id) : Promise.resolve([]),
      ])
    : [[], []];
  const inForce = currentConsents(rows);
  const summary = [...inForce.values()].map((c) => `${CONSENT_TYPE_LABEL[c.type]}: ${c.granted ? "acord" : "refuz"}`);

  return (
    <Panel
      title="Consimțăminte"
      actions={
        canManage && (
          <ConsentFormDialog
            patientId={id}
            defaultTextVersion={gdpr.consentTextVersion}
            documents={documents.map((d) => ({ id: d.id, title: d.title }))}
            plans={plans.filter((p) => p.status !== "ANULAT").map((p) => ({ id: p.id, title: p.title }))}
          />
        )
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-corp text-cerneala">{summary.length > 0 ? `În vigoare: ${summary.join("; ")}.` : "Niciun consimțământ în vigoare."}</p>
        <ConsentList patientId={id} rows={rows} canManage={canManage} />
      </div>
    </Panel>
  );
}
