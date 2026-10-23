import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoteForm } from "@/components/crm/patients/NoteForm";
import { NotesList } from "@/components/crm/patients/NotesList";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { listNotes } from "@/server/patients/notes";
import { getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Note" };

/** Notes: administrative for everyone; clinical ones only for ADMIN and MEDIC (filtered by the service). */
export default async function NotesPage({ params }: PageProps<"/crm/pacienti/[id]/note">) {
  const user = await requirePermission("patients.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, notes] = await Promise.all([getPatientHeader(id), listNotes(user, id)]);
  if (!patient) notFound();
  const readOnly = patient.anonymized;
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <Panel title={can(user, "medical.view") ? "Note administrative și clinice" : "Note administrative"}>
          <NotesList
            patientId={id}
            notes={notes}
            readOnly={readOnly}
            viewer={{ id: user.id, isAdmin: user.role === "ADMIN", canClinicalEdit: can(user, "medical.edit") }}
          />
        </Panel>
      </div>
      {!readOnly && (
        <div className="lg:col-span-4">
          <Panel title="Adăugați o notă">
            <NoteForm patientId={id} canClinical={can(user, "medical.edit")} />
          </Panel>
        </div>
      )}
    </div>
  );
}
