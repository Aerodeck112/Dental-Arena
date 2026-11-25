import "server-only";
import { env } from "@/lib/env";
import { consoleSmsProvider } from "./console";
import type { SmsProvider } from "./types";

export type { SmsProvider } from "./types";

/** Picks the provider from `SMS_PROVIDER` (§9.3). Unknown values fall back to the console. */
export function getSmsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "console":
    default:
      return consoleSmsProvider;
  }
}
