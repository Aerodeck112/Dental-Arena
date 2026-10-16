import { cn } from "@/lib/cn";
import { formatLei } from "@/lib/format";
import type { ColumnKind, ReportCell, ReportColumn, ReportRow } from "@/server/reports/types";

/**
 * A report as a plain table (design system §6.8 „Rapoarte: plain tables”): tabular figures,
 * numbers right-aligned, hairlines between rows, the totals row in a <tfoot>.
 */

const percent = new Intl.NumberFormat("ro-RO", { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 });
const integer = new Intl.NumberFormat("ro-RO", { useGrouping: "always" });

export function formatReportCell(kind: ColumnKind, v: ReportCell): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "string") return v;
  switch (kind) {
    case "lei":
      return formatLei(v);
    case "percent":
      return percent.format(v);
    case "int":
      return integer.format(v);
    default:
      return String(v);
  }
}

const isNumeric = (c: ReportColumn) => c.kind !== "text";

export function ReportTable({
  columns,
  rows,
  totals,
  caption,
  empty,
  className,
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportRow | null;
  caption: string;
  empty?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-mic cifre">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-linie-control">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn("h-rand px-3 pb-2 align-bottom font-semibold text-discret", isNumeric(c) ? "text-right" : "whitespace-nowrap")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-corp text-discret">
                {empty ?? "Nu există date pentru filtrele alese. Alegeți altă perioadă sau altă clinică."}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="h-rand border-b border-linie">
                {columns.map((c, j) =>
                  j === 0 ? (
                    <th key={c.key} scope="row" className="px-3 py-1 text-left font-normal text-cerneala">
                      {formatReportCell(c.kind, row[c.key] ?? null)}
                    </th>
                  ) : (
                    <td key={c.key} className={cn("px-3 py-1 align-middle", isNumeric(c) && "text-right whitespace-nowrap")}>
                      {formatReportCell(c.kind, row[c.key] ?? null)}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
        {totals && rows.length > 0 ? (
          <tfoot>
            <tr className="h-rand border-t border-linie-control">
              {columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row" className="px-3 py-1 text-left font-semibold">
                    {formatReportCell(c.kind, totals[c.key] ?? null)}
                  </th>
                ) : (
                  <td key={c.key} className={cn("px-3 py-1 font-semibold", isNumeric(c) && "text-right whitespace-nowrap")}>
                    {totals[c.key] === null || totals[c.key] === undefined ? "" : formatReportCell(c.kind, totals[c.key])}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
