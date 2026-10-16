import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Icon, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { MESSAGE_CHANNEL_LABEL } from "@/lib/labels";
import { listTemplates } from "@/server/notify/templates";

export const metadata: Metadata = { title: "Șabloane de mesaje" };

/** Mesaje → Șabloane: every message the clinic sends, with its current text. ADMIN only. */
export default async function TemplatesPage() {
  await requirePermission("templates.manage");
  const templates = await listTemplates();
  const groups = [
    { key: "pacient", title: "Mesaje către pacienți", items: templates.filter((t) => t.audience === "pacient") },
    { key: "clinica", title: "Notificări pentru clinică", items: templates.filter((t) => t.audience === "clinica") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        before={<Breadcrumbs items={[{ href: "/crm/mesaje", label: "Mesaje" }, { label: "Șabloane" }]} />}
        title="Șabloane de mesaje"
        subtitle="Textele trimise automat. Cele nemodificate folosesc textul implicit; orice șablon poate reveni la el."
      />
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`sabloane-${g.key}`} className="flex flex-col gap-2">
          <h2 id={`sabloane-${g.key}`} className="text-h3 font-semibold">
            {g.title}
          </h2>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-mic">
              <caption className="sr-only">{g.title}</caption>
              <thead>
                <tr className="border-b border-linie-control text-discret">
                  <th scope="col" className="px-3 pb-2 font-semibold">
                    Șablon
                  </th>
                  <th scope="col" className="hidden px-3 pb-2 font-semibold md:table-cell">
                    Canal
                  </th>
                  <th scope="col" className="hidden px-3 pb-2 font-semibold md:table-cell">
                    Text
                  </th>
                  <th scope="col" className="px-3 pb-2 font-semibold whitespace-nowrap">
                    Stare
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((t) => (
                  <tr key={t.key} className="h-rand border-b border-linie align-top">
                    <th scope="row" className="px-3 py-2 font-normal">
                      <Link href={`/crm/mesaje/sabloane/${t.key}`} className="font-semibold text-link underline-offset-2 hover:underline">
                        {t.name}
                      </Link>
                      <span className="block text-discret">{t.description}</span>
                    </th>
                    <td className="hidden px-3 py-2 whitespace-nowrap md:table-cell">{MESSAGE_CHANNEL_LABEL[t.channel]}</td>
                    <td className="hidden px-3 py-2 text-discret md:table-cell">
                      <span className="line-clamp-2 masura">{t.subject ?? t.body}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {!t.active ? (
                        <span className="inline-flex items-center gap-1 text-carmin">
                          <Icon name="circle-slash" size={14} />
                          Oprit
                        </span>
                      ) : t.overridden ? (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="pencil" size={14} />
                          Modificat{t.updatedAt ? `, ${formatDateTime(new Date(t.updatedAt))}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-discret">
                          <Icon name="check" size={14} />
                          Text implicit
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
