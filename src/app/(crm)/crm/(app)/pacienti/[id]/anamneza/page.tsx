import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MedicalHistoryForm } from "@/components/crm/patients/MedicalHistoryForm";
import { FlagTag } from "@/components/ui/FlagTag";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getPatientFlags } from "@/server/patients/flags";
import { getMedicalHistory } from "@/server/patients/medical";
import { getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Anamneză" };

/** Anamneză: ADMIN and MEDIC only. RECEPTIE is redirected to „Acces interzis” (it sees the flags only). */
export default async function MedicalHistoryPage({ params }: PageProps<"/crm/pacienti/[id]/anamneza">) {
  const user = await requirePermission("medical.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, history, flags] = await Promise.all([getPatientHeader(id), getMedicalHistory(user, id), getPatientFlags(id)]);
  if (!patient) notFound();
  const alerts = flags.filter((f) => f.kind === "alerta");
  const readOnly = !can(user, "medical.edit") || patient.anonymized;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <Panel title="Anamneză">
          <MedicalHistoryForm patientId={id} history={history} readOnly={readOnly} />
        </Panel>
      </div>
      <div className="flex flex-col gap-5 lg:col-span-4">
        <Panel title="Atenționări medicale">
          {alerts.length === 0 ? (
            <p className="text-corp text-discret">Nicio atenționare. Bifele din anamneză apar aici și în calendar.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {alerts.map((f) => (
                <li key={f.label}>
                  <FlagTag kind="alerta">{f.label}</FlagTag>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <p className="text-mic text-discret">
          {history?.lastReviewedAt
            ? `Revizuită ultima dată pe ${formatDateTime(new Date(history.lastReviewedAt))}${history.lastReviewedBy ? `, de ${history.lastReviewedBy}` : ""}.`
            : "Anamneza nu a fost completată încă."}
        </p>
      </div>
    </div>
  );
}
