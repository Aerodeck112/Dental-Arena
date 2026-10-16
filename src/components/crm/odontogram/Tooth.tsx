import { ThreadGlyph } from "@/components/brand/ThreadGlyph";
import type { ToothConditionType } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import { isUpperTooth, quadrantOf, type Surface } from "./fdi";
import { LEGEND_BY_CONDITION, sortForDisplay, TONE_FILL, TONE_STROKE, TONE_TEXT, type ToothTone } from "./legend";

/**
 * One tooth of the chart, drawn from the dentist's view: a five-face crown diagram (M O D V L/P)
 * plus a root zone. Findings are colour + pattern + letter (legend.ts); the implant is the mini
 * thread of the logo (design system §7). Purely presentational; the button around it lives in
 * Odontogram.tsx.
 */

export type ToothFinding = { id: string; condition: ToothConditionType; surfaces: string | null };

/** Crown faces as polygons in a 40×40 box: top, bottom, left, right edges and the centre. */
const FACE = {
  top: "4,4 36,4 27,13 13,13",
  bottom: "4,36 36,36 27,27 13,27",
  left: "4,4 13,13 13,27 4,36",
  right: "36,4 27,13 27,27 36,36",
  centre: "13,13 27,13 27,27 13,27",
} as const;
type FaceKey = keyof typeof FACE;

/** Which drawn face is which surface: vestibular is outward (top on the upper arch), mesial towards the midline. */
export function faceOfSurface(tooth: number, s: Surface): FaceKey {
  const upper = isUpperTooth(tooth);
  const rightSideOfPatient = [1, 4, 5, 8].includes(quadrantOf(tooth)); // drawn on the left of the screen
  switch (s) {
    case "O":
      return "centre";
    case "V":
      return upper ? "top" : "bottom";
    case "L":
    case "P":
      return upper ? "bottom" : "top";
    case "M":
      return rightSideOfPatient ? "right" : "left";
    case "D":
      return rightSideOfPatient ? "left" : "right";
  }
}

/** Fill for a face: solid tone, or a pattern defined once by <OdontogramPatterns />. */
function faceFill(tone: ToothTone, pattern: string): string {
  if (pattern === "solid") return "";
  return `url(#odo-${pattern}-${tone})`;
}

export function Tooth({ tooth, findings, className }: { tooth: number; findings: ToothFinding[]; className?: string }) {
  const sorted = sortForDisplay(findings);
  const upper = isUpperTooth(tooth);
  const faces = new Map<FaceKey, { tone: ToothTone; pattern: string }>();
  const whole = new Set<ToothConditionType>();
  for (const f of [...sorted].reverse()) {
    const l = LEGEND_BY_CONDITION[f.condition];
    if (l.scope === "tooth") {
      whole.add(f.condition);
      continue;
    }
    const surfaces = (f.surfaces ?? "").split("").filter(Boolean) as Surface[];
    const keys: FaceKey[] = surfaces.length ? surfaces.map((s) => faceOfSurface(tooth, s)) : ["top", "bottom", "left", "right", "centre"];
    for (const k of keys) faces.set(k, { tone: l.tone, pattern: l.pattern });
  }
  const absent = whole.has("EXTRAS") || whole.has("LIPSA") || whole.has("IMPLANT");
  const dashedOutline = whole.has("LIPSA") || whole.has("INCLUS");

  const root = (
    <span className="flex h-4 w-9 items-center justify-center" aria-hidden="true">
      {whole.has("IMPLANT") ? (
        <ThreadGlyph count={4} current={4} className={cn("h-3.5 w-auto", upper && "rotate-180")} />
      ) : (
        <svg viewBox="0 0 36 16" className="h-4 w-9 overflow-visible">
          <path
            d={upper ? "M12 16 L14 3 M24 16 L22 3" : "M12 0 L14 13 M24 0 L22 13"}
            className={cn("fill-none", absent ? "stroke-linie" : "stroke-linie-control")}
            strokeWidth={1.25}
            strokeLinecap="round"
          />
          {whole.has("ENDODONTIE") && (
            <path d={upper ? "M13 16 L14.5 2 M23 16 L21.5 2" : "M13 0 L14.5 14 M23 0 L21.5 14"} className={TONE_STROKE.actiune} strokeWidth={2.5} strokeLinecap="round" />
          )}
          {whole.has("RADACINA_RESTANTA") && (
            <g className={TONE_FILL.carmin}>
              <circle cx={13} cy={8} r={2.2} />
              <circle cx={23} cy={8} r={2.2} />
            </g>
          )}
          {(whole.has("PARODONTOPATIE") || whole.has("MOBILITATE")) && (
            <path
              d="M4 8 q3 -4 6 0 t6 0 t6 0 t6 0 t6 0"
              className={cn("fill-none", whole.has("PARODONTOPATIE") ? TONE_STROKE.carmin : TONE_STROKE.discret)}
              strokeWidth={1.75}
            />
          )}
        </svg>
      )}
    </span>
  );

  const crown = (
    <svg viewBox="0 0 40 40" className="h-9 w-9 overflow-visible" aria-hidden="true">
      {(Object.keys(FACE) as FaceKey[]).map((k) => {
        const f = faces.get(k);
        return (
          <polygon
            key={k}
            points={FACE[k]}
            className={cn(
              f ? (f.pattern === "solid" ? TONE_FILL[f.tone] : "") : absent ? "fill-adancit" : "fill-suprafata",
              "stroke-linie-control",
            )}
            style={f && f.pattern !== "solid" ? { fill: faceFill(f.tone, f.pattern) } : undefined}
            strokeWidth={1}
            strokeDasharray={dashedOutline ? "3 2" : undefined}
            strokeLinejoin="round"
          />
        );
      })}
      {whole.has("COROANA") && <rect x={1.5} y={1.5} width={37} height={37} rx={6} className={cn("fill-none", TONE_STROKE.cerneala)} strokeWidth={2.5} />}
      {(whole.has("PUNTE") || whole.has("PROTEZA")) && (
        <rect x={-2} y={upper ? 36.5 : 0} width={44} height={3.5} className={whole.has("PUNTE") ? TONE_FILL.cerneala : TONE_FILL.discret} />
      )}
      {whole.has("EXTRAS") && <path d="M6 6 L34 34 M34 6 L6 34" className={TONE_STROKE.discret} strokeWidth={3} strokeLinecap="round" />}
    </svg>
  );

  const letters = (
    <span className="flex h-4 min-w-9 items-center justify-center gap-0.5 text-micro leading-none font-semibold" aria-hidden="true">
      {sorted.slice(0, 3).map((f) => (
        <span key={f.id} className={TONE_TEXT[LEGEND_BY_CONDITION[f.condition].tone]}>
          {LEGEND_BY_CONDITION[f.condition].letter}
        </span>
      ))}
      {sorted.length > 3 && <span className="text-discret">+</span>}
    </span>
  );

  const number = (
    <span className="cifre text-mic leading-none text-discret" aria-hidden="true">
      {tooth}
    </span>
  );

  return (
    <span className={cn("flex flex-col items-center gap-0.5", className)}>
      {upper ? (
        <>
          {number}
          {root}
          {crown}
          {letters}
        </>
      ) : (
        <>
          {letters}
          {crown}
          {root}
          {number}
        </>
      )}
    </span>
  );
}

/** Pattern definitions, rendered once per chart. Ids: `odo-<pattern>-<tone>`. */
export function OdontogramPatterns() {
  const tones: ToothTone[] = ["carmin", "actiune", "menta", "cerneala", "discret"];
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        {tones.map((t) => (
          <g key={t}>
            <pattern id={`odo-hatch-${t}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" className="fill-suprafata" />
              <line x1="0" y1="0" x2="0" y2="5" className={TONE_STROKE[t]} strokeWidth="2.4" />
            </pattern>
            <pattern id={`odo-crosshatch-${t}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" className="fill-suprafata" />
              <path d="M0 0 V5 M0 0 H5" className={TONE_STROKE[t]} strokeWidth="1.6" />
            </pattern>
            <pattern id={`odo-dots-${t}`} width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" className="fill-suprafata" />
              <circle cx="2.5" cy="2.5" r="1.3" className={TONE_FILL[t]} />
            </pattern>
          </g>
        ))}
      </defs>
    </svg>
  );
}
