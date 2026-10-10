/**
 * Report types (docs/architecture.md §5.3, WP5). Types and constants only, client-safe: the
 * report pages and the chart components import them.
 */

/** Report slugs (§5.3). */
export const REPORT_SLUGS = [
  "venit-medic",
  "venit-serviciu",
  "venit-clinica",
  "venit-lunar",
  "incasari-metoda",
  "programari",
  "neprezentari",
  "conversie-cereri",
] as const;

export type ReportSlug = (typeof REPORT_SLUGS)[number];

export function isReportSlug(v: string): v is ReportSlug {
  return (REPORT_SLUGS as readonly string[]).includes(v);
}

/** How a column is formatted and aligned. Money is always bani (Int). */
export type ColumnKind = "text" | "int" | "lei" | "percent";

export type ReportColumn = { key: string; label: string; kind: ColumnKind };

/** A cell value: text, a count, bani or a rate in [0, 1]; null renders as „–”. */
export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;

/** Filters after parsing the URL (`?de=&pana=&clinica=&medic=`). `pana` is inclusive in the UI. */
export type ReportFilterValues = {
  /** First day, ISO local date. */
  de: string;
  /** Last day (inclusive), ISO local date. */
  pana: string;
  clinica: "cristesti" | "ludus" | "ambele";
  /** Doctor id, or null for every doctor. A MEDIC with only `reports.viewOwn` is forced to their own. */
  medic: string | null;
};

export type ReportResult = {
  slug: ReportSlug;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** The totals row (same keys as `columns`), or null when a total makes no sense. */
  totals: ReportRow | null;
  /** Human sentence describing the scope, for the page and the CSV file. */
  scopeLabel: string;
  filters: ReportFilterValues;
};

/** One point series of the visits-per-week chart. */
export type WeeklySeries = { key: string; label: string; values: number[] };
export type WeeklyVisits = {
  /** Monday of each week, ISO local date. */
  weeks: string[];
  series: WeeklySeries[];
};

/** Report catalogue entry for the index page. */
export type ReportInfo = { slug: ReportSlug; title: string; description: string; group: "venit" | "operational" };
