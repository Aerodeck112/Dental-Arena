import { BookingHeader } from "@/components/booking/BookingHeader";
import { prisma } from "@/lib/db";

/**
 * `/programare` has its own minimal header (design system §6.7): logo, both clinic phones and
 * „Închideți”; no site navigation and no footer, so nothing pulls the visitor out of the steps.
 */
export default async function BookingLayout({ children }: LayoutProps<"/programare">) {
  const clinics = await prisma.location.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { shortName: true, phone: true },
  });
  return (
    <div className="flex min-h-dvh flex-col bg-fundal">
      <BookingHeader clinics={clinics} />
      <main id="continut" tabIndex={-1} className="mx-auto w-full max-w-continut flex-1 px-margine pt-4 pb-16 outline-none lg:pt-10">
        {children}
      </main>
    </div>
  );
}
