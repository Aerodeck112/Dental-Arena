import type { Metadata } from "next";
import { requireLocationAccess } from "@/lib/clinic-scope";
import { notFound } from "next/navigation";
import { AppointmentDetails } from "@/components/crm/calendar/AppointmentDrawer";
import { AppointmentFormPage } from "@/components/crm/calendar/AppointmentForm";
import { StatusActions } from "@/components/crm/calendar/StatusActions";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { formatDateRo } from "@/lib/format";
import { minutesToHHMM } from "@/lib/time";
import { getAppointmentDTO } from "@/server/appointments/calendar";
import { getAppointmentFormOptions, getPatientPick } from "@/server/appointments/service";

export const metadata: Metadata = { title: "Programare" };

/** `/crm/programari/[id]` (WP6): the drawer content as a page (deep link), with the edit form. */
export default async function AppointmentPage({ params }: PageProps<"/crm/programari/[id]">) {
  const user = await requirePermission("appointments.view");
  const { id } = await params;
  const now = new Date();
  const a = await getAppointmentDTO(user, id, now);
  if (!a) notFound();
  await requireLocationAccess(a.locationId);
  const [options, patient] = await Promise.all([
    a.canManage ? getAppointmentFormOptions(user) : Promise.resolve(null),
    a.patientId ? getPatientPick(a.patientId) : Promise.resolve(null),
  ]);
  const editable = options && a.status !== "ANULAT" && a.status !== "NEPREZENTAT" && a.status !== "FINALIZAT";
  const dayHref = `/crm/programari?zi=${a.dateISO}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ href: dayHref, label: "Calendar" }, { label: a.title }]} />}
        title={a.title}
        subtitle={`${formatDateRo(a.dateISO, "full")}, ${minutesToHHMM(a.startMinute)}–${minutesToHHMM(a.endMinute)}, ${a.doctorName}`}
        actions={
          <>
            {a.patientId && (
              <ButtonLink href={`/crm/pacienti/${a.patientId}`} variant="secondary" icon="user">
                Fișa pacientului
              </ButtonLink>
            )}
            <ButtonLink href={dayHref} variant="text" icon="calendar">
              Ziua în calendar
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Programarea">
            <AppointmentDetails a={a} now={now} />
          </Panel>
          {a.canManage && a.actions.length > 0 && (
            <Panel title="Statusul">
              <StatusActions appointment={a} variant="panel" />
            </Panel>
          )}
        </div>
        {editable && options ? (
          <Panel title="Modificați programarea">
            <AppointmentFormPage
              mode="edit"
              idPrefix={`edit-${a.id}`}
              options={options}
              backHref={dayHref}
              initial={{
                id: a.id,
                expectedUpdatedAt: a.updatedAt,
                status: a.status,
                locationId: a.locationId,
                doctorId: a.doctorId,
                cabinetId: a.cabinetId,
                date: a.dateISO,
                time: minutesToHHMM(a.startMinute),
                durationMinutes: a.endMinute - a.startMinute,
                serviceId: a.serviceId,
                reason: a.reason,
                comfort: a.comfort,
                comfortNote: a.comfortNote,
                wantsSedation: a.wantsSedation,
                notes: a.notes,
                patient,
                leadId: a.leadId,
              }}
            />
          </Panel>
        ) : (
          <Panel title="Modificări">
            <p className="text-corp text-discret">
              {a.canManage
                ? "Programarea este închisă și nu se mai modifică. Pentru o vizită nouă, creați o programare."
                : "Puteți vedea programarea; modificările le face recepția sau medicul ei."}
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
