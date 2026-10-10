import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoctorProfileForm } from "@/components/crm/admin/DoctorProfileForm";
import { PhotoUploader } from "@/components/crm/media/PhotoUploader";
import { UserAccountActions, UserForm } from "@/components/crm/admin/UserForm";
import { Breadcrumbs, ButtonLink, FlagTag, PageHeader, Panel } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveLocations } from "@/lib/clinic-scope";
import { prisma } from "@/lib/db";
import { formatDateRo, formatTime, personName } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { zId } from "@/lib/validation/common";
import { getStaffMember } from "@/server/staff/service";

export const metadata: Metadata = { title: "Membru al echipei" };

/**
 * One team member (`[id]` = user id, or a doctor profile without a login): the account (role,
 * clinic, password reset, deactivation) and, for doctors, the public profile. ADMIN only.
 */
export default async function StaffMemberPage({ params, searchParams }: PageProps<"/crm/echipa/[id]">) {
  const me = await requirePermission("staff.manage");
  const { id } = await params;
  const sp = await searchParams;
  if (!zId.safeParse(id).success) notFound();
  const [member, locations, categories, adminCount] = await Promise.all([
    getStaffMember(id),
    getActiveLocations(),
    prisma.serviceCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.user.count({ where: { role: "ADMIN", active: true } }),
  ]);
  if (!member) notFound();
  const { user, doctor } = member;
  const name = user ? personName(user) : personName(doctor!);
  const isSelf = user?.id === me.id;
  const locationOptions = locations.map((l) => ({ id: l.id, shortName: l.shortName }));

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader
        before={<Breadcrumbs items={[{ label: "Echipă", href: "/crm/echipa" }, { label: name }]} />}
        title={name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {user ? ROLE_LABEL[user.role] : "Profil de medic fără cont"}
            {user && !user.active && <FlagTag kind="neutral">Inactiv</FlagTag>}
            {user?.lockedUntil && new Date(user.lockedUntil) > new Date() && <FlagTag kind="alerta">Blocat după încercări greșite</FlagTag>}
            {user?.lastLoginAt && <span>Ultima intrare: {formatDateRo(user.lastLoginAt, "short")}, {formatTime(new Date(user.lastLoginAt))}.</span>}
          </span>
        }
        actions={
          doctor && (
            <ButtonLink href={`/crm/echipa/${doctor.id}/program`} variant="secondary" icon="calendar">
              Program
            </ButtonLink>
          )
        }
      />
      {sp.creat === "1" && (
        <p role="status" className="rounded-panou bg-menta-pal px-4 py-3 text-corp">
          {user ? "Contul a fost creat. Comunicați parola inițială personal, nu prin e-mail." : "Profilul de medic a fost creat."}
          {user?.role === "MEDIC" && !doctor ? " Completați mai jos profilul de medic." : ""}
        </p>
      )}
      {user && (
        <Panel title="Cont">
          <UserForm
            user={{
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              phone: user.phone,
              role: user.role,
              locationIds: user.locationIds,
              active: user.active,
            }}
            locations={locationOptions}
            isSelf={isSelf}
          />
        </Panel>
      )}
      {user && (
        <Panel title="Acces">
          <UserAccountActions
            user={{ ...user, phone: user.phone }}
            isSelf={isSelf}
            isLastAdmin={user.role === "ADMIN" && user.active && adminCount <= 1}
          />
        </Panel>
      )}
      {doctor && (
        <Panel title="Fotografia de pe site">
          <div className="max-w-xs">
            <PhotoUploader
              target={{ doctorId: doctor.id }}
              src={doctor.photoPath}
              alt={doctor.publicName}
              isDefault={!doctor.photoPath}
              aspect="aspect-[4/5]"
              withAlt={false}
              resetLabel="Scoateți fotografia"
              emptyLabel="Fără fotografie: site-ul arată inițialele."
            />
          </div>
        </Panel>
      )}
      {(doctor || user?.role === "MEDIC") && (
        <Panel title="Profil de medic">
          <DoctorProfileForm
            doctor={doctor ?? undefined}
            userId={user && !doctor ? user.id : undefined}
            categories={categories}
            defaults={user ? { firstName: user.firstName, lastName: user.lastName } : undefined}
          />
        </Panel>
      )}
    </div>
  );
}
