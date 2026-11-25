import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";
import { buttonClasses, buttonIconSize, type ButtonSize, type ButtonVariant } from "./button-styles";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Keeps the label and look, adds a spinner, sets aria-busy and blocks a second click. */
  loading?: boolean;
  icon?: IconName;
  /** Put the icon after the label (e.g. a chevron). */
  iconEnd?: boolean;
  children?: ReactNode;
};

/**
 * The label names the result („Rezervați ora de 10:30”, „Confirmați programarea”), never an
 * arrow. An icon-only button needs `aria-label`.
 */
export function Button({
  variant = "primary",
  size = "m",
  loading = false,
  icon,
  iconEnd = false,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconOnly = !!icon && (children === undefined || children === null || children === false);
  const glyph = loading ? (
    <Spinner size={buttonIconSize(size)} />
  ) : icon ? (
    <Icon name={icon} size={buttonIconSize(size)} />
  ) : null;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, iconOnly, loading, className })}
      {...rest}
    >
      {!iconEnd && glyph}
      {children}
      {iconEnd && glyph}
    </button>
  );
}
