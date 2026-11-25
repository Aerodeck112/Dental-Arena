import "server-only";
import { env } from "@/lib/env";
import { smsInfo } from "../gsm";
import type { SmsProvider } from "./types";

/**
 * Default SMS provider: prints the message (development and tests only) and sends nothing.
 * Messages are logged `SIMULAT`. In production it prints nothing, so no personal data reaches the
 * server logs.
 */
export const consoleSmsProvider: SmsProvider = {
  name: "console",
  simulated: true,
  async send(toE164: string, text: string) {
    if (env.NODE_ENV !== "production") {
      const info = smsInfo(text);
      const rule = "─".repeat(64);
      console.info(
        [
          `┌${rule}`,
          `│ SMS (consolă) către ${toE164}: ${info.encoding}, ${info.units} caractere, ${info.segments} segment(e)`,
          `├${rule}`,
          ...text.split("\n").map((l) => `│ ${l}`),
          `└${rule}`,
        ].join("\n"),
      );
    }
    return {};
  },
};
