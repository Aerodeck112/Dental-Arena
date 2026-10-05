import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentUser } from "./auth/dal";
import { prisma } from "./db";

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

export const getClinicScope: () => Promise<ClinicScope> = cache(async () => {
  const fromCookie = (await cookies()).get(CLINIC_SCOPE_COOKIE)?.value;
  if (isClinicScope(fromCookie)) return fromCookie;
  const user = await getCurrentUser();
  if (user?.homeLocationId) {
    const home = (await getActiveLocations()).find((l) => l.id === user.homeLocationId);
    if (home && isClinicScope(home.slug)) return home.slug;
  }
  return "ambele";
});

/** Location ids covered by a scope (the current one by default). „ambele” = every active location. */
export async function scopeLocationIds(scope?: ClinicScope): Promise<string[]> {
  const s = scope ?? (await getClinicScope());
  const locations = await getActiveLocations();
  if (s === "ambele") return locations.map((l) => l.id);
  return locations.filter((l) => l.slug === s).map((l) => l.id);
}
