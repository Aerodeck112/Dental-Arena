"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useConsent, writeConsent } from "./consent";

/**
 * A clinic map that sets no Google cookie before consent (design-system §6.4, architecture §8.4).
 * Until the visitor agrees, a quiet panel explains why the map is missing; „Afișați harta” records
 * the consent (the same one as „Hărți Google” in the cookie settings) and loads the embed.
 */
export function MapConsent({ src, clinicName, mapsLink, className }: { src: string; clinicName: string; mapsLink: string; className?: string }) {
  const consent = useConsent();
  const allowed = consent?.harti === true;
  return (
    <div className={cn("relative aspect-[3/2] w-full overflow-hidden rounded-foto bg-adancit", className)}>
      {allowed ? (
        <iframe
          src={src}
          title={`Harta: ${clinicName}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <div className="flex size-full flex-col items-start justify-end gap-3 p-5 sm:p-6">
          <Icon name="map-pin" size={28} className="text-discret" />
          <p className="max-w-[34ch] text-corp text-cerneala">
            Harta Google poate seta cookie-uri, de aceea o afișăm doar dacă sunteți de acord.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {consent !== undefined && (
              <Button variant="secondary" onClick={() => writeConsent(true)}>
                Afișați harta
              </Button>
            )}
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-control items-center font-medium text-link underline underline-offset-[0.2em] hover:decoration-2"
            >
              Deschideți în Google Maps<span className="sr-only"> (se deschide într-o filă nouă)</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
