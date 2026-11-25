"use client";

import { useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import type { ConflictInfo } from "@/lib/errors";
import { cn } from "@/lib/cn";
import type { Role } from "@/generated/prisma/enums";

/** Warnings a MEDIC may override on their own appointments (§6.2). */
const MEDIC_OVERRIDABLE = ["OUTSIDE_SHIFT", "IN_PAST"];

/** True when every warning may be overridden by this user (A/R: all; MEDIC: shift and past only). */
export function canOverrideAll(conflicts: readonly ConflictInfo[], o: { canOverride: boolean; role: Role }): boolean {
  const warns = conflicts.filter((c) => c.severity === "warn");
  if (conflicts.some((c) => c.severity === "block") || warns.length === 0) return false;
  if (o.canOverride) return true;
  return o.role === "MEDIC" && warns.every((c) => MEDIC_OVERRIDABLE.includes(c.kind));
}

/**
 * The §6.2 conflicts of a refused save. Blocks are listed on carmin-pal and cannot be overridden;
 * warnings show the „Salvați oricum” checkbox (`acknowledgeWarnings`) when the user may override
 * them. Takes focus when it appears, like an error summary.
 */
export function ConflictNotice({
  conflicts,
  canOverride,
  role,
  idPrefix,
  className,
}: {
  conflicts: readonly ConflictInfo[] | undefined;
  canOverride: boolean;
  role: Role;
  idPrefix: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const list = conflicts ?? [];
  const signature = list.map((c) => c.kind + c.message).join("|");
  useEffect(() => {
    if (signature) ref.current?.focus();
  }, [signature]);
  if (list.length === 0) return null;
  const blocks = list.filter((c) => c.severity === "block");
  const warns = list.filter((c) => c.severity === "warn");
  const overridable = canOverrideAll(list, { canOverride, role });
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-panou border p-3 text-corp outline-none focus-visible:outline-2",
        blocks.length > 0 ? "border-carmin bg-carmin-pal" : "border-linie-control bg-adancit",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="alert-triangle" size={18} className={blocks.length > 0 ? "text-carmin" : "text-cerneala"} />
        {blocks.length > 0 ? "Programarea nu poate fi salvată" : "Verificați înainte de a salva"}
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-6">
        {[...blocks, ...warns].map((c, i) => (
          <li key={`${c.kind}-${i}`}>{c.message}</li>
        ))}
      </ul>
      {overridable && (
        <Checkbox
          id={`${idPrefix}-ack`}
          name="acknowledgeWarnings"
          label="Salvați oricum"
          description="Ați verificat avertismentele de mai sus."
        />
      )}
      {!overridable && blocks.length === 0 && warns.length > 0 && (
        <p className="text-mic text-discret">Doar recepția sau administratorul pot salva peste aceste avertismente.</p>
      )}
    </div>
  );
}
