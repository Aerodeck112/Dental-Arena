"use server";

import { after } from "next/server";
import { z } from "zod";
import { publicAction } from "@/lib/actions";
import { cancelByToken, confirmByToken } from "@/server/scheduling/links";
import { notifyClinicCancellation } from "@/server/notify/send";

/**
 * POST actions of the patient link `/p/[token]` (docs/architecture.md §6.6). The page itself never
 * changes data on GET, because SMS and e-mail apps prefetch links.
 */

const tokenSchema = z.object({
  token: z.string({ error: "Linkul nu mai este valabil." }).trim().min(10).max(200),
});

const tokenRateLimit = [{ bucket: "token:ip", limit: 20, windowSec: 600 }];

/** „Confirm programarea”: PROGRAMAT → CONFIRMAT, `confirmedVia = LINK`. */
export const confirmByLink = publicAction(
  { schema: tokenSchema, rateLimit: tokenRateLimit, successMessage: "Mulțumim. Programarea este confirmată." },
  async ({ token }) => confirmByToken(token),
);

/** „Anulez programarea”: allowed until `booking.cancelCutoffHours` before the start. */
export const cancelByLink = publicAction(
  {
    schema: tokenSchema,
    rateLimit: tokenRateLimit,
    successMessage: "Programarea a fost anulată. Ora este din nou liberă pentru alți pacienți.",
  },
  async ({ token }) => {
    const { appointmentId, appointment } = await cancelByToken(token);
    after(async () => {
      try {
        await notifyClinicCancellation(appointmentId);
      } catch (e) {
        console.error(`[p/token] notificare anulare: ${e instanceof Error ? e.name : typeof e}`);
      }
    });
    return appointment;
  },
);
