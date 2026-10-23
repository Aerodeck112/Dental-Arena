"use server";

import { publicAction } from "@/lib/actions";
import { callbackSchema, onlineBookingSchema } from "@/server/leads/schemas";
import {
  botBookingResult,
  CALLBACK_SUCCESS_MESSAGE,
  createCallbackRequest,
  createOnlineBooking,
  toPublicBooking,
} from "@/server/leads/intake";

/**
 * Server Actions of the booking wizard (docs/architecture.md §6.5, §8.2). Each one parses and
 * guards the input through `publicAction` and calls one service. A suspected bot gets a normal
 * looking success and nothing is written.
 */

/** „Rezervați ora de 10:30”: Lead(PROGRAMARE_ONLINE) + Appointment(PROGRAMAT, ONLINE). */
export const submitBooking = publicAction(
  {
    schema: onlineBookingSchema,
    honeypot: true,
    rateLimit: [
      { bucket: "booking:ip", limit: 5, windowSec: 600 },
      { bucket: "booking:phone", limit: 3, windowSec: 86_400, key: (i) => i.phone },
    ],
    botResult: botBookingResult,
  },
  async (input, { ipHash }) => {
    const result = await createOnlineBooking(input, { ipHash, sourcePath: input.sourcePath ?? "/programare" });
    return toPublicBooking(result);
  },
);

/** „Nu găsesc o oră potrivită. Prefer să mă sunați.”: Lead(APEL_INVERS). */
export const requestCallback = publicAction(
  {
    schema: callbackSchema,
    honeypot: true,
    rateLimit: [{ bucket: "callback:ip", limit: 5, windowSec: 600 }],
    successMessage: CALLBACK_SUCCESS_MESSAGE,
  },
  async (input, { ipHash }) => {
    await createCallbackRequest(input, { ipHash, sourcePath: input.sourcePath ?? "/programare" });
    return null;
  },
);
