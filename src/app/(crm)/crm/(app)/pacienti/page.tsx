import type { Metadata } from "next";
import { PatientList } from "@/components/crm/patients/PatientList";
import { PatientSearchBox } from "@/components/crm/patients/PatientSearchBox";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { requirePermission } from "@/lib/auth/dal";
import { pluralRo } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPatientFlagsBulk } from "@/server/patients/flags";
import { listPatients } from "@/server/patients/service";
import { listTags } from "@/server/patients/tags";

export const metadata: Metadata = { title: "Pacienți" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** `/crm/pacienti?q=&eticheta=&pagina=`: search and list, 25 per page (WP7). */
export default async function PatientsPage({ searchParams }: PageProps<"/crm/pacienti">) {
  const user = await requirePermission("patients.view");
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 80);
  const tagParam = one(sp.eticheta);
  const page = Number(one(sp.pagina)) || 1;
  const tags = await listTags();
  const tagId = tags.some((t) => t.id === tagParam) ? tagParam : "";
  const result = await listPatients({ q, tagId: tagId || null, page });
  const flags = await getPatientFlagsBulk(result.rows.map((r) => r.id));
  const canCreate = can(user, "patients.create");
  const filtered = Boolean(q || tagId);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pacienți"
        subtitle={filtered ? `${pluralRo(result.total, "rezultat", "rezultate")} pentru căutarea dumneavoastră.` : `${pluralRo(result.total, "fișă", "fișe")} în total.`}
        actions={
          canCreate && (
            <ButtonLink href="/crm/pacienti/nou" icon="plus">
              Pacient nou
            </ButtonLink>
          )
        }
      />
      <PatientSearchBox q={q} tagId={tagId} tags={tags} />
      <PatientList
        rows={result.rows}
        flags={flags}
        caption={filtered ? "Pacienții găsiți, ordonați după nume" : "Pacienți, ordonați după nume"}
        empty={
          <EmptyState
            title={
              filtered
                ? "Niciun pacient nu corespunde căutării. Verificați numele sau telefonul, ori creați o fișă nouă."
                : "Nicio fișă încă. Pacienții apar aici după prima programare sau când îi adăugați."
            }
            action={
              canCreate ? (
                <ButtonLink href="/crm/pacienti/nou" icon="plus">
                  Pacient nou
                </ButtonLink>
              ) : undefined
            }
          />
        }
      />
      {result.pageCount > 1 && <Pagination page={result.page} pageCount={result.pageCount} baseHref="/crm/pacienti" searchParams={sp} />}
    </div>
  );
}
