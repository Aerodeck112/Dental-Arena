import Image from "next/image";
import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/lib/cn";
import type { ServiceImage } from "@/content/services";
import { CallMenu } from "./CallMenu";
import { Container } from "./Section";

/**
 * The top of a content page (design-system §6.5): breadcrumb, Forum title, lead, the booking
 * button with „Sunați” beside it, and a real clinic photo at 4:3. Without a photo the text takes
 * the full measure; nothing is invented to fill the space.
 */
export function ServiceHero({
  breadcrumbs,
  title,
  lead,
  bookingHref,
  bookingLabel = "Programați o consultație",
  image,
  children,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  lead: string;
  bookingHref?: string;
  bookingLabel?: string;
  image?: ServiceImage | null;
  children?: ReactNode;
}) {
  return (
    <Container className="pt-6 pb-sectiune md:pt-10">
      <Breadcrumbs items={breadcrumbs} />
      <div className="mt-8 grid grid-cols-1 items-start gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
        <div className={cn(image ? "lg:col-span-6" : "lg:col-span-9")}>
          <h1 className="font-display text-h1 text-cerneala">{title}</h1>
          <p className="mt-6 text-lead text-discret masura-lead">{lead}</p>
          {bookingHref && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href={bookingHref} size="l">
                {bookingLabel}
              </ButtonLink>
              <CallMenu variant="secondary" align="start" />
            </div>
          )}
          {children}
        </div>
        {image && (
          <figure className="lg:col-span-5 lg:col-start-8">
            <div
              className="relative aspect-[4/3] w-full overflow-hidden rounded-foto bg-adancit"
              style={image.maxDisplayWidth ? { maxWidth: image.maxDisplayWidth } : undefined}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                priority
                sizes="(min-width: 1024px) 520px, 100vw"
                className="object-cover"
                style={{ objectPosition: image.focus ?? "50% 50%" }}
              />
            </div>
            {image.caption && <figcaption className="mt-3 text-mic text-discret">{image.caption}</figcaption>}
          </figure>
        )}
      </div>
    </Container>
  );
}
