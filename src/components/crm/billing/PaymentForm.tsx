"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import type { ActionResult } from "@/lib/actions";
import { formatAmount, formatLei } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { recordPaymentAction } from "@/app/(crm)/crm/(app)/incasari/actions";

export type PaymentFormInvoice = { id: string; number: string; open: number; locationId: string };

export type PaymentFormProps = {
  patientId: string;
  /** Open invoices of the patient; the payment goes on one of them or on account. */
  invoices: PaymentFormInvoice[];
  defaultInvoiceId?: string | null;
  locations: { id: string; shortName: string }[];
  defaultLocationId?: string | null;
  today: string;
  onDone?: () => void;
};

type Result = ActionResult<{ id: string; receipt: string | null }> | null;
const ON_ACCOUNT = "";

/**
 * „Înregistrați o încasare”: cash, card or bank transfer, against an invoice (partial payments
 * allowed) or on account. Cash gets a receipt number on the server.
 */
export function PaymentForm({ patientId, invoices, defaultInvoiceId, locations, defaultLocationId, today, onDone }: PaymentFormProps) {
  const initialInvoice = invoices.find((i) => i.id === defaultInvoiceId) ?? (defaultInvoiceId === undefined ? invoices[0] : undefined);
  const [invoiceId, setInvoiceId] = useState(initialInvoice?.id ?? ON_ACCOUNT);
  const [amount, setAmount] = useState(initialInvoice ? formatAmount(initialInvoice.open) : "");
  const [method, setMethod] = useState("NUMERAR");
  const [formKey, setFormKey] = useState(0);
  const invoice = invoices.find((i) => i.id === invoiceId);
  const [state, action] = useActionState<Result, FormData>(async (prev, fd) => {
    const r = (await recordPaymentAction(prev, fd)) as Result;
    if (r?.ok) {
      showToast({ kind: "success", message: r.message ?? "Încasare înregistrată." });
      setFormKey((k) => k + 1);
      onDone?.();
    }
    return r;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const ids = (n: string) => (n === "method" ? "field-method" : `plata-${n}`);

  return (
    <form
      key={formKey}
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      {state && !state.ok && <ErrorSummary errors={errors} message={errors ? null : state.error} idFor={ids} />}
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id={ids("invoiceId")}
          label="Pe factura"
          name="invoiceId"
          value={invoiceId}
          onChange={(e) => {
            const next = invoices.find((i) => i.id === e.target.value);
            setInvoiceId(e.target.value);
            setAmount(next ? formatAmount(next.open) : "");
          }}
          options={[
            ...invoices.map((i) => ({ value: i.id, label: `${i.number}, rest ${formatLei(i.open)}` })),
            { value: ON_ACCOUNT, label: "În cont (avans, fără factură)" },
          ]}
          error={errors?.invoiceId}
        />
        <TextField
          id={ids("amount")}
          label="Suma (lei)"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={invoice ? `Rest de plată: ${formatLei(invoice.open)}. O plată parțială este în regulă.` : "De exemplu 1.200 sau 1.200,50."}
          error={errors?.amount}
          inputClassName="cifre text-right"
        />
      </div>
      <RadioGroup
        legend="Metoda"
        name="method"
        inline
        value={method}
        onChange={setMethod}
        options={(["NUMERAR", "CARD", "TRANSFER"] as const).map((m) => ({
          value: m,
          label: PAYMENT_METHOD_LABEL[m],
          description: m === "NUMERAR" ? "Se emite chitanță" : undefined,
        }))}
        error={errors?.method}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <DateInput id={ids("paidOn")} label="Data plății" name="paidOn" defaultValue={today} max={today} error={errors?.paidOn} />
        {!invoice ? (
          <Select
            id={ids("locationId")}
            label="Clinica"
            name="locationId"
            defaultValue={defaultLocationId ?? locations[0]?.id ?? ""}
            options={locations.map((l) => ({ value: l.id, label: l.shortName }))}
            error={errors?.locationId}
          />
        ) : (
          <input type="hidden" name="locationId" value={invoice.locationId} />
        )}
        {method !== "NUMERAR" && (
          <TextField
            id={ids("reference")}
            label={method === "CARD" ? "Nr. tranzacție POS" : "Nr. ordin de plată"}
            name="reference"
            optional
            maxLength={80}
            error={errors?.reference}
          />
        )}
      </div>
      <TextField id={ids("notes")} label="Observații" name="notes" optional maxLength={500} error={errors?.notes} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton icon="wallet" pendingLabel="Se înregistrează">
          Înregistrați încasarea
        </SubmitButton>
      </div>
    </form>
  );
}

/** A button that opens the payment form in a dialog (patient tab, invoice view). */
export function PaymentFormDialog({
  triggerLabel = "Încasați",
  triggerVariant = "primary",
  triggerSize = "m",
  ...props
}: Omit<PaymentFormProps, "onDone"> & { triggerLabel?: string; triggerVariant?: ButtonVariant; triggerSize?: ButtonSize }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={triggerVariant} size={triggerSize} icon="wallet" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Înregistrați o încasare" size="l">
        {open && <PaymentForm {...props} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}
