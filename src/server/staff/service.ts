import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/dal";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { personName } from "@/lib/format";
import type { CreateUserInput, DoctorProfileInput, UpdateUserInput } from "./schemas";

/**
 * Users and doctors (docs/architecture.md §5.1, WP8). Deactivation, role changes and password
 * resets increment `sessionVersion`, which logs the user out everywhere. An admin can never
 * deactivate or demote themselves, nor the last active ADMIN.
 */

export type StaffRow = {
  key: string;
  /** Route id for /crm/echipa/[id]: the user id, or the doctor id for a profile without login. */
  id: string;
  name: string;
  email: string | null;
  role: Role | null;
  active: boolean;
  homeLocation: string | null;
  doctor: { id: string; publicName: string; publicVisible: boolean; acceptsOnlineBooking: boolean } | null;
  lastLoginAt: string | null;
};

export async function listStaff(): Promise<StaffRow[]> {
  const [users, doctors] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        homeLocation: { select: { shortName: true } },
        doctor: { select: { id: true, publicName: true, publicVisible: true, acceptsOnlineBooking: true } },
      },
    }),
    prisma.doctor.findMany({
      where: { userId: null },
      orderBy: [{ sortOrder: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, publicName: true, active: true, publicVisible: true, acceptsOnlineBooking: true },
    }),
  ]);
  return [
    ...users.map(
      (u): StaffRow => ({
        key: `u:${u.id}`,
        id: u.id,
        name: personName(u),
        email: u.email,
        role: u.role,
        active: u.active,
        homeLocation: u.homeLocation?.shortName ?? null,
        doctor: u.doctor,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      }),
    ),
    ...doctors.map(
      (d): StaffRow => ({
        key: `d:${d.id}`,
        id: d.id,
        name: personName(d),
        email: null,
        role: null,
        active: d.active,
        homeLocation: null,
        doctor: { id: d.id, publicName: d.publicName, publicVisible: d.publicVisible, acceptsOnlineBooking: d.acceptsOnlineBooking },
        lastLoginAt: null,
      }),
    ),
  ];
}

export type StaffUserDTO = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  active: boolean;
  homeLocationId: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
};

export type DoctorProfileDTO = {
  id: string;
  userId: string | null;
  slug: string;
  honorific: string;
  firstName: string;
  lastName: string;
  publicName: string;
  roleLine: string;
  bio: string | null;
  photoPath: string | null;
  monogram: string | null;
  publicVisible: boolean;
  acceptsOnlineBooking: boolean;
  active: boolean;
  sortOrder: number;
  categories: { categoryId: string; showOnSite: boolean }[];
};

const doctorSelect = {
  id: true,
  userId: true,
  slug: true,
  honorific: true,
  firstName: true,
  lastName: true,
  publicName: true,
  roleLine: true,
  bio: true,
  photoPath: true,
  monogram: true,
  publicVisible: true,
  acceptsOnlineBooking: true,
  active: true,
  sortOrder: true,
  categories: { select: { categoryId: true, showOnSite: true } },
} as const;

/** `[id]` is a user id or the id of a doctor profile without a login. */
export async function getStaffMember(id: string): Promise<{ user: StaffUserDTO | null; doctor: DoctorProfileDTO | null } | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      active: true,
      homeLocationId: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lockedUntil: true,
      doctor: { select: doctorSelect },
    },
  });
  if (user) {
    const { doctor, ...u } = user;
    return {
      user: { ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, lockedUntil: u.lockedUntil?.toISOString() ?? null },
      doctor,
    };
  }
  const doctor = await prisma.doctor.findUnique({ where: { id }, select: doctorSelect });
  return doctor ? { user: null, doctor } : null;
}

/** Doctor profiles without a login, to link to a new MEDIC account. */
export async function listUnlinkedDoctors(): Promise<{ id: string; publicName: string }[]> {
  return prisma.doctor.findMany({ where: { userId: null }, orderBy: { lastName: "asc" }, select: { id: true, publicName: true } });
}

async function activeAdminCount(tx: Tx): Promise<number> {
  return tx.user.count({ where: { role: "ADMIN", active: true } });
}

function passwordErrors(password: string, email: string): void {
  const problems = passwordProblems(password, email);
  if (problems.length) throw new DomainError("VALIDATION", undefined, { fieldErrors: { password: problems } });
}

export async function createUser(i: CreateUserInput, actor: CurrentUser): Promise<{ id: string }> {
  passwordErrors(i.password, i.email);
  const passwordHash = await hashPassword(i.password);
  return prisma.$transaction(async (tx) => {
    if (await tx.user.findUnique({ where: { email: i.email }, select: { id: true } })) {
      throw new DomainError("VALIDATION", undefined, { fieldErrors: { email: ["Există deja un cont cu acest e-mail."] } });
    }
    if (i.homeLocationId && !(await tx.location.findUnique({ where: { id: i.homeLocationId }, select: { id: true } }))) {
      throw new DomainError("VALIDATION", undefined, { fieldErrors: { homeLocationId: ["Clinica nu există."] } });
    }
    const user = await tx.user.create({
      data: {
        email: i.email,
        passwordHash,
        role: i.role,
        firstName: i.firstName,
        lastName: i.lastName,
        phone: i.phone ?? null,
        homeLocationId: i.homeLocationId ?? null,
        mustChangePassword: true,
      },
      select: { id: true },
    });
    if (i.linkDoctorId) {
      if (i.role !== "MEDIC") throw new DomainError("VALIDATION", undefined, { fieldErrors: { linkDoctorId: ["Doar un cont de medic se leagă de un profil de medic."] } });
      const d = await tx.doctor.findUnique({ where: { id: i.linkDoctorId }, select: { userId: true } });
      if (!d || d.userId) throw new DomainError("VALIDATION", undefined, { fieldErrors: { linkDoctorId: ["Profilul ales are deja un cont."] } });
      await tx.doctor.update({ where: { id: i.linkDoctorId }, data: { userId: user.id } });
    }
    await audit(
      { action: "user.create", entityType: "User", entityId: user.id, metadata: { role: i.role, linkedDoctor: !!i.linkDoctorId } },
      { actor, db: tx },
    );
    return user;
  });
}

export async function updateUser(i: UpdateUserInput, actor: CurrentUser): Promise<{ id: string; doctorId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: i.id },
      select: { email: true, firstName: true, lastName: true, phone: true, role: true, homeLocationId: true, active: true, doctor: { select: { id: true } } },
    });
    if (!before) throw new DomainError("NOT_FOUND", "Contul nu există.");
    if (before.role === "ADMIN" && i.role !== "ADMIN") {
      if (i.id === actor.id) throw new DomainError("VALIDATION", undefined, { fieldErrors: { role: ["Nu vă puteți schimba singur rolul de administrator."] } });
      if (before.active && (await activeAdminCount(tx)) <= 1) {
        throw new DomainError("VALIDATION", undefined, { fieldErrors: { role: ["Este singurul administrator activ. Numiți întâi alt administrator."] } });
      }
    }
    if (i.email !== before.email && (await tx.user.findUnique({ where: { email: i.email }, select: { id: true } }))) {
      throw new DomainError("VALIDATION", undefined, { fieldErrors: { email: ["Există deja un cont cu acest e-mail."] } });
    }
    const next = { email: i.email, firstName: i.firstName, lastName: i.lastName, phone: i.phone ?? null, role: i.role, homeLocationId: i.homeLocationId ?? null };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== before[k]);
    if (changed.length === 0) return { id: i.id, doctorId: before.doctor?.id ?? null };
    const roleChanged = changed.includes("role");
    await tx.user.update({ where: { id: i.id }, data: { ...next, ...(roleChanged ? { sessionVersion: { increment: 1 } } : {}) } });
    await audit({ action: "user.update", entityType: "User", entityId: i.id, metadata: { fields: changed, sessionsRevoked: roleChanged } }, { actor, db: tx });
    return { id: i.id, doctorId: before.doctor?.id ?? null };
  });
}

/** Sets a new temporary password, forces a change at next login and logs the user out everywhere. */
export async function resetUserPassword(id: string, password: string, actor: CurrentUser): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!u) throw new DomainError("NOT_FOUND", "Contul nu există.");
  passwordErrors(password, u.email);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, failedLogins: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
    });
    await audit({ action: "user.update", entityType: "User", entityId: id, metadata: { fields: ["passwordHash"], reset: true, sessionsRevoked: true } }, { actor, db: tx });
  });
}

/** „Deconectați toate sesiunile”. */
export async function revokeUserSessions(id: string, actor: CurrentUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw new DomainError("NOT_FOUND", "Contul nu există.");
    await tx.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
    await audit({ action: "user.update", entityType: "User", entityId: id, metadata: { fields: ["sessionVersion"], sessionsRevoked: true } }, { actor, db: tx });
  });
}

export async function setUserActive(id: string, active: boolean, actor: CurrentUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id }, select: { role: true, active: true } });
    if (!u) throw new DomainError("NOT_FOUND", "Contul nu există.");
    if (u.active === active) return;
    if (!active) {
      if (id === actor.id) throw new DomainError("VALIDATION", "Nu vă puteți dezactiva propriul cont.");
      if (u.role === "ADMIN" && (await activeAdminCount(tx)) <= 1) {
        throw new DomainError("VALIDATION", "Este singurul administrator activ. Numiți întâi alt administrator.");
      }
    }
    await tx.user.update({
      where: { id },
      data: active ? { active: true, failedLogins: 0, lockedUntil: null } : { active: false, sessionVersion: { increment: 1 } },
    });
    await audit(
      { action: active ? "user.update" : "user.deactivate", entityType: "User", entityId: id, metadata: { fields: ["active"] } },
      { actor, db: tx },
    );
  });
}

/** Creates or updates a doctor's public profile and the categories they treat. */
export async function saveDoctorProfile(i: DoctorProfileInput, actor: CurrentUser): Promise<{ id: string; slug: string; previousSlug: string | null }> {
  return prisma.$transaction(async (tx) => {
    const before = i.doctorId ? await tx.doctor.findUnique({ where: { id: i.doctorId }, select: { id: true, slug: true, userId: true } }) : null;
    if (i.doctorId && !before) throw new DomainError("NOT_FOUND", "Profilul de medic nu există.");
    const clash = await tx.doctor.findFirst({ where: { slug: i.slug, ...(i.doctorId ? { id: { not: i.doctorId } } : {}) }, select: { id: true } });
    if (clash) throw new DomainError("VALIDATION", undefined, { fieldErrors: { slug: ["Adresa este folosită de alt medic."] } });
    let userId = before?.userId ?? null;
    if (!before && i.userId) {
      const u = await tx.user.findUnique({ where: { id: i.userId }, select: { role: true, doctor: { select: { id: true } } } });
      if (!u) throw new DomainError("NOT_FOUND", "Contul nu există.");
      if (u.role !== "MEDIC") throw new DomainError("VALIDATION", "Doar un cont cu rolul Medic are profil de medic.");
      if (u.doctor) throw new DomainError("VALIDATION", "Contul are deja un profil de medic.");
      userId = i.userId;
    }
    const categoryIds = [...new Set(i.categoryIds)];
    if (categoryIds.length && (await tx.serviceCategory.count({ where: { id: { in: categoryIds } } })) !== categoryIds.length) {
      throw new DomainError("VALIDATION", "O categorie aleasă nu mai există. Reîncărcați pagina.");
    }
    const data = {
      slug: i.slug,
      honorific: i.honorific,
      firstName: i.firstName,
      lastName: i.lastName,
      publicName: i.publicName,
      roleLine: i.roleLine,
      bio: i.bio ?? null,
      photoPath: i.photoPath ?? null,
      monogram: i.monogram ?? null,
      publicVisible: i.publicVisible,
      acceptsOnlineBooking: i.acceptsOnlineBooking,
      active: i.active,
      sortOrder: i.sortOrder,
    };
    const doctor = before
      ? await tx.doctor.update({ where: { id: before.id }, data, select: { id: true, slug: true } })
      : await tx.doctor.create({ data: { ...data, userId }, select: { id: true, slug: true } });
    await tx.doctorCategory.deleteMany({ where: { doctorId: doctor.id } });
    if (categoryIds.length) {
      const show = new Set(i.showOnSiteIds);
      await tx.doctorCategory.createMany({
        data: categoryIds.map((categoryId) => ({ doctorId: doctor.id, categoryId, showOnSite: show.has(categoryId) })),
      });
    }
    await audit(
      {
        action: "user.update",
        entityType: "Doctor",
        entityId: doctor.id,
        metadata: { op: before ? "update" : "create", fields: [...Object.keys(data), "categories"] },
      },
      { actor, db: tx },
    );
    return { id: doctor.id, slug: doctor.slug, previousSlug: before?.slug ?? null };
  });
}
