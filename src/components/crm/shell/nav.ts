import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "@/lib/permissions";

/**
 * CRM sidebar (docs/architecture.md §11, WP1 „Sidebar”). Items appear in this order; each one
 * declares the permission it needs and is hidden without it. Pure: shared by the server layout
 * and the client sidebar.
 */

export type NavIcon =
  | "azi"
  | "calendar"
  | "cereri"
  | "pacienti"
  | "rechemari"
  | "incasari"
  | "facturi"
  | "servicii"
  | "echipa"
  | "absente"
  | "locatii"
  | "mesaje"
  | "rapoarte"
  | "gdpr"
  | "audit"
  | "fotografii"
  | "setari";

export type NavCountKey = "leadsNew" | "recallsDue";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** One key or any of several. */
  permission: Permission | Permission[];
  /** Count badge shown next to the label. */
  count?: NavCountKey;
  /** Active only on the exact path (Azi), not on its children. */
  exact?: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/crm", label: "Azi", icon: "azi", permission: "dashboard.view", exact: true },
  { href: "/crm/programari", label: "Calendar", icon: "calendar", permission: "appointments.view" },
  { href: "/crm/cereri", label: "Cereri online", icon: "cereri", permission: "leads.view", count: "leadsNew" },
  { href: "/crm/pacienti", label: "Pacienți", icon: "pacienti", permission: "patients.view" },
  { href: "/crm/rechemari", label: "De rechemat", icon: "rechemari", permission: "recalls.view", count: "recallsDue" },
  { href: "/crm/incasari", label: "Încasări", icon: "incasari", permission: "billing.view" },
  { href: "/crm/facturi", label: "Facturi", icon: "facturi", permission: "billing.view" },
  { href: "/crm/servicii", label: "Servicii și prețuri", icon: "servicii", permission: "catalog.view" },
  { href: "/crm/echipa", label: "Echipă", icon: "echipa", permission: "staff.view" },
  { href: "/crm/absente", label: "Absențe", icon: "absente", permission: "schedules.view" },
  { href: "/crm/locatii", label: "Locații", icon: "locatii", permission: "locations.view" },
  { href: "/crm/mesaje", label: "Mesaje", icon: "mesaje", permission: "messages.view" },
  {
    href: "/crm/rapoarte",
    label: "Rapoarte",
    icon: "rapoarte",
    permission: ["reports.view", "reports.operational", "reports.viewOwn"],
  },
  { href: "/crm/gdpr", label: "GDPR", icon: "gdpr", permission: "gdpr.manage" },
  { href: "/crm/audit", label: "Audit", icon: "audit", permission: "audit.view" },
  { href: "/crm/fotografii", label: "Fotografii site", icon: "fotografii", permission: "settings.manage" },
  { href: "/crm/setari", label: "Setări", icon: "setari", permission: "settings.manage" },
];

/** The items a role may see, in order. */
export function navItemsFor(user: { role: Role }): NavItem[] {
  return NAV_ITEMS.filter((item) => can(user, item.permission));
}

/** True when `pathname` belongs to the item. */
export function isNavItemActive(item: Pick<NavItem, "href" | "exact">, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
