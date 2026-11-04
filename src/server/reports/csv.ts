import "server-only";
import type { ReportColumn, ReportResult, ReportRow } from "./types";

/**
 * CSV for Excel in Romanian locale (docs/architecture.md §4.3, §8.3): UTF-8 with BOM, `;` as
 * separator, CRLF line ends, decimal comma. Text cells that start with = + - @ (or a tab / CR) get
 * a leading apostrophe, so a spreadsheet never runs them as formulas.
 */

export const CSV_BOM = "﻿";
export const CSV_SEPARATOR = ";";

const FORMULA_START = /^[=+\-@\t\r]/;

/** Escapes one text cell: formula guard, then quoting when needed. */
export function csvCell(value: string): string {
  let v = value;
  if (FORMULA_START.test(v)) v = `'${v}`;
  if (/[";\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Decimal comma, no thousands separator: 120050 bani → „1200,50”. */
export function csvLei(bani: number): string {
  const sign = bani < 0 ? "-" : "";
  const abs = Math.abs(Math.round(bani));
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** 0.125 → „12,5” (percent, one decimal). */
export function csvPercent(rate: number): string {
  return (Math.round(rate * 1000) / 10).toFixed(1).replace(".", ",");
}

function formatValue(col: ReportColumn, v: ReportRow[string]): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return csvCell(v);
  switch (col.kind) {
    case "lei":
      return csvLei(v);
    case "percent":
      return csvPercent(v);
    case "int":
      return String(Math.round(v));
    default:
      return csvCell(String(v));
  }
}

/** Header label of a column in the file (money and rates carry their unit). */
function headerLabel(col: ReportColumn): string {
  if (col.kind === "lei") return `${col.label} (lei)`;
  if (col.kind === "percent") return `${col.label} (%)`;
  return col.label;
}

/** Builds the CSV text, BOM included. */
export function toCsv(columns: ReportColumn[], rows: ReportRow[], totals?: ReportRow | null): string {
  const lines = [columns.map((c) => csvCell(headerLabel(c))).join(CSV_SEPARATOR)];
  for (const row of rows) lines.push(columns.map((c) => formatValue(c, row[c.key])).join(CSV_SEPARATOR));
  if (totals) lines.push(columns.map((c) => formatValue(c, totals[c.key])).join(CSV_SEPARATOR));
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

export function reportToCsv(r: ReportResult): string {
  return toCsv(r.columns, r.rows, r.totals);
}

/** `raport-<slug>-<de>-<pana>.csv` */
export function csvFilename(r: Pick<ReportResult, "slug" | "filters">): string {
  return `raport-${r.slug}-${r.filters.de}-${r.filters.pana}.csv`;
}
