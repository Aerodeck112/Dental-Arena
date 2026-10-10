import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoicePrint } from "@/components/crm/billing/InvoicePrint";
import { PrintButton } from "@/components/crm/billing/PrintButton";
import { ButtonLink } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { zId } from "@/lib/validation/common";
import { getInvoiceDetail, getSellerInfo } from "@/server/billing/invoices";

export async function generateMetadata({ params }: PageProps<"/crm/facturi/[id]/tipar">): Promise<Metadata> {
  const { id } = await params;
  const inv = zId.safeParse(id).success ? await getInvoiceDetail(id) : null;
  return { title: inv ? `Factura ${inv.number}, tipar` : "Factură" };
}

/** A4 print of an invoice: light palette, no CRM chrome, placeholders flagged. */
export default async function InvoicePrintPage({ params }: PageProps<"/crm/facturi/[id]/tipar">) {
  await requirePermission("billing.view");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const [invoice, seller] = await Promise.all([getInvoiceDetail(id), getSellerInfo()]);
  if (!invoice) notFound();
  return (
    <InvoicePrint
      invoice={invoice}
      seller={seller}
      toolbar={
        <>
          <ButtonLink href={`/crm/facturi/${invoice.id}`} variant="text" icon="chevron-left">
            Înapoi la factură
          </ButtonLink>
          <PrintButton />
          <p className="text-mic text-discret">Se tipărește pe A4, fără meniul aplicației.</p>
        </>
      }
    />
  );
}
