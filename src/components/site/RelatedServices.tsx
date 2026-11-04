import Link from "next/link";
import { cn } from "@/lib/cn";
import { SERVICES, type ServiceSlug } from "@/content/services";

/** „Vă poate interesa și: Chirurgie dento-alveolară, Protetică dentară” (design-system §6.5). */
export function RelatedServices({ slugs, className }: { slugs: readonly ServiceSlug[]; className?: string }) {
  if (slugs.length === 0) return null;
  return (
    <nav aria-label="Servicii înrudite" className={cn("text-corp", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-discret">Vă poate interesa și:</span>
        {slugs.map((s, i) => (
          <span key={s}>
            <Link href={`/${s}`} className="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2">
              {SERVICES[s].title}
            </Link>
            {i < slugs.length - 1 ? "," : ""}
          </span>
        ))}
      </p>
    </nav>
  );
}
