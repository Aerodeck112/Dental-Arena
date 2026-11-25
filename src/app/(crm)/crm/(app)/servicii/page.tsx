import type { Metadata } from "next";
import Link from "next/link";
import { CategoryEditor } from "@/components/crm/admin/CategoryEditor";
import { ButtonLink, EmptyState, FlagTag, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { formatLei } from "@/lib/format";
import { can } from "@/lib/permissions";
import { listCatalog } from "@/server/catalog/service";

export const metadata: Metadata = { title: "Servicii și prețuri" };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Servicii și prețuri: the single source for the site's price lists, the booking reasons and the
 * durations. Everyone reads it; only ADMIN edits.
 */
export default async function CatalogPage({ searchParams }: PageProps<"/crm/servicii">) {
  const user = await requirePermission("catalog.view");
  const sp = await searchParams;
  const categories = await listCatalog();
  const canManage = can(user, "catalog.manage");
  const services = categories.flatMap((c) => c.services);
  const online = services.filter((s) => s.active && s.bookableOnline).length;
  const notice = one(sp.sters) ? "Serviciul a fost șters." : one(sp.dezactivat) ? "Serviciul era folosit, așa că a fost dezactivat; rămâne în istoric." : null;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Servicii și prețuri"
        subtitle={`${categories.length} categorii, ${services.filter((s) => s.active).length} servicii active, dintre care ${online} se pot programa online. Prețurile de aici apar pe site.`}
        actions={
          canManage && (
            <>
              <CategoryEditor nextSortOrder={(categories.at(-1)?.sortOrder ?? 0) + 1} />
              <ButtonLink href="/crm/servicii/nou" icon="plus">
                Serviciu nou
              </ButtonLink>
            </>
          )
        }
      />
      {notice && (
        <p role="status" className="rounded-panou bg-menta-pal px-4 py-3 text-corp">
          {notice}
        </p>
      )}
      {categories.length === 0 && (
        <EmptyState title="Nicio categorie încă. Adăugați prima categorie de servicii; fiecare devine o pagină pe site." />
      )}
      {categories.map((c) => (
        <section key={c.id} aria-labelledby={`cat-${c.id}`} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linie-control pb-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id={`cat-${c.id}`} className="flex flex-wrap items-center gap-2 text-h3 font-semibold">
                {c.name}
                {!c.active && <FlagTag kind="neutral">Inactivă</FlagTag>}
                {c.active && !c.publicVisible && <FlagTag kind="neutral">Ascunsă pe site</FlagTag>}
              </h2>
              <p className="text-mic text-discret">/servicii/{c.slug}</p>
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <CategoryEditor
                  category={{
                    id: c.id,
                    slug: c.slug,
                    name: c.name,
                    summary: c.summary,
                    sortOrder: c.sortOrder,
                    publicVisible: c.publicVisible,
                    active: c.active,
                    serviceCount: c.services.length,
                  }}
                />
                <ButtonLink href={`/crm/servicii/nou?categorie=${c.id}`} variant="text" size="s" icon="plus">
                  Serviciu în categorie
                </ButtonLink>
              </div>
            )}
          </div>
          {c.services.length === 0 ? (
            <p className="py-2 text-corp text-discret">Niciun serviciu în această categorie.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] table-fixed border-collapse text-left text-mic cifre">
                <caption className="sr-only">Serviciile din {c.name}</caption>
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[14%]" />
                  <col className="w-[9%]" />
                  <col className="w-[17%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <thead>
                  <tr className="text-discret">
                    <th scope="col" className="h-rand px-3 pb-2 align-bottom font-semibold">Serviciu</th>
                    <th scope="col" className="h-rand px-3 pb-2 text-right align-bottom font-semibold">Preț</th>
                    <th scope="col" className="h-rand px-3 pb-2 text-right align-bottom font-semibold whitespace-nowrap">Durată</th>
                    <th scope="col" className="h-rand px-3 pb-2 align-bottom font-semibold">Online</th>
                    <th scope="col" className="h-rand px-3 pb-2 align-bottom font-semibold">Detalii</th>
                  </tr>
                </thead>
                <tbody>
                  {c.services.map((s) => (
                    <tr key={s.id} className={cn("h-rand border-t border-linie align-top", !s.active && "text-discret")}>
                      <td className="px-3 py-2">
                        <Link href={`/crm/servicii/${s.id}`} className={cn("font-semibold underline-offset-2 hover:underline", !s.active && "line-through")}>
                          {s.name}
                        </Link>
                        {s.code && <span className="block text-micro text-discret">{s.code}</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {s.priceMin === null ? (
                          <span className="text-discret">La consultație</span>
                        ) : (
                          formatLei(s.priceMin, { from: s.priceFrom, max: s.priceMax, unit: s.unit })
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{s.durationMinutes} min</td>
                      <td className="px-3 py-2">{s.bookableOnline ? (s.onlineLabel ?? "Da") : <span className="text-discret">–</span>}</td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1.5">
                          {!s.active && <FlagTag kind="neutral">Inactiv</FlagTag>}
                          {s.isRepresentative && <FlagTag kind="neutral">Reprezentativ</FlagTag>}
                          {s.urgent && <FlagTag kind="neutral">Urgență</FlagTag>}
                          {s.toothSpecific && <FlagTag kind="neutral">Pe dinte</FlagTag>}
                          {s.recallMonths && <FlagTag kind="neutral">Rechemare la {s.recallMonths} luni</FlagTag>}
                          {s.active && !s.publicVisible && <FlagTag kind="neutral">Ascuns pe site</FlagTag>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
