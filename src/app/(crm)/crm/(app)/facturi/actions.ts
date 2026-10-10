"use server";

import { revalidatePath } from "next/cache";
import { assertLocationAccess, assertRecordAccess } from "@/lib/clinic-scope";
import { redirect } from "next/navigation";
import { crmAction } from "@/lib/actions";
import { createInvoice, cancelInvoice } from "@/server/billing/invoices";
import { cancelSchema, createInvoiceSchema } from "@/server/billing/schemas";

/**
 * Invoices (docs/architecture.md §4.2 `/crm/facturi`). Creating needs `billing.create`
 * (ADMIN, RECEPTIE); cancelling needs `billing.cancel` (ADMIN). The services audit both.
 */

function revalidateBilling(patientId: string) {
  revalidatePath("/crm/facturi");
  revalidatePath("/crm/facturi/[id]", "page");
  revalidatePath("/crm/incasari");
  revalidatePath(`/crm/pacienti/${patientId}`, "layout");
  revalidatePath("/crm");
}

export const createInvoiceAction = crmAction(
  { permission: "billing.create", schema: createInvoiceSchema },
  async (i, { user }) => {
    await assertLocationAccess(i.locationId);
    const r = await createInvoice(
      {
        patientId: i.patientId,
        locationId: i.locationId,
        lines: i.lines.map((l) => ({ ...l, tooth: l.tooth ?? null })),
        buyerName: i.buyerName,
        buyerAddress: i.buyerAddress ?? null,
        buyerEmail: i.buyerEmail ?? null,
        buyerCompany: i.isCompany ? (i.buyerCompany ?? null) : null,
        buyerCui: i.isCompany ? (i.buyerCui ?? null) : null,
        buyerRegCom: i.isCompany ? (i.buyerRegCom ?? null) : null,
        notes: i.notes ?? null,
        payNow: i.payNow && i.payMethod ? { method: i.payMethod, amount: i.payAmount ?? null, reference: i.payReference ?? null } : null,
      },
      user,
    );
    revalidateBilling(i.patientId);
    redirect(`/crm/facturi/${r.id}?emisa=1`);
  },
);

export const cancelInvoiceAction = crmAction(
  { permission: "billing.cancel", schema: cancelSchema, successMessage: "Factura a fost anulată. Plățile ei au trecut în contul pacientului." },
  async ({ id, reason }, { user }) => {
    await assertRecordAccess("invoice", id);
    const r = await cancelInvoice(id, reason, user);
    revalidateBilling(r.patientId);
    return r;
  },
);
