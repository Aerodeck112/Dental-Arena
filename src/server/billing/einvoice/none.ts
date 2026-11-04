import type { EInvoiceProvider } from "./types";

/**
 * The default provider: nothing is transmitted to ANAF. Every invoice stays „Netransmisă”.
 * Whether B2C medical invoices need e-Factura at all is an open item for the accountant (§12.3).
 */
export const noneEInvoiceProvider: EInvoiceProvider = {
  name: "none",
  canSubmit: false,
  async submit() {
    return { status: "NETRANSMISA" };
  },
  async status() {
    return { status: "NETRANSMISA" };
  },
};
