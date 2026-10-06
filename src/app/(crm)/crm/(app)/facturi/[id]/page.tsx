import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelDialog } from "@/components/crm/billing/CancelDialog";
import { InvoiceStateChip } from "@/components/crm/billing/InvoiceStateChip";
import { InvoiceView } from "@/components/crm/billing/InvoiceView";
import { PaymentFormDialog } from "@/components/crm/billing/PaymentForm";
import { Breadcrumbs, ButtonLink, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveLocations } from "@/lib/clinic-scope";
import { formatDateRo } from "@/lib/format";
import { can } from "@/lib/permissions";
import { todayISO } from "@/lib/time";
import { zId } from "@/lib/validation/common";
import { getEInvoiceProvider } from "@/server/billing/einvoice";
import { getInvoiceDetail, getSellerInfo } from "@/server/billing/invoices";
import { cancelInvoiceAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/crm/facturi/[id]">): Promise<Metadata> {
  const { id } = await params;
  const inv = zId.safeParse(id).success ? await getInvoiceDetail(id) : null;
  return { title: inv ? `Factura ${inv.number}` : "Factură" };
}

/** One invoice: the document, its payments, e-Factura status; print, collect, cancel (ADMIN). */
export default async function InvoicePage({ params, searchParams }: PageProps<"/crm/facturi/[id]">) {
  const user = await requirePermission("billing.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [invoice, seller, locations, sp] = await Promise.all([getInvoiceDetail(id), getSellerInfo(), getActiveLocations(), searchParams]);
  if (!invoice) notFound();
  const provider = getEInvoiceProvider();
  const canPay = can(user, "billing.create") && invoice.status === "EMISA" && invoice.openAmount > 0;
  const canCancel = can(user, "billing.cancel") && invoice.status === "EMISA";

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ label: "Facturi", href: "/crm/facturi" }, { label: invoice.number }]} />}
        title={`Factura ${invoice.number}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <InvoiceStateChip state={invoice.paymentState} />
            <span>
              Emisă pe {formatDateRo(invoice.issuedAt, "full")} pentru {invoice.patient.name}.
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/crm/facturi/${invoice.id}/tipar`} variant="secondary" icon="printer">
              Tipăriți
            </ButtonLink>
            {canCancel && (
              <CancelDialog
                id={invoice.id}
                action={cancelInvoiceAction}
                triggerLabel="Anulați factura"
                title={`Anulați factura ${invoice.number}`}
                description="Factura rămâne în evidență ca anulată, cu numărul ei. Plățile de pe ea trec în contul pacientului, ca avans."
                confirmLabel="Anulați factura"
              />
            )}
            {canPay && (
              <PaymentFormDialog
                patientId={invoice.patient.id}
                invoices={[{ id: invoice.id, number: invoice.number, open: invoice.openAmount, locationId: invoice.location.id }]}
                defaultInvoiceId={invoice.id}
                locations={locations.map((l) => ({ id: l.id, shortName: l.shortName }))}
                defaultLocationId={invoice.location.id}
                today={todayISO()}
              />
            )}
          </>
        }
      />
      <InvoiceView
        invoice={invoice}
        seller={seller}
        eInvoice={{ providerName: provider.name, canSubmit: provider.canSubmit }}
        canCancelPayments={can(user, "billing.cancel")}
        justIssued={sp.emisa === "1"}
        canEditSettings={can(user, "settings.manage")}
      />
    </div>
  );
}
