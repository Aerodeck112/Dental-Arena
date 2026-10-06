import type { Metadata } from "next";
import { LeadBoard } from "@/components/crm/leads/LeadBoard";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveLocations, getClinicScope, scopeLocationIds } from "@/lib/clinic-scope";
import { pluralRo } from "@/lib/format";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, labelOptions } from "@/lib/labels";
import { can } from "@/lib/permissions";
import type { LeadSource, LeadStatus } from "@/generated/prisma/enums";
import { LEAD_STATUSES, listLeadAssignees, listLeads } from "@/server/leads/pipeline";

export const metadata: Metadata = { title: "Cereri online" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * `/crm/cereri?vedere=panou|lista&status=&sursa=&clinica=&responsabil=&q=` (WP6): the lead
 * pipeline. Filters are a plain GET form, so they work before hydration and stay in the URL.
 */
export default async function LeadsPage({ searchParams }: PageProps<"/crm/cereri">) {
  const user = await requirePermission("leads.view");
  const sp = await searchParams;
  const now = new Date();
  const view = one(sp.vedere) === "lista" ? "lista" : "panou";
  const statusParam = one(sp.status);
  const status = (LEAD_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as LeadStatus) : null;
  const sourceParam = one(sp.sursa);
  const source = sourceParam in LEAD_SOURCE_LABEL ? (sourceParam as LeadSource) : null;
  const [locations, assignees, scopeIds] = await Promise.all([getActiveLocations(), listLeadAssignees(), getClinicScope().then(scopeLocationIds)]);
  const clinicParam = one(sp.clinica);
  const clinic = locations.find((l) => l.id === clinicParam || l.slug === clinicParam) ?? null;
  const assignedParam = one(sp.responsabil);
  const assignedToId = assignedParam === "none" || assignees.some((a) => a.id === assignedParam) ? assignedParam : null;
  const q = one(sp.q).slice(0, 80);

  const leads = await listLeads({ status, source, locationIds: clinic ? [clinic.id] : scopeIds, assignedToId, q: q || undefined }, now);
  const open = leads.filter((l) => l.status === "NOU" || l.status === "CONTACTAT").length;
  const keep = (v: "panou" | "lista") => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) if (k !== "vedere" && typeof val === "string" && val) p.set(k, val);
    if (v === "lista") p.set("vedere", "lista");
    const s = p.toString();
    return s ? `/crm/cereri?${s}` : "/crm/cereri";
  };
  const filtered = Boolean(status || source || clinic || assignedToId || q);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cereri online"
        subtitle={`${pluralRo(open, "cerere deschisă", "cereri deschise")}${filtered ? " pentru filtrele alese" : ""}. Programat și Pierdut arată ultimele 30 de zile.`}
        actions={
          <SegmentedControl
            size="s"
            label="Afișare"
            value={view}
            options={[
              { value: "panou", label: "Panou", href: keep("panou") },
              { value: "lista", label: "Listă", href: keep("lista") },
            ]}
          />
        }
      />
      <form method="get" action="/crm/cereri" className="grid gap-3 rounded-panou border border-linie bg-suprafata p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
        {view === "lista" && <input type="hidden" name="vedere" value="lista" />}
        <TextField id="f-q" name="q" label="Nume sau telefon" defaultValue={q} autoComplete="off" />
        <Select id="f-status" name="status" label="Status" placeholder="Toate" defaultValue={status ?? ""} options={labelOptions(LEAD_STATUS_LABEL)} />
        <Select id="f-sursa" name="sursa" label="Sursa" placeholder="Toate" defaultValue={source ?? ""} options={labelOptions(LEAD_SOURCE_LABEL)} />
        <Select id="f-clinica" name="clinica" label="Clinica" placeholder="Din antet" defaultValue={clinic?.id ?? ""} options={locations.map((l) => ({ value: l.id, label: l.shortName }))} />
        <Select
          id="f-resp"
          name="responsabil"
          label="Se ocupă"
          placeholder="Oricine"
          defaultValue={assignedToId ?? ""}
          options={[{ value: "none", label: "Neatribuite" }, ...assignees.map((a) => ({ value: a.id, label: a.name }))]}
        />
        <Button type="submit" variant="secondary" icon="filter">
          Filtrați
        </Button>
      </form>
      <LeadBoard leads={leads} view={view} canManage={can(user, "leads.manage")} nowISO={now.toISOString()} />
    </div>
  );
}
