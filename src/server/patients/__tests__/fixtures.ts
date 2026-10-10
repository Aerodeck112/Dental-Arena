import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

/** Test users and helpers for the WP7 integration tests (each test file owns its data). */

export const runTag = () => `wp7${process.pid}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

export async function makeUsers(tag: string) {
  const base = { passwordHash: "x", sessionVersion: 0 };
  const mk = (role: "ADMIN" | "MEDIC" | "RECEPTIE", first: string) =>
    prisma.user.create({
      data: { ...base, email: `${tag}-${role.toLowerCase()}@example.com`, firstName: first, lastName: "Test", role },
      select: { id: true },
    });
  const [a, m, r] = await Promise.all([mk("ADMIN", "Ana"), mk("MEDIC", "Mihai"), mk("RECEPTIE", "Rita")]);
  const user = (id: string, role: CurrentUser["role"], firstName: string): CurrentUser => ({
    id,
    role,
    email: `${tag}-${role.toLowerCase()}@example.com`,
    firstName,
    lastName: "Test",
    displayName: `${firstName} Test`,
    doctorId: null,
    homeLocationId: null,
    locationIds: [],
    theme: "SISTEM",
    density: "COMPACT",
    mustChangePassword: false,
  });
  return { admin: user(a.id, "ADMIN", "Ana"), medic: user(m.id, "MEDIC", "Mihai"), receptie: user(r.id, "RECEPTIE", "Rita") };
}

let fileNo = 700_000 + Math.floor(Math.random() * 200_000);

export async function rawPatient(data: { firstName?: string; lastName?: string; phone?: string | null; email?: string | null; birthDate?: Date | null } = {}) {
  fileNo += 1;
  const firstName = data.firstName ?? "Test";
  const lastName = data.lastName ?? `Pacient${fileNo}`;
  return prisma.patient.create({
    data: {
      fileNumber: fileNo,
      firstName,
      lastName,
      searchText: `${firstName} ${lastName}`.toLowerCase(),
      phone: data.phone ?? null,
      email: data.email ?? null,
      birthDate: data.birthDate ?? null,
    },
    select: { id: true, fileNumber: true },
  });
}
