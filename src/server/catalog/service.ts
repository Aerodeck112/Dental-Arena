import "server-only";
import type { PriceUnit } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/dal";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { CategoryInput, ServiceInput } from "./schemas";

/**
 * Services and prices catalog (docs/architecture.md §3.1, §10.3, WP8). The public site renders
 * prices from these rows; actions revalidate the site after every save. Exactly one active
 * representative service per category is enforced here.
 */

export type ServiceRow = {
  id: string;
  categoryId: string;
  code: string | null;
  name: string;
  priceMin: number | null;
  priceMax: number | null;
  priceFrom: boolean;
  unit: PriceUnit;
  durationMinutes: number;
  bookableOnline: boolean;
  onlineLabel: string | null;
  onlineHint: string | null;
  urgent: boolean;
  isRepresentative: boolean;
  toothSpecific: boolean;
  recallMonths: number | null;
  publicVisible: boolean;
  active: boolean;
  sortOrder: number;
};

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  sortOrder: number;
  publicVisible: boolean;
  active: boolean;
  services: ServiceRow[];
};

const serviceSelect = {
  id: true,
  categoryId: true,
  code: true,
  name: true,
  priceMin: true,
  priceMax: true,
  priceFrom: true,
  unit: true,
  durationMinutes: true,
  bookableOnline: true,
  onlineLabel: true,
  onlineHint: true,
  urgent: true,
  isRepresentative: true,
  toothSpecific: true,
  recallMonths: true,
  publicVisible: true,
  active: true,
  sortOrder: true,
} as const;

export async function listCatalog(): Promise<CategoryRow[]> {
  return prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      sortOrder: true,
      publicVisible: true,
      active: true,
      services: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: serviceSelect },
    },
  });
}

export async function getService(id: string): Promise<(ServiceRow & { usage: number }) | null> {
  const s = await prisma.service.findUnique({
    where: { id },
    select: { ...serviceSelect, _count: { select: { appointments: true, planItems: true, invoiceItems: true, leads: true } } },
  });
  if (!s) return null;
  const { _count, ...row } = s;
  return { ...row, usage: _count.appointments + _count.planItems + _count.invoiceItems + _count.leads };
}

export async function getCategory(id: string): Promise<Omit<CategoryRow, "services"> | null> {
  return prisma.serviceCategory.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, summary: true, sortOrder: true, publicVisible: true, active: true },
  });
}

/** Active services for pickers (invoice lines, plan lines): code, name, price, category. */
export async function listServiceOptions(): Promise<
  { id: string; code: string | null; name: string; categoryName: string; priceMin: number | null; priceMax: number | null; priceFrom: boolean; unit: PriceUnit }[]
> {
  const rows = await prisma.service.findMany({
    where: { active: true, category: { active: true } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, code: true, name: true, priceMin: true, priceMax: true, priceFrom: true, unit: true, category: { select: { name: true } } },
  });
  return rows.map(({ category, ...r }) => ({ ...r, categoryName: category.name }));
}

/** If a category has active services but no representative, the first one (by order) becomes it. */
async function ensureRepresentative(tx: Tx, categoryId: string): Promise<void> {
  const reps = await tx.service.findMany({
    where: { categoryId, active: true, isRepresentative: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (reps.length === 1) return;
  if (reps.length > 1) {
    await tx.service.updateMany({ where: { categoryId, id: { not: reps[0].id } }, data: { isRepresentative: false } });
    return;
  }
  const first = await tx.service.findFirst({
    where: { categoryId, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (first) await tx.service.update({ where: { id: first.id }, data: { isRepresentative: true } });
  // Inactive services never stay representative.
  await tx.service.updateMany({ where: { categoryId, active: false, isRepresentative: true }, data: { isRepresentative: false } });
}

export async function saveCategory(i: CategoryInput, actor: CurrentUser): Promise<{ id: string; slug: string }> {
  const clash = await prisma.serviceCategory.findFirst({ where: { slug: i.slug, ...(i.id ? { id: { not: i.id } } : {}) }, select: { id: true } });
  if (clash) throw new DomainError("VALIDATION", undefined, { fieldErrors: { slug: ["Există deja o categorie cu această adresă."] } });
  const data = {
    slug: i.slug,
    name: i.name,
    summary: i.summary ?? null,
    sortOrder: i.sortOrder,
    publicVisible: i.publicVisible,
    active: i.active,
  };
  return prisma.$transaction(async (tx) => {
    const row = i.id
      ? await tx.serviceCategory.update({ where: { id: i.id }, data, select: { id: true, slug: true } })
      : await tx.serviceCategory.create({ data, select: { id: true, slug: true } });
    await audit(
      { action: "catalog.update", entityType: "ServiceCategory", entityId: row.id, metadata: { op: i.id ? "update" : "create", fields: Object.keys(data) } },
      { actor, db: tx },
    );
    return row;
  });
}

export async function deleteCategory(id: string, actor: CurrentUser): Promise<{ slug: string }> {
  return prisma.$transaction(async (tx) => {
    const cat = await tx.serviceCategory.findUnique({ where: { id }, select: { slug: true, _count: { select: { services: true } } } });
    if (!cat) throw new DomainError("NOT_FOUND", "Categoria nu există.");
    if (cat._count.services > 0) {
      throw new DomainError("VALIDATION", "Categoria are servicii. Mutați sau ștergeți serviciile, ori dezactivați categoria.");
    }
    await tx.serviceCategory.delete({ where: { id } });
    await audit({ action: "catalog.update", entityType: "ServiceCategory", entityId: id, metadata: { op: "delete" } }, { actor, db: tx });
    return { slug: cat.slug };
  });
}

export async function saveService(i: ServiceInput, actor: CurrentUser): Promise<{ id: string; categorySlug: string }> {
  const category = await prisma.serviceCategory.findUnique({ where: { id: i.categoryId }, select: { id: true, slug: true } });
  if (!category) throw new DomainError("VALIDATION", undefined, { fieldErrors: { categoryId: ["Alegeți o categorie."] } });
  if (i.code) {
    const clash = await prisma.service.findFirst({ where: { code: i.code, ...(i.id ? { id: { not: i.id } } : {}) }, select: { id: true } });
    if (clash) throw new DomainError("VALIDATION", undefined, { fieldErrors: { code: ["Codul este folosit de alt serviciu."] } });
  }
  const before = i.id
    ? await prisma.service.findUnique({ where: { id: i.id }, select: { categoryId: true, isRepresentative: true, active: true } })
    : null;
  if (i.id && !before) throw new DomainError("NOT_FOUND", "Serviciul nu există.");
  if (before?.isRepresentative && !i.isRepresentative && before.categoryId === i.categoryId && i.active) {
    throw new DomainError("VALIDATION", undefined, {
      fieldErrors: { isRepresentative: ["Fiecare categorie are exact un serviciu reprezentativ. Marcați alt serviciu ca reprezentativ, iar acesta se debifează singur."] },
    });
  }
  if (i.isRepresentative && !i.active) {
    throw new DomainError("VALIDATION", undefined, { fieldErrors: { isRepresentative: ["Un serviciu inactiv nu poate fi reprezentativ."] } });
  }
  const data = {
    categoryId: i.categoryId,
    code: i.code ?? null,
    name: i.name,
    priceMin: i.priceMin,
    priceMax: i.priceMax,
    priceFrom: i.priceFrom,
    unit: i.unit,
    durationMinutes: i.durationMinutes,
    bookableOnline: i.bookableOnline,
    onlineLabel: i.onlineLabel ?? null,
    onlineHint: i.onlineHint ?? null,
    urgent: i.urgent,
    isRepresentative: i.isRepresentative,
    toothSpecific: i.toothSpecific,
    recallMonths: i.recallMonths ?? null,
    publicVisible: i.publicVisible,
    active: i.active,
    sortOrder: i.sortOrder,
  };
  return prisma.$transaction(async (tx) => {
    const row = i.id
      ? await tx.service.update({ where: { id: i.id }, data, select: { id: true } })
      : await tx.service.create({ data, select: { id: true } });
    if (i.isRepresentative) {
      await tx.service.updateMany({ where: { categoryId: i.categoryId, id: { not: row.id } }, data: { isRepresentative: false } });
    }
    await ensureRepresentative(tx, i.categoryId);
    if (before && before.categoryId !== i.categoryId) await ensureRepresentative(tx, before.categoryId);
    await audit(
      { action: "catalog.update", entityType: "Service", entityId: row.id, metadata: { op: i.id ? "update" : "create", fields: Object.keys(data) } },
      { actor, db: tx },
    );
    return { id: row.id, categorySlug: category.slug };
  });
}

/** Deletes an unused service; a service used by appointments, plans, invoices or leads is deactivated instead. */
export async function deleteService(id: string, actor: CurrentUser): Promise<{ deleted: boolean; categoryId: string }> {
  const s = await getService(id);
  if (!s) throw new DomainError("NOT_FOUND", "Serviciul nu există.");
  return prisma.$transaction(async (tx) => {
    let deleted = false;
    if (s.usage === 0) {
      await tx.service.delete({ where: { id } });
      deleted = true;
    } else {
      await tx.service.update({ where: { id }, data: { active: false, bookableOnline: false, isRepresentative: false } });
    }
    await ensureRepresentative(tx, s.categoryId);
    await audit(
      { action: "catalog.update", entityType: "Service", entityId: id, metadata: { op: deleted ? "delete" : "deactivate" } },
      { actor, db: tx },
    );
    return { deleted, categoryId: s.categoryId };
  });
}
