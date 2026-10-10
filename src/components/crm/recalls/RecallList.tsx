"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRecallStatusAction } from "@/app/(crm)/crm/(app)/rechemari/actions";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDateRo, formatPhone, telHref } from "@/lib/format";
import { RECALL_STATUS_LABEL } from "@/lib/labels";
import type { RecallRow } from "@/server/appointments/types";
import { RecallAttemptForm } from "./RecallAttemptForm";

/** „întârziat 12 zile”, „azi”, „peste 3 zile”. Pure. */
export function dueLabel(days: number): string {
  if (days === 0) return "azi";
  const n = Math.abs(days);
  const word = n === 1 ? "zi" : n < 20 ? "zile" : "de zile";
  return days < 0 ? `întârziat ${n} ${word}` : `peste ${n} ${word}`;
}

const STATUS_TONE: Record<RecallRow["status"], string> = {
  DE_FACUT: "border-linie-control text-cerneala",
  CONTACTAT: "border-actiune bg-menta-pal text-cerneala",
  PROGRAMAT: "border-actiune bg-menta-pal text-cerneala",
  REFUZAT: "border-linie-control bg-adancit text-discret",
  ANULAT: "border-linie-control bg-adancit text-discret line-through",
};

/**
 * „De rechemat” (WP6): one row per recall with the reason and how late it is, the calls so far,
 * „Sunați”, „Notați apelul” (outcome and note), „Programați” (the appointment form with the
 * recall), and cancel or reopen.
 */
export function RecallList({ rows, canManage, empty }: { rows: RecallRow[]; canManage: boolean; empty: string }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const setStatus = (id: string, status: "DE_FACUT" | "ANULAT") =>
    start(async () => {
      const r = await setRecallStatusAction({ id, status, note: undefined });
      if (r.ok) {
        showToast({ kind: "success", message: r.message ?? "Salvat" });
        router.refresh();
      } else showToast({ kind: "error", message: r.error });
    });

  if (rows.length === 0) return <p className="rounded-panou border border-linie bg-suprafata px-4 py-8 text-corp text-discret">{empty}</p>;

  return (
    <ul className="flex flex-col rounded-panou border border-linie bg-suprafata">
      {rows.map((r) => {
        const open = r.status === "DE_FACUT" || r.status === "CONTACTAT";
        return (
          <li key={r.id} className="flex flex-col gap-2 border-b border-linie px-4 py-3 last:border-b-0">
            <div className="grid gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={`/crm/pacienti/${r.patientId}`} className="text-corp font-semibold text-cerneala hover:underline hover:underline-offset-4">
                    {r.patientName}
                  </Link>
                  <span className="text-corp">{r.reason}</span>
                </p>
                <p className="text-mic text-discret">
                  <span className={cn(open && r.dueInDays < 0 && "font-semibold text-carmin")}>
                    {formatDateRo(r.dueDate, "short")}
                    {open ? `, ${dueLabel(r.dueInDays)}` : ""}
                  </span>
                  {[r.doctorName, r.locationName].filter(Boolean).map((s) => `, ${s}`)}
                  {r.attempts > 0 ? `, ${r.attempts} ${r.attempts === 1 ? "apel" : "apeluri"}` : ""}
                </p>
                {r.outcomeNote && <p className="text-mic text-discret">Ultimul: {r.outcomeNote}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                <span className={cn("inline-flex h-6 items-center rounded-chip border px-2 text-micro", STATUS_TONE[r.status])}>{RECALL_STATUS_LABEL[r.status]}</span>
                {r.phone && open && (
                  <a
                    href={telHref(r.phone)}
                    aria-label={`Sunați pe ${r.patientName}, ${formatPhone(r.phone)}`}
                    className="apasat inline-flex h-control-s items-center gap-1.5 rounded-control px-2 text-control text-link hover:bg-adancit"
                  >
                    <Icon name="phone" size={16} />
                    <span className="telefon">{formatPhone(r.phone)}</span>
                  </a>
                )}
                {canManage && open && (
                  <>
                    <Button size="s" variant="secondary" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                      Notați apelul
                    </Button>
                    <Link
                      href={`/crm/programari/noua?pacient=${r.patientId}&rechemare=${r.id}`}
                      className="apasat inline-flex h-control-s items-center rounded-control bg-actiune px-3 text-control font-semibold text-pe-actiune hover:bg-actiune-apasat"
                    >
                      Programați
                    </Link>
                    <Button size="s" variant="text" disabled={pending} onClick={() => setStatus(r.id, "ANULAT")}>
                      Anulați
                    </Button>
                  </>
                )}
                {canManage && (r.status === "REFUZAT" || r.status === "ANULAT") && (
                  <Button size="s" variant="text" disabled={pending} onClick={() => setStatus(r.id, "DE_FACUT")}>
                    Redeschideți
                  </Button>
                )}
                {r.status === "PROGRAMAT" && r.bookedAppointmentId && (
                  <Link href={`/crm/programari/${r.bookedAppointmentId}`} className="text-mic text-link underline underline-offset-4">
                    Programarea
                  </Link>
                )}
              </div>
            </div>
            {openId === r.id && <RecallAttemptForm recallId={r.id} patientName={r.patientName} onDone={() => setOpenId(null)} />}
          </li>
        );
      })}
    </ul>
  );
}
