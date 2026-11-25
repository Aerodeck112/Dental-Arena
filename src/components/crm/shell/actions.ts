"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crmAction, publicAction } from "@/lib/actions";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { deleteSession } from "@/lib/auth/session";
import { CLINIC_SCOPE_COOKIE, CLINIC_SCOPES, type ClinicScope } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/** Clinic switch in the top bar: persists the scope in the `da_clinica` cookie. */
export const setClinicScope = crmAction(
  {
    permission: "dashboard.view",
    schema: z.object({ scope: z.enum(CLINIC_SCOPES as [ClinicScope, ...ClinicScope[]]) }),
  },
  async ({ scope }) => {
    (await cookies()).set(CLINIC_SCOPE_COOKIE, scope, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath("/crm", "layout");
    return { scope };
  },
);

/** Theme toggle in the user menu: stores the preference on the user. */
export const setThemePreference = crmAction(
  {
    permission: "dashboard.view",
    schema: z.object({ theme: z.enum(["SISTEM", "LUMINOS", "INTUNECAT"]) }),
  },
  async ({ theme }, { user }) => {
    await prisma.user.update({ where: { id: user.id }, data: { theme } });
    return { theme };
  },
);

/**
 * „Ieșiți din cont”. Works even when the session is no longer valid in the database, so the
 * cookie is always cleared.
 */
export const logout = publicAction({ schema: z.object({}) }, async () => {
  const user = await getCurrentUser();
  if (user) {
    await audit({ action: "auth.logout", entityType: "User", entityId: user.id }, { actor: user });
  }
  await deleteSession();
  redirect("/crm/login");
});
