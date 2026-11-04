import type { Metadata } from "next";
import { RecallList } from "@/components/crm/recalls/RecallList";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { requirePermission } from "@/lib/auth/dal";
import { getClinicScope, scopeLocationIds } from "@/lib/clinic-scope";
import { pluralRo } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listRecalls, type RecallView } from "@/server/recalls/service";

export const metadata: Metadata = { title: "De rechemat" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const EMPTY: Record<RecallView, string> = {
  "de-facut": "Nicio rechemare în următoarele 30 de zile. Rechemările apar după vizitele finalizate cu control periodic.",
  toate: "Nicio rechemare încă.",
  inchise: "Nicio rechemare închisă.",
};

/** `/crm/rechemari?vedere=de-facut|toate|inchise` (WP6): the „De rechemat” queue. MEDIC: own, read-only. */
export default async function RecallsPage({ searchParams }: PageProps<"/crm/rechemari">) {
  const user = await requirePermission("recalls.view");
  const sp = await searchParams;
  const v = one(sp.vedere);
  const view: RecallView = v === "toate" || v === "inchise" ? v : "de-facut";
  const locationIds = await scopeLocationIds(await getClinicScope());
  const rows = await listRecalls(user, { view, locationIds });
  const overdue = rows.filter((r) => (r.status === "DE_FACUT" || r.status === "CONTACTAT") && r.dueInDays < 0).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="De rechemat"
        subtitle={
          view === "de-facut"
            ? `${pluralRo(rows.length, "pacient", "pacienți")} de sunat în următoarele 30 de zile${overdue > 0 ? `, ${overdue} cu termenul depășit` : ""}.`
            : pluralRo(rows.length, "rechemare", "rechemări")
        }
        actions={
          <SegmentedControl
            size="s"
            label="Rechemări"
            value={view}
            options={[
              { value: "de-facut", label: "De făcut", href: "/crm/rechemari" },
              { value: "toate", label: "Toate", href: "/crm/rechemari?vedere=toate" },
              { value: "inchise", label: "Închise", href: "/crm/rechemari?vedere=inchise" },
            ]}
          />
        }
      />
      <RecallList rows={rows} canManage={can(user, "recalls.manage")} empty={EMPTY[view]} />
    </div>
  );
}
