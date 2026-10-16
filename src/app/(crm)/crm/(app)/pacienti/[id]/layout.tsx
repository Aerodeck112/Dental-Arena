import { notFound } from "next/navigation";
import { PatientHeader } from "@/components/crm/patients/PatientHeader";
import { PatientTabs } from "@/components/crm/patients/PatientTabs";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { TabItem } from "@/components/ui/Tabs";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getPatientBalance } from "@/server/billing/balance";
import { getPatientFlags } from "@/server/patients/flags";
import { getPatientHeader, recordPatientView } from "@/server/patients/service";

/**
 * „Fișa pacientului” (docs/architecture.md §4.2, WP7): header with flags, comfort note and balance,
 * then the tabs. Every tab page checks its own permission again (§8.5). Opening the file writes
 * the `patient.view` audit at most once per user, patient and hour.
 */
export default async function PatientFileLayout({ children, params }: LayoutProps<"/crm/pacienti/[id]">) {
  const user = await requirePermission("patients.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const patient = await getPatientHeader(id);
  if (!patient) notFound();

  const showBalance = can(user, "billing.view");
  const [flags, balance] = await Promise.all([
    getPatientFlags(id),
    showBalance ? getPatientBalance(id) : Promise.resolve(null),
    recordPatientView(user, id),
  ]);

  const base = `/crm/pacienti/${id}`;
  const tabs: (TabItem & { show: boolean })[] = [
    { href: base, label: "Prezentare", show: true },
    { href: `${base}/date`, label: "Date personale", show: true },
    { href: `${base}/anamneza`, label: "Anamneză", show: can(user, "medical.view") },
    { href: `${base}/odontograma`, label: "Odontogramă", show: can(user, "medical.view") },
    { href: `${base}/planuri`, label: "Planuri de tratament", show: can(user, "plans.view") },
    { href: `${base}/programari`, label: "Programări", show: can(user, "appointments.view") },
    { href: `${base}/incasari`, label: "Încasări", show: can(user, "billing.view") },
    { href: `${base}/documente`, label: "Documente", show: can(user, "documents.view") },
    { href: `${base}/consimtaminte`, label: "Consimțăminte", show: true },
    { href: `${base}/note`, label: "Note", show: true },
    { href: `${base}/gdpr`, label: "GDPR", show: can(user, "gdpr.manage") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5" data-print="ascuns">
      <Breadcrumbs items={[{ href: "/crm/pacienti", label: "Pacienți" }, { label: patient.name }]} />
      <PatientHeader
        patient={patient}
        flags={flags}
        balance={balance}
        can={{
          book: can(user, ["appointments.manage", "appointments.manageOwn"]),
          message: can(user, "messages.send"),
          bill: can(user, "billing.create"),
        }}
      />
      <PatientTabs items={tabs.filter((t) => t.show).map(({ href, label }) => ({ href, label }))} />
      </div>
      <div>{children}</div>
    </div>
  );
}
