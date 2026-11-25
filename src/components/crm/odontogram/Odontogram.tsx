"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ThreadGlyph } from "@/components/brand/ThreadGlyph";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { TOOTH_CONDITION_LABEL } from "@/lib/labels";
import type { ToothConditionDTO } from "@/server/patients/types";
import { neighbourTooth, rowsFor, toothName, type Dentition } from "./fdi";
import { LEGEND, sortForDisplay, TONE_FILL, TONE_STROKE, TONE_TEXT, type LegendEntry } from "./legend";
import { OdontogramPatterns, Tooth } from "./Tooth";
import { ToothDialog, type OdontogramPlan, type OdontogramService } from "./ToothDialog";

type Props = {
  patientId: string;
  rows: ToothConditionDTO[];
  defaultDentition: Dentition;
  canEdit: boolean;
  canPlan: boolean;
  services: OdontogramService[];
  plans: OdontogramPlan[];
};

const NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"] as const;
type NavKey = (typeof NAV_KEYS)[number];

/**
 * FDI odontogram, adult (11–48) and child (51–85). Fully keyboard-operable: one tab stop, arrow
 * keys move between teeth (up and down jump arches), Enter or Space opens the tooth.
 */
export function Odontogram({ patientId, rows, defaultDentition, canEdit, canPlan, services, plans }: Props) {
  const [dentition, setDentition] = useState<Dentition>(defaultDentition);
  const layout = rowsFor(dentition);
  const [focus, setFocus] = useState<number>(layout[0][0]);
  const [openTooth, setOpenTooth] = useState<number | null>(null);
  const refs = useRef(new Map<number, HTMLButtonElement>());

  const byTooth = useMemo(() => {
    const m = new Map<number, ToothConditionDTO[]>();
    for (const r of rows) m.set(r.tooth, [...(m.get(r.tooth) ?? []), r]);
    return m;
  }, [rows]);
  const current = layout.flat().includes(focus) ? focus : layout[0][0];

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!(NAV_KEYS as readonly string[]).includes(e.key)) return;
    e.preventDefault();
    const next = neighbourTooth(current, e.key as NavKey, dentition);
    setFocus(next);
    refs.current.get(next)?.focus();
  }

  const label = (tooth: number) => {
    const active = sortForDisplay((byTooth.get(tooth) ?? []).filter((r) => !r.resolvedAt));
    const findings = active.map((r) => `${TOOTH_CONDITION_LABEL[r.condition]}${r.surfaces ? ` ${r.surfaces}` : ""}`).join(", ");
    return `${toothName(tooth)}: ${findings || "fără constatări"}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <OdontogramPatterns />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Dentiția"
          value={dentition}
          onChange={(v) => setDentition(v as Dentition)}
          size="s"
          options={[
            { value: "adult", label: "Adult, 11–48" },
            { value: "copil", label: "Copil, 51–85" },
          ]}
        />
        <p className="text-mic text-discret">Săgețile mută între dinți, Enter deschide dintele.</p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          role="group"
          aria-label={dentition === "adult" ? "Odontogramă, dentiție permanentă" : "Odontogramă, dentiție temporară"}
          onKeyDown={onKeyDown}
          className="mx-auto flex w-max flex-col gap-3"
        >
          {layout.map((row, ri) => (
            <div key={ri} className={cn("flex", ri === 0 && "border-b border-linie pb-3")}>
              {row.map((tooth, ci) => {
                const active = (byTooth.get(tooth) ?? []).filter((r) => !r.resolvedAt);
                return (
                  <button
                    key={tooth}
                    ref={(el) => {
                      if (el) refs.current.set(tooth, el);
                      else refs.current.delete(tooth);
                    }}
                    type="button"
                    tabIndex={tooth === current ? 0 : -1}
                    aria-label={label(tooth)}
                    aria-haspopup="dialog"
                    onFocus={() => setFocus(tooth)}
                    onClick={() => {
                      setFocus(tooth);
                      setOpenTooth(tooth);
                    }}
                    className={cn(
                      "apasat rounded-control px-0.5 py-1 hover:bg-adancit focus-visible:bg-menta-pal",
                      ci === row.length / 2 && "ml-3 border-l border-linie pl-3",
                    )}
                  >
                    <Tooth tooth={tooth} findings={active} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Legend />

      {openTooth !== null && (
        <ToothDialog
          open
          onClose={() => {
            const t = openTooth;
            setOpenTooth(null);
            requestAnimationFrame(() => refs.current.get(t)?.focus());
          }}
          patientId={patientId}
          tooth={openTooth}
          rows={byTooth.get(openTooth) ?? []}
          canEdit={canEdit}
          canPlan={canPlan}
          services={services}
          plans={plans}
        />
      )}
    </div>
  );
}

function Swatch({ l }: { l: LegendEntry }) {
  const box = "4,4 20,4 20,20 4,20";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 overflow-visible" aria-hidden="true">
      {
        <polygon
          points={box}
          className={cn(l.pattern === "solid" ? TONE_FILL[l.tone] : "fill-suprafata", "stroke-linie-control")}
          style={["hatch", "crosshatch", "dots"].includes(l.pattern) ? { fill: `url(#odo-${l.pattern}-${l.tone})` } : undefined}
          strokeDasharray={l.pattern === "dashed" ? "3 2" : undefined}
        />
      }
      {l.pattern === "ring" && <rect x="2" y="2" width="20" height="20" rx="4" className={cn("fill-none", TONE_STROKE[l.tone])} strokeWidth="2.5" />}
      {l.pattern === "cross" && <path d="M6 6 L18 18 M18 6 L6 18" className={TONE_STROKE[l.tone]} strokeWidth="2.5" strokeLinecap="round" />}
      {l.pattern === "root" && <path d="M12 4 V20" className={TONE_STROKE[l.tone]} strokeWidth="3" strokeLinecap="round" />}
      {l.pattern === "bar" && <rect x="1" y="17" width="22" height="3.5" className={TONE_FILL[l.tone]} />}
      {l.pattern === "wave" && <path d="M3 12 q2.25 -4 4.5 0 t4.5 0 t4.5 0 t4.5 0" className={cn("fill-none", TONE_STROKE[l.tone])} strokeWidth="1.75" />}
    </svg>
  );
}

function Legend() {
  return (
    <section aria-labelledby="odo-legend" className="flex flex-col gap-2">
      <h3 id="odo-legend" className="text-control font-semibold text-cerneala">
        Legendă
      </h3>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {LEGEND.map((l) => (
          <li key={l.condition} className="flex items-center gap-2 text-mic text-cerneala">
            {l.pattern === "thread" ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <ThreadGlyph count={4} current={4} className="h-3.5 w-auto" />
              </span>
            ) : (
              <Swatch l={l} />
            )}
            <span className={cn("w-5 font-semibold", TONE_TEXT[l.tone])}>{l.letter}</span>
            <span>{l.label}</span>
          </li>
        ))}
      </ul>
      <p className="text-mic text-discret">Roșu: de tratat. Verde: lucrări existente. Implantul este desenat ca filetul din sigla clinicii.</p>
    </section>
  );
}
