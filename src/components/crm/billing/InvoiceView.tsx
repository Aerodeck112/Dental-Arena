import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { formatDateRo, formatLei } from "@/lib/format";
import { EINVOICE_STATUS_LABEL } from "@/lib/labels";
import type { InvoiceDetail, SellerInfo } from "@/server/billing/types";
import { EInvoiceStatusText } from "./InvoiceStateChip";
import { InvoiceDocument, PLACEHOLDER } from "./InvoicePrint";
import { PaymentList } from "./PaymentList";

/**
 * The invoice screen below the page header: notices (just issued, cancelled, legal data missing),
 * the document itself, its payments and the e-Factura status. Actions live in the page header.
 */
export function InvoiceView({
  invoice,
  seller,
  eInvoice,
  canCancelPayments,
  justIssued,
  canEditSettings,
}: {
  invoice: InvoiceDetail;
  seller: SellerInfo;
  eInvoice: { providerName: string; canSubmit: boolean };
  canCancelPayments: boolean;
  justIssued: boolean;
  canEditSettings: boolean;
}) {
  const missingLegal = [seller.legalName, seller.cui, seller.regCom, seller.registeredAddress].some((v) => !v || v.includes(PLACEHOLDER));
  return (
    <div className="flex flex-col gap-5">
      {justIssued && invoice.status === "EMISA" && (
        <p role="status" className="rounded-panou bg-menta-pal px-4 py-3 text-corp">
          Factura {invoice.number} a fost emisă
          {invoice.amountPaid > 0
            ? invoice.openAmount === 0
              ? " și încasată integral."
              : `, cu ${formatLei(invoice.amountPaid)} încasați. Rămân ${formatLei(invoice.openAmount)} de plată.`
            : "."}
        </p>
      )}
      {invoice.status === "ANULATA" && (
        <div role="note" className="rounded-panou border border-dashed border-linie-control bg-adancit px-4 py-3 text-corp">
          <p className="font-semibold">
            Factură anulată
            {invoice.cancelledAt ? ` pe ${formatDateRo(invoice.cancelledAt, "short")}` : ""}
            {invoice.cancelledByName ? ` de ${invoice.cancelledByName}` : ""}.
          </p>
          {invoice.cancelReason && <p>Motiv: {invoice.cancelReason}</p>}
          <p className="text-discret">Plățile ei au trecut în contul pacientului, ca avans.</p>
        </div>
      )}
      {missingLegal && (
        <p role="note" className="rounded-panou border-2 border-carmin bg-carmin-pal px-4 py-3 text-corp">
          Datele legale ale clinicii (denumire, CUI, Reg. Com., sediu) nu sunt completate, așa că apar marcate pe factură.{" "}
          {canEditSettings ? (
            <Link href="/crm/setari#clinic" className="font-semibold underline underline-offset-2">
              Completați-le în Setări
            </Link>
          ) : (
            "Cereți-i administratorului să le completeze în Setări."
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <InvoiceDocument invoice={invoice} seller={seller} />
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="e-Factura" level={2}>
            <dl className="flex flex-col gap-2 text-corp">
              <div className="flex justify-between gap-3">
                <dt className="text-discret">Stare</dt>
                <dd>
                  <EInvoiceStatusText status={invoice.eInvoiceStatus} />
                </dd>
              </div>
              {invoice.eInvoiceRef && (
                <div className="flex justify-between gap-3">
                  <dt className="text-discret">Index SPV</dt>
                  <dd className="cifre">{invoice.eInvoiceRef}</dd>
                </div>
              )}
              {invoice.eInvoiceError && <dd className="text-mic text-carmin">{invoice.eInvoiceError}</dd>}
            </dl>
            <div className="mt-3 flex flex-col gap-2">
              <Button type="button" variant="secondary" icon="upload" disabled={!eInvoice.canSubmit || invoice.status === "ANULATA"} aria-describedby={`spv-${invoice.id}`}>
                Trimiteți în SPV
              </Button>
              <p id={`spv-${invoice.id}`} className="text-mic text-discret">
                {eInvoice.canSubmit
                  ? `Transmiterea se face prin ${eInvoice.providerName}.`
                  : `Transmiterea către ANAF nu este configurată, așa că factura rămâne „${EINVOICE_STATUS_LABEL.NETRANSMISA}”. Dacă e-Factura se aplică facturilor către pacienți se confirmă cu contabilul clinicii.`}
              </p>
            </div>
          </Panel>
          <Panel title="Detalii" level={2}>
            <dl className="flex flex-col gap-1.5 text-corp">
              <div className="flex justify-between gap-3">
                <dt className="text-discret">Pacient</dt>
                <dd>
                  <Link href={`/crm/pacienti/${invoice.patient.id}/incasari`} className="underline underline-offset-2">
                    {invoice.patient.name}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-discret">Clinica</dt>
                <dd>{invoice.location.name.replace(/^Dental Arena /, "")}</dd>
              </div>
              {invoice.createdByName && (
                <div className="flex justify-between gap-3">
                  <dt className="text-discret">Emisă de</dt>
                  <dd>{invoice.createdByName}</dd>
                </div>
              )}
            </dl>
          </Panel>
        </div>
      </div>

      <Panel title="Plăți pe această factură" level={2}>
        <PaymentList
          rows={invoice.payments}
          caption={`Plățile facturii ${invoice.number}`}
          showPatient={false}
          showInvoice={false}
          canCancel={canCancelPayments}
          empty={<p className="text-corp text-discret">Nicio plată încă. Folosiți „Încasați” de sus pentru a înregistra plata.</p>}
        />
      </Panel>
    </div>
  );
}
