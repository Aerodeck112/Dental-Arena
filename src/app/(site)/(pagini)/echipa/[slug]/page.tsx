import Link from "next/link";
import { notFound } from "next/navigation";
import { CallMenu } from "@/components/site/CallMenu";
import { DoctorPortrait } from "@/components/site/DoctorFigure";
import { Container } from "@/components/site/Section";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PORTRAITS } from "@/content/portraits";
import { bookingHref } from "@/content/site";
import { pageMetadata } from "@/server/public/seo";
import { getDoctorWorkplaces, getPublicDoctor, getPublicDoctors } from "@/server/public/queries";

export const revalidate = 300;

const WEEKDAY = ["", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"];

/** „luni, miercuri și vineri” */
function joinDays(days: number[]): string {
  const names = days.map((d) => WEEKDAY[d]);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} și ${names[names.length - 1]}`;
}

export async function generateStaticParams() {
  try {
    return (await getPublicDoctors()).map((d) => ({ slug: d.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps<"/echipa/[slug]">) {
  const { slug } = await params;
  const doctor = await getPublicDoctor(slug);
  if (!doctor) return {};
  return pageMetadata({
    title: doctor.publicName,
    description: `${doctor.publicName}, ${doctor.roleLine.charAt(0).toLocaleLowerCase("ro-RO")}${doctor.roleLine.slice(1)}, la Dental Arena în Cristești și Luduș. Programați-vă online sau la telefon.`,
    path: `/echipa/${doctor.slug}`,
    image: doctor.photoPath && PORTRAITS[doctor.photoPath]
      ? { src: doctor.photoPath, width: PORTRAITS[doctor.photoPath].width, height: PORTRAITS[doctor.photoPath].height, alt: doctor.publicName }
      : undefined,
  });
}

/** A doctor's profile (design-system §6.6): portrait, role, bio once supplied, where and when (only once hours are published), services. */
export default async function DoctorPage({ params }: PageProps<"/echipa/[slug]">) {
  const { slug } = await params;
  const doctor = await getPublicDoctor(slug);
  if (!doctor) notFound();
  const workplaces = await getDoctorWorkplaces(doctor.id);
  const maxFrame = doctor.photoPath ? PORTRAITS[doctor.photoPath]?.maxFrameWidth : undefined;

  return (
    <Container className="pt-6 pb-sectiune md:pt-10">
      <Breadcrumbs items={[{ href: "/echipa", label: "Echipa" }, { label: doctor.publicName }]} />
      <div className="mt-8 grid grid-cols-1 gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div style={{ maxWidth: maxFrame ?? 420 }}>
            <DoctorPortrait doctor={doctor} size="profile" priority sizes="(min-width: 1024px) 400px, 90vw" />
          </div>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <h1 className="font-display text-h1 text-cerneala">{doctor.publicName}</h1>
          <p className="mt-5 text-lead text-discret masura-lead">{doctor.roleLine}</p>
          {doctor.bio && <p className="mt-6 text-corp text-cerneala masura">{doctor.bio}</p>}

          <dl className="mt-10 flex flex-col gap-6">
            {workplaces.length > 0 && (
              <div>
                <dt className="text-control font-semibold text-cerneala">Unde lucrează</dt>
                <dd className="mt-1 text-corp text-cerneala">
                  <ul>
                    {workplaces.map((w) => (
                      <li key={w.clinic}>
                        <Link href={`/contact#${w.clinic}`} className="text-link underline underline-offset-[0.2em] hover:decoration-2">
                          {w.clinicName}
                        </Link>
                        , {joinDays(w.weekdays)}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {doctor.services.length > 0 && (
              <div>
                <dt className="text-control font-semibold text-cerneala">Servicii</dt>
                <dd className="mt-1 text-corp text-cerneala">
                  {doctor.services.map((s, i) => (
                    <span key={s.slug}>
                      <Link href={`/${s.slug}`} className="text-link underline underline-offset-[0.2em] hover:decoration-2">
                        {s.name}
                      </Link>
                      {i < doctor.services.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {doctor.acceptsOnlineBooking && (
              <ButtonLink href={bookingHref({ medic: doctor.slug })} size="l">
                Programați-vă la {doctor.shortName}
              </ButtonLink>
            )}
            <CallMenu variant="secondary" align="start" />
          </div>
        </div>
      </div>
    </Container>
  );
}
