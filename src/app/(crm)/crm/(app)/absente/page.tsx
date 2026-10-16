import type { Metadata } from "next";
import Link from "next/link";
import { TimeOffForm } from "@/components/crm/schedule/TimeOffForm";
import { TimeOffList } from "@/components/crm/schedule/TimeOffList";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Toaster } from "@/components/ui/Toast";
import { requirePermission } from "@/lib/auth/dal";
import { getClinicScope, scopeLocationIds } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { todayISO } from "@/lib/time";
import { listTimeOff } from "@/server/scheduling/schedules";

export const metadata: Metadata = { title: "Absențe" };

function first(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

/**
 * `/crm/absente` (docs/architecture.md §4.2): time off and clinic closures. Everybody with
 * `schedules.view` reads the list; ADMIN and RECEPTIE add time off for anyone and close a clinic,
 * a MEDIC adds and removes only their own.
 */
export default async function TimeOffPage({ searchParams }: PageProps<"/crm/absente">) {
  const user = await requirePermission("schedules.view");
  const sp = await searchParams;
  const medic = first(sp.medic);
  const scope = await getClinicScope();
  const scoped = scope === "ambele" ? null : ((await scopeLocationIds(scope))[0] ?? null);

  const [doctors, locations] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }], select: { id: true, publicName: true } }),
    prisma.location.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, shortName: true } }),
  ]);
  const filterDoctor = medic && doctors.some((d) => d.id === medic) ? medic : null;
  const items = await listTimeOff(user, { doctorId: filterDoctor, locationId: scoped });

  const manageAll = can(user, "timeoff.manage");
  const own = user.role === "MEDIC" && user.doctorId ? (doctors.find((d) => d.id === user.doctorId) ?? null) : null;
  const canAdd = manageAll || !!own;
  const filterName = filterDoctor ? doctors.find((d) => d.id === filterDoctor)?.publicName : null;

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <Toaster />
      <PageHeader
        title="Absențe"
        subtitle={
          manageAll
            ? "Concedii, cursuri, intervale blocate și zilele în care o clinică este închisă. Orele dispar imediat din programarea online."
            : "Concediile și zilele libere ale echipei. Puteți adăuga absențe doar pentru dumneavoastră."
        }
      />
      {canAdd && (
        <Panel title="Absență nouă">
          <TimeOffForm
            doctors={doctors.map((d) => ({ id: d.id, name: d.publicName }))}
            locations={locations}
            fixedDoctor={manageAll ? null : own ? { id: own.id, name: own.publicName } : null}
            defaultDoctorId={filterDoctor}
            today={todayISO()}
          />
        </Panel>
      )}
      <Panel
        title={filterName ? `Absențe programate, ${filterName}` : "Absențe programate"}
        actions={
          filterName ? (
            <Link href="/crm/absente" className="text-mic text-link underline underline-offset-4">
              Toată echipa
            </Link>
          ) : null
        }
      >
        <TimeOffList items={items} />
      </Panel>
    </div>
  );
}
