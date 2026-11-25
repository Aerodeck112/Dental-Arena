"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { ChoiceButton, type ChoiceTone } from "@/components/ui/ChoiceButton";
import { TextArea } from "@/components/ui/TextArea";
import { COMFORT_LABEL } from "@/lib/labels";
import type { ComfortValue } from "@/server/leads/schemas";
import type { BookingState } from "./useBookingState";

const CHOICES: { value: ComfortValue; tone: ChoiceTone }[] = [
  { value: "FARA_EMOTII", tone: "calm" },
  { value: "EMOTII", tone: "comfort" },
  { value: "FRICA", tone: "comfort" },
];

/**
 * Step 3 „Cum vă simțiți”: the comfort answer (prefilled from the home question), the inhalosedare
 * wish and, for „Am puține emoții” or „Mi-e frică”, an optional note. Mustard means comfort only.
 */
export function StepComfort({
  state,
  update,
}: {
  state: BookingState;
  update: (patch: Partial<BookingState>) => void;
}) {
  const worried = state.comfort === "EMOTII" || state.comfort === "FRICA";
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="pas3-titlu" className="font-display text-h2 text-cerneala">
          Cum vă simțiți înainte de vizită?
        </h2>
        <p className="text-corp text-discret">Medicul vede răspunsul înainte să intrați.</p>
      </div>

      <div role="group" aria-labelledby="pas3-titlu" className="flex flex-wrap gap-3">
        {CHOICES.map((c) => (
          <ChoiceButton
            key={c.value}
            tone={c.tone}
            selected={state.comfort === c.value}
            onClick={() => update({ comfort: state.comfort === c.value ? null : c.value })}
          >
            {COMFORT_LABEL[c.value]}
          </ChoiceButton>
        ))}
      </div>

      {worried && (
        <div className="da-fade rounded-panou bg-mustar-pal p-5">
          <TextArea
            label="Vreți să ne spuneți ce vă îngrijorează?"
            name="comfortNote"
            optional
            rows={3}
            maxLength={500}
            value={state.comfortNote}
            onChange={(e) => update({ comfortNote: e.target.value })}
            hint="De exemplu: „Am avut o extracție grea acum mulți ani.”"
          />
        </div>
      )}

      <Checkbox
        name="wantsSedation"
        label="Aș vrea inhalosedare (150 lei / oră)"
        description="Respirați un amestec care vă relaxează; rămâneți conștient. Stabilim detaliile la telefon."
        checked={state.wantsSedation}
        onChange={(e) => update({ wantsSedation: e.target.checked })}
      />
    </div>
  );
}
