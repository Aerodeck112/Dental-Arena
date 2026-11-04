import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BalanceSummary } from "@/components/crm/billing/BalanceSummary";
import { EInvoiceStatusText, InvoiceStateChip } from "@/components/crm/billing/InvoiceStateChip";
import { PaymentFormDialog } from "@/components/crm/billing/PaymentForm";
import { PaymentList } from "@/components/crm/billing/PaymentList";
import { ButtonLink, DataTable, EmptyState, Panel } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/DataTable";
import { requirePermission } from "@/lib/auth/dal";
import { getAllowedLocations } from "@/lib/clinic-scope";
import { formatDateRo, formatLei } from "@/lib/format";
import { can } from "@/lib/permissions";
import { todayISO } from "@/lib/time";
import { zId } from "@/lib/validation/common";
import { getPatientBalance } from "@/server/billing/balance";
import { listPatientInvoices } from "@/server/billing/invoices";
import { getBillingPatient, listOpenInvoices } from "@/server/billing/patients";
import { listPatientPayments } from "@/server/billing/payments";
import type { InvoiceListRow } from "@/server/billing/types";

export const metadata: Metadata = { title: "Încasări pacient" };

/**
 * Fișa pacientului, tab „Încasări”: the balance, the patient's invoices and payments (cancelled
 * ones included), „Factură nouă” and „Încasați”. The patient header and tabs come from the
 * patient-file layout.
 */
export default async function PatientBillingPage({ params }: PageProps<"/crm/pacienti/[id]/incasari">) {
  const user = await requirePermission("billing.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const patient = await getBillingPatient(id);
  if (!patient) notFound();
  const [balance, invoices, payments, openInvoices, locations] = await Promise.all([
    getPatientBalance(id),
    listPatientInvoices(id),
    listPatientPayments(id),
    listOpenInvoices(id),
    getAllowedLocations(),
  ]);
  const canCreate = can(user, "billing.create") && !patient.anonymized;

  const columns: DataTableColumn<InvoiceListRow>[] = [
    {
      key: "number",
      header: "Număr",
      className: "font-semibold whitespace-nowrap",
      render: (r) => r.number,
    },
    { key: "issuedAt", header: "Data", render: (r) => formatDateRo(r.issuedAt, "short") },
    { key: "location", header: "Clinica", render: (r) => r.locationName },
    { key: "total", header: "Total", align: "right", render: (r) => <span className="whitespace-nowrap">{formatLei(r.total)}</span> },
    {
      key: "open",
      header: "Rest de plată",
      align: "right",
      render: (r) => <span className="whitespace-nowrap">{r.status === "ANULATA" ? "–" : formatLei(Math.max(0, r.total - r.amountPaid))}</span>,
    },
    { key: "state", header: "Stare", render: (r) => <InvoiceStateChip state={r.paymentState} /> },
    { key: "einvoice", header: "e-Factura", render: (r) => <EInvoiceStatusText status={r.eInvoiceStatus} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Sold"
        actions={
          canCreate && (
            <>
              <ButtonLink href={`/crm/facturi/noua?pacient=${patient.id}`} variant="secondary" icon="receipt">
                Factură nouă
              </ButtonLink>
              <PaymentFormDialog
                patientId={patient.id}
                invoices={openInvoices}
                locations={locations.map((l) => ({ id: l.id, shortName: l.shortName }))}
                defaultLocationId={patient.preferredLocationId}
                today={todayISO()}
              />
            </>
          )
        }
      >
        <BalanceSummary balance={balance} />
      </Panel>

      <Panel title="Facturi">
        <DataTable
          caption={`Facturile lui ${patient.name}`}
          columns={columns}
          rows={invoices}
          rowKey={(r) => r.id}
          rowHref={(r) => `/crm/facturi/${r.id}`}
          empty={
            <EmptyState
              title="Nicio factură pentru acest pacient. Facturați lucrările acceptate sau efectuate din plan."
              action={
                canCreate ? (
                  <ButtonLink href={`/crm/facturi/noua?pacient=${patient.id}`} icon="plus">
                    Factură nouă
                  </ButtonLink>
                ) : undefined
              }
            />
          }
        />
      </Panel>

      <Panel title="Plăți">
        <PaymentList
          rows={payments}
          caption={`Plățile lui ${patient.name}`}
          showPatient={false}
          canCancel={can(user, "billing.cancel")}
          empty={<p className="text-corp text-discret">Nicio plată înregistrată. Plățile în avans apar aici, „În cont”.</p>}
        />
      </Panel>
    </div>
  );
}
