import Link from "next/link";
import { formatPhone, telHref } from "@/lib/format";
import { CLINIC_ORDER, CLINICS } from "@/content/site";
import { Container } from "./Section";

/**
 * The closing band of the marketing pages: forest green, one large sentence, the online booking
 * and both clinics' phones. The only dark surface of the site.
 */
export function BookingBand({
  title = "Programați o consultație",
  lead = "Alegeți online ora care vă convine sau sunați la clinica la care veniți. Vă răspundem noi.",
  href = "/programare",
}: {
  title?: string;
  lead?: string;
  href?: string;
}) {
  return (
    <section aria-labelledby="programare-banda" className="px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="rounded-mare bg-padure py-16 text-white md:py-24">
        <Container className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 id="programare-banda" className="font-display text-[clamp(2.5rem,1.4rem+3.6vw,4.75rem)] leading-[1.02]">
              {title}
            </h2>
            <p className="mt-6 max-w-[48ch] text-lead text-padure-text">{lead}</p>
            <Link
              href={href}
              className="mt-10 inline-flex h-14 items-center rounded-chip bg-menta px-8 text-control font-semibold text-pe-menta transition-colors duration-150 hover:bg-white focus-visible:outline-white"
            >
              Programați-vă online
            </Link>
          </div>
          <ul className="flex flex-col gap-6 lg:col-span-4 lg:col-start-9">
            {CLINIC_ORDER.map((slug) => {
              const c = CLINICS[slug];
              const n = formatPhone(c.phone);
              return (
                <li key={slug} className="border-t border-white/25 pt-5">
                  <p className="text-mic text-padure-text">{c.shortName}</p>
                  <a
                    href={telHref(c.phone)}
                    aria-label={`Sunați la ${c.shortName}, ${n}`}
                    className="telefon mt-1 inline-flex min-h-control items-center text-[1.75rem] font-semibold underline decoration-transparent underline-offset-[0.2em] hover:decoration-current focus-visible:outline-white"
                  >
                    {n}
                  </a>
                </li>
              );
            })}
          </ul>
        </Container>
      </div>
    </section>
  );
}
