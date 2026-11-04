"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { recordConsent, revokeConsent } from "@/server/patients/consents";
import { consentRecordSchema, consentRevokeSchema } from "@/server/patients/schemas";

/** Consents (`consents.manage`): record a decision or revoke one. Both are audited. */

export const recordConsentAction = crmAction(
  { permission: "consents.manage", schema: consentRecordSchema, successMessage: "Consimțământul a fost înregistrat." },
  async ({ id, ...i }, { user }) => {
    const r = await recordConsent(user, id, i);
    revalidatePath(`/crm/pacienti/${id}`, "layout");
    return r;
  },
);

export const revokeConsentAction = crmAction(
  { permission: "consents.manage", schema: consentRevokeSchema, successMessage: "Consimțământul a fost retras." },
  async ({ id, consentId }, { user }) => {
    await revokeConsent(user, id, consentId);
    revalidatePath(`/crm/pacienti/${id}`, "layout");
    return null;
  },
);
