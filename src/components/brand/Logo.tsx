import Image from "next/image";
import { cn } from "@/lib/cn";

export type LogoVariant = "full" | "compact" | "mark" | "reversed" | "mono";
export type LogoLockup = "full" | "compact" | "mark";

type LogoProps = {
  /**
   * The ORIGINAL Dental Arena logo from dentalarena.ro, unchanged (only its white background is
   * transparent, see scripts/build-logo-assets.mjs).
   * full / compact / reversed / mono: the whole logo; mark: the tooth and implant alone.
   * Always place the full logo on a light background: its wordmark is the original slate grey.
   */
  variant?: LogoVariant;
  /** Kept for older call sites; "mark" shows the tooth alone. */
  lockup?: LogoLockup;
  /** Accessible name. Pass "" when the logo sits inside a link or heading that already names it. */
  title?: string;
  /** Kept for older call sites (the original mark is used at every size). */
  simplified?: boolean;
  className?: string;
  /** Loads the logo eagerly (header). */
  priority?: boolean;
  /** Displayed width, so the browser downloads a file of that size (next/image `sizes`). */
  sizes?: string;
};

const FULL = { src: "/brand/logo-dental-arena.webp", width: 640, height: 241 };
const MARK = { src: "/brand/semn-dental-arena.png", width: 296, height: 487 };

/** The Dental Arena logo. Size it with a height or width class (`h-10 w-auto`). */
export function Logo({ variant = "compact", lockup, title = "Dental Arena", className, priority = false, sizes = "160px" }: LogoProps) {
  const isMark = variant === "mark" || (lockup === "mark" && (variant === "reversed" || variant === "mono"));
  const file = isMark ? MARK : FULL;
  return (
    <Image
      src={file.src}
      width={file.width}
      height={file.height}
      alt={title}
      aria-hidden={title === "" ? true : undefined}
      priority={priority}
      sizes={sizes}
      className={cn("shrink-0 select-none", className)}
      draggable={false}
    />
  );
}
