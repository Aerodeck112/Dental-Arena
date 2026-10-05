import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PanelTone = "suprafata" | "menta-pal" | "mustar-pal";

export type PanelProps = {
  title?: ReactNode;
  /**
   * suprafata: a raised work pane with a 1px linie border (flat, no shadow)
   * menta-pal: selected or informative (the closing booking band)
   * mustar-pal: comfort only („Vă e teamă?”, the patient's own words)
   */
  tone?: PanelTone;
  /** Buttons or links on the title row. */
  actions?: ReactNode;
  /** Heading level of the title. Default 2. */
  level?: 2 | 3 | 4;
  as?: "section" | "div" | "aside";
  children?: ReactNode;
  className?: string;
};

export function Panel({ title, tone = "suprafata", actions, level = 2, as: Tag = "section", children, className }: PanelProps) {
  const H = `h${level}` as "h2" | "h3" | "h4";
  return (
    <Tag
      className={cn(
        "rounded-panou p-5 text-cerneala",
        tone === "suprafata" && "border border-linie bg-suprafata",
        tone === "menta-pal" && "bg-menta-pal",
        tone === "mustar-pal" && "bg-mustar-pal",
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {title && <H className="text-h3 font-semibold">{title}</H>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
