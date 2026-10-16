import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/crm/billing/InvoiceForm";
import { Breadcrumbs, Button, ButtonLink, EmptyState, PageHeader, Panel, SearchField } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { scopeLocationIds } from "@/lib/clinic-scope";
import { zId } from "@/lib/validation/common";
import { getInvoiceFormData, searchBillingPatients } from "@/server/billing/patients";

export const metadata: Metadata = { title: "Factură nouă" };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Factură nouă: first the patient (`?pacient=<id>`, or a search), then the lines from the plan,
 * finished appointments, the catalog or free text.
 */
export default async function NewInvoicePage({ searchParams }: PageProps<"/crm/facturi/noua">) {
  await requirePermission("billing.create");
  const params = await searchParams;
  const patientParam = one(params.pacient);
  const breadcrumbs = <Breadcrumbs items={[{ label: "Facturi", href: "/crm/facturi" }, { label: "Factură nouă" }]} />;

  if (!patientParam) {
    const q = one(params.q)?.trim().slice(0, 80) ?? "";
    const hits = q ? await searchBillingPatients(q) : [];
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <PageHeader before={breadcrumbs} title="Factură nouă" subtitle="Alegeți pacientul. Factura preia datele lui și lucrările nefacturate." />
        <form method="get" action="/crm/facturi/noua" className="flex flex-wrap items-end gap-3">
          <SearchField label="Pacient" name="q" defaultValue={q} placeholder="Nume, telefon sau nr. fișă" className="w-full sm:w-80" autoFocus />
          <Button type="submit" variant="secondary" icon="search">
            Căutați
          </Button>
        </form>
        {q && hits.length === 0 && (
          <EmptyState title={`Niciun pacient pentru „${q}”. Verificați numele sau căutați după telefon.`} />
        )}
        {hits.length > 0 && (
          <ul className="flex flex-col divide-y divide-linie border-y border-linie" aria-label="Pacienți găsiți">
            {hits.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-corp font-semibold">{p.name}</p>
                  <p className="text-mic text-discret cifre">
                    Fișa nr. {p.fileNumber}
                    {p.phone ? `, ${p.phone}` : ""}
                  </p>
                </div>
                {p.anonymized ? (
                  <span className="text-mic text-discret">Anonimizat</span>
                ) : (
                  <ButtonLink href={`/crm/facturi/noua?pacient=${p.id}`} variant="secondary" size="s">
                    Facturați
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!zId.safeParse(patientParam).success) notFound();
  const data = await getInvoiceFormData(patientParam, await scopeLocationIds());
  if (!data) notFound();

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageHeader
        before={breadcrumbs}
        title="Factură nouă"
        subtitle={
          <>
            Pentru{" "}
            <Link href={`/crm/pacienti/${data.patient.id}/incasari`} className="font-semibold text-cerneala underline underline-offset-2">
              {data.patient.name}
            </Link>
            , fișa nr. {data.patient.fileNumber}.{" "}
            <Link href="/crm/facturi/noua" className="underline underline-offset-2">
              Alt pacient
            </Link>
          </>
        }
      />
      {data.patient.anonymized ? (
        <Panel>
          <p className="text-corp">Pacientul a fost anonimizat; nu se mai emit facturi noi pe numele lui.</p>
        </Panel>
      ) : (
        <InvoiceForm
          patient={data.patient}
          locations={data.locations}
          defaultLocationId={data.defaultLocationId}
          doctors={data.doctors}
          services={data.services}
          candidates={data.candidates}
          vatRate={data.vatRate}
          vatNote={data.vatNote}
        />
      )}
    </div>
  );
}
