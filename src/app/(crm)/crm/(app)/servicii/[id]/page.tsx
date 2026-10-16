import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceEditor } from "@/components/crm/admin/ServiceEditor";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { formatLei, pluralRo } from "@/lib/format";
import { can } from "@/lib/permissions";
import { zId } from "@/lib/validation/common";
import { getService } from "@/server/catalog/service";

export const metadata: Metadata = { title: "Serviciu" };

/** One service (`[id]` = its id, or „nou” with an optional `?categorie=`). ADMIN edits; others read. */
export default async function ServicePage({ params, searchParams }: PageProps<"/crm/servicii/[id]">) {
  const user = await requirePermission("catalog.view");
  const { id } = await params;
  const sp = await searchParams;
  const canManage = can(user, "catalog.manage");
  const isNew = id === "nou";
  if (isNew && !canManage) notFound();
  if (!isNew && !zId.safeParse(id).success) notFound();
  const [service, categories] = await Promise.all([
    isNew ? Promise.resolve(null) : getService(id),
    prisma.serviceCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!isNew && !service) notFound();
  const categoryParam = typeof sp.categorie === "string" ? sp.categorie : undefined;
  const title = service ? service.name : "Serviciu nou";

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ label: "Servicii și prețuri", href: "/crm/servicii" }, { label: title }]} />}
        title={title}
        subtitle={
          service
            ? `${service.priceMin === null ? "Preț stabilit la consultație" : formatLei(service.priceMin, { from: service.priceFrom, max: service.priceMax, unit: service.unit })}, ${pluralRo(service.durationMinutes, "minut", "minute")}.${service.usage > 0 ? " Folosit în programări, planuri sau facturi; modificarea prețului nu schimbă documentele deja emise." : ""}`
            : "Prețul și eticheta online apar pe site după salvare."
        }
      />
      {sp.salvat === "1" && (
        <p role="status" className="rounded-panou bg-menta-pal px-4 py-3 text-corp">
          Serviciul a fost adăugat.
        </p>
      )}
      <ServiceEditor
        service={service ?? undefined}
        categories={categories}
        defaultCategoryId={categories.some((c) => c.id === categoryParam) ? categoryParam : undefined}
        readOnly={!canManage}
      />
    </div>
  );
}
