import Link from "next/link";
import { DataTable } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatDateRo, formatPhone, formatTime } from "@/lib/format";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL } from "@/lib/labels";
import type { LeadStatus } from "@/generated/prisma/enums";
import type { LeadCardDTO } from "@/server/appointments/types";
import { LeadCard } from "./LeadCard";

const COLUMNS: { status: LeadStatus; hint: string }[] = [
  { status: "NOU", hint: "De sunat sau de confirmat" },
  { status: "CONTACTAT", hint: "Am vorbit, încă fără oră" },
  { status: "PROGRAMAT", hint: "Ultimele 30 de zile" },
  { status: "PIERDUT", hint: "Ultimele 30 de zile" },
];

/**
 * The lead pipeline (WP6): four columns Nou / Contactat / Programat / Pierdut, or the same
 * requests as a table. On phones the columns stack.
 */
export function LeadBoard({ leads, view, canManage, nowISO }: { leads: LeadCardDTO[]; view: "panou" | "lista"; canManage: boolean; nowISO: string }) {
  if (view === "lista") {
    return (
      <DataTable
        caption="Cereri, cele mai noi întâi"
        rows={leads}
        rowKey={(l) => l.id}
        rowHref={(l) => `/crm/cereri/${l.id}`}
        empty={<p className="py-6 text-corp text-discret">Nicio cerere pentru filtrele alese.</p>}
        columns={[
          { key: "name", header: "Nume", render: (l) => <span className="font-semibold">{l.name}</span> },
          { key: "status", header: "Status", render: (l) => LEAD_STATUS_LABEL[l.status] },
          { key: "source", header: "Sursa", render: (l) => LEAD_SOURCE_LABEL[l.source] },
          { key: "serviceName", header: "Motivul", render: (l) => l.serviceName ?? "" },
          { key: "locationName", header: "Clinica", render: (l) => l.locationName ?? "" },
          {
            key: "appointment",
            header: "Programare",
            render: (l) =>
              l.appointment ? (
                <span className="inline-flex items-center gap-2">
                  <StatusChip status={l.appointment.status} size="s" iconOnly />
                  <span className="cifre">{`${formatDateRo(new Date(l.appointment.startsAt), "short")}, ${formatTime(new Date(l.appointment.startsAt))}`}</span>
                </span>
              ) : (
                ""
              ),
          },
          { key: "phone", header: "Telefon", render: (l) => (l.phone ? <span className="telefon">{formatPhone(l.phone)}</span> : "") },
          { key: "assignedToName", header: "Se ocupă", render: (l) => l.assignedToName ?? "" },
          { key: "createdAt", header: "Primită", align: "right", render: (l) => <span className="cifre">{formatDateRo(new Date(l.createdAt), "short")}</span> },
        ]}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((c) => {
        const items = leads.filter((l) => l.status === c.status);
        return (
          <section key={c.status} aria-labelledby={`col-${c.status}`} className="flex min-w-0 flex-col gap-2 rounded-panou bg-adancit/60 p-2.5">
            <header className="flex items-baseline justify-between gap-2 px-1">
              <h2 id={`col-${c.status}`} className="text-corp font-semibold">
                {LEAD_STATUS_LABEL[c.status]} <span className="font-normal text-discret cifre">{items.length}</span>
              </h2>
              <span className="text-micro text-discret">{c.hint}</span>
            </header>
            {items.length === 0 ? (
              <p className="px-1 py-3 text-mic text-discret">
                {c.status === "NOU" ? (
                  "Nicio cerere nouă. Cererile de pe site apar aici."
                ) : (
                  <>
                    Nimic aici.{" "}
                    {c.status === "PIERDUT" ? null : (
                      <Link href="/crm/cereri?vedere=lista" className="text-link underline underline-offset-4">
                        Vedeți lista
                      </Link>
                    )}
                  </>
                )}
              </p>
            ) : (
              items.map((l) => <LeadCard key={l.id} lead={l} canManage={canManage} nowISO={nowISO} />)
            )}
          </section>
        );
      })}
    </div>
  );
}
