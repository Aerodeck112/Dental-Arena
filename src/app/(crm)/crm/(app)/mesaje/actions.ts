"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crmAction, DomainError } from "@/lib/actions";
import { zCheckbox } from "@/lib/validation/common";
import { DEFAULT_TEMPLATES, SAMPLE_VARIABLES } from "@/server/notify/default-templates";
import { smsInfo, toGsm7 } from "@/server/notify/gsm";
import { getSettings } from "@/lib/settings";
import {
  allowedVariables,
  isTemplateKey,
  renderText,
  resetTemplate,
  saveTemplate,
  templateProblems,
} from "@/server/notify/templates";
import type { TemplatePreview } from "@/server/notify/types";

/** Template editor actions (Mesaje → Șabloane). ADMIN only (`templates.manage`). */

const zKey = z.string().refine(isTemplateKey, { error: "Șablonul nu există." });

/** Renders the draft with sample data and lists unknown variables; nothing is saved. */
export const previewTemplate = crmAction(
  {
    permission: "templates.manage",
    schema: z.object({ key: zKey, subject: z.string().max(300).optional(), body: z.string().max(5000) }),
  },
  async ({ key, subject, body }): Promise<TemplatePreview> => {
    if (!isTemplateKey(key)) throw new DomainError("NOT_FOUND");
    const def = DEFAULT_TEMPLATES[key];
    const allowed = allowedVariables(key);
    const vars = def.audience === "clinica" ? SAMPLE_VARIABLES : { ...SAMPLE_VARIABLES, motiv: "" };
    const text = renderText(body, vars);
    let sms: TemplatePreview["sms"] = null;
    if (def.channel === "SMS") {
      const strip = (await getSettings("reminders")).smsStripDiacritics;
      const sent = strip ? toGsm7(text) : text;
      sms = { text: sent, ...smsInfo(sent) };
    }
    return {
      subject: def.channel === "EMAIL" ? renderText(subject ?? "", vars) : null,
      text,
      problems: {
        subject: def.channel === "EMAIL" ? templateProblems(subject ?? "", allowed) : [],
        body: templateProblems(body, allowed),
      },
      sms,
    };
  },
);

export const saveTemplateAction = crmAction(
  {
    permission: "templates.manage",
    schema: z.object({
      key: zKey,
      subject: z.string().max(300).optional(),
      body: z.string({ error: "Scrieți textul mesajului." }).max(5000, { error: "Textul are cel mult 5.000 de caractere." }),
      active: zCheckbox,
    }),
    successMessage: "Șablonul a fost salvat.",
  },
  async ({ key, subject, body, active }, { user }) => {
    if (!isTemplateKey(key)) throw new DomainError("NOT_FOUND");
    await saveTemplate(key, { subject: subject ?? null, body, active }, user);
    revalidatePath("/crm/mesaje/sabloane");
    revalidatePath(`/crm/mesaje/sabloane/${key}`);
    return { key };
  },
);

/** „Reveniți la textul implicit”. */
export const resetTemplateAction = crmAction(
  { permission: "templates.manage", schema: z.object({ key: zKey }), successMessage: "S-a revenit la textul implicit." },
  async ({ key }, { user }) => {
    if (!isTemplateKey(key)) throw new DomainError("NOT_FOUND");
    await resetTemplate(key, user);
    revalidatePath("/crm/mesaje/sabloane");
    revalidatePath(`/crm/mesaje/sabloane/${key}`);
    return { key };
  },
);
