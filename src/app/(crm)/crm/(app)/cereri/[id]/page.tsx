import type { Metadata } from "next";
import { requireLocationAccess } from "@/lib/clinic-scope";
import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/crm/leads/LeadDetail";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { addDaysISO, todayISO } from "@/lib/time";
import { getAppointmentFormOptions } from "@/server/appointments/service";
import { getLeadDetail, leadDuplicates, listLeadAssignees } from "@/server/leads/pipeline";

export const metadata: Metadata = { title: "Cerere" };

/** `/crm/cereri/[id]` (WP6): activity, assignment, status and conversion to patient and appointment. */
export default async function LeadPage({ params }: PageProps<"/crm/cereri/[id]">) {
  const user = await requirePermission("leads.view");
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();
  await requireLocationAccess(lead.locationId);
  const canManage = can(user, "leads.manage");
  const converted = !!lead.convertedAt && !!lead.patientId;
  const [assignees, options, duplicates] = await Promise.all([
    canManage ? listLeadAssignees() : Promise.resolve([]),
    canManage && !converted ? getAppointmentFormOptions(user) : Promise.resolve(null),
    canManage && !converted ? leadDuplicates(lead.suggested) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ href: "/crm/cereri", label: "Cereri online" }, { label: lead.name }]} />}
        title={lead.name}
        actions={
          canManage && !converted ? (
            <ButtonLink href={`/crm/programari/noua?cerere=${lead.id}`} variant="secondary" icon="calendar-plus">
              Programați din calendar
            </ButtonLink>
          ) : null
        }
      />
      <LeadDetail lead={lead} assignees={assignees} options={options} duplicates={duplicates} canManage={canManage} defaultDate={addDaysISO(todayISO(), 1)} />
    </div>
  );
}
