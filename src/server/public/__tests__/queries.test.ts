import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp3.db";
});

import { prisma } from "@/lib/db";
import {
  getAllPublicCatalog,
  getPublicCatalog,
  getPublicDoctor,
  getPublicLocations,
  getServiceIndex,
  monogramOf,
} from "../queries";

/** Fixed slugs from content/services, so getServiceIndex keeps them; a unique suffix keeps codes apart. */
const SUFFIX = Math.random().toString(36).slice(2, 8).toUpperCase();
let implantId = "";

beforeAll(async () => {
  await prisma.doctorCategory.deleteMany({});
  await prisma.service.deleteMany({ where: { category: { slug: { in: ["implantologie", "ortodontie"] } } } }).catch(() => undefined);
  await prisma.serviceCategory.deleteMany({ where: { slug: { in: ["implantologie", "ortodontie"] } } }).catch(() => undefined);
  await prisma.doctor.deleteMany({ where: { slug: { in: ["test-masca", "test-podar", "test-ascuns"] } } });

  const imp = await prisma.serviceCategory.create({
    data: { slug: "implantologie", name: "Implantologie", sortOrder: 4, summary: "Implanturi din titan." },
  });
  await prisma.serviceCategory.create({ data: { slug: "ortodontie", name: "Ortodonție", sortOrder: 8, publicVisible: false } });
  const implant = await prisma.service.create({
    data: { categoryId: imp.id, code: `IMP-T-${SUFFIX}`, name: "Implant Neodent", priceMin: 220_000, isRepresentative: true, sortOrder: 1 },
  });
  implantId = implant.id;
  await prisma.service.create({
    data: { categoryId: imp.id, code: `IMP-B-${SUFFIX}`, name: "Bont protetic", priceMin: 55_000, priceMax: 70_000, sortOrder: 2 },
  });
  await prisma.service.create({
    data: { categoryId: imp.id, code: `IMP-H-${SUFFIX}`, name: "Ascuns de pe site", priceMin: 1_000, publicVisible: false, sortOrder: 3 },
  });
  await prisma.service.create({
    data: { categoryId: imp.id, code: `IMP-P-${SUFFIX}`, name: "Plan complex", priceMin: null, sortOrder: 4 },
  });
  const masca = await prisma.doctor.create({
    data: {
      slug: "test-masca",
      firstName: "Mihail Dan",
      lastName: "Mașca",
      publicName: "Dr. Mihail Dan Mașca",
      roleLine: "Medic dentist, competență în implantologie",
      photoPath: "/images/echipa/mihail-dan-masca.png",
      sortOrder: 2,
    },
  });
  await prisma.doctor.create({
    data: { slug: "test-podar", firstName: "Victoria-Ana", lastName: "Podar", publicName: "Dr. Victoria-Ana Podar", roleLine: "Ortodonție", sortOrder: 4 },
  });
  await prisma.doctor.create({
    data: { slug: "test-ascuns", firstName: "A", lastName: "B", publicName: "Dr. A B", roleLine: "x", publicVisible: false },
  });
  await prisma.doctorCategory.create({ data: { doctorId: masca.id, categoryId: imp.id, showOnSite: true } });
});

describe("public catalog", () => {
  it("formats prices with formatLei and hides what is not public", async () => {
    const page = await getPublicCatalog("implantologie");
    expect(page?.category.name).toBe("Implantologie");
    expect(page?.prices.map((p) => [p.name, p.price, p.onRequest])).toEqual([
      ["Implant Neodent", "2.200 lei", false],
      ["Bont protetic", "550 / 700 lei", false],
      ["Plan complex", "Prețul îl aflați la telefon", true],
    ]);
    expect(page?.doctors.map((d) => d.publicName)).toEqual(["Dr. Mihail Dan Mașca"]);
    expect(await getPublicCatalog("ortodontie")).toBeNull();
  });

  it("shows a price changed in the CRM on the next read", async () => {
    await prisma.service.update({ where: { id: implantId }, data: { priceMin: 240_000 } });
    const page = await getPublicCatalog("implantologie");
    expect(page?.prices[0].price).toBe("2.400 lei");
    const all = await getAllPublicCatalog();
    expect(all.find((c) => c.slug === "implantologie")?.prices[0].price).toBe("2.400 lei");
  });

  it("builds the „Ce tratăm” index with the representative price", async () => {
    const index = await getServiceIndex();
    const row = index.find((r) => r.slug === "implantologie");
    expect(row?.summary).toBe("Implanturi din titan.");
    expect(row?.representative).toEqual({ name: "Implant Neodent", price: "2.400 lei" });
    expect(index.find((r) => r.slug === "ortodontie")).toBeUndefined();
  });
});

describe("public doctors", () => {
  it("gives a monogram to a doctor without a portrait and hides private profiles", async () => {
    const podar = await getPublicDoctor("test-podar");
    expect(podar?.monogram).toBe("VP");
    expect(podar?.shortName).toBe("Dr. Podar");
    expect(await getPublicDoctor("test-ascuns")).toBeNull();
    expect(monogramOf("ana-maria", "fertea")).toBe("AF");
  });
});

describe("public locations", () => {
  it("never exposes hours that are not published", async () => {
    await prisma.location.deleteMany({ where: { slug: "ludus", appointments: { none: {} } } }).catch(() => undefined);
    const existing = await prisma.location.findUnique({ where: { slug: "ludus" } });
    if (!existing) {
      await prisma.location.create({
        data: { slug: "ludus", name: "Dental Arena Luduș", shortName: "Luduș", street: "str. Gheorghe Barițiu nr. 6", city: "Luduș", phone: "0365 430 125" },
      });
    } else {
      await prisma.location.update({ where: { slug: "ludus" }, data: { publishHours: false } });
    }
    const ludus = (await getPublicLocations()).find((l) => l.slug === "ludus");
    expect(ludus?.publishHours).toBe(false);
    expect(ludus?.hours).toEqual([]);
  });
});
