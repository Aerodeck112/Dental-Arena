import Link from "next/link";
import { ComfortDot } from "@/components/ui/FlagTag";
import { cn } from "@/lib/cn";

/**
 * „Vă e teamă?” (design-system §6.5): a `mustar-pal` note beside the doctor on service pages.
 * Mustard always means emotional comfort, so this is the only place it appears on those pages.
 */
export function ComfortNote({
  title = "Vă e teamă?",
  text = "Intervenția se poate face sub inhalosedare: rămâneți conștient, doar mult mai relaxat.",
  className,
}: {
  title?: string;
  text?: string;
  className?: string;
}) {
  return (
    <aside aria-label={title} className={cn("rounded-panou bg-mustar-pal p-5 text-cerneala", className)}>
      <p className="flex items-center gap-2.5 text-h3 font-semibold">
        <ComfortDot className="size-2.5" />
        {title}
      </p>
      <p className="mt-2 text-corp">{text}</p>
      <Link
        href="/inhalosedare"
        className="mt-1 inline-flex min-h-control items-center font-medium underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
      >
        Despre inhalosedare
      </Link>
    </aside>
  );
}
