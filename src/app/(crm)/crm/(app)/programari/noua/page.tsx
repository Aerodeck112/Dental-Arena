import type { Metadata } from "next";
import { AppointmentFormPage, type AppointmentFormInitial } from "@/components/crm/calendar/AppointmentForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/dal";
import { getClinicScope, scopeLocationIds } from "@/lib/clinic-scope";
import { can } from "@/lib/permissions";
import { hhmmToMinutes, isValidDateISO, minutesToHHMM, todayISO, utcToLocal } from "@/lib/time";
import { getAppointmentFormOptions, getPatientPick } from "@/server/appointments/service";
import { getLeadDetail } from "@/server/leads/pipeline";
import { getRecallForBooking } from "@/server/recalls/service";

export const metadata: Metadata = { title: "Programare nouă" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** The next quarter hour from now, within 08:00–19:00 (default time of a new appointment). */
function defaultTime(now: Date, dateISO: string): string {
  if (dateISO !== todayISO(now)) return "09:00";
  const m = Math.ceil((utcToLocal(now).minute + 1) / 15) * 15;
  return minutesToHHMM(Math.min(Math.max(m, 480), 1125));
}

/**
 * `/crm/programari/noua?medic&zi&ora&pacient&cerere&rechemare` (WP6): the full create form,
 * prefilled from the calendar, a patient file, a lead or a recall.
 */
export default async function NewAppointmentPage({ searchParams }: PageProps<"/crm/programari/noua">) {
  const user = await requirePermission(["appointments.manage", "appointments.manageOwn"]);
  const sp = await searchParams;
  const now = new Date();
  const options = await getAppointmentFormOptions(user);

  const [patient, lead, recall] = await Promise.all([
    one(sp.pacient) ? getPatientPick(one(sp.pacient)) : Promise.resolve(null),
    one(sp.cerere) && can(user, "leads.view") ? getLeadDetail(one(sp.cerere)) : Promise.resolve(null),
    one(sp.rechemare) ? getRecallForBooking(one(sp.rechemare)) : Promise.resolve(null),
  ]);
  const recallPatient = recall && !patient ? await getPatientPick(recall.patientId) : null;
  const leadPatient = lead?.patientId && !patient ? await getPatientPick(lead.patientId) : null;

  const date = isValidDateISO(one(sp.zi)) ? one(sp.zi) : todayISO(now);
  const ora = one(sp.ora);
  const time = hhmmToMinutes(ora) !== null ? ora : defaultTime(now, date);
  const doctorId = options.forcedDoctorId ?? (options.doctors.some((d) => d.id === one(sp.medic)) ? one(sp.medic) : (recall?.doctorId ?? null));
  const scopeIds = await scopeLocationIds(await getClinicScope());
  const doctorLocations = options.doctors.find((d) => d.id === doctorId)?.locationIds ?? [];
  const locationId =
    lead?.locationId ?? recall?.locationId ?? doctorLocations.find((id) => scopeIds.includes(id)) ?? doctorLocations[0] ?? scopeIds[0] ?? options.locations[0]?.id ?? "";
  const service = lead?.serviceName ? options.services.find((s) => s.name === lead.serviceName) : undefined;

  const initial: AppointmentFormInitial = {
    locationId,
    doctorId,
    cabinetId: null,
    date,
    time,
    durationMinutes: service?.durationMinutes ?? 30,
    serviceId: service?.id ?? null,
    reason: recall?.reason ?? null,
    comfort: lead?.comfort ?? null,
    comfortNote: lead?.comfortNote ?? null,
    wantsSedation: lead?.wantsSedation ?? false,
    notes: lead?.message ?? null,
    patient: patient ?? recallPatient ?? leadPatient,
    leadId: lead?.id ?? null,
    leadName: lead && !lead.patientId ? lead.name : null,
    recallId: recall?.id ?? null,
  };
  const backHref = lead ? `/crm/cereri/${lead.id}` : recall ? "/crm/rechemari" : patient ? `/crm/pacienti/${patient.id}` : `/crm/programari?zi=${date}`;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ href: "/crm/programari", label: "Calendar" }, { label: "Programare nouă" }]} />}
        title="Programare nouă"
        subtitle={
          lead
            ? `Pentru cererea lui ${lead.name}.`
            : recall
              ? `Rechemare: ${recall.reason}.`
              : "Alegeți pacientul, motivul și ora. Conflictele din program apar înainte de salvare."
        }
      />
      <div className="rounded-panou border border-linie bg-suprafata p-5 sm:p-6">
        <AppointmentFormPage mode="create" idPrefix="noua" options={options} initial={initial} backHref={backHref} />
      </div>
    </div>
  );
}
