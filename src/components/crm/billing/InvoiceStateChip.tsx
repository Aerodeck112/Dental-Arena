import type { EInvoiceStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import { EINVOICE_STATUS_LABEL } from "@/lib/labels";
import { Icon, type IconName } from "@/components/ui/Icon";
import { INVOICE_PAYMENT_STATE_LABEL } from "@/server/billing/totals";
import type { InvoicePaymentState } from "@/server/billing/types";

/**
 * Payment state of an invoice as a pill with icon and word (never colour alone). The edge carries
 * the meaning in greyscale too: dashed = still open, bar = partly paid, filled = paid, struck = cancelled.
 */
const STATE: Record<InvoicePaymentState, { icon: IconName; className: string }> = {
  NEPLATITA: { icon: "clock", className: "border-[1.5px] border-dashed border-discret bg-suprafata text-cerneala" },
  PARTIAL: { icon: "wallet", className: "border-[1.5px] border-actiune bg-suprafata text-cerneala" },
  PLATITA: { icon: "check-check", className: "border-[1.5px] border-actiune bg-menta-pal text-cerneala" },
  ANULATA: { icon: "circle-slash", className: "border border-dashed border-linie-control bg-transparent text-discret line-through" },
};

export function InvoiceStateChip({ state, className }: { state: InvoicePaymentState; className?: string }) {
  const s = STATE[state];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-chip px-2 text-micro font-semibold whitespace-nowrap",
        s.className,
        className,
      )}
    >
      <Icon name={s.icon} size={13} strokeWidth={2} aria-hidden />
      {INVOICE_PAYMENT_STATE_LABEL[state]}
    </span>
  );
}

const EINVOICE_ICON: Record<EInvoiceStatus, IconName> = {
  NETRANSMISA: "minus",
  IN_ASTEPTARE: "clock",
  TRANSMISA: "check",
  RESPINSA: "alert-triangle",
};

/** e-Factura status as plain text with an icon (it is information, not a work state). */
export function EInvoiceStatusText({ status, className }: { status: EInvoiceStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-discret", status === "RESPINSA" && "text-carmin", className)}>
      <Icon name={EINVOICE_ICON[status]} size={13} aria-hidden />
      {EINVOICE_STATUS_LABEL[status]}
    </span>
  );
}
