"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignLeadAction } from "@/app/(crm)/crm/(app)/cereri/actions";
import { Spinner } from "@/components/ui/Spinner";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/** Who handles the request: a compact select that saves on change (A/R only). */
export function AssignSelect({
  leadId,
  value,
  assignees,
  disabled = false,
  id,
  className,
}: {
  leadId: string;
  value: string | null;
  assignees: { id: string; name: string }[];
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value ?? "none");
  const [pending, start] = useTransition();
  const selectId = id ?? `assign-${leadId}`;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label htmlFor={selectId} className="text-mic text-discret">
        Se ocupă
      </label>
      <select
        id={selectId}
        value={current}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = current;
          setCurrent(next);
          start(async () => {
            const r = await assignLeadAction({ id: leadId, assignedToId: next });
            if (r.ok) {
              showToast({ kind: "success", message: r.message ?? "Salvat" });
              router.refresh();
            } else {
              setCurrent(prev);
              showToast({ kind: "error", message: r.error });
            }
          });
        }}
        className="h-control-s min-w-0 rounded-control border border-linie-control bg-suprafata px-2 text-control text-cerneala disabled:opacity-60"
      >
        <option value="none">Nimeni</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {pending && <Spinner size={16} />}
    </div>
  );
}
