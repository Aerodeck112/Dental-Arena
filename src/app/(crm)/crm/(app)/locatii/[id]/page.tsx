import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabinetEditor } from "@/components/crm/admin/CabinetEditor";
import { HoursEditor } from "@/components/crm/admin/HoursEditor";
import { LocationForm } from "@/components/crm/admin/LocationForm";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getLocation } from "@/server/locations/service";

export const metadata: Metadata = { title: "Locație" };

/** One clinic: address and capacity, weekly opening hours (with the publish flag) and cabinets. */
export default async function LocationPage({ params }: PageProps<"/crm/locatii/[id]">) {
  const user = await requirePermission("locations.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const location = await getLocation(id);
  if (!location) notFound();
  const readOnly = !can(user, "locations.manage");

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ label: "Locații", href: "/crm/locatii" }, { label: location.shortName }]} />}
        title={location.name}
        subtitle={readOnly ? "Doar administratorul modifică datele clinicii." : "Modificările apar pe site după salvare."}
      />
      <Panel title="Date de contact și capacitate">
        <LocationForm location={location} readOnly={readOnly} />
      </Panel>
      <Panel title="Program de funcționare">
        <p className="mb-3 text-mic text-discret masura">
          {location.publishHours
            ? "Programul este publicat pe site."
            : "Programul nu apare pe site până nu bifați „Programul apare pe site” mai sus. Orele de lucru ale medicilor se stabilesc separat, în Program."}
        </p>
        <HoursEditor locationId={location.id} hours={location.hours} readOnly={readOnly} />
      </Panel>
      <Panel title="Cabinete">
        <CabinetEditor locationId={location.id} cabinets={location.cabinets} readOnly={readOnly} />
      </Panel>
    </div>
  );
}
