"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import { OPEN_SETTINGS_EVENT, openCookieSettings, parseConsent, readConsentCookie, useConsent, writeConsent } from "./consent";

/**
 * The cookie banner, entirely in Romanian (design-system §10, §12.6): „Acceptați toate”,
 * „Refuzați”, „Setări”. The site sets only necessary cookies; the one optional purpose is the
 * Google map on the contact page. Not modal: the page stays usable while it is open.
 * It appears only after hydration, so a page served from the cache never flashes it.
 */
export function CookieConsent() {
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);
  const [settings, setSettings] = useState(false);
  const [maps, setMaps] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const onOpen = () => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // The saved choice prefills the settings.
      setMaps(parseConsent(readConsentCookie(document.cookie))?.harti ?? false);
      setReopened(true);
      setSettings(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
  }, []);

  const visible = consent !== undefined && (consent === null || reopened);

  useEffect(() => {
    if (visible && reopened) panelRef.current?.focus();
  }, [visible, reopened]);

  if (!visible) return null;

  const done = (harti: boolean) => {
    writeConsent(harti);
    setReopened(false);
    setSettings(false);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target && document.contains(target)) target.focus();
  };

  return (
    <div
      ref={panelRef}
      role="region"
      aria-labelledby={titleId}
      aria-describedby={textId}
      tabIndex={-1}
      data-print="ascuns"
      className={cn(
        "da-rise fixed inset-x-3 z-50 max-h-[calc(100dvh-7rem)] overflow-y-auto outline-none",
        "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-margine md:right-auto md:w-[34rem]",
        "rounded-panou border border-linie bg-suprafata p-5 text-cerneala shadow-float sm:p-6",
      )}
    >
      <h2 id={titleId} className="text-h3 font-semibold">
        Cookie-uri
      </h2>
      <p id={textId} className="mt-2 text-corp">
        Folosim doar cookie-urile fără de care site-ul nu funcționează. Harta Google de pe pagina de contact poate seta
        cookie-uri proprii, de aceea o încărcăm doar cu acordul dumneavoastră.{" "}
        <Link href="/politica-cookies" className="text-link underline underline-offset-[0.2em] hover:decoration-2">
          Politica cookies
        </Link>
      </p>

      {settings && (
        <fieldset className="mt-4 flex flex-col gap-3 border-t border-linie pt-4">
          <legend className="sr-only">Setări cookie-uri</legend>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-control font-semibold">Necesare</p>
              <p className="text-mic text-discret">Țin minte alegerea de față. Fără ele site-ul nu funcționează.</p>
            </div>
            <p className="shrink-0 text-mic font-medium text-discret">Întotdeauna active</p>
          </div>
          <Checkbox
            name="harti"
            checked={maps}
            onChange={(e) => setMaps(e.currentTarget.checked)}
            label={<span className="font-semibold">Hărți Google</span>}
            description="Afișează harta fiecărei clinici. Google poate seta atunci cookie-uri proprii."
          />
        </fieldset>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {settings ? (
          <>
            <Button onClick={() => done(maps)}>Salvați alegerea</Button>
            <Button variant="secondary" onClick={() => done(true)}>
              Acceptați toate
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => done(true)}>Acceptați toate</Button>
            <Button variant="secondary" onClick={() => done(false)}>
              Refuzați
            </Button>
            <Button variant="text" onClick={() => setSettings(true)}>
              Setări
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** „Setări cookie-uri” in the footer: reopens the banner on its settings. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={cn("inline-flex min-h-control items-center underline underline-offset-[0.2em] hover:decoration-2", className)}
    >
      Setări cookie-uri
    </button>
  );
}
