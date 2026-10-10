import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDateRo, formatTime } from "@/lib/format";
import { LEAD_ACTIVITY_TYPE_LABEL } from "@/lib/labels";
import type { LeadActivityType } from "@/generated/prisma/enums";
import type { LeadActivityDTO } from "@/server/appointments/types";

const ICON: Record<LeadActivityType, IconName> = {
  NOTA: "pencil",
  APEL: "phone",
  SMS: "message-square",
  EMAIL: "mail",
  STATUS: "arrow-up-down",
  ATRIBUIRE: "user",
  CONVERSIE: "check-check",
};

/** The request's history, newest first: notes, calls, status changes, assignment, conversion. */
export function LeadActivityList({ items }: { items: LeadActivityDTO[] }) {
  if (items.length === 0) return <p className="text-mic text-discret">Nicio activitate încă. Notați primul apel sau o observație.</p>;
  return (
    <ol className="flex flex-col">
      {items.map((a) => (
        <li key={a.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2 border-b border-linie py-2 last:border-b-0">
          <Icon name={ICON[a.type]} size={16} className="mt-0.5 text-discret" />
          <div className="min-w-0">
            <p className="text-mic text-discret">
              <span className="font-semibold text-cerneala">{LEAD_ACTIVITY_TYPE_LABEL[a.type]}</span>
              {", "}
              <time dateTime={a.createdAt} className="cifre">
                {formatDateRo(new Date(a.createdAt), "short")}, {formatTime(new Date(a.createdAt))}
              </time>
              {a.authorName ? `, ${a.authorName}` : ""}
            </p>
            {a.body && <p className="whitespace-pre-line break-words text-corp">{a.body}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
