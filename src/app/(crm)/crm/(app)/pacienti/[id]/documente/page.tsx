import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentList } from "@/components/crm/patients/DocumentList";
import { DocumentUpload } from "@/components/crm/patients/DocumentUpload";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { formatBytes, listDocuments } from "@/server/patients/documents";
import { getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Documente" };

/** Document metadata, upload (≤ 20 MB, type and magic bytes checked) and authenticated download. */
export default async function DocumentsPage({ params, searchParams }: PageProps<"/crm/pacienti/[id]/documente">) {
  const user = await requirePermission("documents.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const sp = await searchParams;
  const showDeleted = sp.sterse === "1" && can(user, "documents.delete");
  const [patient, docs] = await Promise.all([getPatientHeader(id), listDocuments(user, id, { includeDeleted: showDeleted })]);
  if (!patient) notFound();
  const canUpload = can(user, "documents.upload") && !patient.anonymized;
  const uploadError = typeof sp.eroare === "string" ? sp.eroare.slice(0, 200) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className={canUpload ? "lg:col-span-8" : "lg:col-span-12"}>
        <Panel
          title="Documente"
          actions={
            can(user, "documents.delete") && (
              <a href={showDeleted ? "?" : "?sterse=1"} className="text-mic text-link underline underline-offset-4">
                {showDeleted ? "Ascundeți documentele șterse" : "Arătați și documentele șterse"}
              </a>
            )
          }
        >
          <DocumentList patientId={id} rows={docs.map((d) => ({ ...d, size: formatBytes(d.sizeBytes) }))} canDelete={can(user, "documents.delete") && !patient.anonymized} />
        </Panel>
      </div>
      {canUpload && (
        <div className="lg:col-span-4">
          <Panel title="Încărcați un document">
            <DocumentUpload patientId={id} serverError={uploadError} />
          </Panel>
        </div>
      )}
    </div>
  );
}
