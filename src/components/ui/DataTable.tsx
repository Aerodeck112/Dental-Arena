import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Numbers, prices and times are right-aligned. */
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
  /** Extra classes for this column's cells. */
  className?: string;
  /** Header links to `sortHref(key, dir)` when the table has sorting. */
  sortable?: boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Makes the whole row a link (the first cell carries it; one tab stop per row). */
  rowHref?: (row: T) => string;
  rowKey?: (row: T, index: number) => string;
  /** Shown in place of rows: one sentence and one action (EmptyState). */
  empty?: ReactNode;
  /** What the table lists, for screen readers („Pacienți, ordonați după nume”). */
  caption: string;
  captionVisible?: boolean;
  sort?: { key: string; dir: "asc" | "desc" };
  sortHref?: (key: string, dir: "asc" | "desc") => string;
  className?: string;
};

function cellValue<T>(row: T, col: DataTableColumn<T>): ReactNode {
  if (col.render) return col.render(row);
  const v = (row as Record<string, unknown>)[col.key];
  return v === null || v === undefined ? "" : (v as ReactNode);
}

/**
 * A plain CRM table (server-renderable): tabular figures, hairlines between rows only,
 * row height from the density (36px compact, 44px confortabil).
 */
export function DataTable<T>({
  columns,
  rows,
  rowHref,
  rowKey,
  empty,
  caption,
  captionVisible = false,
  sort,
  sortHref,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-mic cifre">
        <caption className={cn(captionVisible ? "pb-2 text-left text-mic text-discret" : "sr-only")}>{caption}</caption>
        <thead>
          <tr className="border-b border-linie-control">
            {columns.map((col) => {
              const sorted = sort?.key === col.key ? sort.dir : null;
              const canSort = col.sortable && sortHref;
              const nextDir = sorted === "asc" ? "desc" : "asc";
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "h-rand px-3 align-bottom pb-2 font-semibold whitespace-nowrap text-discret",
                    col.align === "right" && "text-right",
                  )}
                >
                  {canSort ? (
                    <Link
                      href={sortHref(col.key, nextDir)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-cerneala hover:underline",
                        sorted && "text-cerneala",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {col.header}
                      <Icon
                        name={sorted === "asc" ? "chevron-up" : sorted === "desc" ? "chevron-down" : "arrow-up-down"}
                        size={14}
                      />
                    </Link>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty !== undefined ? (
            <tr>
              <td colSpan={columns.length} className="px-0 py-4">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className={cn(
                    "h-rand border-b border-linie",
                    href &&
                      "relative cursor-pointer hover:bg-adancit has-[a[data-row-link]:focus-visible]:outline-2 has-[a[data-row-link]:focus-visible]:-outline-offset-2 has-[a[data-row-link]:focus-visible]:outline-focus",
                  )}
                >
                  {columns.map((col, c) => {
                    const value = cellValue(row, col);
                    return (
                      <td
                        key={col.key}
                        className={cn("px-3 py-1 align-middle", col.align === "right" && "text-right", col.className)}
                      >
                        {href && c === 0 ? (
                          <Link
                            href={href}
                            data-row-link=""
                            className="font-medium text-cerneala outline-none after:absolute after:inset-0 after:content-[''] hover:underline"
                          >
                            {value}
                          </Link>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
