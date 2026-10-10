import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ServiceSlug } from "@/content/services";

/**
 * Line drawings of teeth, implants and instruments, in the manner of a dental chart: one even
 * hairline (it does not thicken when the drawing is scaled), round ends, drawn in currentColor so
 * the parent sets the colour (mint on the forest panels, the action green on light tiles).
 * Decorative and still (design-system §8: nothing autoplays). Every single drawing is laid out
 * upright on a 120 × 120 grid around its centre (60, 60).
 */
export type DentalArtName =
  | "molar"
  | "incisiv"
  | "implant"
  | "oglinda"
  | "sonda"
  | "pensa"
  | "clesti"
  | "coroana"
  | "aparat"
  | "periuta"
  | "masca"
  | "culori"
  | "plomba"
  | "gingie"
  | "consult"
  | "copil"
  | "pereche"
  | "tava";

/** The drawing on each service's tile and page. */
export const SERVICE_ART: Record<ServiceSlug, DentalArtName> = {
  "consultatie-profilaxie": "consult",
  "stomatologie-generala": "plomba",
  inhalosedare: "masca",
  implantologie: "implant",
  "chirurgie-dento-alveolara": "clesti",
  "protetica-dentara": "coroana",
  pedodontie: "copil",
  ortodontie: "aparat",
  parodontologie: "gingie",
  "estetica-dentara": "culori",
};

/** Places an upright 120 × 120 drawing with its centre at (x, y), turned and scaled. */
const at = (x: number, y: number, deg = 0, s = 1) => `translate(${x} ${y}) rotate(${deg}) scale(${s}) translate(-60 -60)`;

const MOLAR =
  "M32 34C30 20 40 14 48 18C53 21 56 24 60 22C64 24 67 21 72 18C80 14 90 20 88 34C87 46 84 54 82 62C80 76 80 90 76 102C74 108 68 107 67 101C66 90 64 80 60 76C56 80 54 90 53 101C52 107 46 108 44 102C40 90 40 76 38 62C36 54 33 46 32 34Z";

function Molar() {
  return (
    <>
      <path d={MOLAR} />
      <path d="M44 34C50 38 55 36 60 32C65 36 70 38 76 34" />
    </>
  );
}

function Incisor() {
  return (
    <>
      <path d="M44 22C52 18 68 18 76 22C79 34 78 48 74 58C72 64 70 72 68 84C66 96 64 104 60 106C56 104 54 96 52 84C50 72 48 64 46 58C42 48 41 34 44 22Z" />
      <path d="M46 58C54 62 66 62 74 58" />
    </>
  );
}

function Implant() {
  return (
    <>
      <path d="M42 20C42 10 78 10 78 20C80 30 78 37 74 41H46C42 37 40 30 42 20Z" />
      <path d="M50 41 52 50H68L70 41" />
      <path d="M52 50 53 94 57 102H63L67 94 68 50" />
      {[58, 66, 74, 82, 90].map((y, i) => (
        <path key={y} d={`M${48 + i * 0.6} ${y + 2}L${72 - i * 0.6} ${y - 2}`} />
      ))}
    </>
  );
}

function Mirror() {
  return (
    <>
      <circle cx="60" cy="20" r="14" />
      <path d="M51 16A10 10 0 0 1 58 10" />
      <path d="M60 34V44" />
      <rect x="56" y="44" width="8" height="68" rx="4" />
      <path d="M56 60H64M56 65H64M56 70H64" />
    </>
  );
}

function Probe() {
  return (
    <>
      <path d="M51 19C48 18 47 14 50 12C54 10 60 14 60 22V40" />
      <rect x="56" y="40" width="8" height="70" rx="4" />
      <path d="M56 56H64M56 61H64M56 66H64" />
    </>
  );
}

function Tweezers() {
  return (
    <>
      <path d="M60 8C55 8 52 12 51 18L46 66 55 100 55 110" />
      <path d="M60 8C65 8 68 12 69 18L74 66 65 100 65 110" />
      <path d="M48 46H51M47.5 51H50.5M47 56H50M69 46H72M69.5 51H72.5M70 56H73" />
    </>
  );
}

function Forceps() {
  return (
    <>
      <path d="M55 8C50 18 52 26 58 33" />
      <path d="M65 8C70 18 68 26 62 33" />
      <circle cx="60" cy="37" r="4" />
      <path d="M58 41C50 60 46 84 48 110" />
      <path d="M62 41C70 60 74 84 72 110" />
    </>
  );
}

function Crown() {
  return (
    <>
      <path d="M36 22C36 12 84 12 84 22C86 34 84 44 80 50H40C36 44 34 34 36 22Z" />
      <path d="M45 50 47 37C51 31 69 31 73 37L75 50" strokeDasharray="3 4" />
      <path d="M46 66C48 58 72 58 74 66L72 78C70 92 66 102 60 108C54 102 50 92 48 78Z" />
    </>
  );
}

function Braces() {
  return (
    <>
      {[0, 1, 2].map((i) => {
        const x = 17 + i * 30;
        return (
          <g key={i}>
            <path d={`M${x} 32C${x} 26 ${x + 26} 26 ${x + 26} 32V72C${x + 26} 88 ${x} 88 ${x} 72Z`} />
            <rect x={x + 7} y="50" width="12" height="12" rx="2" />
          </g>
        );
      })}
      <path d="M6 56H114" />
    </>
  );
}

function Toothbrush() {
  return (
    <>
      <rect x="54" y="10" width="12" height="32" rx="4" />
      <path d="M54 15H46M54 21H46M54 27H46M54 33H46M54 39H46" />
      <path d="M57 42 58 108C58 111 62 111 62 108L63 42" />
    </>
  );
}

function SedationMask() {
  return (
    <>
      <path d="M60 30C48 30 40 56 40 66C40 76 50 80 60 80C70 80 80 76 80 66C80 56 72 30 60 30Z" />
      <path d="M52 66C55 69 65 69 68 66" />
      <path d="M41 58C26 54 16 48 10 40M79 58C94 54 104 48 110 40" />
      <path d="M60 80C60 92 70 100 84 104C96 108 104 104 110 96" />
    </>
  );
}

function ShadeGuide() {
  return (
    <>
      {[-30, -10, 10, 30].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 60 108)`}>
          <path d="M53 18C53 12 67 12 67 18L66 40C65 46 55 46 54 40Z" />
          <path d="M58 45V100M62 45V100" />
        </g>
      ))}
      <circle cx="60" cy="108" r="4" />
    </>
  );
}

function Filling() {
  return (
    <>
      <Molar />
      <path d="M50 26C54 30 66 30 70 26C70 38 50 38 50 26Z" fill="currentColor" fillOpacity="0.22" />
    </>
  );
}

function Gum() {
  return (
    <>
      <path d={MOLAR} />
      <path d="M6 70C22 70 30 56 40 56C48 56 52 62 60 62C68 62 72 56 80 56C90 56 98 70 114 70" />
      <path d="M6 88H40M54.5 88H65.5M80 88H114" strokeDasharray="3 5" />
    </>
  );
}

/** Mirror and probe, crossed: the check-up. */
function Checkup() {
  return (
    <>
      <g transform={at(50, 62, -22, 0.9)}>
        <Mirror />
      </g>
      <g transform={at(70, 62, 22, 0.9)}>
        <Probe />
      </g>
    </>
  );
}

/** A small milk tooth beside a toothbrush. */
function ChildTooth() {
  return (
    <>
      <g transform={at(40, 64, 0, 0.62)}>
        <path d="M30 40C28 22 42 16 50 22C55 26 65 26 70 22C78 16 92 22 90 40C89 54 86 62 84 70C82 80 78 88 72 86C68 84 66 78 60 76C54 78 52 84 48 86C42 88 38 80 36 70C34 62 31 54 30 40Z" />
        <path d="M42 42C50 46 56 44 60 40C64 44 70 46 78 42" />
      </g>
      <g transform={at(86, 62, 18, 0.86)}>
        <Toothbrush />
      </g>
    </>
  );
}

const SINGLE: Record<Exclude<DentalArtName, "pereche" | "tava">, () => ReactNode> = {
  molar: Molar,
  incisiv: Incisor,
  implant: Implant,
  oglinda: Mirror,
  sonda: Probe,
  pensa: Tweezers,
  clesti: Forceps,
  coroana: Crown,
  aparat: Braces,
  periuta: Toothbrush,
  masca: SedationMask,
  culori: ShadeGuide,
  plomba: Filling,
  gingie: Gum,
  consult: Checkup,
  copil: ChildTooth,
};

/** A natural molar beside an implant, on the same bone line: the home page's drawing. */
function Pair() {
  return (
    <>
      <g transform={at(60, 60)}>
        <Molar />
      </g>
      <g transform={at(160, 60)}>
        <Implant />
      </g>
      <path d="M2 68H36M84 68H148M172 68H218" strokeDasharray="3 5" />
    </>
  );
}

/** The instrument tray: mirror, probe and tweezers laid side by side. */
function Tray() {
  return (
    <>
      <rect x="3" y="3" width="234" height="144" rx="16" />
      <g transform={at(120, 38, -90, 1.6)}>
        <Mirror />
      </g>
      <g transform={at(120, 76, -90, 1.6)}>
        <Probe />
      </g>
      {/* Full length, but only as wide as the other two, so it does not crowd the probe. */}
      <g transform="translate(120 116) rotate(-90) scale(1.05 1.6) translate(-60 -60)">
        <Tweezers />
      </g>
    </>
  );
}

const VIEWBOX: Partial<Record<DentalArtName, string>> = { pereche: "0 0 220 120", tava: "0 0 240 150" };

export function DentalArt({
  name,
  className,
  strokeWidth = 1.5,
}: {
  name: DentalArtName;
  className?: string;
  /** Line weight in screen pixels, whatever the drawing's size. */
  strokeWidth?: number;
}) {
  const Body = name === "pereche" ? Pair : name === "tava" ? Tray : SINGLE[name];
  return (
    <svg
      viewBox={VIEWBOX[name] ?? "0 0 120 120"}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn("desen", className)}
    >
      <Body />
    </svg>
  );
}
