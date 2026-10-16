"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { cancelPayment, recordPayment } from "@/server/billing/payments";
import { cancelSchema, recordPaymentSchema } from "@/server/billing/schemas";

/**
 * Payments (docs/architecture.md §4.2 `/crm/incasari`). Recording needs `billing.create`
 * (ADMIN, RECEPTIE); cancelling needs `billing.cancel` (ADMIN). The services audit both.
 */

function revalidatePayments(patientId: string) {
  revalidatePath("/crm/incasari");
  revalidatePath("/crm/facturi");
  revalidatePath("/crm/facturi/[id]", "page");
  revalidatePath(`/crm/pacienti/${patientId}`, "layout");
  revalidatePath("/crm");
}

export const recordPaymentAction = crmAction(
  {
    permission: "billing.create",
    schema: recordPaymentSchema,
    successMessage: (d: { receipt: string | null }) => (d.receipt ? `Încasare înregistrată, chitanța ${d.receipt}.` : "Încasare înregistrată."),
  },
  async (i, { user }) => {
    const r = await recordPayment(
      {
        patientId: i.patientId,
        invoiceId: i.invoiceId ?? null,
        locationId: i.locationId ?? null,
        amount: i.amount,
        method: i.method,
        paidOn: i.paidOn ?? null,
        reference: i.reference ?? null,
        notes: i.notes ?? null,
      },
      user,
    );
    revalidatePayments(i.patientId);
    return r;
  },
);

export const cancelPaymentAction = crmAction(
  { permission: "billing.cancel", schema: cancelSchema, successMessage: "Încasarea a fost anulată." },
  async ({ id, reason }, { user }) => {
    const r = await cancelPayment(id, reason, user);
    revalidatePayments(r.patientId);
    return { id: r.id };
  },
);
