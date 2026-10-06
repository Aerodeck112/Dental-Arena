"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { addDaysISO } from "@/lib/time";
import { formatDateRo } from "@/lib/format";
import type { WeeklySeries } from "@/server/reports/types";

/**
 * Visits per week per clinic (design system §6.8, §10 `LineChart`; dataviz rules):
 * - 2px lines in fixed order: Cristești = `actiune` (green; the brand mint in dark mode), Luduș =
 *   `linie-control` (the slate). Validated for CVD and contrast against both surfaces.
 * - Identity never by colour alone: solid vs dashed line, circle vs square markers, a legend and
 *   direct labels at the line ends.
 * - Hover or keyboard (arrow keys) moves a crosshair that snaps to the nearest week; the tooltip
 *   shows every series. The same numbers are in the table under the chart.
 */

type Props = {
  title: string;
  /** Monday of each week, ISO. */
  weeks: string[];
  series: WeeklySeries[];
  unit?: { one: string; many: string };
  /** The last week is still in progress: it is shaded and labelled „în curs”, so its drop reads as partial. */
  partialLast?: boolean;
  className?: string;
};

const SERIES_STYLE = [
  { stroke: "var(--color-actiune)", dash: undefined, marker: "circle" as const },
  { stroke: "var(--color-linie-control)", dash: "6 4", marker: "square" as const },
];

const M = { top: 16, right: 112, bottom: 32, left: 44 };
const HEIGHT = 260;

function shortDay(iso: string): string {
  return formatDateRo(iso, "weekday").replace(/^\S+\s/, "");
}

function weekLabel(monday: string): string {
  return `${shortDay(monday)}–${shortDay(addDaysISO(monday, 6))}`;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= v) return m * pow;
  }
  return 10 * pow;
}

function plural(n: number, unit: { one: string; many: string }): string {
  if (n === 1) return `1 ${unit.one}`;
  const mod = n % 100;
  return `${n}${n !== 0 && (mod === 0 || mod >= 20) ? " de" : ""} ${unit.many}`;
}

function Marker({ kind, x, y }: { kind: "circle" | "square"; x: number; y: number }) {
  return kind === "circle" ? (
    <circle cx={x} cy={y} r={4.5} strokeWidth={2} />
  ) : (
    <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={1} strokeWidth={2} />
  );
}

function LineKey({ index }: { index: number }) {
  const s = SERIES_STYLE[index % SERIES_STYLE.length];
  return (
    <svg width="28" height="12" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="6" x2="27" y2="6" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} strokeLinecap="round" />
      <g fill={s.stroke} stroke="var(--color-suprafata)">
        <Marker kind={s.marker} x={14} y={6} />
      </g>
    </svg>
  );
}

export function LineChart({ title, weeks, series, unit = { one: "vizită", many: "vizite" }, partialLast = false, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const tipId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = weeks.length;
  const maxValue = Math.max(0, ...series.flatMap((s) => s.values));
  const yMax = niceMax(maxValue);
  const narrow = width < 520;
  const right = narrow ? 16 : M.right;
  const plotW = Math.max(40, width - M.left - right);
  const plotH = HEIGHT - M.top - M.bottom;
  const x = useCallback((i: number) => M.left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1)), [n, plotW]);
  const y = (v: number) => M.top + plotH - (v / yMax) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * yMax));
  const labelEvery = narrow ? Math.ceil(n / 4) : n > 8 ? 2 : 1;
  const inProgress = (i: number) => partialLast && i === n - 1;
  const weekTitle = (i: number) => `${weekLabel(weeks[i])}${inProgress(i) ? " (în curs)" : ""}`;

  // Direct labels at the line ends, kept at least 18px apart; a short leader joins label and line.
  const endLabels = (() => {
    const sorted = series.map((s, i) => ({ i, lineY: y(s.values[n - 1] ?? 0) })).sort((a, b) => a.lineY - b.lineY);
    const placed: { i: number; lineY: number; labelY: number }[] = [];
    for (const item of sorted) {
      const prev = placed[placed.length - 1];
      placed.push({ ...item, labelY: prev ? Math.max(item.lineY, prev.labelY + 18) : item.lineY });
    }
    return placed;
  })();

  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setActive(best);
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const cur = active ?? n - 1;
    const next =
      e.key === "ArrowLeft" ? Math.max(0, cur - 1) : e.key === "ArrowRight" ? Math.min(n - 1, cur + 1) : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (e.key === "Escape") {
      setActive(null);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active) + 12, 0), width - 200);

  if (n === 0 || maxValue === 0) {
    return (
      <figure className={cn("flex flex-col gap-2", className)}>
        <figcaption className="text-h3 font-semibold">{title}</figcaption>
        <p className="text-corp text-discret">Nicio vizită în această perioadă. Graficul apare după primele programări finalizate.</p>
      </figure>
    );
  }

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <figcaption className="text-h3 font-semibold">{title}</figcaption>
        {series.length >= 2 ? (
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-mic" aria-label="Legendă">
            {series.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                <LineKey index={i} />
                {s.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div ref={wrapRef} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="group"
          aria-roledescription="grafic"
          aria-label={`${title}. Folosiți săgețile stânga și dreapta pentru a parcurge săptămânile. Datele complete sunt în tabelul de sub grafic.`}
          aria-describedby={active !== null ? tipId : undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="block max-w-full overflow-visible rounded-control text-micro outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {/* The week in progress: a recessive band behind the last point. */}
          {partialLast && n >= 2 ? (
            <g aria-hidden="true">
              <rect
                x={(x(n - 2) + x(n - 1)) / 2}
                y={M.top}
                width={x(n - 1) - (x(n - 2) + x(n - 1)) / 2}
                height={plotH}
                fill="var(--color-adancit)"
              />
              <text x={x(n - 1) - 4} y={M.top + 12} textAnchor="end" fill="var(--color-discret)">
                în curs
              </text>
            </g>
          ) : null}

          {/* Grid and y axis: hairlines, recessive. */}
          <g aria-hidden="true">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--color-linie)" strokeWidth={1} />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fill="var(--color-discret)" className="cifre">
                  {t}
                </text>
              </g>
            ))}
            {weeks.map((w, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text key={w} x={x(i)} y={HEIGHT - M.bottom + 18} textAnchor="middle" fill="var(--color-discret)" className="cifre">
                  {shortDay(w)}
                </text>
              ) : null,
            )}
          </g>

          {active !== null ? (
            <line
              aria-hidden="true"
              x1={x(active)}
              x2={x(active)}
              y1={M.top}
              y2={M.top + plotH}
              stroke="var(--color-discret)"
              strokeWidth={1}
            />
          ) : null}

          {series.map((s, si) => {
            const st = SERIES_STYLE[si % SERIES_STYLE.length];
            const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
            return (
              <g key={s.key} aria-hidden="true">
                <path d={d} fill="none" stroke={st.stroke} strokeWidth={2} strokeDasharray={st.dash} strokeLinejoin="round" strokeLinecap="round" />
                <g fill={st.stroke} stroke="var(--color-suprafata)">
                  {s.values.map((v, i) =>
                    i === n - 1 || i === active ? <Marker key={i} kind={st.marker} x={x(i)} y={y(v)} /> : null,
                  )}
                </g>
              </g>
            );
          })}

          {!narrow
            ? endLabels.map(({ i, lineY, labelY }) => {
                const s = series[i];
                const lx = M.left + plotW + 10;
                return (
                  <g key={s.key} aria-hidden="true">
                    {Math.abs(labelY - lineY) > 1 ? (
                      <line x1={M.left + plotW + 2} y1={lineY} x2={lx - 2} y2={labelY} stroke="var(--color-linie-control)" strokeWidth={1} />
                    ) : null}
                    <text x={lx} y={labelY} dy="0.32em" fill="var(--color-cerneala)" className="cifre">
                      <tspan fontWeight={600}>{s.values[n - 1]}</tspan> {s.label}
                    </text>
                  </g>
                );
              })
            : null}

          {/* Hit area: the pointer never has to land on a 2px line. */}
          <rect
            x={M.left}
            y={M.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {active !== null ? (
          <div
            id={tipId}
            role="status"
            className="pointer-events-none absolute top-2 z-10 w-48 rounded-control border border-linie bg-suprafata px-3 py-2 text-mic shadow-float"
            style={{ left: tipLeft }}
          >
            <p className="mb-1 font-semibold cifre">Săptămâna {weekTitle(active)}</p>
            <ul className="flex flex-col gap-1">
              {series.map((s, i) => (
                <li key={s.key} className="flex items-center gap-2 cifre">
                  <LineKey index={i} />
                  <span className="grow">{s.label}</span>
                  <span className="font-semibold">{plural(s.values[active] ?? 0, unit)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <details className="group text-mic">
        <summary className="inline-flex cursor-pointer items-center gap-1 text-link underline underline-offset-2">
          Vedeți datele ca tabel
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table id={tableId} className="w-full max-w-xl border-collapse text-left cifre">
            <caption className="sr-only">{title}, pe săptămâni</caption>
            <thead>
              <tr className="border-b border-linie-control">
                <th scope="col" className="px-3 pb-2 font-semibold text-discret">
                  Săptămâna
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-3 pb-2 text-right font-semibold text-discret">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={w} className="h-rand border-b border-linie">
                  <th scope="row" className="px-3 py-1 font-normal">
                    {weekTitle(i)}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1 text-right">
                      {s.values[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
