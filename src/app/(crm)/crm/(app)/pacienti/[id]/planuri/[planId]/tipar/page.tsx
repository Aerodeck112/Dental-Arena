import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/crm/billing/PrintButton";
import { PlanPrint } from "@/components/crm/plans/PlanPrint";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayISO } from "@/lib/time";
import { zId } from "@/lib/validation/common";
import { getPlan } from "@/server/patients/plans";
import { getPatientHeader } from "@/server/patients/service";

export const metadata: Metadata = { title: "Deviz" };

/** Printable deviz (A4, print CSS): clinic header, lines, totals and signature lines. */
export default async function PlanPrintPage({ params }: PageProps<"/crm/pacienti/[id]/planuri/[planId]/tipar">) {
  await requirePermission("plans.view");
  const { id, planId } = await params;
  if (!zId.safeParse(id).success || !zId.safeParse(planId).success) notFound();
  const [patient, plan, clinic] = await Promise.all([getPatientHeader(id), getPlan(id, planId), getSettings("clinic")]);
  if (!patient || !plan) notFound();
  const loc = patient.preferredLocation
    ? await prisma.location.findUnique({ where: { id: patient.preferredLocation.id }, select: { shortName: true, street: true, city: true, phone: true } })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3" data-print="ascuns">
        <ButtonLink href={`/crm/pacienti/${id}/planuri/${planId}`} variant="text" icon="chevron-left">
          Înapoi la plan
        </ButtonLink>
        <PrintButton label="Tipăriți devizul" />
        <p className="text-mic text-discret">Se tipărește pe A4, fără meniul aplicației.</p>
      </div>
      <PlanPrint
        plan={plan}
        today={todayISO()}
        patient={{ name: patient.name, fileNumber: patient.fileNumber, birthDate: patient.birthDate, phone: patient.phone }}
        clinic={{
          displayName: clinic.displayName,
          legalName: clinic.legalName,
          cui: clinic.cui,
          email: clinic.email,
          location: loc ? { name: loc.shortName, address: `${loc.street}, ${loc.city}`, phone: loc.phone } : null,
        }}
      />
    </div>
  );
}
