import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { cn } from "@/lib/cn";
import { formatDateRo, formatLei, formatTime } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import type { PaymentRow } from "@/server/billing/types";
import { cancelPaymentAction } from "@/app/(crm)/crm/(app)/incasari/actions";
import { CancelDialog } from "./CancelDialog";

/**
 * Payments as a table (journal, invoice, patient tab). Cancelled payments stay listed, struck
 * through, with the reason; only ADMIN sees „Anulați”.
 */
export function PaymentList({
  rows,
  caption,
  showPatient = true,
  showInvoice = true,
  canCancel = false,
  empty,
}: {
  rows: PaymentRow[];
  caption: string;
  showPatient?: boolean;
  showInvoice?: boolean;
  canCancel?: boolean;
  empty?: React.ReactNode;
}) {
  const columns: DataTableColumn<PaymentRow>[] = [
    {
      key: "paidAt",
      header: "Data",
      render: (r) => (
        <span className="whitespace-nowrap">
          {formatDateRo(r.paidAt, "short")} <span className="text-discret">{formatTime(new Date(r.paidAt))}</span>
        </span>
      ),
    },
    ...(showPatient
      ? [
          {
            key: "patient",
            header: "Pacient",
            render: (r: PaymentRow) => (
              <Link href={`/crm/pacienti/${r.patientId}/incasari`} className="font-semibold underline-offset-2 hover:underline">
                {r.patientName}
              </Link>
            ),
          },
        ]
      : []),
    ...(showInvoice
      ? [
          {
            key: "invoice",
            header: "Factura",
            render: (r: PaymentRow) =>
              r.invoiceId && r.invoiceNumber ? (
                <Link href={`/crm/facturi/${r.invoiceId}`} className="underline underline-offset-2">
                  {r.invoiceNumber}
                </Link>
              ) : (
                <span className="text-discret">În cont</span>
              ),
          },
        ]
      : []),
    { key: "location", header: "Clinica", render: (r) => r.locationName },
    { key: "method", header: "Metoda", render: (r) => PAYMENT_METHOD_LABEL[r.method] },
    {
      key: "doc",
      header: "Chitanță sau referință",
      render: (r) => r.receipt ?? r.reference ?? <span className="text-discret">–</span>,
    },
    {
      key: "amount",
      header: "Suma",
      align: "right",
      render: (r) => (
        <span className={cn("font-semibold whitespace-nowrap", r.cancelled && "font-normal text-discret line-through")}>
          {formatLei(r.amount)}
        </span>
      ),
    },
    {
      key: "state",
      header: "Observații",
      render: (r) =>
        r.cancelled ? (
          <span className="text-discret">Anulată{r.cancelReason ? `: ${r.cancelReason}` : ""}</span>
        ) : (
          <span className="text-discret">{[r.receivedByName ? `Primită de ${r.receivedByName}` : null, r.notes].filter(Boolean).join(", ") || "–"}</span>
        ),
    },
    ...(canCancel
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Acțiuni</span>,
            align: "right" as const,
            render: (r: PaymentRow) =>
              r.cancelled ? null : (
                <span data-print="ascuns">
                  <CancelDialog
                    id={r.id}
                    action={cancelPaymentAction}
                    triggerLabel="Anulați"
                    triggerVariant="text"
                    triggerSize="s"
                    title="Anulați încasarea"
                    description={`${formatLei(r.amount)}, ${PAYMENT_METHOD_LABEL[r.method].toLowerCase()}, din ${formatDateRo(r.paidAt, "short")}. Încasarea rămâne în jurnal, tăiată, iar soldul pacientului crește.`}
                    confirmLabel="Anulați încasarea"
                  />
                </span>
              ),
          },
        ]
      : []),
  ];
  return <DataTable caption={caption} columns={columns} rows={rows} rowKey={(r) => r.id} empty={empty} />;
}
