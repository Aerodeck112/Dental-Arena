import type { PrismaClient } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth/dal";

/**
 * Test data for the WP4 integration tests (prisma/test-wp4.db). Every call creates its own
 * locations, cabinets, category, service and doctors under a unique tag, so test files can run in
 * parallel against the same database.
 */

let counter = 0;
export function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}${process.pid}${Date.now().toString(36)}${counter}`.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type Clinic = Awaited<ReturnType<typeof makeClinic>>;

/**
 * Two locations (L1 with cabinets C1 and C2, L2 with cabinet C3), a category with an online
 * service of 30 minutes, and two doctors (A, sortOrder 1; B, sortOrder 2) who do that category.
 * Shifts: A at L1 every day 09:00–17:00 in C1 with a 12:00–12:30 break; B at L1 every day
 * 09:00–17:00 in C2. Nothing at L2 unless a test adds it.
 */
export async function makeClinic(prisma: PrismaClient, o: { sedationUnits?: number } = {}) {
  const tag = uniq("t");
  const l1 = await prisma.location.create({
    data: { slug: `${tag}-c`, name: `Dental Arena Test ${tag}`, shortName: "Testești", street: "str. Test 1", city: "Testești", phone: "0265 000 001", sedationUnits: o.sedationUnits ?? 1, sortOrder: 90 },
  });
  const l2 = await prisma.location.create({
    data: { slug: `${tag}-l`, name: `Dental Arena Alt ${tag}`, shortName: "Altești", street: "str. Alta 2", city: "Altești", phone: "0365 000 002", sortOrder: 91 },
  });
  const c1 = await prisma.cabinet.create({ data: { locationId: l1.id, name: "Cabinet 1" } });
  const c2 = await prisma.cabinet.create({ data: { locationId: l1.id, name: "Cabinet 2" } });
  const c3 = await prisma.cabinet.create({ data: { locationId: l2.id, name: "Cabinet 1" } });
  const category = await prisma.serviceCategory.create({ data: { slug: `${tag}-cat`, name: `Categorie ${tag}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, code: `${tag}-SVC`.toUpperCase(), name: "Consultație test", durationMinutes: 30, bookableOnline: true, onlineLabel: "Consultație sau control" },
  });
  const offline = await prisma.service.create({
    data: { categoryId: category.id, code: `${tag}-OFF`.toUpperCase(), name: "Serviciu doar în clinică", durationMinutes: 30, bookableOnline: false },
  });
  const doctorA = await prisma.doctor.create({
    data: { slug: `${tag}-a`, firstName: "Ana", lastName: "Testescu", publicName: "Dr. Ana Testescu", roleLine: "Medic dentist", sortOrder: 1 },
  });
  const doctorB = await prisma.doctor.create({
    data: { slug: `${tag}-b`, firstName: "Bogdan", lastName: "Probă", publicName: "Dr. Bogdan Probă", roleLine: "Medic dentist", sortOrder: 2 },
  });
  await prisma.doctorCategory.createMany({
    data: [
      { doctorId: doctorA.id, categoryId: category.id },
      { doctorId: doctorB.id, categoryId: category.id },
    ],
  });
  for (let weekday = 1; weekday <= 7; weekday++) {
    await prisma.workShift.create({
      data: {
        doctorId: doctorA.id,
        locationId: l1.id,
        cabinetId: c1.id,
        weekday,
        startMinute: 540,
        endMinute: 1020,
        breaks: { create: [{ startMinute: 720, endMinute: 750, label: "Pauză" }] },
      },
    });
    await prisma.workShift.create({
      data: { doctorId: doctorB.id, locationId: l1.id, cabinetId: c2.id, weekday, startMinute: 540, endMinute: 1020 },
    });
  }
  return { tag, l1, l2, c1, c2, c3, category, service, offline, doctorA, doctorB };
}

let fileNumber = 900_000 + Math.floor(Math.random() * 90_000);

export async function makePatient(prisma: PrismaClient, firstName = "Ion") {
  fileNumber += 1 + Math.floor(Math.random() * 7);
  return prisma.patient.create({
    data: { fileNumber, firstName, lastName: "Pacient", searchText: `${firstName.toLowerCase()} pacient` },
  });
}

export function testUser(role: "ADMIN" | "MEDIC" | "RECEPTIE", doctorId: string | null = null): CurrentUser {
  return {
    id: `test-${role.toLowerCase()}`,
    role,
    email: `${role.toLowerCase()}@example.com`,
    firstName: "Test",
    lastName: role,
    displayName: `Test ${role}`,
    doctorId,
    homeLocationId: null,
    locationIds: [],
    theme: "SISTEM",
    density: "COMPACT",
    mustChangePassword: false,
  };
}
