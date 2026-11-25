"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { changeStatusAction } from "@/app/(crm)/crm/(app)/programari/actions";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { FlagTag } from "@/components/ui/FlagTag";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDateRo, formatLei, formatPhone, formatTime, telHref } from "@/lib/format";
import { COMFORT_TAG, LEAD_SOURCE_LABEL } from "@/lib/labels";
import { diffDaysISO } from "@/lib/time";
import type { BalanceQueueItem, LeadQueueItem, RecallQueueItem } from "@/server/appointments/types";

/** One „De făcut” queue on Azi: a title with its count, up to a handful of rows, and „Toate”. */
export function WorkQueue({
  title,
  count,
  href,
  hrefLabel = "Toate",
  empty,
  children,
}: {
  title: string;
  count: number;
  href?: string;
  hrefLabel?: string;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-linie pb-2">
        <h3 className="flex items-center gap-2 text-h3 font-semibold">
          {title}
          {count > 0 && <CountBadge count={count} />}
        </h3>
        {href && (
          <Link href={href} className="text-mic text-link underline underline-offset-4">
            {hrefLabel}
          </Link>
        )}
      </div>
      {count === 0 ? <p className="py-3 text-mic text-discret">{empty}</p> : <ul className="flex flex-col">{children}</ul>}
    </section>
  );
}

const rowCls = "flex flex-col gap-1.5 border-b border-linie py-2.5 last:border-b-0";
const callCls = "apasat inline-flex h-control-s items-center gap-1.5 rounded-control px-2 text-control text-link hover:bg-adancit";

function CallLink({ phone, name }: { phone: string | null; name: string }) {
  if (!phone) return null;
  return (
    <a href={telHref(phone)} className={callCls} aria-label={`Sunați pe ${name}, ${formatPhone(phone)}`}>
      <Icon name="phone" size={16} />
      Sunați
    </a>
  );
}

/** A new online request: what and when they asked, „Confirmați” for a tentative slot, „Sunați”, „Propuneți altă oră”. */
export function LeadQueueRow({ lead, canManage }: { lead: LeadQueueItem; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const appt = lead.appointment;
  const when = appt ? `${formatDateRo(new Date(appt.startsAt), "weekday")}, ${formatTime(new Date(appt.startsAt))}` : lead.preferredTime;
  const confirm = () =>
    start(async () => {
      if (!appt) return;
      const r = await changeStatusAction({ id: appt.id, to: "CONFIRMAT", reason: undefined });
      if (r.ok) {
        setDone(true);
        showToast({ kind: "success", message: `Programare confirmată pentru ${lead.name}` });
        router.refresh();
      } else showToast({ kind: "error", message: r.error });
    });
  return (
    <li className={rowCls}>
      <p className="text-corp">
        <Link href={`/crm/cereri/${lead.id}`} className="font-semibold text-cerneala hover:underline hover:underline-offset-4">
          {lead.name}
        </Link>
        <span className="text-discret">{[lead.serviceName?.toLowerCase(), when, appt?.doctorName].filter(Boolean).map((s) => `, ${s}`).join("")}</span>
      </p>
      <p className="flex flex-wrap items-center gap-1.5 text-micro text-discret">
        <FlagTag kind="online">{LEAD_SOURCE_LABEL[lead.source]}</FlagTag>
        {lead.comfort && lead.comfort !== "FARA_EMOTII" && <FlagTag kind="confort">{COMFORT_TAG[lead.comfort]}</FlagTag>}
        {lead.locationName && <span>{lead.locationName}</span>}
      </p>
      {canManage && (
        <div className="flex flex-wrap items-center gap-1.5">
          {appt && appt.status === "PROGRAMAT" && !done && (
            <Button size="s" loading={pending} onClick={confirm}>
              Confirmați
            </Button>
          )}
          <CallLink phone={lead.phone} name={lead.name} />
          <Link href={`/crm/programari/noua?cerere=${lead.id}`} className={cn(callCls, "text-cerneala")}>
            {appt ? "Propuneți altă oră" : "Programați"}
          </Link>
        </div>
      )}
    </li>
  );
}

/** A patient due for a recall: the reason, how late, „Sunați” and „Programați”. */
export function RecallQueueRow({ recall, todayISO, canManage }: { recall: RecallQueueItem; todayISO: string; canManage: boolean }) {
  const days = diffDaysISO(todayISO, recall.dueDate);
  const due = days < 0 ? `întârziat ${Math.abs(days)} ${Math.abs(days) === 1 ? "zi" : "zile"}` : days === 0 ? "azi" : `pe ${formatDateRo(recall.dueDate, "short")}`;
  return (
    <li className={rowCls}>
      <p className="text-corp">
        <Link href={`/crm/pacienti/${recall.patientId}`} className="font-semibold text-cerneala hover:underline hover:underline-offset-4">
          {recall.patientName}
        </Link>
        <span className="text-discret">, {recall.reason.charAt(0).toLowerCase() + recall.reason.slice(1)}</span>
      </p>
      <p className={cn("text-micro", days < 0 ? "text-carmin" : "text-discret")}>
        {due}
        {recall.attempts > 0 ? `, ${recall.attempts} ${recall.attempts === 1 ? "apel" : "apeluri"}` : ""}
      </p>
      {canManage && (
        <div className="flex flex-wrap items-center gap-1.5">
          <CallLink phone={recall.phone} name={recall.patientName} />
          <Link href={`/crm/programari/noua?pacient=${recall.patientId}&rechemare=${recall.id}`} className={cn(callCls, "text-cerneala")}>
            Programați
          </Link>
        </div>
      )}
    </li>
  );
}

/** A patient who owes money: the balance and a link to their payments. */
export function BalanceQueueRow({ item }: { item: BalanceQueueItem }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-linie py-2 last:border-b-0">
      <Link href={`/crm/pacienti/${item.patientId}`} className="min-w-0 truncate text-corp font-semibold text-cerneala hover:underline hover:underline-offset-4">
        {item.name}
      </Link>
      <span className="flex shrink-0 items-center gap-1">
        <span className="text-corp cifre">{formatLei(item.balance)}</span>
        <CallLink phone={item.phone} name={item.name} />
      </span>
    </li>
  );
}
