"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { formatAmount, formatLei } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { parseLei } from "@/lib/validation/common";
import { computeInvoiceTotals } from "@/server/billing/totals";
import type { InvoiceCandidate } from "@/server/billing/types";
import { createInvoiceAction } from "@/app/(crm)/crm/(app)/facturi/actions";
import { InvoiceItemsEditor, InvoiceItemsHeader, toNumericLine, type EditorLine } from "./InvoiceItemsEditor";

export type InvoiceFormProps = {
  patient: { id: string; name: string; fileNumber: number; buyerName: string; buyerAddress: string | null; buyerEmail: string | null };
  locations: { id: string; shortName: string }[];
  defaultLocationId: string | null;
  doctors: { id: string; name: string }[];
  services: { id: string; code: string | null; name: string; categoryName: string; priceMin: number | null; priceMax: number | null; priceFrom: boolean }[];
  candidates: { plan: InvoiceCandidate[]; appointments: InvoiceCandidate[] };
  vatRate: number;
  vatNote: string;
};

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

function fromCandidate(c: InvoiceCandidate, vatRate: number): EditorLine {
  return {
    key: newKey(),
    source: c.source,
    serviceId: c.serviceId,
    treatmentPlanItemId: c.treatmentPlanItemId,
    appointmentId: c.appointmentId,
    doctorId: c.doctorId,
    description: c.description,
    tooth: c.tooth,
    quantity: String(c.quantity),
    // A plan line carries its agreed price, even 0; a visit without a catalog price must be priced here.
    priceText: c.source === "PLAN" || c.unitPrice > 0 ? formatAmount(c.unitPrice) : "",
    discountText: c.discount > 0 ? formatAmount(c.discount) : "",
    vatRate,
    context: c.context,
  };
}

const LINE_FIELD: Record<string, string> = { description: "descriere", unitPrice: "pret", discount: "reducere", quantity: "cantitate" };

/**
 * „Factură nouă” for one patient. Lines come from accepted or performed plan items, from services
 * of finished appointments, from the catalog or as free text; each line names its doctor. The
 * totals preview uses the same pure function as the server. An optional „încasare imediată”
 * records the payment in the same transaction.
 */
export function InvoiceForm({ patient, locations, defaultLocationId, doctors, services, candidates, vatRate, vatNote }: InvoiceFormProps) {
  const [lines, setLines] = useState<EditorLine[]>(() => candidates.plan.filter((c) => c.context.endsWith("efectuat")).map((c) => fromCandidate(c, vatRate)));
  const [catalogId, setCatalogId] = useState("");
  const [isCompany, setIsCompany] = useState(false);
  const [payNow, setPayNow] = useState(false);
  const [payMethod, setPayMethod] = useState("NUMERAR");
  const [payAmount, setPayAmount] = useState("");
  const [tried, setTried] = useState(false);
  const [state, action] = useActionState<ActionResult<never> | null, FormData>(
    async (prev, fd) => (await createInvoiceAction(prev, fd)) as ActionResult<never>,
    null,
  );
  const serverErrors = state && !state.ok ? state.fieldErrors : undefined;

  const numeric = useMemo(() => lines.map(toNumericLine), [lines]);
  const totals = useMemo(() => computeInvoiceTotals(numeric), [numeric]);
  const lineErrors = numeric.some((l) => l.invalid.length > 0);
  const usedPlan = new Set(lines.map((l) => l.treatmentPlanItemId).filter(Boolean));
  const usedAppt = new Set(lines.map((l) => l.appointmentId).filter(Boolean));
  const payAmountBani = payAmount.trim() === "" ? totals.total : parseLei(payAmount);

  const add = (l: EditorLine) => setLines((prev) => [...prev, l]);
  const addCatalog = () => {
    const s = services.find((x) => x.id === catalogId);
    if (!s) return;
    add({
      key: newKey(),
      source: "CATALOG",
      serviceId: s.id,
      treatmentPlanItemId: null,
      appointmentId: null,
      doctorId: null,
      description: s.name,
      tooth: null,
      quantity: "1",
      priceText: s.priceMin !== null ? formatAmount(s.priceMin) : "",
      discountText: "",
      vatRate,
      context: s.priceMax !== null || s.priceFrom ? `preț în catalog ${formatLei(s.priceMin, { from: s.priceFrom, max: s.priceMax })}` : null,
    });
    setCatalogId("");
  };
  const addFree = () =>
    add({
      key: newKey(),
      source: "LIBER",
      serviceId: null,
      treatmentPlanItemId: null,
      appointmentId: null,
      doctorId: null,
      description: "",
      tooth: null,
      quantity: "1",
      priceText: "",
      discountText: "",
      vatRate,
      context: null,
    });

  const linesJson = JSON.stringify(
    numeric.map(({ invalid: _invalid, ...l }) => {
      void _invalid;
      return { ...l, tooth: l.tooth ?? null };
    }),
  );
  const idFor = (name: string) => {
    const m = name.match(/^lines\.(\d+)(?:\.(\w+))?$/);
    if (m) return `linie-${m[1]}-${LINE_FIELD[m[2] ?? "description"] ?? "descriere"}`;
    return name === "payMethod" ? "field-payMethod" : `factura-${name}`;
  };

  return (
    <form
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (lines.length === 0 || lineErrors) {
          document.getElementById("factura-linii")?.focus();
          return;
        }
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {state && !state.ok && <ErrorSummary errors={serverErrors} message={serverErrors ? null : state.error} idFor={idFor} />}
      <input type="hidden" name="patientId" value={patient.id} />
      <input type="hidden" name="lines" value={linesJson} />

      <section aria-labelledby="factura-surse" className="flex flex-col gap-3">
        <h2 id="factura-surse" className="text-h3 font-semibold">
          Ce facturați
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CandidateList
            title="Din planul de tratament"
            empty="Nicio lucrare acceptată sau efectuată, nefacturată."
            items={candidates.plan}
            used={(c) => usedPlan.has(c.treatmentPlanItemId)}
            onAdd={(c) => add(fromCandidate(c, vatRate))}
          />
          <CandidateList
            title="Din programările finalizate"
            empty="Nicio programare finalizată în ultimele 6 luni fără linie în plan."
            items={candidates.appointments}
            used={(c) => usedAppt.has(c.appointmentId)}
            onAdd={(c) => add(fromCandidate(c, vatRate))}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Din catalog"
            name="_catalog"
            className="w-full max-w-md"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            placeholder="Alegeți serviciul"
            options={services.map((s) => ({
              value: s.id,
              label: `${s.name}, ${s.priceMin === null ? "fără preț" : formatLei(s.priceMin, { from: s.priceFrom, max: s.priceMax })}`,
            }))}
          />
          <Button type="button" variant="secondary" icon="plus" onClick={addCatalog} disabled={!catalogId}>
            Adăugați serviciul
          </Button>
          <Button type="button" variant="text" icon="plus" onClick={addFree}>
            Linie liberă
          </Button>
        </div>
      </section>

      <section aria-labelledby="factura-linii-titlu" className="flex flex-col gap-2">
        <h2 id="factura-linii-titlu" className="text-h3 font-semibold">
          Liniile facturii
        </h2>
        <div id="factura-linii" tabIndex={-1} className="outline-none">
          {tried && lines.length === 0 && <p className="mb-2 text-mic text-carmin">Adăugați cel puțin o linie pe factură.</p>}
          <InvoiceItemsHeader />
          <InvoiceItemsEditor lines={lines} onChange={setLines} doctors={doctors} serverErrors={serverErrors} showErrors={tried} />
        </div>
        <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-corp cifre" aria-live="polite">
          <dt className="text-discret">Subtotal</dt>
          <dd className="text-right">{formatLei(totals.subtotal)}</dd>
          <dt className="text-discret">Reduceri</dt>
          <dd className="text-right">{totals.discountTotal ? `−${formatLei(totals.discountTotal)}` : formatLei(0)}</dd>
          {totals.vatTotal > 0 && (
            <>
              <dt className="text-discret">TVA</dt>
              <dd className="text-right">{formatLei(totals.vatTotal)}</dd>
            </>
          )}
          <dt className="border-t border-linie pt-1 font-semibold">Total de plată</dt>
          <dd className="border-t border-linie pt-1 text-right text-h3 font-semibold">{formatLei(totals.total)}</dd>
        </dl>
        {totals.vatTotal === 0 && vatNote && <p className="ml-auto max-w-xs text-mic text-discret">{vatNote}</p>}
      </section>

      <section aria-labelledby="factura-cumparator" className="flex flex-col gap-3">
        <h2 id="factura-cumparator" className="text-h3 font-semibold">
          Cumpărător
        </h2>
        <p className="text-mic text-discret">
          Datele vin din fișa pacientului (nr. {patient.fileNumber}). Le puteți corecta doar pentru această factură.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField id="factura-buyerName" label="Nume" name="buyerName" required defaultValue={patient.buyerName} maxLength={160} error={serverErrors?.buyerName} />
          <TextField id="factura-buyerAddress" label="Adresa" name="buyerAddress" optional defaultValue={patient.buyerAddress ?? ""} maxLength={300} error={serverErrors?.buyerAddress} />
          <TextField id="factura-buyerEmail" label="E-mail" name="buyerEmail" type="email" optional defaultValue={patient.buyerEmail ?? ""} error={serverErrors?.buyerEmail} />
        </div>
        <Checkbox name="isCompany" label="Factura se emite pe o firmă" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} />
        {isCompany && (
          <div className="grid gap-4 md:grid-cols-3">
            <TextField id="factura-buyerCompany" label="Denumirea firmei" name="buyerCompany" required maxLength={200} error={serverErrors?.buyerCompany} />
            <TextField id="factura-buyerCui" label="CUI" name="buyerCui" required hint="Cu sau fără RO, de exemplu RO12345678." maxLength={12} error={serverErrors?.buyerCui} />
            <TextField id="factura-buyerRegCom" label="Nr. Reg. Com." name="buyerRegCom" optional maxLength={40} hint="De exemplu J26/123/2020." error={serverErrors?.buyerRegCom} />
          </div>
        )}
      </section>

      <section aria-labelledby="factura-detalii" className="grid gap-4 md:grid-cols-3">
        <h2 id="factura-detalii" className="sr-only">
          Detalii
        </h2>
        <Select
          id="factura-locationId"
          label="Clinica emitentă"
          name="locationId"
          defaultValue={defaultLocationId ?? locations[0]?.id ?? ""}
          options={locations.map((l) => ({ value: l.id, label: l.shortName }))}
          error={serverErrors?.locationId}
        />
        <TextArea id="factura-notes" label="Mențiuni pe factură" name="notes" optional rows={2} maxLength={1000} className="md:col-span-2" error={serverErrors?.notes} />
      </section>

      <section aria-labelledby="factura-incasare" className={cn("flex flex-col gap-3 rounded-panou border border-linie p-4", payNow && "bg-menta-pal border-transparent")}>
        <h2 id="factura-incasare" className="sr-only">
          Încasare imediată
        </h2>
        <Checkbox
          name="payNow"
          label="Încasare imediată"
          description="Plata se înregistrează odată cu factura. Numerarul primește chitanță."
          checked={payNow}
          onChange={(e) => setPayNow(e.target.checked)}
        />
        {payNow && (
          <div className="flex flex-col gap-4">
            <RadioGroup
              legend="Metoda"
              name="payMethod"
              inline
              value={payMethod}
              onChange={setPayMethod}
              options={(["NUMERAR", "CARD", "TRANSFER"] as const).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
              error={serverErrors?.payMethod}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <TextField
                id="factura-payAmount"
                label="Suma încasată (lei)"
                name="payAmount"
                inputMode="decimal"
                placeholder={formatAmount(totals.total)}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                hint={
                  payAmountBani !== null && payAmountBani < totals.total
                    ? `Plată parțială; rămân ${formatLei(totals.total - payAmountBani)} de plată.`
                    : "Gol înseamnă totalul facturii."
                }
                error={serverErrors?.payAmount}
                inputClassName="cifre text-right"
              />
              {payMethod !== "NUMERAR" && (
                <TextField
                  id="factura-payReference"
                  label={payMethod === "CARD" ? "Nr. tranzacție POS" : "Nr. ordin de plată"}
                  name="payReference"
                  optional
                  maxLength={80}
                />
              )}
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-linie pt-4">
        <SubmitButton icon="receipt" pendingLabel="Se emite factura">
          {payNow ? `Emiteți factura și încasați` : "Emiteți factura"}
        </SubmitButton>
        <span className="text-corp text-discret cifre">
          {lines.length === 0 ? "Nicio linie" : `${lines.length} ${lines.length === 1 ? "linie" : "linii"}, total ${formatLei(totals.total)}`}
        </span>
      </div>
    </form>
  );
}

function CandidateList({
  title,
  empty,
  items,
  used,
  onAdd,
}: {
  title: string;
  empty: string;
  items: InvoiceCandidate[];
  used: (c: InvoiceCandidate) => boolean;
  onAdd: (c: InvoiceCandidate) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-panou border border-linie p-4">
      <h3 className="text-corp font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-mic text-discret">{empty}</p>
      ) : (
        <>
          {items.every((c) => c.possiblyInvoiced) && <p className="text-mic text-discret">{empty}</p>}
          <CandidateRows items={items.filter((c) => !c.possiblyInvoiced)} used={used} onAdd={onAdd} />
          {items.some((c) => c.possiblyInvoiced) && (
            <details className="group">
              <summary className="cursor-pointer text-mic text-link underline underline-offset-2">
                Probabil deja facturate ({items.filter((c) => c.possiblyInvoiced).length})
              </summary>
              <p className="mt-1 text-micro text-discret">
                Pacientul are o factură, emisă după vizită, cu același serviciu. Verificați înainte să le adăugați.
              </p>
              <CandidateRows items={items.filter((c) => c.possiblyInvoiced)} used={used} onAdd={onAdd} />
            </details>
          )}
        </>
      )}
    </div>
  );
}

function CandidateRows({
  items,
  used,
  onAdd,
}: {
  items: InvoiceCandidate[];
  used: (c: InvoiceCandidate) => boolean;
  onAdd: (c: InvoiceCandidate) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-linie">
      {items.map((c) => {
        const isUsed = used(c);
        return (
          <li key={c.key} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-corp">
                {c.description}
                {c.tooth ? <span className="text-discret">, dinte {c.tooth}</span> : null}
              </p>
              <p className="text-micro text-discret">
                {c.context}
                {c.doctorName ? `, ${c.doctorName}` : ""}
              </p>
            </div>
            <span className="text-corp cifre whitespace-nowrap">
              {c.unitPrice > 0 || c.source === "PLAN" ? formatLei(c.quantity * c.unitPrice - c.discount) : "fără preț"}
            </span>
            <Button
              type="button"
              size="s"
              variant={isUsed ? "text" : "secondary"}
              icon={isUsed ? "check" : "plus"}
              disabled={isUsed}
              onClick={() => onAdd(c)}
              aria-label={isUsed ? `${c.description}: adăugată` : `Adăugați ${c.description}`}
            >
              {isUsed ? "Adăugată" : "Adăugați"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
