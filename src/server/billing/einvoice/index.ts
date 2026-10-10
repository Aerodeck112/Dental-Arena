import "server-only";
import { env } from "@/lib/env";
import { noneEInvoiceProvider } from "./none";
import type { EInvoiceProvider } from "./types";

export type { EInvoiceProvider, EInvoiceResult, InvoiceForEInvoice } from "./types";

const PROVIDERS: Record<string, EInvoiceProvider> = {
  none: noneEInvoiceProvider,
};

/** Provider selected by `EINVOICE_PROVIDER`; unknown names fall back to "none" (never transmits by accident). */
export function getEInvoiceProvider(): EInvoiceProvider {
  return PROVIDERS[env.EINVOICE_PROVIDER] ?? noneEInvoiceProvider;
}
