import type { Role } from "@/generated/prisma/enums";

/**
 * Permission keys (docs/architecture.md §5.2). Pure; importable by client components to hide
 * controls. The server-side checks (`requirePermission`, `crmAction`) are the real boundary.
 */
export const PERMISSIONS = {
  "dashboard.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "dashboard.revenue":         ["ADMIN"],                       // month revenue on Azi
  "appointments.view":         ["ADMIN", "MEDIC", "RECEPTIE"],  // all calendars, both clinics
  "appointments.manage":       ["ADMIN", "RECEPTIE"],           // create/edit/move/cancel/status for anyone
  "appointments.manageOwn":    ["MEDIC"],                       // same, only where doctorId = own doctor
  "appointments.override":     ["ADMIN", "RECEPTIE"],           // save despite "warn" conflicts
  "leads.view":                ["ADMIN", "RECEPTIE"],
  "leads.manage":              ["ADMIN", "RECEPTIE"],           // status, assign, convert
  "recalls.view":              ["ADMIN", "MEDIC", "RECEPTIE"],  // MEDIC: own recalls
  "recalls.manage":            ["ADMIN", "RECEPTIE"],
  "patients.view":             ["ADMIN", "MEDIC", "RECEPTIE"],
  "patients.create":           ["ADMIN", "MEDIC", "RECEPTIE"],
  "patients.edit":             ["ADMIN", "MEDIC", "RECEPTIE"],  // demographics, contact, tags, comfort
  "patients.revealCnp":        ["ADMIN", "MEDIC", "RECEPTIE"],  // always audited
  "consents.manage":           ["ADMIN", "MEDIC", "RECEPTIE"],
  "medical.view":              ["ADMIN", "MEDIC"],              // anamneză, odontogramă, clinical notes
  "medical.edit":              ["ADMIN", "MEDIC"],
  "plans.view":                ["ADMIN", "MEDIC", "RECEPTIE"],  // reception needs prices to bill
  "plans.manage":              ["ADMIN", "MEDIC"],
  "documents.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "documents.upload":          ["ADMIN", "MEDIC", "RECEPTIE"],
  "documents.delete":          ["ADMIN"],                       // soft delete
  "gdpr.manage":               ["ADMIN"],                       // export, anonymise, request register
  "catalog.view":              ["ADMIN", "MEDIC", "RECEPTIE"],
  "catalog.manage":            ["ADMIN"],
  "billing.view":              ["ADMIN", "RECEPTIE"],
  "billing.create":            ["ADMIN", "RECEPTIE"],           // invoices + payments
  "billing.cancel":            ["ADMIN"],
  "staff.view":                ["ADMIN", "MEDIC", "RECEPTIE"],
  "staff.manage":              ["ADMIN"],
  "schedules.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "schedules.manage":          ["ADMIN"],
  "timeoff.manage":            ["ADMIN", "RECEPTIE"],           // MEDIC may add own time off (scoped)
  "locations.view":            ["ADMIN", "MEDIC", "RECEPTIE"],
  "locations.manage":          ["ADMIN"],
  "messages.view":             ["ADMIN", "RECEPTIE"],
  "messages.send":             ["ADMIN", "RECEPTIE"],
  "templates.manage":          ["ADMIN"],
  "reports.view":              ["ADMIN"],                       // every report, incl. revenue
  "reports.operational":       ["ADMIN", "RECEPTIE"],           // appointments, no-shows, leads
  "reports.viewOwn":           ["ADMIN", "MEDIC"],              // own production and no-shows
  "audit.view":                ["ADMIN"],
  "settings.manage":           ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** True when the user's role grants the permission, or any of them when given an array. */
export function can(user: { role: Role } | null | undefined, p: Permission | Permission[]): boolean {
  if (!user) return false;
  const keys = Array.isArray(p) ? p : [p];
  return keys.some((key) => (PERMISSIONS[key] as readonly Role[]).includes(user.role));
}

/** Every permission granted to a role (for display and tests). */
export function permissionsOf(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((key) =>
    (PERMISSIONS[key] as readonly Role[]).includes(role),
  );
}

/**
 * §5.2 scoping rule: ADMIN and RECEPTIE manage time off for anyone; a MEDIC only for their own
 * doctor profile (and never a location-wide closure).
 */
export function canManageTimeOff(
  user: { role: Role; doctorId: string | null } | null | undefined,
  doctorId: string | null,
): boolean {
  if (!user) return false;
  if (can(user, "timeoff.manage")) return true;
  return user.role === "MEDIC" && user.doctorId !== null && doctorId === user.doctorId;
}

/**
 * True when the user may act on an appointment of `doctorId`: with `appointments.manage`, any;
 * with `appointments.manageOwn`, only their own.
 */
export function canActOnDoctorAppointment(
  user: { role: Role; doctorId: string | null } | null | undefined,
  doctorId: string,
): boolean {
  if (!user) return false;
  if (can(user, "appointments.manage")) return true;
  return can(user, "appointments.manageOwn") && user.doctorId !== null && user.doctorId === doctorId;
}
