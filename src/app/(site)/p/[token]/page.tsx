import type { Metadata } from "next";
import { AppointmentManage } from "@/components/booking/AppointmentManage";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { prisma } from "@/lib/db";
import { formatPhone, telHref } from "@/lib/format";
import { getManagedAppointment } from "@/server/scheduling/links";

export const metadata: Metadata = {
  title: "Programarea dumneavoastră",
  robots: { index: false, follow: false },
  // The token is a credential: never send it to another site in the Referer header.
  referrer: "no-referrer",
};

/**
 * `/p/[token]`: the patient's link from the SMS or e-mail (docs/architecture.md §6.6). Rendering
 * never changes data (apps prefetch links); confirming and cancelling are POST Server Actions.
 * It shows the first name only, and no reason for the visit or health information.
 */
export default async function AppointmentLinkPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const [view, clinics] = await Promise.all([
    getManagedAppointment(decodeURIComponent(token)),
    prisma.location.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { shortName: true, phone: true },
    }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-fundal">
      <BookingHeader clinics={clinics} />
      <main id="continut" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-margine pt-6 pb-16 outline-none lg:pt-12">
        {view.ok ? (
          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-h1 text-cerneala">Programarea dumneavoastră</h1>
              {view.appointment.firstName && <p className="text-lead text-discret">Bună ziua, {view.appointment.firstName}.</p>}
            </header>
            <AppointmentManage token={token} appointment={view.appointment} />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <h1 className="font-display text-h1 text-cerneala">Linkul nu mai este valabil.</h1>
            {/* Together with the heading this reads exactly as §6.6 words it. */}
            <p className="text-lead text-cerneala masura-lead">
              Pentru modificări sunați la{" "}
              {clinics.map((c, i) => (
                <span key={c.shortName}>
                  {i > 0 ? (i === clinics.length - 1 ? " sau " : ", ") : ""}
                  {c.shortName},{" "}
                  <a
                    href={telHref(c.phone)}
                    aria-label={`Sunați la ${c.shortName}, ${formatPhone(c.phone)}`}
                    className="telefon text-link underline underline-offset-[0.25em]"
                  >
                    {formatPhone(c.phone)}
                  </a>
                </span>
              ))}
              .
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
