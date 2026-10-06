import { ThreadSteps } from "@/components/brand/ThreadSteps";
import type { ServiceStep } from "@/content/services";

/**
 * „Cum decurge” (design-system §6.5, §7): the thread, one band per step, only on the services
 * whose own copy describes a real sequence (implantologie, ortodonție, inhalosedare). The screw
 * is drawn whole, in the clinical order: the root first, the crown last.
 */
export function ServiceSteps({ steps, note, headingId = "cum-decurge" }: { steps: ServiceStep[]; note?: string; headingId?: string }) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-h2 text-cerneala">
        Cum decurge
      </h2>
      <ThreadSteps
        variant="list"
        steps={steps.map((s) => ({ label: s.label, detail: s.detail }))}
        current={steps.length}
        label="Etapele tratamentului"
        className="mt-8"
      />
      {note && <p className="mt-6 text-corp text-discret masura">{note}</p>}
    </section>
  );
}
