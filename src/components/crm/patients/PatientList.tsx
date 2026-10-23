import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FlagTag } from "@/components/ui/FlagTag";
import { formatDateRo, formatPhone, formatYears } from "@/lib/format";
import type { PatientFlag } from "@/server/patients/flags";
import type { PatientListRow } from "@/server/patients/types";
import type { ReactNode } from "react";

/** The patient table: one link per row to the file, flags under the name, the last and next visit. */
export function PatientList({ rows, flags, empty, caption }: { rows: PatientListRow[]; flags: Map<string, PatientFlag[]>; empty: ReactNode; caption: string }) {
  const columns: DataTableColumn<PatientListRow>[] = [
    {
      key: "name",
      header: "Pacient",
      render: (r) => {
        const f = flags.get(r.id) ?? [];
        return (
          <div className="flex flex-col gap-1">
            <span className={r.anonymized ? "text-discret" : "font-semibold text-cerneala"}>{r.name}</span>
            {(f.length > 0 || r.tags.length > 0) && (
              <span className="flex flex-wrap gap-1">
                {f.map((x) => (
                  <FlagTag key={x.label} kind={x.kind}>
                    {x.label}
                  </FlagTag>
                ))}
                {r.tags.map((t) => (
                  <FlagTag key={t.id} kind="neutral">
                    {t.name}
                  </FlagTag>
                ))}
              </span>
            )}
          </div>
        );
      },
    },
    { key: "file", header: "Fișa", className: "cifre whitespace-nowrap", render: (r) => r.fileNumber },
    { key: "age", header: "Vârsta", className: "whitespace-nowrap", render: (r) => (r.age !== null ? formatYears(r.age) : "–") },
    {
      key: "phone",
      header: "Telefon",
      className: "telefon whitespace-nowrap",
      render: (r) => (r.phone ? formatPhone(r.phone) : "–"),
    },
    { key: "clinic", header: "Clinica", render: (r) => r.locationName ?? "–" },
    {
      key: "last",
      header: "Ultima vizită",
      className: "cifre whitespace-nowrap",
      render: (r) => (r.lastVisit ? formatDateRo(r.lastVisit, "short") : "–"),
    },
    {
      key: "next",
      header: "Următoarea",
      className: "cifre whitespace-nowrap",
      render: (r) => (r.nextVisit ? formatDateRo(r.nextVisit, "short") : "–"),
    },
  ];
  return <DataTable caption={caption} columns={columns} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/crm/pacienti/${r.id}`} empty={empty} />;
}
