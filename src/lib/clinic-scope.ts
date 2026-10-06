import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth/dal";
import { prisma } from "./db";
import { DomainError } from "./errors";

/**
 * The CRM clinic scope: Cristești, Luduș or both (docs/architecture.md §4.2, §7.2). It persists in
 * the `da_clinica` cookie, set by the `setClinicScope` Server Action in
 * src/components/crm/shell/actions.ts. Without the cookie the default is the user's home
 * location, or „ambele”.
 */

export type ClinicScope = "cristesti" | "ludus" | "ambele";
export const CLINIC_SCOPE_COOKIE = "da_clinica";
export const CLINIC_SCOPES: readonly ClinicScope[] = ["cristesti", "ludus", "ambele"];

export function isClinicScope(v: unknown): v is ClinicScope {
  return typeof v === "string" && (CLINIC_SCOPES as readonly string[]).includes(v);
}

/** Active locations, ordered; memoised per request. */
export const getActiveLocations = cache(async () =>
  prisma.location.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, shortName: true, phone: true },
  }),
);

/**
 * The clinics the signed-in user may work in: the ones ticked on the account (Echipă), or every
 * active clinic for an ADMIN or an account with none ticked.
 */
export const getAllowedLocations = cache(async () => {
  const [user, locations] = await Promise.all([getCurrentUser(), getActiveLocations()]);
  if (!user || user.locationIds.length === 0) return locations;
  return locations.filter((l) => user.locationIds.includes(l.id));
});

/** The scopes the clinic switch offers to this user: their clinics, plus „ambele” when they have two or more. */
export const getAllowedScopes = cache(async (): Promise<ClinicScope[]> => {
  const allowed = (await getAllowedLocations()).map((l) => l.slug).filter(isClinicScope);
  return allowed.length > 1 ? [...allowed, "ambele"] : allowed.length === 1 ? allowed : ["ambele"];
});

export const getClinicScope: () => Promise<ClinicScope> = cache(async () => {
  const scopes = await getAllowedScopes();
  const fromCookie = (await cookies()).get(CLINIC_SCOPE_COOKIE)?.value;
  if (isClinicScope(fromCookie) && scopes.includes(fromCookie)) return fromCookie;
  const user = await getCurrentUser();
  if (user?.homeLocationId) {
    const home = (await getActiveLocations()).find((l) => l.id === user.homeLocationId);
    if (home && isClinicScope(home.slug) && scopes.includes(home.slug)) return home.slug;
  }
  return scopes.includes("ambele") ? "ambele" : scopes[0];
});

/** Location ids covered by a scope (the current one by default), limited to the user's clinics. */
export async function scopeLocationIds(scope?: ClinicScope): Promise<string[]> {
  const s = scope ?? (await getClinicScope());
  const allowed = await getAllowedLocations();
  if (s === "ambele") return allowed.map((l) => l.id);
  return allowed.filter((l) => l.slug === s).map((l) => l.id);
}

/** True when the user may open records of this clinic. A record without a clinic is open to all. */
export async function canAccessLocation(locationId: string | null | undefined): Promise<boolean> {
  if (!locationId) return true;
  return (await getAllowedLocations()).some((l) => l.id === locationId);
}

/** Redirects to „acces interzis” when the record belongs to a clinic the user does not work in. */
export async function requireLocationAccess(locationId: string | null | undefined): Promise<void> {
  if (!(await canAccessLocation(locationId))) redirect("/crm/acces-interzis");
}

const NO_CLINIC_ACCESS = "Această înregistrare aparține altei clinici. Nu aveți acces la ea.";

/** For Server Actions: throws FORBIDDEN when the clinic is not one of the user's clinics. */
export async function assertLocationAccess(locationId: string | null | undefined): Promise<void> {
  if (!(await canAccessLocation(locationId))) throw new DomainError("FORBIDDEN", NO_CLINIC_ACCESS);
}

/** Looks up the clinic of an appointment, a lead or an invoice and checks the user may act on it. */
export async function assertRecordAccess(kind: "appointment" | "lead" | "invoice", id: string): Promise<void> {
  const select = { locationId: true } as const;
  const row =
    kind === "appointment"
      ? await prisma.appointment.findUnique({ where: { id }, select })
      : kind === "lead"
        ? await prisma.lead.findUnique({ where: { id }, select })
        : await prisma.invoice.findUnique({ where: { id }, select });
  if (row) await assertLocationAccess(row.locationId);
}
