"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { chairMinutes } from "@/components/crm/calendar/AppointmentBlock";
import { useNow } from "@/components/crm/calendar/NowLine";
import { StatusActions } from "@/components/crm/calendar/StatusActions";
import { FlagTag } from "@/components/ui/FlagTag";
import { Icon } from "@/components/ui/Icon";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/lib/cn";
import { formatPhone, telHref } from "@/lib/format";
import { minutesToHHMM, utcToLocal } from "@/lib/time";
import type { CalendarAppointment } from "@/server/appointments/types";

export type TodayListProps = {
  appointments: CalendarAppointment[];
  nowISO: string;
  /** Show the clinic on each row (both clinics in scope). */
  withLocation?: boolean;
  /** MEDIC: own rows come first; a quiet divider before the colleagues' rows. */
  ownDoctorId?: string | null;
  /** Hide cancelled rows (Azi); the list view keeps them. */
  hideCancelled?: boolean;
  /** One sentence when there is nothing to show. */
  empty: string;
  /** Refresh every minute (Azi stays open all day). */
  autoRefresh?: boolean;
  className?: string;
};

/**
 * Today's appointments as a dense list (design system §6.8, Azi): time, patient with overlays,
 * doctor and reason, the status with the chair timer, and the next status step inline
 * („Confirmați programarea”, „A sosit”…) with the rest in a menu, plus „Sunați”.
 */
export function TodayList({ appointments, nowISO, withLocation = false, ownDoctorId = null, hideCancelled = false, empty, autoRefresh = false, className }: TodayListProps) {
  const now = useNow(nowISO);
  const router = useRouter();
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, router]);

  const rows = hideCancelled ? appointments.filter((a) => a.status !== "ANULAT") : appointments;
  if (rows.length === 0) return <p className={cn("py-6 text-corp text-discret", className)}>{empty}</p>;
  const nowMinute = utcToLocal(now).minute;
  const firstOther = ownDoctorId ? rows.findIndex((a) => a.doctorId !== ownDoctorId) : -1;

  return (
    <ol className={cn("flex flex-col", className)}>
      {rows.map((a, i) => {
        const minutes = chairMinutes(a, now);
        const past = a.endMinute <= nowMinute && (a.status === "PROGRAMAT" || a.status === "CONFIRMAT");
        const href = a.patientId ? `/crm/pacienti/${a.patientId}` : a.leadId ? `/crm/cereri/${a.leadId}` : `/crm/programari/${a.id}`;
        return (
          <li
            key={a.id}
            className={cn(
              "grid grid-cols-[3.25rem_1fr] gap-x-3 gap-y-1.5 border-b border-linie py-2.5 last:border-b-0 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center",
              i === firstOther && firstOther > 0 && "mt-3 border-t-2 border-t-linie-control pt-3",
              a.status === "ANULAT" && "opacity-70",
            )}
          >
            <span className={cn("pt-0.5 text-corp font-semibold cifre sm:pt-0", past && "text-carmin")}>
              <Link href={`/crm/programari/${a.id}`} className="hover:underline hover:underline-offset-4" aria-label={`Programarea de la ${minutesToHHMM(a.startMinute)}, ${a.title}`}>
                {minutesToHHMM(a.startMinute)}
              </Link>
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={href} className={cn("font-semibold text-cerneala hover:underline hover:underline-offset-4", a.status === "ANULAT" && "line-through")}>
                  {a.title}
                </Link>
                {a.flags.map((f) => (
                  <FlagTag key={`${f.kind}-${f.label}`} kind={f.kind}>
                    {f.label}
                  </FlagTag>
                ))}
              </p>
              <p className="truncate text-mic text-discret">
                {[a.doctorName, a.serviceName ?? a.reason, withLocation ? a.locationName : null, `până la ${minutesToHHMM(a.endMinute)}`].filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:justify-end">
              <StatusChip status={a.status} size="s" detail={minutes !== null ? `${minutes} min` : undefined} />
              {a.canManage && a.actions.length > 0 && <StatusActions appointment={a} variant="row" />}
              {a.phone && (a.status === "PROGRAMAT" || a.status === "CONFIRMAT" || a.status === "NEPREZENTAT") && (
                <a
                  href={telHref(a.phone)}
                  className="apasat inline-flex h-control-s items-center gap-1.5 rounded-control px-2 text-control text-link hover:bg-adancit"
                  aria-label={`Sunați pe ${a.title}, ${formatPhone(a.phone)}`}
                >
                  <Icon name="phone" size={16} />
                  Sunați
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
