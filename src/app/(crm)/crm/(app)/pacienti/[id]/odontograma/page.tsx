import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dentitionOf } from "@/components/crm/odontogram/fdi";
import { Odontogram } from "@/components/crm/odontogram/Odontogram";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { listToothConditions } from "@/server/patients/odontogram";
import { listOpenPlans, listPlanServices } from "@/server/patients/plans";
import { getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Odontogramă" };

/** FDI tooth chart (ADMIN and MEDIC; RECEPTIE is redirected). */
export default async function OdontogramPage({ params }: PageProps<"/crm/pacienti/[id]/odontograma">) {
  const user = await requirePermission("medical.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [patient, rows] = await Promise.all([getPatientHeader(id), listToothConditions(user, id)]);
  if (!patient) notFound();
  const editable = !patient.anonymized;
  const canPlan = can(user, "plans.manage") && editable;
  const [services, plans] = canPlan ? await Promise.all([listPlanServices(), listOpenPlans(id)]) : [[], []];
  const active = rows.filter((r) => !r.resolvedAt);
  const primary = active.filter((r) => dentitionOf(r.tooth) === "copil").length;
  const defaultDentition = (patient.age !== null && patient.age < 12) || primary > active.length / 2 ? "copil" : "adult";

  return (
    <Panel title="Odontogramă">
      <Odontogram
        patientId={id}
        rows={rows}
        defaultDentition={defaultDentition}
        canEdit={can(user, "medical.edit") && editable}
        canPlan={canPlan}
        services={services}
        plans={plans}
      />
    </Panel>
  );
}
