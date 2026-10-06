import "server-only";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { formatPhone } from "@/lib/format";
import { hoursProblems, type CabinetInput, type HoursRow, type LocationInput } from "./schemas";

/**
 * Locations, opening hours and cabinets (docs/architecture.md §3.1, §10.1, WP8). Hours appear on
 * the public site only when `publishHours` is on; actions revalidate the site after every save.
 */

export type LocationRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  street: string;
  city: string;
  phone: string;
  publishHours: boolean;
  sedationUnits: number;
  active: boolean;
  cabinets: number;
  hours: HoursRow[];
};

export type LocationDetail = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  street: string;
  city: string;
  county: string;
  postalCode: string | null;
  phone: string;
  email: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  publishHours: boolean;
  sedationUnits: number;
  sortOrder: number;
  active: boolean;
  hours: HoursRow[];
  cabinets: { id: string; name: string; sortOrder: number; active: boolean; usage: number }[];
};

const hoursOrder = [{ weekday: "asc" as const }, { openMinute: "asc" as const }];

export async function listLocations(): Promise<LocationRow[]> {
  const rows = await prisma.location.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      street: true,
      city: true,
      phone: true,
      publishHours: true,
      sedationUnits: true,
      active: true,
      _count: { select: { cabinets: { where: { active: true } } } },
      hours: { orderBy: hoursOrder, select: { weekday: true, openMinute: true, closeMinute: true } },
    },
  });
  return rows.map(({ _count, ...r }) => ({ ...r, cabinets: _count.cabinets }));
}

export async function getLocation(id: string): Promise<LocationDetail | null> {
  const l = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      shortName: true,
      street: true,
      city: true,
      county: true,
      postalCode: true,
      phone: true,
      email: true,
      mapsUrl: true,
      latitude: true,
      longitude: true,
      publishHours: true,
      sedationUnits: true,
      sortOrder: true,
      active: true,
      hours: { orderBy: hoursOrder, select: { weekday: true, openMinute: true, closeMinute: true } },
      cabinets: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, sortOrder: true, active: true, _count: { select: { appointments: true, shifts: true } } },
      },
    },
  });
  if (!l) return null;
  return {
    ...l,
    cabinets: l.cabinets.map(({ _count, ...c }) => ({ ...c, usage: _count.appointments + _count.shifts })),
  };
}

export async function updateLocation(i: LocationInput, actor: CurrentUser): Promise<{ slug: string }> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.location.findUnique({ where: { id: i.id }, select: { slug: true, active: true } });
    if (!before) throw new DomainError("NOT_FOUND", "Clinica nu există.");
    if (before.active && !i.active && (await tx.location.count({ where: { active: true } })) <= 1) {
      throw new DomainError("VALIDATION", undefined, { fieldErrors: { active: ["Cel puțin o clinică rămâne activă."] } });
    }
    const data = {
      name: i.name,
      shortName: i.shortName,
      street: i.street,
      city: i.city,
      county: i.county,
      postalCode: i.postalCode ?? null,
      phone: formatPhone(i.phone),
      email: i.email ?? null,
      mapsUrl: i.mapsUrl ?? null,
      latitude: i.latitude ?? null,
      longitude: i.longitude ?? null,
      publishHours: i.publishHours,
      sedationUnits: i.sedationUnits,
      sortOrder: i.sortOrder,
      active: i.active,
    };
    await tx.location.update({ where: { id: i.id }, data });
    await audit({ action: "settings.update", entityType: "Location", entityId: i.id, metadata: { fields: Object.keys(data) } }, { actor, db: tx });
    return { slug: before.slug };
  });
}

/** Replaces the week's opening intervals of a clinic. */
export async function saveLocationHours(locationId: string, rows: HoursRow[], actor: CurrentUser): Promise<void> {
  const problems = hoursProblems(rows);
  if (problems.length) throw new DomainError("VALIDATION", problems[0], { fieldErrors: { hours: problems } });
  await prisma.$transaction(async (tx) => {
    if (!(await tx.location.findUnique({ where: { id: locationId }, select: { id: true } }))) throw new DomainError("NOT_FOUND", "Clinica nu există.");
    await tx.locationHours.deleteMany({ where: { locationId } });
    if (rows.length) await tx.locationHours.createMany({ data: rows.map((r) => ({ ...r, locationId })) });
    await audit(
      { action: "schedule.update", entityType: "LocationHours", entityId: locationId, metadata: { fields: ["hours"], intervals: rows.length } },
      { actor, db: tx },
    );
  });
}

export async function saveCabinet(i: CabinetInput, actor: CurrentUser): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    if (i.id) {
      const c = await tx.cabinet.findUnique({ where: { id: i.id }, select: { locationId: true } });
      if (!c || c.locationId !== i.locationId) throw new DomainError("NOT_FOUND", "Cabinetul nu există.");
    }
    const clash = await tx.cabinet.findFirst({
      where: { locationId: i.locationId, name: i.name, ...(i.id ? { id: { not: i.id } } : {}) },
      select: { id: true },
    });
    if (clash) throw new DomainError("VALIDATION", undefined, { fieldErrors: { name: ["Există deja un cabinet cu acest nume în clinică."] } });
    const data = { name: i.name, sortOrder: i.sortOrder, active: i.active };
    const row = i.id
      ? await tx.cabinet.update({ where: { id: i.id }, data, select: { id: true } })
      : await tx.cabinet.create({ data: { ...data, locationId: i.locationId }, select: { id: true } });
    await audit(
      { action: "settings.update", entityType: "Cabinet", entityId: row.id, metadata: { op: i.id ? "update" : "create", fields: Object.keys(data) } },
      { actor, db: tx },
    );
    return row;
  });
}

/** Deletes an unused cabinet; one used by appointments or shifts is deactivated instead. */
export async function deleteCabinet(id: string, actor: CurrentUser): Promise<{ deleted: boolean; locationId: string }> {
  return prisma.$transaction(async (tx) => {
    const c = await tx.cabinet.findUnique({ where: { id }, select: { locationId: true, _count: { select: { appointments: true, shifts: true } } } });
    if (!c) throw new DomainError("NOT_FOUND", "Cabinetul nu există.");
    const used = c._count.appointments + c._count.shifts > 0;
    if (used) await tx.cabinet.update({ where: { id }, data: { active: false } });
    else await tx.cabinet.delete({ where: { id } });
    await audit({ action: "settings.update", entityType: "Cabinet", entityId: id, metadata: { op: used ? "deactivate" : "delete" } }, { actor, db: tx });
    return { deleted: !used, locationId: c.locationId };
  });
}
