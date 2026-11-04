import { AppShell, type ShellUser } from "@/components/crm/shell/AppShell";
import type { NavCountKey } from "@/components/crm/shell/nav";
import { requireUser, type CurrentUser } from "@/lib/auth/dal";
import { getAllowedScopes, getClinicScope, scopeLocationIds, type ClinicScope } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { localDayRangeUtc, todayISO } from "@/lib/time";

/**
 * Signed-in CRM area: every page below renders inside the shell. Pages still call
 * `requirePermission()` themselves (docs/architecture.md §8.5); this layout is not a security
 * boundary for nested data.
 */

/** Sidebar badges: new online requests and recalls due today or earlier, in the clinic scope. */
async function getNavCounts(user: CurrentUser, scope: ClinicScope): Promise<Partial<Record<NavCountKey, number>>> {
  const locationIds = await scopeLocationIds(scope);
  const inScope = { OR: [{ locationId: { in: locationIds } }, { locationId: null }] };
  const endOfToday = localDayRangeUtc(todayISO()).end;

  const [leadsNew, recallsDue] = await Promise.all([
    can(user, "leads.view") ? prisma.lead.count({ where: { status: "NOU", ...inScope } }) : Promise.resolve(0),
    can(user, "recalls.view")
      ? prisma.recall.count({
          where: {
            status: "DE_FACUT",
            dueDate: { lt: endOfToday },
            ...inScope,
            ...(user.role === "MEDIC" ? { doctorId: user.doctorId ?? "__niciunul__" } : {}),
          },
        })
      : Promise.resolve(0),
  ]);
  return { leadsNew, recallsDue };
}

export default async function CrmAppLayout({ children }: LayoutProps<"/crm">) {
  const user = await requireUser();
  const [scope, scopes] = await Promise.all([getClinicScope(), getAllowedScopes()]);
  const counts = await getNavCounts(user, scope);

  const shellUser: ShellUser = {
    displayName: user.displayName,
    firstName: user.firstName,
    role: user.role,
    roleLabel: ROLE_LABEL[user.role],
    theme: user.theme,
    canCreateAppointment: can(user, ["appointments.manage", "appointments.manageOwn"]),
  };

  return (
    <AppShell user={shellUser} scope={scope} scopes={scopes} counts={counts}>
      {children}
    </AppShell>
  );
}
