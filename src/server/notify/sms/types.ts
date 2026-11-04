/**
 * SMS provider interface (docs/architecture.md §9.3). A real provider is one new file plus one
 * `case` line in `./index.ts`. It must throw on a non-2xx response and never log the full text in
 * production. Types only.
 */
export interface SmsProvider {
  /** Stored in `MessageLog.provider`. */
  readonly name: string;
  /** True when nothing leaves the server (the message is logged `SIMULAT`). */
  readonly simulated: boolean;
  send(toE164: string, text: string): Promise<{ providerMessageId?: string }>;
}
