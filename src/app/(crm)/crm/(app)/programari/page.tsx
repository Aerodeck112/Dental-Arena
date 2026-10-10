import type { Metadata } from "next";
import { CalendarGrid } from "@/components/crm/calendar/CalendarGrid";
import { CalendarToolbar } from "@/components/crm/calendar/CalendarToolbar";
import { CalendarWeek } from "@/components/crm/calendar/CalendarWeek";
import { TodayList } from "@/components/crm/dashboard/TodayList";
import { requirePermission } from "@/lib/auth/dal";
import { getAllowedScopes, getClinicScope, isClinicScope } from "@/lib/clinic-scope";
import { pluralRo } from "@/lib/format";
import { can } from "@/lib/permissions";
import { isValidDateISO, todayISO } from "@/lib/time";
import { getCalendarData } from "@/server/appointments/calendar";
import { getAppointmentFormOptions } from "@/server/appointments/service";

export const metadata: Metadata = { title: "Calendar" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * `/crm/programari?vedere=zi|saptamana|lista&zi=YYYY-MM-DD&clinica=…&coloane=medici|cabinete&medic=…`
 * (WP6): the day view with doctor or cabinet columns, the week view for one doctor, and the
 * day's list. `clinica` overrides the top-bar clinic for this page only.
 */
export default async function CalendarPage({ searchParams }: PageProps<"/crm/programari">) {
  const user = await requirePermission("appointments.view");
  const sp = await searchParams;
  const now = new Date();
  const vedere = one(sp.vedere) === "saptamana" ? "saptamana" : one(sp.vedere) === "lista" ? "lista" : "zi";
  const zi = isValidDateISO(one(sp.zi)) ? one(sp.zi) : todayISO(now);
  const coloane = one(sp.coloane) === "cabinete" ? "cabinete" : "medici";
  const clinicaParam = one(sp.clinica);
  const allowedScopes = await getAllowedScopes();
  const scope = isClinicScope(clinicaParam) && allowedScopes.includes(clinicaParam) ? clinicaParam : await getClinicScope();
  const canCreate = can(user, ["appointments.manage", "appointments.manageOwn"]);

  const [data, options] = await Promise.all([
    getCalendarData(user, {
      view: vedere === "saptamana" ? "saptamana" : "zi",
      dateISO: zi,
      columnsMode: coloane,
      doctorId: one(sp.medic) || null,
      scope,
      now,
    }),
    canCreate ? getAppointmentFormOptions(user) : Promise.resolve(null),
  ]);
  const active = data.appointments.filter((a) => a.status !== "ANULAT").length;
  const clinica = isClinicScope(clinicaParam) && clinicaParam === scope ? clinicaParam : null;
  const multiClinic = scope === "ambele";
  const nowISO = now.toISOString();

  return (
    <div className="flex flex-col gap-4">
      <CalendarToolbar
        view={vedere}
        dateISO={zi}
        todayISO={data.todayISO}
        title={data.title}
        columnsMode={data.columnsMode}
        doctors={data.doctors}
        selectedDoctorId={data.selectedDoctorId}
        clinica={clinica}
        scopeLabel={data.scopeLabel}
        canCreate={canCreate}
        summary={pluralRo(active, "programare", "programări")}
      />
      {vedere === "lista" ? (
        <section aria-label="Programările zilei" className="rounded-panou border border-linie bg-suprafata px-4">
          <TodayList
            appointments={data.appointments}
            nowISO={nowISO}
            withLocation={multiClinic}
            empty="Nicio programare în această zi. Alegeți altă zi sau creați o programare."
          />
        </section>
      ) : vedere === "saptamana" ? (
        <CalendarWeek data={data} options={options} nowISO={nowISO} clinica={clinica} multiClinic={multiClinic} />
      ) : (
        <CalendarGrid data={data} options={options} nowISO={nowISO} clinica={clinica} multiClinic={multiClinic} />
      )}
    </div>
  );
}
