"use client";

import type { AppointmentFormOptions, CalendarData } from "@/server/appointments/types";
import { CalendarGrid } from "./CalendarGrid";

/**
 * The week view (design system §6.8): one doctor, one column per day (Sunday only when it has
 * something), today's column tinted. Day headers link to that day's day view. The grid, drag,
 * quick-create and drawer are the day view's.
 */
export function CalendarWeek(props: {
  data: CalendarData;
  options: AppointmentFormOptions | null;
  nowISO: string;
  clinica: string | null;
  multiClinic: boolean;
}) {
  const doctor = props.data.doctors.find((d) => d.id === props.data.selectedDoctorId);
  return (
    <section aria-label={doctor ? `Săptămâna lui ${doctor.name}` : "Săptămâna"} className="flex flex-col gap-2">
      <CalendarGrid {...props} />
    </section>
  );
}
