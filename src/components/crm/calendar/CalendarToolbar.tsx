"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { addDaysISO, startOfWeekISO } from "@/lib/time";
import { calendarHref, type CalendarParams } from "./layout";

export type CalendarToolbarProps = {
  view: "zi" | "saptamana" | "lista";
  dateISO: string;
  todayISO: string;
  title: string;
  columnsMode: "medici" | "cabinete";
  doctors: { id: string; name: string; shortName: string }[];
  selectedDoctorId: string | null;
  /** The `clinica` URL parameter, kept on every link (null: the cookie scope). */
  clinica: string | null;
  scopeLabel: string;
  canCreate: boolean;
  /** Count line under the title („14 programări”). */
  summary?: string;
};

const navBtn =
  "apasat inline-flex size-control-s items-center justify-center rounded-control border border-linie-control bg-suprafata text-cerneala hover:bg-adancit";

/**
 * The calendar's header row (design system §6.8): the date as the title, prev / „Azi” / next,
 * Zi | Săptămână | Listă, the Medici | Cabinete switch (day view) or the doctor (week view),
 * and „Programare nouă” for that day. Every state lives in the URL.
 */
export function CalendarToolbar(p: CalendarToolbarProps) {
  const router = useRouter();
  const base: CalendarParams = {
    vedere: p.view,
    coloane: p.columnsMode,
    medic: p.selectedDoctorId,
    clinica: p.clinica,
  };
  const step = p.view === "saptamana" ? 7 : 1;
  const prev = calendarHref({ ...base, zi: addDaysISO(p.dateISO, -step) });
  const next = calendarHref({ ...base, zi: addDaysISO(p.dateISO, step) });
  const isToday = p.view === "saptamana" ? startOfWeekISO(p.todayISO) === startOfWeekISO(p.dateISO) : p.todayISO === p.dateISO;
  const unit = p.view === "saptamana" ? "săptămâna" : "ziua";

  const newHref = `/crm/programari/noua?zi=${p.dateISO}${p.view === "saptamana" && p.selectedDoctorId ? `&medic=${p.selectedDoctorId}` : ""}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-h1 text-cerneala">{p.title}</h1>
          <p className="text-mic text-discret">
            {p.scopeLabel}
            {p.summary ? `, ${p.summary}` : ""}
          </p>
        </div>
        {p.canCreate && (
          <ButtonLink href={newHref} icon="plus" size="m">
            Programare nouă
          </ButtonLink>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <Link href={prev} className={navBtn} aria-label={`${unit === "ziua" ? "Ziua" : "Săptămâna"} anterioară`} scroll={false}>
            <Icon name="chevron-left" size={18} />
          </Link>
          <Link
            href={calendarHref({ ...base, zi: p.todayISO })}
            aria-current={isToday ? "date" : undefined}
            scroll={false}
            className={cn(
              "apasat inline-flex h-control-s items-center rounded-control border px-3 text-control",
              isToday ? "border-cerneala bg-menta-pal font-semibold text-cerneala" : "border-linie-control bg-suprafata text-cerneala hover:bg-adancit",
            )}
          >
            Azi
          </Link>
          <Link href={next} className={navBtn} aria-label={`${unit === "ziua" ? "Ziua" : "Săptămâna"} următoare`} scroll={false}>
            <Icon name="chevron-right" size={18} />
          </Link>
          <label className="sr-only" htmlFor="cal-date">
            Mergeți la data
          </label>
          <input
            id="cal-date"
            type="date"
            value={p.dateISO}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) router.push(calendarHref({ ...base, zi: e.target.value }), { scroll: false });
            }}
            className="h-control-s rounded-control border border-linie-control bg-suprafata px-2 text-control text-cerneala cifre"
          />
        </div>
        <SegmentedControl
          size="s"
          label="Vederea calendarului"
          value={p.view}
          options={[
            { value: "zi", label: "Zi", href: calendarHref({ ...base, vedere: "zi", zi: p.dateISO }) },
            { value: "saptamana", label: "Săptămână", href: calendarHref({ ...base, vedere: "saptamana", zi: p.dateISO }) },
            { value: "lista", label: "Listă", href: calendarHref({ ...base, vedere: "lista", zi: p.dateISO }) },
          ]}
        />
        {p.view === "zi" && (
          <SegmentedControl
            size="s"
            label="Coloanele calendarului"
            value={p.columnsMode}
            options={[
              { value: "medici", label: "Medici", href: calendarHref({ ...base, coloane: "medici", zi: p.dateISO }) },
              { value: "cabinete", label: "Cabinete", href: calendarHref({ ...base, coloane: "cabinete", zi: p.dateISO }) },
            ]}
          />
        )}
        {p.view === "saptamana" && p.doctors.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="cal-doctor" className="text-mic text-discret">
              Medicul
            </label>
            <select
              id="cal-doctor"
              value={p.selectedDoctorId ?? ""}
              onChange={(e) => router.push(calendarHref({ ...base, medic: e.target.value, zi: p.dateISO }), { scroll: false })}
              className="h-control-s rounded-control border border-linie-control bg-suprafata px-2 text-control text-cerneala"
            >
              {p.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
