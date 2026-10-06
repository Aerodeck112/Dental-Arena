import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanProgress } from "@/components/crm/plans/PlanProgress";
import { PlanTotals } from "@/components/crm/plans/PlanTotals";
import { TreatmentPlanEditor } from "@/components/crm/plans/TreatmentPlanEditor";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getPlan, listPlanServices } from "@/server/patients/plans";
import { getPatientFormOptions, getPatientHeader } from "@/server/patients/service";

export async function generateMetadata({ params }: PageProps<"/crm/pacienti/[id]/planuri/[planId]">): Promise<Metadata> {
  const { id, planId } = await params;
  const plan = zId.safeParse(id).success && zId.safeParse(planId).success ? await getPlan(id, planId) : null;
  return { title: plan?.title ?? "Plan de tratament" };
}

/** Plan editor: phases, lines (tooth, service, price, status), totals and progress. */
export default async function PlanPage({ params }: PageProps<"/crm/pacienti/[id]/planuri/[planId]">) {
  const user = await requirePermission("plans.view");
  const { id, planId } = await params;
  if (!zId.safeParse(id).success || !zId.safeParse(planId).success) notFound();
  const [patient, plan] = await Promise.all([getPatientHeader(id), getPlan(id, planId)]);
  if (!patient || !plan) notFound();
  const canManage = can(user, "plans.manage") && !patient.anonymized;
  const [services, options] = canManage ? await Promise.all([listPlanServices(), getPatientFormOptions()]) : [[], { doctors: [] }];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <ButtonLink href={`/crm/pacienti/${id}/planuri`} variant="text" size="s" icon="chevron-left">
          Toate planurile
        </ButtonLink>
      </div>
      <TreatmentPlanEditor
        patientId={id}
        plan={plan}
        services={services}
        doctors={options.doctors}
        canManage={canManage}
        progress={<PlanProgress items={plan.items} isImplant={plan.isImplant} />}
        totals={<PlanTotals totals={plan.totals} />}
      />
    </div>
  );
}
