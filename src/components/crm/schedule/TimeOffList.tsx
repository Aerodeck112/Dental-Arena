"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { showToast } from "@/components/ui/Toast";
import { formatDateRo } from "@/lib/format";
import { TIME_OFF_KIND_LABEL } from "@/lib/labels";
import { minutesToHHMM } from "@/lib/time";
import type { TimeOffDTO } from "@/server/scheduling/schedules";
import { deleteTimeOffAction } from "@/app/(crm)/crm/(app)/absente/actions";

/** „12.10.2026–14.10.2026” for whole days, „12.10.2026, 09:00–12:00” for part of a day. */
export function periodLabel(t: Pick<TimeOffDTO, "startDate" | "endDate" | "startMinute" | "endMinute" | "allDay">): string {
  const from = formatDateRo(t.startDate, "short");
  const to = formatDateRo(t.endDate, "short");
  if (t.allDay) return t.startDate === t.endDate ? from : `${from}–${to}`;
  if (t.startDate === t.endDate) return `${from}, ${minutesToHHMM(t.startMinute)}–${minutesToHHMM(t.endMinute)}`;
  return `${from}, ${minutesToHHMM(t.startMinute)}–${to}, ${minutesToHHMM(t.endMinute)}`;
}

/** Upcoming time off and closures, soonest first, with „Ștergeți” where the user may. */
export function TimeOffList({ items, showDoctor = true }: { items: TimeOffDTO[]; showDoctor?: boolean }) {
  const [toDelete, setToDelete] = useState<TimeOffDTO | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = (t: TimeOffDTO) =>
    startTransition(async () => {
      const r = await deleteTimeOffAction({ id: t.id });
      showToast(r.ok ? { kind: "success", message: r.message ?? "Absența a fost ștearsă." } : { kind: "error", message: r.error });
      setToDelete(null);
    });

  const columns: DataTableColumn<TimeOffDTO>[] = [
    ...(showDoctor
      ? [{ key: "who", header: "Cine", render: (t: TimeOffDTO) => t.doctorName ?? <span className="font-semibold">Clinica închisă</span> }]
      : []),
    { key: "where", header: "Clinica", render: (t) => t.locationName ?? "Ambele" },
    { key: "kind", header: "Tipul", render: (t) => TIME_OFF_KIND_LABEL[t.kind] },
    { key: "period", header: "Perioada", className: "cifre whitespace-nowrap", render: (t) => periodLabel(t) },
    { key: "reason", header: "Motiv", render: (t) => t.reason ?? <span className="text-discret">–</span> },
    {
      key: "actions",
      header: <span className="sr-only">Acțiuni</span>,
      align: "right",
      render: (t) =>
        t.canDelete ? (
          <Button variant="text" size="s" icon="x" onClick={() => setToDelete(t)} aria-label={`Ștergeți absența din ${periodLabel(t)}`}>
            Ștergeți
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        caption="Absențe și zile în care clinica este închisă"
        columns={columns}
        rows={items}
        rowKey={(t) => t.id}
        empty={<p className="text-corp text-discret">Nicio absență programată.</p>}
      />
      {toDelete && (
        <Dialog
          open
          onClose={() => setToDelete(null)}
          title="Ștergeți absența?"
          description={`${toDelete.doctorName ?? "Clinica închisă"}, ${periodLabel(toDelete)}. Orele redevin libere pentru programări.`}
          size="s"
          footer={
            <>
              <Button variant="text" onClick={() => setToDelete(null)}>
                Păstrați
              </Button>
              <Button variant="danger" loading={pending} onClick={() => remove(toDelete)}>
                Ștergeți absența
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
