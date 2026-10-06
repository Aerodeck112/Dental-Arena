import Image from "next/image";
import { cn } from "@/lib/cn";
import type { SiteImageDefault } from "@/content/site-images";

/**
 * A photo of the public site, filling its frame. Photos uploaded from the CRM (/media) are already
 * resized to WebP, so they skip the image optimiser; the defaults under /images go through it.
 */
export function SitePhoto({
  image,
  sizes,
  priority = false,
  className,
  position,
}: {
  image: SiteImageDefault;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** CSS object-position, e.g. "50% 30%". */
  position?: string;
}) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={image.src.startsWith("/media/")}
      className={cn("object-cover", className)}
      style={position ? { objectPosition: position } : undefined}
    />
  );
}
