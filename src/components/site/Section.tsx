import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Page grid (design-system §6.1): content max 1280px, side margins 20 / 40 / 80px, and 4 / 8 / 12
 * columns with 24px gutters. Sections are separated by space and, where the kind of content
 * changes, by a change of surface; never by hairlines.
 */
export function Container({ as: Tag = "div", className, children, id }: { as?: ElementType; className?: string; children: ReactNode; id?: string }) {
  return (
    <Tag id={id} className={cn("mx-auto w-full max-w-[calc(var(--container-continut)+2*var(--spacing-margine))] px-margine", className)}>
      {children}
    </Tag>
  );
}

/** The 4 / 8 / 12-column grid. */
export const GRID = "grid grid-cols-4 gap-x-gutter md:grid-cols-8 lg:grid-cols-12";

export type SectionSurface = "fundal" | "suprafata" | "menta-pal";

export function Section({
  id,
  surface = "fundal",
  className,
  innerClassName,
  labelledBy,
  children,
}: {
  id?: string;
  surface?: SectionSurface;
  className?: string;
  innerClassName?: string;
  /** id of the section heading. */
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "py-sectiune",
        surface === "suprafata" && "bg-suprafata",
        surface === "menta-pal" && "bg-menta-pal",
        className,
      )}
    >
      <Container className={innerClassName}>{children}</Container>
    </section>
  );
}

/** Section heading: Forum, sentence case, nothing above it (design-system §4.3 rule 3). */
export function SectionHeading({
  id,
  as: Tag = "h2",
  size = "h2",
  className,
  children,
}: {
  id?: string;
  as?: "h1" | "h2" | "h3";
  size?: "h1" | "h2" | "nume";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "font-display font-normal text-cerneala",
        size === "h1" && "text-h1",
        size === "h2" && "text-h2",
        size === "nume" && "text-nume",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
