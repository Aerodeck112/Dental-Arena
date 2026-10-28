import type { Metadata } from "next";
import { DataRequestForm, DataRequestTable } from "@/components/crm/patients/DataRequestTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { requirePermission } from "@/lib/auth/dal";
import { pluralRo } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { listDataRequests } from "@/server/patients/gdpr";

export const metadata: Metadata = { title: "GDPR" };

/** `/crm/gdpr`: the register of data-subject requests, with 30-day due dates (ADMIN). */
export default async function GdprRegisterPage({ searchParams }: PageProps<"/crm/gdpr">) {
  const user = await requirePermission("gdpr.manage");
  const sp = await searchParams;
  const status = sp.stare === "toate" ? "toate" : "deschise";
  const rows = await listDataRequests(user, { status });
  const overdue = rows.filter((r) => r.overdue).length;
  const open = rows.filter((r) => r.status === "PRIMITA" || r.status === "IN_LUCRU").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cereri GDPR"
        subtitle={
          open === 0
            ? "Nicio cerere deschisă."
            : `${pluralRo(open, "cerere deschisă", "cereri deschise")}${overdue > 0 ? `, din care ${pluralRo(overdue, "cu termenul depășit", "cu termenul depășit")}` : ""}.`
        }
        actions={<DataRequestForm today={todayISO()} />}
      />
      <form method="get" className="flex">
        <SegmentedControl
          label="Ce cereri arătăm"
          name="stare"
          value={status}
          submitOnChange
          options={[
            { value: "deschise", label: "Deschise" },
            { value: "toate", label: "Toate" },
          ]}
        />
      </form>
      <DataRequestTable rows={rows} />
    </div>
  );
}
