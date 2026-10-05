import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Density, Role, ThemePreference } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { can, type Permission } from "../permissions";
import { getRequestPath } from "../request";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * Data Access Layer for authentication (docs/architecture.md §5.1). This is the real security
 * boundary: every CRM page, action and route handler goes through `getCurrentUser()`.
 */

export type CurrentUser = {
  id: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  doctorId: string | null;
  homeLocationId: string | null;
  theme: ThemePreference;
  density: Density;
  mustChangePassword: boolean;
};

/**
 * The signed-in user, or null. Checks the JWT, that the user exists and is active, that the
 * session version still matches (revocation) and that the account is not locked.
 * Memoised per request with React `cache()`.
 */
export const getCurrentUser: () => Promise<CurrentUser | null> = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: {
      id: true,
      role: true,
      email: true,
      firstName: true,
      lastName: true,
      active: true,
      sessionVersion: true,
      lockedUntil: true,
      homeLocationId: true,
      theme: true,
      density: true,
      mustChangePassword: true,
      doctor: { select: { id: true, publicName: true } },
    },
  });
  if (!user || !user.active) return null;
  if (user.sessionVersion !== claims.sv) return null;
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null;

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.doctor?.publicName ?? `${user.firstName} ${user.lastName}`.trim(),
    doctorId: user.doctor?.id ?? null,
    homeLocationId: user.homeLocationId,
    theme: user.theme,
    density: user.density,
    mustChangePassword: user.mustChangePassword,
  };
});

/** Login URL that returns to the current page after signing in. */
async function loginRedirectUrl(): Promise<string> {
  const path = await getRequestPath();
  return path && path.startsWith("/crm") && path !== "/crm/login"
    ? `/crm/login?next=${encodeURIComponent(path)}`
    : "/crm/login";
}

/**
 * The signed-in user, or a redirect to `/crm/login?next=…`. A user who must change the password
 * is sent to `/crm/cont?schimbare=1` from every other page.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectUrl());
  if (user.mustChangePassword) {
    const path = (await getRequestPath()) ?? "";
    if (!path.startsWith("/crm/cont") && !path.startsWith("/crm/acces-interzis")) {
      redirect("/crm/cont?schimbare=1");
    }
  }
  return user;
}

/** The signed-in user with the permission (or any of them), else a redirect to `/crm/acces-interzis`. */
export async function requirePermission(p: Permission | Permission[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, p)) redirect("/crm/acces-interzis");
  return user;
}
