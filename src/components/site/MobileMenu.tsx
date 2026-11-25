"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { useNativeDialog } from "@/components/ui/use-dialog";
import { cn } from "@/lib/cn";
import { formatPhone, telHref } from "@/lib/format";
import { SERVICE_LIST } from "@/content/services";
import { CLINIC_ORDER, CLINICS, MAIN_NAV } from "@/content/site";

/**
 * „Meniu” below the desktop breakpoint: a full-height sheet with the pages, the 10 services,
 * both phones and „Programați-vă”. Without JavaScript the trigger jumps to the footer navigation.
 */
export function MobileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useNativeDialog(open, () => setOpen(false));
  const titleId = useId();

  // A navigation closes the sheet (the dialog stays mounted across client navigations).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]);

  const navLinks = [...MAIN_NAV.filter((l) => l.href !== "/servicii"), { href: "/contact", label: "Contact" }];

  return (
    <>
      <a
        href="#navigare-subsol"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className={cn(
          "apasat inline-flex min-h-control items-center gap-2 rounded-control px-3 text-control font-medium text-cerneala hover:bg-adancit",
          className,
        )}
      >
        <Icon name="menu" size={22} />
        Meniu
      </a>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="da-overlay fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-fundal p-0 text-cerneala open:da-rise"
      >
        <div className="flex min-h-full flex-col px-margine pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="flex h-20 shrink-0 items-center justify-between gap-4">
            <Link href="/" aria-label="Dental Arena, prima pagină" onClick={() => setOpen(false)}>
              <Logo variant="compact" title="" className="h-10 w-auto" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="apasat inline-flex min-h-control items-center gap-2 rounded-control px-3 text-control font-medium hover:bg-adancit"
            >
              <Icon name="x" size={22} />
              Închideți
            </button>
          </div>
          <h2 id={titleId} className="sr-only">
            Meniu
          </h2>
          <nav aria-label="Principal" className="mt-2">
            <ul className="flex flex-col">
              {navLinks.map((l) => {
                const path = l.href.split("#")[0];
                const here = pathname === path && !l.href.includes("#");
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={here ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-control-l items-center font-display text-nume",
                        here ? "text-link underline decoration-2 underline-offset-[0.3em]" : "text-cerneala",
                      )}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <section aria-labelledby={`${titleId}-servicii`} className="mt-6">
            <h3 id={`${titleId}-servicii`}>
              <Link
                href="/servicii"
                onClick={() => setOpen(false)}
                className={cn(
                  "font-display text-nume",
                  pathname === "/servicii" ? "text-link underline decoration-2 underline-offset-[0.3em]" : "text-cerneala",
                )}
              >
                Servicii
              </Link>
            </h3>
            <ul className="mt-2 grid grid-cols-1 gap-x-6 min-[30rem]:grid-cols-2">
              {SERVICE_LIST.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/${s.slug}`}
                    aria-current={pathname === `/${s.slug}` ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex min-h-control items-center text-control text-cerneala underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-link aria-[current=page]:underline"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <div className="mt-auto pt-8">
            <ul className="grid grid-cols-2 gap-2">
              {CLINIC_ORDER.map((slug) => {
                const c = CLINICS[slug];
                const number = formatPhone(c.phone);
                return (
                  <li key={slug}>
                    <a
                      href={telHref(c.phone)}
                      aria-label={`Sunați la ${c.shortName}, ${number}`}
                      className="flex min-h-control-l flex-col justify-center rounded-control border border-linie-control px-3 py-2 hover:border-cerneala"
                    >
                      <span className="text-mic text-discret">{c.shortName}</span>
                      <span className="telefon text-control font-semibold">{number}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
            <ButtonLink href="/programare" size="l" className="mt-3 w-full" onClick={() => setOpen(false)}>
              Programați-vă
            </ButtonLink>
          </div>
        </div>
      </dialog>
    </>
  );
}
