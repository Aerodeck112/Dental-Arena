import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, type CurrentUser } from "./auth/dal";
import { DomainError, ERROR_MESSAGES, isDomainError, type ErrorCode, type ErrorDetails } from "./errors";
import { isLikelyBot } from "./honeypot";
import { can, type Permission } from "./permissions";
import { hmacHash } from "./pii";
import { rateLimit } from "./rate-limit";
import { getIpHash, getUserAgent } from "./request";

export { DomainError, type ErrorCode } from "./errors";

/**
 * Server Action wrappers (docs/architecture.md §7.1). Every mutation goes through `crmAction`
 * (staff) or `publicAction` (site visitors). In order they authenticate, authorise, validate,
 * run the handler and map errors to an `ActionResult`. They never throw to the client; a handler
 * may still call `redirect()` after success.
 */

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      code: ErrorCode;
      error: string;
      fieldErrors?: Record<string, string[]>;
      details?: ErrorDetails;
    };

export type ActionFailure = Extract<ActionResult<never>, { ok: false }>;

/**
 * The function returned by `crmAction` / `publicAction`. Call it directly with FormData or a plain
 * object, or hand it straight to `useActionState` (React then calls it with the previous state
 * and the FormData), which keeps forms working before hydration:
 *
 *   const [state, formAction, pending] = useActionState<ActionResult<T> | null, FormData>(action, null);
 */
export type ServerActionFn<In, T> = {
  (input: FormData | In): Promise<ActionResult<T>>;
  (prevState: unknown, input: FormData | In): Promise<ActionResult<T>>;
};

/** One argument: the input. Two arguments (from `useActionState`): previous state, then the input. */
function inputOf(args: unknown[]): unknown {
  return args.length >= 2 ? args[1] : args[0];
}

/** Key under which form-level (non-field) validation errors are reported. */
export const FORM_ERROR_KEY = "form";

/**
 * FormData → plain object: repeated keys become arrays, "" becomes undefined, "on" becomes true,
 * empty file inputs are dropped, and Next's internal `$ACTION…` fields are skipped.
 */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const repeated = new Set<string>();
  for (const [key, raw] of fd.entries()) {
    if (key.startsWith("$ACTION")) continue;
    let value: unknown = raw;
    if (typeof raw === "string") {
      if (raw === "") value = undefined;
      else if (raw === "on") value = true;
    } else if (typeof File !== "undefined" && raw instanceof File && raw.size === 0 && raw.name === "") {
      value = undefined;
    }
    if (Object.prototype.hasOwnProperty.call(out, key) || repeated.has(key)) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
      repeated.add(key);
    } else {
      out[key] = value;
    }
  }
  for (const key of repeated) {
    out[key] = (out[key] as unknown[]).filter((v) => v !== undefined);
  }
  return out;
}

/** zod issues → `{ "field.path": ["message", …] }`; root issues go under `form`. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || FORM_ERROR_KEY;
    const list = (fieldErrors[path] ??= []);
    if (!list.includes(issue.message)) list.push(issue.message);
  }
  return fieldErrors;
}

function failure(code: ErrorCode, error?: string, extra?: Partial<ActionFailure>): ActionFailure {
  return { ok: false, code, error: error ?? ERROR_MESSAGES[code], ...extra };
}

function validationFailure(error: z.ZodError): ActionFailure {
  return failure("VALIDATION", undefined, { fieldErrors: zodFieldErrors(error) });
}

/** Maps any thrown value to a failure result; unexpected errors are logged without PII. */
function mapError(e: unknown, where: string): ActionFailure {
  if (isDomainError(e)) {
    return failure(e.code, e.message, {
      ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
      ...(e.details ? { details: e.details } : {}),
    });
  }
  if (e instanceof z.ZodError) return validationFailure(e);
  const prismaCode = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : null;
  if (prismaCode === "P2025") return failure("NOT_FOUND");
  if (prismaCode === "P2002") return failure("CONFLICT", "Există deja o înregistrare cu aceste date.");
  if (prismaCode === "P2034") return failure("STALE", "Datele s-au schimbat chiar acum. Încercați din nou.");
  const errorId = randomUUID().slice(0, 8);
  const name = e instanceof Error ? e.name : typeof e;
  // Never log the message: it may contain personal data. The stack frames are enough to debug.
  const frames = e instanceof Error && e.stack ? e.stack.split("\n").slice(1, 6).join("\n") : "";
  console.error(`[action:${where}] eroare ${errorId}: ${name}${prismaCode ? ` (${prismaCode})` : ""}\n${frames}`);
  return failure("INTERNAL", `${ERROR_MESSAGES.INTERNAL} (cod ${errorId})`);
}

function toRaw(input: unknown): unknown {
  return typeof FormData !== "undefined" && input instanceof FormData ? formDataToObject(input) : input;
}

/**
 * Staff action: requires a signed-in user with `permission` (one key, or any of an array).
 * Ownership checks (a MEDIC's own appointments) happen inside the handler.
 */
export function crmAction<S extends z.ZodType, T>(
  opts: { permission: Permission | Permission[]; schema: S; successMessage?: string | ((d: T) => string) },
  handler: (input: z.output<S>, ctx: { user: CurrentUser }) => Promise<T>,
): ServerActionFn<z.input<S>, T> {
  return async (...args: unknown[]): Promise<ActionResult<T>> => {
    const input = inputOf(args);
    try {
      const user = await getCurrentUser();
      if (!user) return failure("UNAUTHENTICATED");
      if (!can(user, opts.permission)) return failure("FORBIDDEN");
      const parsed = opts.schema.safeParse(toRaw(input));
      if (!parsed.success) return validationFailure(parsed.error);
      const data = await handler(parsed.data, { user });
      const message =
        typeof opts.successMessage === "function" ? opts.successMessage(data) : opts.successMessage;
      return message ? { ok: true, data, message } : { ok: true, data };
    } catch (e) {
      unstable_rethrow(e);
      return mapError(e, "crm");
    }
  };
}

export type RateLimitRule<I> = {
  /** Bucket name, for example "booking:ip" or "booking:phone". */
  bucket: string;
  limit: number;
  windowSec: number;
  /** Key from the validated input (it is hashed before storage). Without it the client IP hash is used. Return null to skip. */
  key?: (i: I) => string | null;
};

/**
 * Public action (site visitors). In order: honeypot and fill time (a bot gets a fake success and
 * nothing is written), IP rate limits, zod validation, keyed rate limits, then the handler.
 */
export function publicAction<S extends z.ZodType, T>(
  opts: {
    schema: S;
    honeypot?: boolean;
    rateLimit?: RateLimitRule<z.output<S>>[];
    successMessage?: string | ((d: T) => string);
    /** What a suspected bot receives as `data` (default null), so the client can render a normal success. */
    botResult?: (raw: Record<string, unknown>) => T;
  },
  handler: (input: z.output<S>, ctx: { ipHash: string; userAgent: string | null }) => Promise<T>,
): ServerActionFn<z.input<S>, T> {
  return async (...args: unknown[]): Promise<ActionResult<T>> => {
    const input = inputOf(args);
    try {
      const raw = toRaw(input);
      const rawObject = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const message = (data: T) =>
        typeof opts.successMessage === "function" ? opts.successMessage(data) : opts.successMessage;

      if (opts.honeypot && isLikelyBot(rawObject)) {
        const data = (opts.botResult ? opts.botResult(rawObject) : null) as T;
        const m = message(data);
        return m ? { ok: true, data, message: m } : { ok: true, data };
      }

      const ipHash = await getIpHash();
      const userAgent = await getUserAgent();

      for (const rule of opts.rateLimit ?? []) {
        if (rule.key) continue;
        const r = await rateLimit(`${rule.bucket}:${ipHash}`, rule.limit, rule.windowSec);
        if (!r.ok) return failure("RATE_LIMITED");
      }

      const parsed = opts.schema.safeParse(raw);
      if (!parsed.success) return validationFailure(parsed.error);

      for (const rule of opts.rateLimit ?? []) {
        if (!rule.key) continue;
        const k = rule.key(parsed.data);
        if (k === null || k === undefined || k === "") continue;
        const hashed = hmacHash(k.toLowerCase(), "ip").slice(0, 32);
        const r = await rateLimit(`${rule.bucket}:${hashed}`, rule.limit, rule.windowSec);
        if (!r.ok) return failure("RATE_LIMITED");
      }

      const data = await handler(parsed.data, { ipHash, userAgent });
      const m = message(data);
      return m ? { ok: true, data, message: m } : { ok: true, data };
    } catch (e) {
      unstable_rethrow(e);
      return mapError(e, "public");
    }
  };
}

/** Throws a DomainError; handy in handlers: `if (!row) fail("NOT_FOUND")`. */
export function fail(code: ErrorCode, message?: string, extra?: { fieldErrors?: Record<string, string[]>; details?: unknown }): never {
  throw new DomainError(code, message, extra);
}
