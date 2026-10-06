import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatDateRo, formatLei, formatPhone } from "@/lib/format";
import { EINVOICE_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { INVOICE_PAYMENT_STATE_LABEL } from "@/server/billing/totals";
import type { InvoiceDetail, SellerInfo } from "@/server/billing/types";

export const PLACEHOLDER = "[de completat]";

/** A legal field that still holds the „[de completat]” placeholder is flagged, on screen and on paper. */
export function LegalValue({ value, label }: { value: string | null | undefined; label: string }) {
  if (!value || value.trim() === "" || value.includes(PLACEHOLDER)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-bloc border border-dashed border-carmin px-1.5 text-carmin" data-placeholder="">
        <Icon name="alert-triangle" size={13} strokeWidth={2} />
        {label} de completat în Setări
      </span>
    );
  }
  return <>{value}</>;
}

/**
 * The invoice as a document: seller (legal data from settings), buyer, lines, totals, VAT note and
 * payments. Shared by the CRM view and the A4 print page so both always match.
 */
export function InvoiceDocument({ invoice, seller, className }: { invoice: InvoiceDetail; seller: SellerInfo; className?: string }) {
  const activePayments = invoice.payments.filter((p) => !p.cancelled);
  return (
    <article
      aria-label={`Factura ${invoice.number}`}
      className={cn("flex min-w-0 flex-col gap-6 rounded-panou border border-linie bg-suprafata p-5 text-corp text-cerneala sm:p-8 print:border-0 print:p-0", className)}
    >
      <header className="grid items-start gap-6 border-b border-linie pb-5 sm:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col items-start gap-3">
          <Logo variant="compact" className="h-10 w-auto" />
          <div className="flex flex-col gap-0.5 text-mic">
            <p className="font-semibold">
              <LegalValue value={seller.legalName} label="Denumirea legală" />
            </p>
            <p>
              CUI: <LegalValue value={seller.cui} label="CUI-ul" />
            </p>
            <p>
              Nr. Reg. Com.: <LegalValue value={seller.regCom} label="Nr. Reg. Com." />
            </p>
            <p>
              Sediul: <LegalValue value={seller.registeredAddress} label="Sediul social" />
            </p>
            <p>Punct de lucru: {invoice.location.name}, {invoice.location.address}, tel. {formatPhone(invoice.location.phone)}</p>
            {seller.iban && (
              <p>
                IBAN: {seller.iban}
                {seller.bank ? `, ${seller.bank}` : ""}
              </p>
            )}
            <p>{seller.email}</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right print:items-end print:text-right">
          <p className="text-h3 font-semibold">Factură</p>
          <p className="text-h3 font-semibold cifre">{invoice.number}</p>
          <p className="text-mic cifre">Data emiterii: {formatDateRo(invoice.issuedAt, "short")}</p>
          <p className="text-mic cifre">Scadența: {invoice.dueAt ? formatDateRo(invoice.dueAt, "short") : "la emitere"}</p>
          {invoice.status === "ANULATA" && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-bloc border border-dashed border-cerneala px-2 py-0.5 text-mic font-semibold">
              <Icon name="circle-slash" size={14} />
              Anulată
            </p>
          )}
        </div>
      </header>

      <section aria-labelledby={`cump-${invoice.id}`} className="flex flex-col gap-0.5 text-mic">
        <h2 id={`cump-${invoice.id}`} className="mb-1 text-corp font-semibold">
          Cumpărător
        </h2>
        {invoice.buyer.company ? (
          <>
            <p className="font-semibold">{invoice.buyer.company}</p>
            <p>CUI: {invoice.buyer.cui}</p>
            {invoice.buyer.regCom && <p>Nr. Reg. Com.: {invoice.buyer.regCom}</p>}
            <p>Pentru pacientul: {invoice.buyer.name}</p>
          </>
        ) : (
          <p className="font-semibold">{invoice.buyer.name}</p>
        )}
        {invoice.buyer.address && <p>{invoice.buyer.address}</p>}
        {invoice.buyer.email && <p>{invoice.buyer.email}</p>}
        <p className="text-discret">Fișa nr. {invoice.patient.fileNumber}</p>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-mic cifre">
          <caption className="sr-only">Liniile facturii {invoice.number}</caption>
          <thead>
            <tr className="border-b border-linie-control text-discret">
              <th scope="col" className="w-8 py-2 pr-2 font-semibold">
                Nr.
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Denumire
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">
                Cant.
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold whitespace-nowrap">
                Preț unitar
              </th>
              {invoice.discountTotal > 0 && (
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Reducere
                </th>
              )}
              {invoice.vatTotal > 0 && (
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  TVA
                </th>
              )}
              <th scope="col" className="py-2 text-right font-semibold">
                Valoare
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={it.id} className="border-b border-linie align-top">
                <td className="py-2 pr-2 text-discret">{i + 1}</td>
                <td className="min-w-40 py-2 pr-3">
                  {it.description}
                  {it.tooth ? `, dinte ${it.tooth}` : ""}
                  {it.doctorName && <span className="block text-micro text-discret">{it.doctorName}</span>}
                </td>
                <td className="py-2 pr-3 text-right">{it.quantity}</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">{formatLei(it.unitPrice)}</td>
                {invoice.discountTotal > 0 && (
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{it.discount ? `−${formatLei(it.discount)}` : "–"}</td>
                )}
                {invoice.vatTotal > 0 && <td className="py-2 pr-3 text-right">{it.vatRate}%</td>}
                <td className="py-2 text-right font-semibold whitespace-nowrap">{formatLei(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex max-w-md flex-col gap-2 text-mic">
          {invoice.vatTotal === 0 && seller.vatNote && <p>{seller.vatNote}.</p>}
          {invoice.notes && <p className="whitespace-pre-line">{invoice.notes}</p>}
          {activePayments.length > 0 && (
            <div>
              <p className="font-semibold">Plăți</p>
              <ul>
                {activePayments.map((p) => (
                  <li key={p.id} className="cifre">
                    {formatDateRo(p.paidAt, "short")}, {PAYMENT_METHOD_LABEL[p.method].toLowerCase()}
                    {p.receipt ? `, chitanța ${p.receipt}` : ""}: {formatLei(p.amount)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-discret">e-Factura: {EINVOICE_STATUS_LABEL[invoice.eInvoiceStatus].toLowerCase()}</p>
        </div>
        <dl className="grid min-w-64 grid-cols-[1fr_auto] gap-x-6 gap-y-1 cifre">
          <dt className="text-discret">Subtotal</dt>
          <dd className="text-right">{formatLei(invoice.subtotal)}</dd>
          {invoice.discountTotal > 0 && (
            <>
              <dt className="text-discret">Reduceri</dt>
              <dd className="text-right">−{formatLei(invoice.discountTotal)}</dd>
            </>
          )}
          {invoice.vatTotal > 0 && (
            <>
              <dt className="text-discret">TVA</dt>
              <dd className="text-right">{formatLei(invoice.vatTotal)}</dd>
            </>
          )}
          <dt className="border-t border-linie pt-1 font-semibold">Total</dt>
          <dd className="border-t border-linie pt-1 text-right text-h3 font-semibold">{formatLei(invoice.total)}</dd>
          {invoice.status === "EMISA" && (
            <>
              <dt className="text-discret">Achitat</dt>
              <dd className="text-right">{formatLei(invoice.amountPaid)}</dd>
              <dt className="font-semibold">Rest de plată</dt>
              <dd className="text-right font-semibold">{formatLei(invoice.openAmount)}</dd>
              <dt className="sr-only">Stare</dt>
              <dd className="col-span-2 text-right text-mic text-discret">{INVOICE_PAYMENT_STATE_LABEL[invoice.paymentState]}</dd>
            </>
          )}
        </dl>
      </div>

      <footer className="hidden justify-between gap-6 border-t border-linie pt-6 text-mic print:flex">
        <p>Semnătura și ștampila furnizorului</p>
        <p>Semnătura de primire</p>
      </footer>
    </article>
  );
}

/**
 * Print CSS for the A4 page: everything that is not the document or one of its ancestors is
 * removed (sidebar, top bar, toolbar), and the ancestors lose their padding and min-height, so
 * the invoice starts at the top of the sheet and no blank second page follows.
 */
const PRINT_CSS = `@media print {
  body *:not(:has([data-print-root])):not([data-print-root]):not([data-print-root] *) { display: none !important; }
  body *:has([data-print-root]) { display: block !important; min-height: 0 !important; height: auto !important; padding: 0 !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; background: none !important; }
  [data-print-root] { max-width: none !important; }
}`;

/** The A4 print page: a toolbar on screen, the document alone on paper. */
export function InvoicePrint({ invoice, seller, toolbar }: { invoice: InvoiceDetail; seller: SellerInfo; toolbar: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <style>{PRINT_CSS}</style>
      <div data-print="ascuns" className="flex flex-wrap items-center gap-3">
        {toolbar}
      </div>
      <div data-print-root="" className="mx-auto w-full max-w-[210mm]">
        <InvoiceDocument invoice={invoice} seller={seller} className="print:rounded-none" />
      </div>
    </div>
  );
}
