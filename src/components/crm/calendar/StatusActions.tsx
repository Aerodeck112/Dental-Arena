"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeStatusAction } from "@/app/(crm)/crm/(app)/programari/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextArea } from "@/components/ui/TextArea";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { APPOINTMENT_STATUS_ACTION, APPOINTMENT_STATUS_LABEL } from "@/lib/labels";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { isUndo } from "@/server/scheduling/rules";

/** Forward actions in the order of a visit (design system §6.8: Confirmați, A sosit, Finalizați). */
const FORWARD_ORDER: AppointmentStatus[] = ["CONFIRMAT", "SOSIT", "IN_TRATAMENT", "FINALIZAT"];

/** The button text for a transition: the design-system action, or „Reveniți la …” for an undo. */
export function transitionLabel(from: AppointmentStatus, to: AppointmentStatus): string {
  if (to === "PROGRAMAT") return APPOINTMENT_STATUS_ACTION.PROGRAMAT;
  if (isUndo(from, to)) return `Reveniți la ${APPOINTMENT_STATUS_LABEL[to]}`;
  return APPOINTMENT_STATUS_ACTION[to];
}

/** Splits the allowed targets into forward steps (buttons) and the rest (menu or secondary row). */
export function splitActions(from: AppointmentStatus, actions: readonly AppointmentStatus[]) {
  const forward = FORWARD_ORDER.filter((s) => actions.includes(s) && !isUndo(from, s));
  const other = actions.filter((s) => !forward.includes(s));
  // Cancelling and no-show last, after the undo steps.
  other.sort((a, b) => Number(a === "ANULAT" || a === "NEPREZENTAT") - Number(b === "ANULAT" || b === "NEPREZENTAT"));
  return { forward, other };
}

export type StatusActionsProps = {
  appointment: { id: string; status: AppointmentStatus; actions: AppointmentStatus[]; title: string };
  /** "row": compact (Azi list): the next step as a button, the rest in a menu. "panel": every action (drawer). */
  variant?: "row" | "panel";
  onChanged?: (status: AppointmentStatus) => void;
  className?: string;
};

/**
 * Status buttons for one appointment, through WP4's machine (server re-checks everything).
 * „Anulați programarea” asks who cancelled and why. Success shows the design-system toast.
 */
export function StatusActions({ appointment, variant = "panel", onChanged, className }: StatusActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { forward, other } = splitActions(appointment.status, appointment.actions);

  const run = (to: AppointmentStatus, extra: { cancelledBy?: "PACIENT" | "CLINICA"; reason?: string } = {}) => {
    setBusy(to);
    startTransition(async () => {
      const r = await changeStatusAction({ id: appointment.id, to, cancelledBy: extra.cancelledBy, reason: extra.reason });
      setBusy(null);
      if (r.ok) {
        showToast({
          kind: "success",
          message: r.data.recallCreated ? `${r.message ?? "Vizită finalizată"}. Rechemarea a fost adăugată.` : (r.message ?? "Status schimbat"),
        });
        setCancelOpen(false);
        onChanged?.(r.data.status);
        router.refresh();
      } else {
        showToast({ kind: "error", message: r.error });
      }
    });
  };

  const choose = (to: AppointmentStatus) => (to === "ANULAT" ? setCancelOpen(true) : run(to));

  if (appointment.actions.length === 0) return null;

  const cancelDialog = (
    <CancelDialog
      open={cancelOpen}
      title={appointment.title}
      pending={pending && busy === "ANULAT"}
      onClose={() => setCancelOpen(false)}
      onConfirm={(cancelledBy, reason) => run("ANULAT", { cancelledBy, reason })}
    />
  );

  if (variant === "row") {
    const next = forward[0];
    const rest: MenuItem[] = [...forward.slice(1), ...other].map((to) => ({
      label: transitionLabel(appointment.status, to),
      onSelect: () => choose(to),
      tone: to === "ANULAT" || to === "NEPREZENTAT" ? ("danger" as const) : undefined,
    }));
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {next && (
          <Button size="s" variant={next === "CONFIRMAT" ? "primary" : "secondary"} loading={busy === next} disabled={pending} onClick={() => choose(next)}>
            {transitionLabel(appointment.status, next)}
          </Button>
        )}
        {rest.length > 0 && (
          <Menu
            trigger={<Icon name="ellipsis" size={18} />}
            triggerLabel={`Alte acțiuni pentru ${appointment.title}`}
            triggerVariant="text"
            triggerSize="s"
            chevron={false}
            triggerClassName="w-control-s justify-center px-0"
            items={rest}
            label={`Acțiuni pentru ${appointment.title}`}
            align="end"
          />
        )}
        {cancelDialog}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {forward.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {forward.map((to, i) => (
            <Button key={to} size="m" variant={i === 0 ? "primary" : "secondary"} loading={busy === to} disabled={pending} onClick={() => choose(to)}>
              {transitionLabel(appointment.status, to)}
            </Button>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {other.map((to) => (
            <Button
              key={to}
              size="s"
              variant={to === "ANULAT" || to === "NEPREZENTAT" ? "danger" : "secondary"}
              loading={busy === to}
              disabled={pending}
              onClick={() => choose(to)}
            >
              {transitionLabel(appointment.status, to)}
            </Button>
          ))}
        </div>
      )}
      {cancelDialog}
    </div>
  );
}

function CancelDialog({
  open,
  title,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (by: "PACIENT" | "CLINICA", reason?: string) => void;
}) {
  const [by, setBy] = useState<"PACIENT" | "CLINICA">("PACIENT");
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="s"
      title="Anulați programarea"
      description={`Ora rămâne liberă pentru alt pacient. Programarea lui ${title} rămâne în istoric.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Renunțați
          </Button>
          <Button variant="danger" loading={pending} onClick={() => onConfirm(by, reason.trim() || undefined)}>
            Anulați programarea
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <RadioGroup
          name="cancelledBy"
          legend="Cine a anulat"
          value={by}
          onChange={(v: string) => setBy(v === "CLINICA" ? "CLINICA" : "PACIENT")}
          options={[
            { value: "PACIENT", label: "Pacientul" },
            { value: "CLINICA", label: "Clinica", description: "Pacientul primește un mesaj de anulare, dacă a fost de acord." },
          ]}
        />
        <TextArea name="reason" label="Motivul" optional rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Dialog>
  );
}
