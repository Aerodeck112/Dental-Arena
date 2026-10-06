"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { moveAppointmentAction } from "@/app/(crm)/crm/(app)/programari/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { TimeInput } from "@/components/ui/TimeInput";
import { showToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions";
import type { ConflictInfo } from "@/lib/errors";
import { minutesToHHMM } from "@/lib/time";
import type { Role } from "@/generated/prisma/enums";
import type { CalendarAppointment } from "@/server/appointments/types";
import { ConflictNotice } from "./ConflictNotice";

type MoveData = Extract<Awaited<ReturnType<typeof moveAppointmentAction>>, { ok: true }>["data"];

/**
 * After a successful move: the toast „Programare mutată la 11:30” with „Anulați” for 6 s. Undo
 * moves the appointment back (with the old doctor, cabinet and confirmation) and sends nothing.
 */
export function announceMove(r: Extract<ActionResult<MoveData>, { ok: true }>, refresh: () => void) {
  const d = r.data;
  showToast({
    kind: "success",
    message:
      d.previous.confirmed && d.status === "PROGRAMAT"
        ? `Programare mutată la ${d.time}. Confirmați din nou ora cu pacientul.`
        : (r.message ?? `Programare mutată la ${d.time}`),
    undoLabel: "Anulați",
    undo: async () => {
      const back = await moveAppointmentAction({
        id: d.id,
        expectedUpdatedAt: d.updatedAt,
        date: d.previous.date,
        time: d.previous.time,
        durationMinutes: d.previous.durationMinutes,
        doctorId: d.previous.doctorId,
        cabinetId: d.previous.cabinetId ?? "none",
        confirmed: d.previous.confirmed,
        acknowledgeWarnings: true,
        undo: true,
      });
      if (back.ok) showToast({ kind: "success", message: "Mutarea a fost anulată." });
      else showToast({ kind: "error", message: back.error });
      refresh();
    },
  });
  refresh();
}

export type MoveTarget = { date: string; startMinute: number; durationMinutes: number; doctorId: string; cabinetId?: string | null };

/**
 * „Mutați”: the keyboard alternative to dragging (design system §11.2). Day, time, doctor and
 * duration; „Pacientul a confirmat noua oră” keeps the status Confirmat.
 */
export function MoveDialog({
  appointment,
  open,
  onClose,
  doctors,
  canChangeDoctor,
  canOverride,
  role,
  target,
}: {
  appointment: CalendarAppointment;
  open: boolean;
  onClose: () => void;
  doctors: { id: string; name: string }[];
  canChangeDoctor: boolean;
  canOverride: boolean;
  role: Role;
  /** Prefill (a drag that needs „Salvați oricum”). */
  target?: MoveTarget | null;
}) {
  const router = useRouter();
  const initial: MoveTarget = target ?? {
    date: appointment.dateISO,
    startMinute: appointment.startMinute,
    durationMinutes: appointment.endMinute - appointment.startMinute,
    doctorId: appointment.doctorId,
    cabinetId: appointment.cabinetId,
  };
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (open) setFormKey((k) => k + 1);
  }, [open]);

  const [state, formAction, pending] = useActionState<ActionResult<MoveData> | null, FormData>(async (_prev, fd) => {
    const r = await moveAppointmentAction(fd);
    if (r.ok) {
      onClose();
      announceMove(r, () => router.refresh());
    }
    return r;
  }, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  const conflicts: ConflictInfo[] | undefined = state && !state.ok && state.code === "CONFLICT" ? state.details?.conflicts : undefined;
  const fieldErrors = state && !state.ok && !conflicts ? state.fieldErrors : undefined;
  const formError = state && !state.ok && !conflicts && !fieldErrors ? state.error : null;
  const durations = [...new Set([15, 20, 30, 45, 60, 90, 120, 180, 240, initial.durationMinutes])].sort((a, b) => a - b);
  const formId = `move-${appointment.id}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Mutați programarea"
      description={`${appointment.title}, acum ${minutesToHHMM(appointment.startMinute)}, ${appointment.doctorName}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Renunțați
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            Mutați programarea
          </Button>
        </>
      }
    >
      <form key={formKey} id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="id" value={appointment.id} />
        <input type="hidden" name="expectedUpdatedAt" value={appointment.updatedAt} />
        {initial.cabinetId !== undefined && target?.cabinetId !== undefined && <input type="hidden" name="cabinetId" value={target.cabinetId ?? "none"} />}
        <ErrorSummary errors={fieldErrors} message={formError} idFor={(n) => `${formId}-${n}`} />
        <div className="grid grid-cols-2 gap-4">
          <DateInput id={`${formId}-date`} name="date" label="Ziua" defaultValue={initial.date} />
          <TimeInput id={`${formId}-time`} name="time" label="Ora" step={300} defaultValue={minutesToHHMM(initial.startMinute)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {canChangeDoctor ? (
            <Select
              id={`${formId}-doctorId`}
              name="doctorId"
              label="Medic"
              options={doctors.map((d) => ({ value: d.id, label: d.name }))}
              defaultValue={initial.doctorId}
            />
          ) : (
            <input type="hidden" name="doctorId" value={appointment.doctorId} />
          )}
          <Select
            id={`${formId}-durationMinutes`}
            name="durationMinutes"
            label="Durata"
            options={durations.map((m) => ({ value: String(m), label: `${m} min` }))}
            defaultValue={String(initial.durationMinutes)}
          />
        </div>
        <Checkbox
          id={`${formId}-confirmed`}
          name="confirmed"
          label="Pacientul a confirmat noua oră"
          description="Fără bifă, statusul devine Programat și pacientul primește un mesaj cu noua oră, dacă a fost de acord."
          defaultChecked={false}
        />
        <ConflictNotice conflicts={conflicts} canOverride={canOverride} role={role} idPrefix={formId} />
      </form>
    </Dialog>
  );
}
