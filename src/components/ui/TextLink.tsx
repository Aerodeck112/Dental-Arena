import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type TextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  /** A link on its own line („Toate prețurile”): 48px target on the site, medium weight. */
  standalone?: boolean;
  /** Opens in a new tab, with an icon and a screen-reader note. */
  external?: boolean;
  /** Navigation link that marks the current page (link colour plus underline). */
  current?: boolean;
  children: ReactNode;
};

/** Links are always underlined in running text (§3.2). Hover thickens the underline, nothing moves. */
export function TextLink({ href, standalone = false, external = false, current, className, children, ...rest }: TextLinkProps) {
  const classes = cn(
    "text-link underline decoration-1 underline-offset-[0.2em] hover:decoration-2",
    standalone && "inline-flex min-h-control-s items-center gap-1.5 font-medium",
    className,
  );
  if (external || /^(https?:|tel:|mailto:|sms:)/.test(href)) {
    const newTab = external;
    return (
      <a
        href={href}
        className={classes}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noopener noreferrer" : undefined}
        aria-current={current ? "page" : undefined}
        {...rest}
      >
        {children}
        {newTab && (
          <>
            <Icon name="external-link" size={16} className="ml-1 inline-block align-[-0.125em]" />
            <span className="sr-only"> (se deschide într-o filă nouă)</span>
          </>
        )}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} aria-current={current ? "page" : undefined} {...rest}>
      {children}
    </Link>
  );
}
