import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { formatPhone, telHref } from "@/lib/format";

export type HeaderClinic = { shortName: string; phone: string };

/**
 * The wizard's own minimal header (design system §6.7): the logo, both clinic phones (each named
 * with its clinic) and „Închideți”. On phones the numbers fold into „Sunați”, a two-row menu that
 * works without JavaScript.
 */
export function BookingHeader({ clinics, closeHref = "/" }: { clinics: HeaderClinic[]; closeHref?: string }) {
  return (
    <header className="bg-fundal">
      <div className="mx-auto flex max-w-continut items-center justify-between gap-4 px-margine py-3">
        <Link href="/" className="inline-flex min-h-control items-center rounded-control" aria-label="Dental Arena, pagina principală">
          <Logo variant="compact" title="" className="h-9 w-auto sm:h-10" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-6">
          <ul className="hidden items-center gap-6 lg:flex" aria-label="Telefoanele clinicilor">
            {clinics.map((c) => (
              <li key={c.shortName}>
                <a
                  href={telHref(c.phone)}
                  aria-label={`Sunați la ${c.shortName}, ${formatPhone(c.phone)}`}
                  className="inline-flex min-h-control items-center gap-2 text-control text-cerneala underline decoration-linie-control underline-offset-[0.25em] hover:decoration-current"
                >
                  <Icon name="phone" size={18} className="text-discret" />
                  <span>{c.shortName}</span>
                  <span className="telefon">{formatPhone(c.phone)}</span>
                </a>
              </li>
            ))}
          </ul>

          <details className="group relative lg:hidden">
            <summary className="apasat inline-flex min-h-control items-center gap-2 rounded-control px-3 text-control font-medium text-cerneala hover:bg-adancit">
              <Icon name="phone" size={18} />
              Sunați
            </summary>
            <div className="da-rise absolute right-0 z-30 mt-2 w-72 rounded-panou border border-linie bg-suprafata p-2 shadow-float">
              <p className="px-3 pt-1 pb-2 text-mic text-discret">Ce clinică sunați?</p>
              <ul>
                {clinics.map((c) => (
                  <li key={c.shortName}>
                    <a
                      href={telHref(c.phone)}
                      aria-label={`Sunați la ${c.shortName}, ${formatPhone(c.phone)}`}
                      className="flex min-h-control-l items-center justify-between gap-3 rounded-control px-3 text-control text-cerneala hover:bg-menta-pal"
                    >
                      <span>{c.shortName}</span>
                      <span className="telefon">{formatPhone(c.phone)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>

          <Link
            href={closeHref}
            className="apasat inline-flex min-h-control items-center gap-1.5 rounded-control px-3 text-control font-medium text-cerneala hover:bg-adancit"
          >
            <Icon name="x" size={20} />
            Închideți
          </Link>
        </div>
      </div>
    </header>
  );
}
