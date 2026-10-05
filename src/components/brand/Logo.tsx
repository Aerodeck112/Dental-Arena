import type { SVGProps } from "react";
import { cn } from "@/lib/cn";
import { HAIRLINE, MARK, SUBLINE, WORDMARK, type MarkPart } from "./logo-paths";

export type LogoVariant = "full" | "compact" | "mark" | "reversed" | "mono";
export type LogoLockup = "full" | "compact" | "mark";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox" | "role"> & {
  /**
   * full: mark, wordmark, hairline and „CLINICA STOMATOLOGICA” (min. 220px wide)
   * compact: mark and wordmark (min. 140px wide); mark: the mark alone (min. 16px tall)
   * reversed: white wordmark with the Mentă mark, for the footer (`lockup` picks the shape)
   * mono: one colour (currentColor, `cerneala` by default) for print (`lockup` picks the shape)
   *
   * full, compact and mark switch to the reversed colours by themselves in dark mode.
   */
  variant?: LogoVariant;
  /** Shape used by the reversed and mono variants. Default "full". */
  lockup?: LogoLockup;
  /** Accessible name. Pass "" when the logo sits inside a link or heading that already names it. */
  title?: string;
  /** Mark only: drop two bands so the screw stays legible below 32px (favicon rule, §9.4). */
  simplified?: boolean;
  className?: string;
};

const VIEWBOX: Record<LogoLockup, { box: string; width: number; height: number }> = {
  // One unit = one pixel of the master artwork (see logo-paths.ts).
  full: { box: "-1 -1.5 1640 618", width: 220, height: 83 },
  compact: { box: "-1 -1.5 1640 479", width: 160, height: 47 },
  mark: { box: "718.5 -2 297 484", width: 25, height: 40 },
};

const FULL_PARTS: MarkPart[] = ["crownLeft", "crownRight", "band1", "band2", "band3", "band4", "apex"];
const SIMPLE_PARTS: MarkPart[] = ["crownLeft", "crownRight", "band1", "band3", "apex"];

/**
 * The Dental Arena logo, hand-traced from the master artwork. Never typeset „DENTAL ARENA”
 * in Forum as a stand-in (§4.3 rule 12). Size it with height or width classes (`h-10 w-auto`).
 */
export function Logo({
  variant = "compact",
  lockup,
  title = "Dental Arena",
  simplified = false,
  className,
  ...rest
}: LogoProps) {
  const shape: LogoLockup =
    variant === "full" || variant === "compact" || variant === "mark" ? variant : (lockup ?? "full");
  const { box, width, height } = VIEWBOX[shape];

  const markFill = variant === "mono" ? "currentColor" : "var(--da-logo-marca)";
  const textFill =
    variant === "mono" ? "currentColor" : variant === "reversed" ? "var(--da-logo-invers)" : "var(--da-logo-text)";
  const parts = shape === "mark" && simplified ? SIMPLE_PARTS : FULL_PARTS;
  const labelled = title !== "";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={box}
      width={width}
      height={height}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      className={cn("shrink-0", variant === "mono" && "text-cerneala", className)}
      {...rest}
    >
      <g fill={markFill}>
        {parts.map((part) => (
          <path key={part} d={MARK[part]} />
        ))}
      </g>
      {shape !== "mark" && <path d={WORDMARK} fill={textFill} fillRule="evenodd" />}
      {shape === "full" && (
        <>
          <rect x={HAIRLINE[0]} y={HAIRLINE[1]} width={HAIRLINE[2]} height={HAIRLINE[3]} fill={textFill} />
          <path d={SUBLINE} fill={textFill} fillRule="evenodd" />
        </>
      )}
    </svg>
  );
}
