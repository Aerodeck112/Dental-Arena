"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crmAction } from "@/lib/actions";
import { zId, zOptionalText, zText } from "@/lib/validation/common";
import { sendManualFromStaff } from "@/server/notify/log";
import { MESSAGE_STATUS_LABEL } from "@/lib/labels";

/**
 * Manual message from `SendMessageDialog` (Mesaje, the patient file, a lead). ADMIN and RECEPTIE
 * (`messages.send`). The recipient comes from the patient or lead record when one is given.
 */
const sendSchema = z
  .object({
    channel: z.enum(["SMS", "EMAIL"], { error: "Alegeți SMS sau e-mail." }),
    to: zOptionalText(254),
    subject: zOptionalText(150),
    body: zText(2000),
    patientId: zId.optional(),
    leadId: zId.optional(),
  })
  .refine((v) => v.channel !== "SMS" || v.body.length <= 640, {
    path: ["body"],
    error: "Un SMS are cel mult 640 de caractere (4 segmente). Scurtați textul.",
  });

export const sendMessage = crmAction(
  {
    permission: "messages.send",
    schema: sendSchema,
    successMessage: (d: { status: string }) =>
      d.status === "EROARE" ? "Mesajul nu a putut fi trimis. Detaliile sunt în jurnal." : `Mesaj ${MESSAGE_STATUS_LABEL[d.status as "TRIMIS"].toLowerCase()}.`,
  },
  async (input, { user }) => {
    const r = await sendManualFromStaff(input, user.id);
    revalidatePath("/crm/mesaje");
    if (input.patientId) revalidatePath(`/crm/pacienti/${input.patientId}`, "layout");
    return { status: r.status };
  },
);
