import { ThreadSteps } from "@/components/brand/ThreadSteps";
import { formatDateRo } from "@/lib/format";
import { IMPLANT_STEPS, implantProgress } from "@/server/patients/plan-math";
import type { PlanItemDTO } from "@/server/patients/types";

/**
 * Implant plan progress with the thread (design system §7, „Where it appears” 2): radiografii,
 * implant, vindecare 3–6 luni, bont, coroană. Plans that are not implant plans show a plain count.
 */
export function PlanProgress({ items, isImplant, now }: { items: PlanItemDTO[]; isImplant: boolean; now?: Date }) {
  if (!isImplant) {
    const live = items.filter((i) => i.status !== "ANULAT");
    const done = live.filter((i) => i.status === "EFECTUAT").length;
    return (
      <p className="text-mic text-discret cifre">
        {live.length === 0 ? "Nicio lucrare în plan." : `${done} din ${live.length} lucrări efectuate`}
      </p>
    );
  }
  const { current, healingUntil } = implantProgress(items, now);
  return (
    <div className="flex flex-col gap-1">
      <ThreadSteps steps={[...IMPLANT_STEPS]} current={current} variant="plan" label="Etapele tratamentului cu implant" />
      {healingUntil && current <= 2 && (
        <p className="text-mic text-discret">Vindecare până la {formatDateRo(healingUntil, "short")}</p>
      )}
    </div>
  );
}
