import type { Metadata } from "next";
import { EInvoiceStatusText, InvoiceStateChip } from "@/components/crm/billing/InvoiceStateChip";
import { Button, ButtonLink, DataTable, DateInput, EmptyState, PageHeader, Pagination, SearchField, Select } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/DataTable";
import { requirePermission } from "@/lib/auth/dal";
import { getClinicScope, scopeLocationIds } from "@/lib/clinic-scope";
import { formatDateRo, formatLei, pluralRo } from "@/lib/format";
import { CLINIC_SCOPE_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { isValidDateISO, localDayRangeUtc } from "@/lib/time";
import { listInvoices } from "@/server/billing/invoices";
import type { InvoiceListRow } from "@/server/billing/types";

export const metadata: Metadata = { title: "Facturi" };

const STATUS_OPTIONS = [
  { value: "", label: "Toate" },
  { value: "neplatite", label: "Cu rest de plată" },
  { value: "emise", label: "Emise" },
  { value: "anulate", label: "Anulate" },
];

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Facturi: every invoice in the clinic scope, with search by number or patient, status and period. */
export default async function InvoicesPage({ searchParams }: PageProps<"/crm/facturi">) {
  const user = await requirePermission("billing.view");
  const params = await searchParams;
  const q = one(params.q)?.trim().slice(0, 80) ?? "";
  const stare = one(params.stare) ?? "";
  const de = one(params.de);
  const pana = one(params.pana);
  const page = Math.max(1, Number(one(params.pagina)) || 1);
  const [scope, locationIds] = await Promise.all([getClinicScope(), scopeLocationIds()]);
  const status = stare === "neplatite" ? "NEPLATITE" : stare === "emise" ? "EMISA" : stare === "anulate" ? "ANULATA" : undefined;
  const from = de && isValidDateISO(de) ? localDayRangeUtc(de).start : undefined;
  const to = pana && isValidDateISO(pana) ? localDayRangeUtc(pana).end : undefined;
  const { rows, count, pageSize, sums } = await listInvoices({ locationIds, status, q, from, to, page });
  const filtered = Boolean(q || stare || de || pana);
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  const columns: DataTableColumn<InvoiceListRow>[] = [
    {
      key: "number",
      header: "Număr",
      className: "font-semibold whitespace-nowrap",
      render: (r) => r.number,
    },
    { key: "issuedAt", header: "Data", render: (r) => formatDateRo(r.issuedAt, "short") },
    { key: "patient", header: "Pacient", render: (r) => r.patientName },
    { key: "location", header: "Clinica", render: (r) => r.locationName },
    { key: "total", header: "Total", align: "right", render: (r) => <span className="whitespace-nowrap">{formatLei(r.total)}</span> },
    {
      key: "paid",
      header: "Achitat",
      align: "right",
      render: (r) => <span className="whitespace-nowrap">{r.status === "ANULATA" ? "–" : formatLei(r.amountPaid)}</span>,
    },
    { key: "state", header: "Stare", render: (r) => <InvoiceStateChip state={r.paymentState} /> },
    { key: "einvoice", header: "e-Factura", render: (r) => <EInvoiceStatusText status={r.eInvoiceStatus} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Facturi"
        subtitle={
          count === 0
            ? `Facturile emise în ${scope === "ambele" ? "ambele clinici" : CLINIC_SCOPE_LABEL[scope]}.`
            : `${pluralRo(count, "factură", "facturi")}${filtered ? " pentru filtrele alese" : ""} în ${scope === "ambele" ? "ambele clinici" : CLINIC_SCOPE_LABEL[scope]}: total ${formatLei(sums.total)}, încasat ${formatLei(sums.amountPaid)}, rest de plată ${formatLei(sums.open)}.`
        }
        actions={
          can(user, "billing.create") && (
            <ButtonLink href="/crm/facturi/noua" icon="plus">
              Factură nouă
            </ButtonLink>
          )
        }
      />
      <form method="get" action="/crm/facturi" aria-label="Filtre" className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-linie pb-4">
        <SearchField label="Căutați" name="q" defaultValue={q} placeholder="Număr sau pacient" className="w-full sm:w-64" />
        <Select label="Stare" name="stare" defaultValue={stare} options={STATUS_OPTIONS} className="w-44" />
        <DateInput label="De la" name="de" defaultValue={de ?? ""} className="w-40" />
        <DateInput label="Până la" name="pana" defaultValue={pana ?? ""} className="w-40" />
        <Button type="submit" variant="secondary" icon="filter">
          Aplicați filtrele
        </Button>
        {filtered && (
          <ButtonLink href="/crm/facturi" variant="text">
            Ștergeți filtrele
          </ButtonLink>
        )}
      </form>
      <DataTable
        caption="Facturi"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/crm/facturi/${r.id}`}
        empty={
          <EmptyState
            title={
              filtered
                ? "Nicio factură pentru filtrele alese. Schimbați perioada sau ștergeți filtrele."
                : "Nicio factură încă. Emiteți prima factură din fișa unui pacient sau de aici."
            }
            action={
              filtered ? (
                <ButtonLink href="/crm/facturi" variant="secondary">
                  Ștergeți filtrele
                </ButtonLink>
              ) : can(user, "billing.create") ? (
                <ButtonLink href="/crm/facturi/noua" icon="plus">
                  Factură nouă
                </ButtonLink>
              ) : undefined
            }
          />
        }
      />
      <Pagination page={page} pageCount={pageCount} baseHref="/crm/facturi" searchParams={params} />
    </div>
  );
}
