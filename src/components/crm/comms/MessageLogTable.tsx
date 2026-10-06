import Link from "next/link";
import { Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPhone } from "@/lib/format";
import {
  MESSAGE_CHANNEL_LABEL,
  MESSAGE_KIND_LABEL,
  MESSAGE_STATUS_LABEL,
} from "@/lib/labels";
import type { MessageLogRow, MessageStatus } from "@/server/notify/types";

/**
 * The message log (Mesaje): one row per message actually sent, simulated or failed. Status is
 * an icon plus a word, never colour alone; the text opens in place.
 */

const STATUS_STYLE: Record<
  MessageStatus,
  { icon: IconName; className: string }
> = {
  TRIMIS: { icon: "check", className: "border-actiune text-cerneala" },
  SIMULAT: { icon: "info", className: "border-linie-control text-discret" },
  EROARE: { icon: "alert-triangle", className: "border-carmin text-carmin" },
};

export function MessageStatusChip({ status }: { status: MessageStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-chip border px-2 text-micro font-semibold whitespace-nowrap",
        s.className,
      )}
    >
      <Icon name={s.icon} size={14} />
      {MESSAGE_STATUS_LABEL[status]}
    </span>
  );
}

function recipient(row: MessageLogRow): string {
  return row.channel === "SMS" ? formatPhone(row.to) : row.to;
}

export function MessageLogTable({
  rows,
  empty,
}: {
  rows: MessageLogRow[];
  empty: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      {/* Phones: one block per message, the text first. */}
      <ul
        className="flex flex-col md:hidden"
        aria-label="Jurnalul mesajelor, cele mai noi primele"
      >
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-1.5 border-b border-linie py-3 text-mic cifre"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold">
                  {MESSAGE_CHANNEL_LABEL[r.channel]}
                </span>
                , {MESSAGE_KIND_LABEL[r.kind].toLowerCase()}
              </span>
              <MessageStatusChip status={r.status} />
            </div>
            <p className="text-discret">
              {formatDateTime(new Date(r.createdAt))}, către{" "}
              <span className="whitespace-nowrap">{recipient(r)}</span>
              {r.patient ? (
                <>
                  {" "}
                  (
                  <Link
                    href={`/crm/pacienti/${r.patient.id}`}
                    className="text-link underline-offset-2 hover:underline"
                  >
                    {r.patient.name}
                  </Link>
                  )
                </>
              ) : null}
            </p>
            <details className="group [overflow-wrap:anywhere]">
              <summary className="cursor-pointer list-none">
                <span className="line-clamp-3 group-open:hidden">
                  {r.subject ? (
                    <span className="font-semibold">{r.subject}: </span>
                  ) : null}
                  {r.body}
                </span>
                <span className="hidden text-link underline group-open:inline">
                  Ascundeți textul
                </span>
              </summary>
              {r.subject ? (
                <p className="mt-1 font-semibold">{r.subject}</p>
              ) : null}
              <p className="mt-1 whitespace-pre-line">{r.body}</p>
            </details>
            {r.error ? (
              <p className="flex items-start gap-1 text-carmin">
                <Icon name="alert-triangle" size={14} className="mt-0.5" />
                {r.error}
              </p>
            ) : null}
            <p className="text-discret">
              Trimis de: {r.sentByName ?? "automat"}
            </p>
          </li>
        ))}
      </ul>
      <div className="relative hidden w-full overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-mic cifre">
          <caption className="sr-only">
            Jurnalul mesajelor, cele mai noi primele
          </caption>
          <thead>
            <tr className="border-b border-linie-control text-discret">
              <th
                scope="col"
                className="px-3 pb-2 font-semibold whitespace-nowrap"
              >
                Data
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Canal și tip
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Destinatar
              </th>
              <th
                scope="col"
                className="w-full min-w-64 px-3 pb-2 font-semibold"
              >
                Mesaj
              </th>
              <th
                scope="col"
                className="px-3 pb-2 font-semibold whitespace-nowrap"
              >
                Trimis de
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-linie align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDateTime(new Date(r.createdAt))}
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold">
                    {MESSAGE_CHANNEL_LABEL[r.channel]}
                  </span>
                  <span className="block text-discret">
                    {MESSAGE_KIND_LABEL[r.kind]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <MessageStatusChip status={r.status} />
                </td>
                <td className="px-3 py-2">
                  <span className="whitespace-nowrap">{recipient(r)}</span>
                  {r.patient ? (
                    <Link
                      href={`/crm/pacienti/${r.patient.id}`}
                      className="block text-link underline-offset-2 hover:underline"
                    >
                      {r.patient.name}
                    </Link>
                  ) : r.leadId ? (
                    <Link
                      href={`/crm/cereri/${r.leadId}`}
                      className="block text-link underline-offset-2 hover:underline"
                    >
                      Cererea
                    </Link>
                  ) : null}
                </td>
                <td className="px-3 py-2 [overflow-wrap:anywhere]">
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <span className="line-clamp-2 group-open:hidden">
                        {r.subject ? (
                          <span className="font-semibold">{r.subject}: </span>
                        ) : null}
                        {r.body}
                      </span>
                      <span className="hidden text-link underline group-open:inline">
                        Ascundeți textul
                      </span>
                    </summary>
                    {r.subject ? (
                      <p className="mt-1 font-semibold">{r.subject}</p>
                    ) : null}
                    <p className="mt-1 whitespace-pre-line masura">{r.body}</p>
                  </details>
                  {r.error ? (
                    <p className="mt-1 flex items-start gap-1 text-carmin">
                      <Icon
                        name="alert-triangle"
                        size={14}
                        className="mt-0.5"
                      />
                      {r.error}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-discret">
                  {r.sentByName ?? "Automat"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
