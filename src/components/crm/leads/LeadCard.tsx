"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { changeStatusAction } from "@/app/(crm)/crm/(app)/programari/actions";
import { Button } from "@/components/ui/Button";
import { FlagTag } from "@/components/ui/FlagTag";
import { Icon } from "@/components/ui/Icon";
import { StatusChip } from "@/components/ui/StatusChip";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDateRo, formatPhone, formatTime, telHref } from "@/lib/format";
import { COMFORT_TAG, LEAD_SOURCE_LABEL } from "@/lib/labels";
import type { LeadCardDTO } from "@/server/appointments/types";

/** „acum 2 ore”, „ieri, 14:20”, „3 oct., 09:10”. Pure. */
export function receivedLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return "acum";
  if (minutes < 60) return `acum ${minutes} min`;
  if (minutes < 6 * 60) return `acum ${Math.floor(minutes / 60)} ${Math.floor(minutes / 60) === 1 ? "oră" : "ore"}`;
  return `${formatDateRo(d, "short")}, ${formatTime(d)}`;
}

/**
 * One request on the board: who, what and when they asked, the overlays (comfort, child,
 * inhalosedare), who handles it, and for a tentative online booking its slot with „Confirmați”.
 */
export function LeadCard({ lead, canManage, nowISO }: { lead: LeadCardDTO; canManage: boolean; nowISO: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const appt = lead.appointment;
  const tentative = appt && !lead.patientId && appt.status === "PROGRAMAT";
  const confirm = () =>
    start(async () => {
      if (!appt) return;
      const r = await changeStatusAction({ id: appt.id, to: "CONFIRMAT", reason: undefined });
      if (r.ok) {
        showToast({ kind: "success", message: `Programare confirmată pentru ${lead.name}` });
        router.refresh();
      } else showToast({ kind: "error", message: r.error });
    });

  return (
    <article
      className={cn(
        "relative flex flex-col gap-2 rounded-panou border border-linie bg-suprafata p-3 text-mic",
        lead.status === "NOU" && "border-l-[3px] border-l-actiune",
        lead.status === "PIERDUT" && "bg-adancit",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-corp font-semibold leading-snug">
          <Link href={`/crm/cereri/${lead.id}`} className="after:absolute after:inset-0 hover:underline hover:underline-offset-4">
            {lead.name}
          </Link>
        </h3>
        <time dateTime={lead.createdAt} className="shrink-0 text-micro text-discret">
          {receivedLabel(lead.createdAt, new Date(nowISO))}
        </time>
      </div>
      <p className="text-discret">
        {[lead.serviceName, lead.locationName, lead.preferredTime && !appt ? `preferă ${lead.preferredTime}` : null].filter(Boolean).join(", ") || LEAD_SOURCE_LABEL[lead.source]}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <FlagTag kind="neutral">{LEAD_SOURCE_LABEL[lead.source]}</FlagTag>
        {lead.comfort && lead.comfort !== "FARA_EMOTII" && <FlagTag kind="confort">{COMFORT_TAG[lead.comfort]}</FlagTag>}
        {lead.wantsSedation && <FlagTag kind="sedare">Inhalosedare</FlagTag>}
        {lead.forChild && <FlagTag kind="copil">{lead.childLabel ?? "Copil"}</FlagTag>}
      </div>
      {appt && (
        <p className="flex flex-wrap items-center gap-2">
          <StatusChip status={appt.status} size="s" />
          <span className="cifre">
            {formatDateRo(new Date(appt.startsAt), "weekday")}, {formatTime(new Date(appt.startsAt))}
          </span>
          <span className="text-discret">{appt.doctorName}</span>
        </p>
      )}
      {lead.status === "PIERDUT" && lead.lostReason && <p className="text-discret">Motiv: {lead.lostReason}</p>}
      <div className="relative z-10 flex flex-wrap items-center gap-1.5">
        {canManage && tentative && (
          <Button size="s" loading={pending} onClick={confirm}>
            Confirmați
          </Button>
        )}
        {lead.phone && (
          <a
            href={telHref(lead.phone)}
            aria-label={`Sunați pe ${lead.name}, ${formatPhone(lead.phone)}`}
            className="apasat inline-flex h-control-s items-center gap-1.5 rounded-control px-2 text-control text-link hover:bg-adancit"
          >
            <Icon name="phone" size={16} />
            <span className="telefon">{formatPhone(lead.phone)}</span>
          </a>
        )}
        <span className="ml-auto text-micro text-discret">{lead.assignedToName ?? "Neatribuită"}</span>
      </div>
    </article>
  );
}
