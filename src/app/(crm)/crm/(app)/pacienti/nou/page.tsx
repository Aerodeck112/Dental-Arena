import type { Metadata } from "next";
import { PatientForm } from "@/components/crm/patients/PatientForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { requirePermission } from "@/lib/auth/dal";
import { getPatientFormOptions } from "@/server/patients/service";

export const metadata: Metadata = { title: "Pacient nou" };

/** „Pacient nou” with the duplicate warning (same phone, same CNP, or same name and birth date). */
export default async function NewPatientPage() {
  const user = await requirePermission("patients.create");
  const options = await getPatientFormOptions();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ href: "/crm/pacienti", label: "Pacienți" }, { label: "Pacient nou" }]} />}
        title="Pacient nou"
        subtitle="Completați ce știți acum; restul se poate adăuga oricând în fișă."
      />
      <Panel className="max-w-4xl">
        <PatientForm mode="create" locations={options.locations} doctors={options.doctors} defaultLocationId={user.homeLocationId} />
      </Panel>
    </div>
  );
}
