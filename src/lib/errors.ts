/**
 * Domain errors (docs/architecture.md §7.1). Services throw `DomainError`; the action wrappers
 * in `src/lib/actions.ts` turn it into an `ActionResult`. Pure; client components may import the
 * types.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SLOT_TAKEN"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "STALE"
  | "INTERNAL";

/**
 * Structural shape of a scheduling conflict. WP4's `Conflict` (src/server/scheduling/types.ts)
 * is assignable to it; the platform layer cannot import from `src/server`.
 */
export type ConflictInfo = {
  kind: string;
  severity: "block" | "warn";
  message: string;
  appointmentId?: string;
};

export type ErrorDetails = { conflicts?: ConflictInfo[] } & Record<string, unknown>;

/** Default Romanian messages per code (design system §12.4: say what happened and what to do). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Sesiunea a expirat. Intrați din nou în cont.",
  FORBIDDEN: "Nu aveți acces la această acțiune. Cereți-i administratorului drepturile necesare.",
  VALIDATION: "Verificați câmpurile marcate și încercați din nou.",
  NOT_FOUND: "Înregistrarea nu mai există. Reîncărcați pagina.",
  CONFLICT: "Există un conflict în program. Alegeți altă oră sau alt medic.",
  SLOT_TAKEN: "Ora aleasă tocmai a fost ocupată. Alegeți altă oră; celelalte date au rămas completate.",
  INVALID_TRANSITION: "Statusul nu poate fi schimbat astfel. Reîncărcați pagina și încercați din nou.",
  RATE_LIMITED: "Ați trimis prea multe cereri. Încercați din nou peste câteva minute sau sunați-ne.",
  STALE: "Înregistrarea a fost modificată între timp. Reîncărcați pagina.",
  INTERNAL: "A apărut o eroare neașteptată. Încercați din nou.",
};

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  readonly details?: ErrorDetails;

  constructor(
    code: ErrorCode,
    message?: string,
    extra?: { fieldErrors?: Record<string, string[]>; details?: unknown },
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "DomainError";
    this.code = code;
    this.fieldErrors = extra?.fieldErrors;
    this.details = extra?.details as ErrorDetails | undefined;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError || (e instanceof Error && e.name === "DomainError" && "code" in e);
}
