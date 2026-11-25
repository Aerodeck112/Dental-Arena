"use server";

import { revalidatePath } from "next/cache";
import { crmAction } from "@/lib/actions";
import { RECALL_OUTCOME_LABEL, logRecallAttempt, recallAttemptSchema, recallStatusSchema, setRecallStatus } from "@/server/recalls/service";

/** „De rechemat” actions (WP6): log a call attempt, cancel or reopen a recall. */

function revalidateRecalls() {
  revalidatePath("/crm/rechemari");
  revalidatePath("/crm");
}

export const logRecallAttemptAction = crmAction(
  { permission: "recalls.manage", schema: recallAttemptSchema, successMessage: (d: { label: string }) => `Apel notat: ${d.label.toLowerCase()}.` },
  async (input, { user }) => {
    const r = await logRecallAttempt(input, user);
    revalidateRecalls();
    return { ...r, label: RECALL_OUTCOME_LABEL[input.outcome] };
  },
);

export const setRecallStatusAction = crmAction(
  { permission: "recalls.manage", schema: recallStatusSchema, successMessage: (d: { status: string }) => (d.status === "ANULAT" ? "Rechemarea a fost anulată." : "Rechemarea a fost redeschisă.") },
  async (input, { user }) => {
    await setRecallStatus(input, user);
    revalidateRecalls();
    return { status: input.status };
  },
);
