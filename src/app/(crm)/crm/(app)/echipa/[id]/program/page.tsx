import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScheduleEditor } from "@/components/crm/schedule/ScheduleEditor";
import { TimeOffList } from "@/components/crm/schedule/TimeOffList";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { can, canManageTimeOff } from "@/lib/permissions";
import { getScheduleEditorData, listTimeOff } from "@/server/scheduling/schedules";

export const metadata: Metadata = { title: "Program" };

/** `[id]` is the doctor's id, or the id of the user account linked to the doctor. */
async function resolveDoctorId(id: string): Promise<string | null> {
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return null;
  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true } });
  if (doctor) return doctor.id;
  const viaUser = await prisma.doctor.findUnique({ where: { userId: id }, select: { id: true } });
  return viaUser?.id ?? null;
}

/**
 * `/crm/echipa/[id]/program` (docs/architecture.md §4.2): the doctor's weekly shifts per clinic,
 * with breaks, cabinet, online flag and validity, and the doctor's upcoming time off. Everyone
 * with `schedules.view` reads it; only ADMIN (`schedules.manage`) edits shifts.
 */
export default async function DoctorSchedulePage({ params }: PageProps<"/crm/echipa/[id]/program">) {
  const user = await requirePermission("schedules.view");
  const { id } = await params;
  const doctorId = await resolveDoctorId(id);
  if (!doctorId) notFound();
  const [data, timeOff] = await Promise.all([getScheduleEditorData(doctorId), listTimeOff(user, { doctorId })]);
  if (!data) notFound();
  const canManage = can(user, "schedules.manage");

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageHeader
        before={
          <Breadcrumbs
            items={[
              { label: "Echipă", href: can(user, "staff.view") ? "/crm/echipa" : undefined },
              { label: data.doctor.publicName },
            ]}
          />
        }
        title={`Program, ${data.doctor.publicName}`}
        subtitle={canManage ? "Orele de aici hrănesc programarea online și calendarul." : "Doar administratorul modifică programul."}
        actions={
          canManageTimeOff(user, doctorId) && (
            <ButtonLink href={`/crm/absente?medic=${doctorId}`} variant="secondary" size="s" icon="calendar">
              Adăugați o absență
            </ButtonLink>
          )
        }
      />
      <ScheduleEditor data={data} canManage={canManage} />
      <Panel title="Absențe">
        <TimeOffList items={timeOff} showDoctor={false} />
      </Panel>
    </div>
  );
}
