import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { buttonClasses, buttonIconSize, type ButtonSize, type ButtonVariant } from "./button-styles";

export type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconEnd?: boolean;
  /** Next.js prefetch for internal links. */
  prefetch?: boolean;
  children?: ReactNode;
};

const isExternal = (href: string) => /^(https?:|tel:|mailto:|sms:)/.test(href);

/** A link that looks like a button: „Programați-vă”, „Sunați”. tel:, mailto: and http links stay plain <a>. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "m",
  icon,
  iconEnd = false,
  prefetch,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const iconOnly = !!icon && (children === undefined || children === null || children === false);
  const classes = buttonClasses({ variant, size, iconOnly, className });
  const glyph = icon ? <Icon name={icon} size={buttonIconSize(size)} /> : null;
  const content = (
    <>
      {!iconEnd && glyph}
      {children}
      {iconEnd && glyph}
    </>
  );
  if (isExternal(href)) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={prefetch} className={classes} {...rest}>
      {content}
    </Link>
  );
}
