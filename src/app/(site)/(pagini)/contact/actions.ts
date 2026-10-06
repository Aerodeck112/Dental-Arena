"use server";

import { publicAction } from "@/lib/actions";
import { CONTACT_SUCCESS_MESSAGE, createContactLead } from "@/server/leads/intake";
import { contactLeadSchema } from "@/server/leads/schemas";

/**
 * The contact form (architecture §4.1, §8.2): honeypot and fill time, 5 messages per 10 minutes
 * per IP, then a `Lead` with source FORMULAR_CONTACT through WP4's `createContactLead`. A suspected
 * bot sees the same success message and nothing is written.
 */
export const sendContactMessage = publicAction(
  {
    schema: contactLeadSchema,
    honeypot: true,
    rateLimit: [{ bucket: "contact:ip", limit: 5, windowSec: 600 }],
    successMessage: CONTACT_SUCCESS_MESSAGE,
  },
  async (input, { ipHash }) => {
    await createContactLead(input, { ipHash, sourcePath: input.sourcePath ?? "/contact" });
    return null;
  },
);
