import Image from "next/image";
import { cn } from "@/lib/cn";
import { ANPC_BADGES } from "@/content/site";

/**
 * The ANPC pictograms (SAL, SOL), legally required in the footer and linked to anpc.ro and the
 * European Commission's ODR page. Opened in a new tab, which the link name says.
 */
export function AnpcBadges({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-3", className)}>
      {ANPC_BADGES.map((b) => (
        <li key={b.href}>
          <a
            href={b.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${b.alt} (se deschide într-o filă nouă)`}
            className="block rounded-control"
          >
            <Image src={b.src} alt="" width={300} height={76} sizes="200px" className="h-[50px] w-auto rounded-control" />
          </a>
        </li>
      ))}
    </ul>
  );
}
