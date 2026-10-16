import type { Metadata } from "next";
import { DoctorProfileForm } from "@/components/crm/admin/DoctorProfileForm";
import { UserForm } from "@/components/crm/admin/UserForm";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveLocations } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { listUnlinkedDoctors } from "@/server/staff/service";

export const metadata: Metadata = { title: "Utilizator nou" };

/** New staff account (`?tip=medic` = a public doctor profile without a login). ADMIN only. */
export default async function NewStaffPage({ searchParams }: PageProps<"/crm/echipa/nou">) {
  await requirePermission("staff.manage");
  const sp = await searchParams;
  const doctorOnly = sp.tip === "medic";
  const [locations, unlinked, categories] = await Promise.all([
    getActiveLocations(),
    listUnlinkedDoctors(),
    prisma.serviceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const title = doctorOnly ? "Profil de medic nou" : "Utilizator nou";

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ label: "Echipă", href: "/crm/echipa" }, { label: title }]} />}
        title={title}
        subtitle={
          doctorOnly
            ? "Un medic care apare pe site și în calendar, fără cont în aplicație. Contul se poate lega mai târziu."
            : "Contul primește o parolă inițială, pe care utilizatorul o schimbă la prima intrare."
        }
      />
      <Panel>
        {doctorOnly ? (
          <DoctorProfileForm categories={categories} />
        ) : (
          <UserForm locations={locations.map((l) => ({ id: l.id, shortName: l.shortName }))} unlinkedDoctors={unlinked} />
        )}
      </Panel>
    </div>
  );
}
