import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import type {
  AppointmentSource,
  AppointmentStatus,
  Comfort,
  ConfirmationChannel,
  LeadSource,
  LeadStatus,
  PaymentMethod,
  PlanItemStatus,
  PlanStatus,
  Sex,
  ToothConditionType,
} from "../../src/generated/prisma/enums";
import { aesGcmEncrypt, hmacHex } from "../../src/lib/crypto";
import { formatDateRo, formatTime } from "../../src/lib/format";
import { buildPatientSearchText } from "../../src/lib/search";
import { addDaysISO, addMonthsISO, isoWeekday, localToUtc, utcToLocal } from "../../src/lib/time";
import { signAppointmentTokenWithKey } from "../../src/lib/tokens-core";
import { cnpControlDigit } from "../../src/lib/validation/common";
import type { Random } from "./random";

/**
 * Demo data (docs/architecture.md §10.5). Everything clinical is fictitious; phones use the
 * non-allocated range +40700000xxx; e-mails use example.com. Dates are relative to the seed day.
 * Appointments are placed inside the demo shifts with an occupancy check per doctor, cabinet,
 * patient and sedation unit, and the result is asserted conflict-free at the end.
 */

export type LocSlug = "cristesti" | "ludus";
type Tx = Prisma.TransactionClient;

export type DemoContext = {
  db: PrismaClient;
  random: Random;
  now: Date;
  today: string;
  locations: Record<LocSlug, { id: string; slug: LocSlug; name: string; shortName: string; phone: string; street: string; city: string; sedationUnits: number }>;
  doctors: Record<string, { id: string; slug: string; publicName: string; lastName: string; categories: Set<string>; userId: string }>;
  services: Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      categorySlug: string;
      priceMin: number | null;
      priceMax: number | null;
      unit: string;
      durationMinutes: number;
      onlineLabel: string | null;
    }
  >;
  users: {
    admin: { id: string; name: string };
    receptie: Record<LocSlug, { id: string; name: string }>;
  };
  tags: Map<string, string>;
  shifts: {
    doctorSlug: string;
    doctorId: string;
    loc: LocSlug;
    locationId: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
    cabinetId: string | null;
    breaks: { startMinute: number; endMinute: number }[];
  }[];
  timeOff: { doctorId: string | null; locationId: string | null; start: number; end: number }[];
  keys: { pii: Buffer; cnpHash: Buffer; link: Buffer; ipHash: Buffer };
  appUrl: string;
  consentTextVersion: string;
  invoiceSeries: string;
  receiptSeries: string;
};

export type DemoSummary = Record<string, number>;

// ───────────────────────────── Fixed name lists ─────────────────────────────

const ADULTS: readonly [string, string, Sex][] = [
  ["Ion", "Pop", "M"],
  ["Maria", "Suciu", "F"],
  ["Elena", "Rus", "F"],
  ["Gheorghe", "Moldovan", "M"],
  ["Ioana", "Man", "F"],
  ["Vasile", "Boț", "M"],
  ["Ana", "Man", "F"],
  ["Dan", "Pop", "M"],
  ["Mihaela", "Rusu", "F"],
  ["Andrei", "Moldovan", "M"],
  ["Cristina", "Pop", "F"],
  ["Florin", "Suciu", "M"],
  ["Ileana", "Crișan", "F"],
  ["Nicolae", "Oltean", "M"],
  ["Rodica", "Szabo", "F"],
  ["Ștefan", "Kovács", "M"],
  ["Adriana", "Toma", "F"],
  ["Mihai", "Bucur", "M"],
  ["Lucia", "Mărginean", "F"],
  ["Sorin", "Câmpean", "M"],
  ["Daniela", "Pușcaș", "F"],
  ["Cosmin", "Boar", "M"],
  ["Gabriela", "Fărcaș", "F"],
  ["Radu", "Muntean", "M"],
  ["Monica", "Sabău", "F"],
  ["Paul", "Hossu", "M"],
  ["Larisa", "Bota", "F"],
  ["Emil", "Cozma", "M"],
  ["Viorica", "Lazăr", "F"],
  ["Alexandru", "Nagy", "M"],
  ["Carmen", "Rus", "F"],
  ["Tudor", "Pop", "M"],
  ["Raluca", "Moga", "F"],
  ["Bogdan", "Chirilă", "M"],
  ["Simona", "Pintea", "F"],
  ["Liviu", "Rusu", "M"],
  ["Anca", "Morar", "F"],
  ["Ovidiu", "Șandor", "M"],
  ["Teodora", "Vaida", "F"],
  ["Marius", "Zăgrean", "M"],
];

/** Children: first name, sex, age, guardian (index in ADULTS). Surname is the guardian's. */
const CHILDREN: readonly [string, Sex, number, number][] = [
  ["Ioana", "F", 8, 10],
  ["David", "M", 7, 9],
  ["Sara", "F", 10, 4],
  ["Matei", "M", 6, 8],
  ["Eva", "F", 11, 12],
  ["Bianca", "F", 12, 14],
];

const MARIA = 1; // index of Maria Suciu in ADULTS

/** Adults who arrived through an online request; value = hours since the request (see the leads below). */
const CONVERTED_LEAD_HOURS: Record<number, number> = { 36: 120, 37: 96, 38: 150 };

const PLACES: Record<LocSlug, readonly string[]> = {
  cristesti: ["Cristești", "Târgu Mureș", "Sâncraiu de Mureș", "Corunca", "Livezeni", "Sântana de Mureș"],
  ludus: ["Luduș", "Iernut", "Cuci", "Sărmașu", "Gheja", "Valea Largă"],
};
const STREETS = ["str. Principală", "str. Trandafirilor", "str. Școlii", "str. Morii", "str. Libertății", "str. Republicii", "str. Câmpului"];

const COMFORT_WORDS = [
  "Am avut o extracție grea acum mulți ani.",
  "Mă sperie zgomotul frezei.",
  "Aș vrea să mi se explice înainte ce urmează.",
  "Mi-e teamă de ac.",
];

// ───────────────────────────── Time helpers ─────────────────────────────

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const GRID = 15 * MIN; // clinic offsets are whole hours, so a UTC 15-min grid is the local grid

type Interval = [number, number];

function subtract(intervals: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const [a, b] of intervals) {
    if (cut[1] <= a || cut[0] >= b) {
      out.push([a, b]);
      continue;
    }
    if (cut[0] > a) out.push([a, cut[0]]);
    if (cut[1] < b) out.push([cut[1], b]);
  }
  return out;
}

class Occupancy {
  private readonly map = new Map<string, Interval[]>();
  free(key: string, s: number, e: number): boolean {
    return !(this.map.get(key) ?? []).some(([a, b]) => s < b && a < e);
  }
  count(key: string, s: number, e: number): number {
    return (this.map.get(key) ?? []).filter(([a, b]) => s < b && a < e).length;
  }
  add(key: string, s: number, e: number) {
    const list = this.map.get(key) ?? [];
    list.push([s, e]);
    this.map.set(key, list);
  }
}

function gsm7(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[„”“]/g, '"')
    .replace(/[–—]/g, "-");
}

function round10Lei(bani: number): number {
  return Math.floor(bani / 1000) * 1000;
}

// ───────────────────────────── Types used while building ─────────────────────────────

type DemoPatient = {
  index: number;
  id: string;
  fileNumber: number;
  firstName: string;
  lastName: string;
  sex: Sex;
  birthISO: string;
  child: boolean;
  guardian: number | null;
  loc: LocSlug;
  phone: string | null;
  email: string | null;
  comfort: Comfort | null;
  prefersSedation: boolean;
  smsOptIn: boolean;
  createdAt: Date;
  primaryDoctorSlug: string;
  street: string;
  city: string;
};

type Draft = {
  locationId: string;
  loc: LocSlug;
  doctorId: string;
  doctorSlug: string;
  cabinetId: string | null;
  patient: DemoPatient | null;
  leadId: string | null;
  serviceCode: string;
  reason: string | null;
  start: number;
  end: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  comfort: Comfort | null;
  comfortNote: string | null;
  wantsSedation: boolean;
  notes: string | null;
  createdAt: Date;
  createdById: string | null;
  tooth: number | null;
  label?: string;
  id?: string;
};

const BLOCKING: readonly AppointmentStatus[] = ["PROGRAMAT", "CONFIRMAT", "SOSIT", "IN_TRATAMENT", "FINALIZAT"];

/** Service mix per doctor (weights); children get the pedodontics list. */
const SERVICE_MIX: Record<string, readonly (readonly [string, number])[]> = {
  "andrei-marcoci": [
    ["CON-CONSULT", 3], ["CON-DETARTRAJ", 4], ["CON-AIRFLOW", 1], ["SG-OBT-COMPOZIT", 5], ["SG-OBT-ESTETICA", 2],
    ["SG-ENDO-MONO", 1], ["SG-ENDO-PLURI", 1], ["SG-PANSAMENT", 1], ["PAR-CHIURETAJ", 1], ["PR-ZR", 1], ["EST-OPALESCENCE", 0.5],
  ],
  "paul-bologa": [
    ["CON-CONSULT", 3], ["CON-DETARTRAJ", 4], ["SG-OBT-COMPOZIT", 5], ["SG-OBT-GIC", 1], ["SG-ENDO-PLURI", 1],
    ["SG-RETRAT-MONO", 0.5], ["PAR-PARODONTOMETRIE", 1], ["PR-MC", 1], ["EST-ALBIRE-INTERNA", 0.5],
  ],
  "mihail-dan-masca": [
    ["CON-CONSULT", 2], ["IMP-CONSULT", 2], ["IMP-NEODENT", 1], ["IMP-BONT", 1], ["SG-OBT-COMPOZIT", 3], ["PR-ZR", 2],
    ["PR-MC", 1], ["PR-ZR-IMPLANT", 1], ["CH-EXT-MONO", 1], ["CON-DETARTRAJ", 1],
  ],
  "victoria-ana-podar": [["ORT-CONSULT", 2], ["ORT-CONTROL", 6], ["ORT-METALIC", 1], ["ORT-MOBILIZABIL", 1], ["ORT-INDEPARTARE", 0.5]],
  "ana-maria-fertea": [
    ["CH-EXT-MONO", 3], ["CH-EXT-PLURI", 2], ["CH-EXT-MINTE", 2], ["CH-EXT-ALVEOLOTOMIE", 1], ["CH-ODONTECTOMIE", 0.5],
    ["CH-INCIZIE", 0.5], ["CON-CONSULT", 1], ["SG-URGENTA", 1],
  ],
};
const CHILD_MIX: readonly (readonly [string, number])[] = [["PED-FLUOR", 3], ["PED-OBT-TEMP", 3], ["PED-SIGILARE", 2], ["PED-OBT-PERM", 1], ["CON-CONSULT", 1]];
const PEDIATRIC_DOCTORS = new Set(["andrei-marcoci", "paul-bologa", "victoria-ana-podar"]);

const UPPER_TEETH = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const LOWER_TEETH = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];
const MOLARS = [16, 17, 26, 27, 36, 37, 46, 47];
const CHILD_TEETH = [54, 55, 64, 65, 74, 75, 84, 85];

// ───────────────────────────── Main ─────────────────────────────

export async function seedDemo(ctx: DemoContext): Promise<DemoSummary> {
  return ctx.db.$transaction((tx) => buildDemo(tx, ctx), { maxWait: 10_000, timeout: 600_000 });
}

async function buildDemo(tx: Tx, ctx: DemoContext): Promise<DemoSummary> {
  const { random, now, today } = ctx;
  const summary: DemoSummary = {};
  const doctorBySlug = ctx.doctors;
  const svc = (code: string) => {
    const s = ctx.services.get(code);
    if (!s) throw new Error(`Serviciu lipsă în catalog: ${code}`);
    return s;
  };
  const receptieFor = (loc: LocSlug) => ctx.users.receptie[loc];
  const nowLocal = utcToLocal(now);
  const thisYear = Number(today.slice(0, 4));

  // ── 1. Patients ──────────────────────────────────────────────────────────
  const patients: DemoPatient[] = [];
  const cristestiDoctors = ["andrei-marcoci", "mihail-dan-masca", "paul-bologa"];
  let fileNumber = 0;
  const nextFileNumber = async () => {
    const row = await tx.numberSequence.upsert({
      where: { key: "PACIENT" },
      create: { key: "PACIENT", value: 1 },
      update: { value: { increment: 1 } },
    });
    fileNumber = row.value;
    return fileNumber;
  };

  for (let i = 0; i < ADULTS.length; i += 1) {
    const [firstName, lastName, sex] = ADULTS[i];
    const age = i === MARIA ? 58 : random.int(22, 78);
    const birthISO = `${thisYear - age}-${String(random.int(1, 12)).padStart(2, "0")}-${String(random.int(1, 28)).padStart(2, "0")}`;
    const loc: LocSlug = i === MARIA ? "cristesti" : random.chance(0.6) ? "cristesti" : "ludus";
    const monthsAgo = i >= 36 ? 0 : random.int(2, 30); // the last four joined this month
    const createdAt =
      CONVERTED_LEAD_HOURS[i] !== undefined
        ? new Date(now.getTime() - (CONVERTED_LEAD_HOURS[i] - 3) * 60 * MIN)
        : new Date(now.getTime() - (monthsAgo * 30 + random.int(1, 20)) * DAY);
    patients.push({
      index: i,
      id: "",
      fileNumber: 0,
      firstName,
      lastName,
      sex,
      birthISO,
      child: false,
      guardian: null,
      loc,
      phone: `+40700000${String(i + 1).padStart(3, "0")}`,
      email: i % 2 === 0 || i === MARIA ? `pacient${i + 1}@example.com` : null,
      comfort: null,
      prefersSedation: false,
      smsOptIn: random.chance(0.7),
      createdAt,
      primaryDoctorSlug: i === MARIA ? "mihail-dan-masca" : random.pick(cristestiDoctors),
      street: `${random.pick(STREETS)} nr. ${random.int(1, 140)}`,
      city: random.pick(PLACES[loc]),
    });
  }
  for (let c = 0; c < CHILDREN.length; c += 1) {
    const [firstName, sex, age, guardianIndex] = CHILDREN[c];
    const guardian = patients[guardianIndex];
    patients.push({
      index: ADULTS.length + c,
      id: "",
      fileNumber: 0,
      firstName,
      lastName: guardian.lastName,
      sex,
      birthISO: `${thisYear - age}-${String(random.int(1, 9)).padStart(2, "0")}-${String(random.int(1, 28)).padStart(2, "0")}`,
      child: true,
      guardian: guardianIndex,
      loc: guardian.loc,
      phone: null,
      email: null,
      comfort: null,
      prefersSedation: false,
      smsOptIn: false,
      createdAt: guardian.createdAt,
      primaryDoctorSlug: random.pick(["andrei-marcoci", "paul-bologa"]),
      street: guardian.street,
      city: guardian.city,
    });
  }

  // Comfort: 8 „Mi-e frică” (Maria first), 2 who prefer sedation, a few with mild nerves.
  const adultIdx = random.shuffle(patients.filter((p) => !p.child && p.index !== MARIA).map((p) => p.index));
  const fear = [MARIA, ...adultIdx.slice(0, 7)];
  for (const i of fear) patients[i].comfort = "FRICA";
  for (const i of adultIdx.slice(7, 12)) patients[i].comfort = "EMOTII";
  patients[MARIA].prefersSedation = true;
  patients[adultIdx[0]].prefersSedation = true;
  patients[patients.length - 2].comfort = "EMOTII"; // a child

  // Medical flags: 8 penicillin (Maria among them), 2 latex, 3 anticoagulants, 1 pregnancy.
  const flagPool = random.shuffle(patients.filter((p) => !p.child && p.index !== MARIA).map((p) => p.index));
  const penicillin = new Set([MARIA, ...flagPool.slice(0, 7)]);
  const latex = new Set(flagPool.slice(7, 9));
  const anticoag = new Set(flagPool.slice(9, 12));
  const pregnantCandidate = patients.find(
    (p) => !p.child && p.sex === "F" && thisYear - Number(p.birthISO.slice(0, 4)) <= 40 && !penicillin.has(p.index),
  );

  // CNP for 10 adults (fictitious, valid checksum, county 26 = Mureș).
  const cnpPatients = new Set([MARIA, ...flagPool.slice(12, 21)]);

  for (const p of patients) {
    p.fileNumber = await nextFileNumber();
    let cnpEncrypted: string | null = null;
    let cnpHash: string | null = null;
    if (cnpPatients.has(p.index)) {
      const [y, m, d] = p.birthISO.split("-");
      const century = Number(y) >= 2000;
      const s = p.sex === "M" ? (century ? 5 : 1) : century ? 6 : 2;
      const first12 = `${s}${y.slice(2)}${m}${d}26${String(random.int(1, 999)).padStart(3, "0")}`;
      const cnp = `${first12}${cnpControlDigit(first12)}`;
      cnpEncrypted = aesGcmEncrypt(cnp, ctx.keys.pii);
      cnpHash = hmacHex(ctx.keys.cnpHash, cnp);
    }
    const created = await tx.patient.create({
      data: {
        fileNumber: p.fileNumber,
        firstName: p.firstName,
        lastName: p.lastName,
        searchText: buildPatientSearchText(p),
        cnpEncrypted,
        cnpHash,
        birthDate: localToUtc(p.birthISO, 0),
        sex: p.sex,
        phone: p.phone,
        email: p.email,
        street: p.street,
        city: p.city,
        county: "Mureș",
        guardianId: p.guardian !== null ? patients[p.guardian].id : null,
        preferredLocationId: ctx.locations[p.loc].id,
        primaryDoctorId: doctorBySlug[p.primaryDoctorSlug].id,
        comfortDefault: p.comfort,
        prefersSedation: p.prefersSedation,
        smsOptIn: p.smsOptIn,
        emailOptIn: Boolean(p.email),
        acquisitionSource:
          p.index === 38
            ? "APEL_INVERS"
            : CONVERTED_LEAD_HOURS[p.index] !== undefined
              ? "PROGRAMARE_ONLINE"
              : random.weighted<LeadSource>([["RECOMANDARE", 4], ["TELEFON", 4], ["PROGRAMARE_ONLINE", 2], ["SOCIAL", 1]]),
        createdById: receptieFor(p.loc).id,
        createdAt: p.createdAt,
      },
    });
    p.id = created.id;

    await tx.medicalHistory.create({
      data: {
        patientId: p.id,
        allergies: penicillin.has(p.index) ? "Penicilină" : latex.has(p.index) ? "Latex" : null,
        medications: anticoag.has(p.index) ? "Acenocumarol (Trombostop)" : null,
        anticoagulants: anticoag.has(p.index),
        hypertension: anticoag.has(p.index) || random.chance(0.12),
        diabetes: !p.child && random.chance(0.08),
        pregnancy: pregnantCandidate?.index === p.index,
        smoker: !p.child && random.chance(0.2),
        lastReviewedAt: p.createdAt,
        lastReviewedByUserId: doctorBySlug[p.primaryDoctorSlug].userId,
      },
    });

    // Consents: health-data processing for everyone; SMS for those who opted in.
    await tx.consent.create({
      data: {
        patientId: p.id,
        type: "GDPR_DATE_SANATATE",
        granted: true,
        method: "SEMNAT_HARTIE",
        textVersion: ctx.consentTextVersion,
        grantedAt: p.createdAt,
        recordedById: receptieFor(p.loc).id,
      },
    });
    if (p.smsOptIn || (p.child && patients[p.guardian ?? 0].smsOptIn)) {
      await tx.consent.create({
        data: {
          patientId: p.id,
          type: "SMS",
          granted: true,
          method: "SEMNAT_HARTIE",
          textVersion: ctx.consentTextVersion,
          grantedAt: p.createdAt,
          recordedById: receptieFor(p.loc).id,
        },
      });
    }
  }
  summary.patients = patients.length;

  // Tags
  const tag = (name: string) => {
    const id = ctx.tags.get(name);
    if (!id) throw new Error(`Etichetă lipsă: ${name}`);
    return id;
  };
  const tagLinks: { patientId: string; tagId: string }[] = [];
  for (const p of patients) {
    if (p.createdAt.getTime() > now.getTime() - 31 * DAY) tagLinks.push({ patientId: p.id, tagId: tag("Pacient nou") });
    if (p.child || patients.some((c) => c.guardian === p.index)) tagLinks.push({ patientId: p.id, tagId: tag("Familie") });
  }
  tagLinks.push({ patientId: patients[MARIA].id, tagId: tag("Implant în curs") });
  for (const i of random.shuffle(adultIdx).slice(0, 4)) tagLinks.push({ patientId: patients[i].id, tagId: tag("Preferă dimineața") });
  for (const i of random.shuffle(adultIdx).slice(0, 2)) tagLinks.push({ patientId: patients[i].id, tagId: tag("Necesită reconfirmare") });
  const orthoPatients = [patients[ADULTS.length + 5], patients[ADULTS.length + 4], patients[adultIdx[20]]];
  for (const p of orthoPatients) tagLinks.push({ patientId: p.id, tagId: tag("Ortodonție în curs") });
  const uniqueLinks = [...new Map(tagLinks.map((l) => [`${l.patientId}:${l.tagId}`, l])).values()];
  await tx.patientTag.createMany({ data: uniqueLinks });

  // ── 2. Leads ─────────────────────────────────────────────────────────────
  const ipHash = (n: number) => hmacHex(ctx.keys.ipHash, `10.0.0.${n}`);
  type LeadPlan = {
    status: LeadStatus;
    source: LeadSource;
    name: string;
    loc: LocSlug;
    serviceCode: string | null;
    message?: string;
    preferredTime?: string;
    comfort?: Comfort;
    comfortNote?: string;
    wantsSedation?: boolean;
    forChild?: { name: string; age: number };
    patient?: DemoPatient;
    lostReason?: string;
    hoursAgo: number;
    activities: { type: "NOTA" | "APEL" | "STATUS" | "CONVERSIE" | "ATRIBUIRE"; body: string; hoursAfter: number }[];
  };
  const recentPatients = patients.filter((p) => !p.child && p.index >= 36);
  const leadPlans: LeadPlan[] = [
    {
      status: "NOU", source: "PROGRAMARE_ONLINE", name: "Corina Dobra", loc: "cristesti", serviceCode: "CON-DETARTRAJ",
      comfort: "FRICA", comfortNote: "Ultima dată m-a durut foarte tare, aș vrea să mergem încet.", wantsSedation: true,
      hoursAgo: 5, activities: [{ type: "STATUS", body: "Programare online creată", hoursAfter: 0 }],
    },
    {
      status: "NOU", source: "PROGRAMARE_ONLINE", name: "Lucian Furtună", loc: "ludus", serviceCode: "CON-CONSULT",
      forChild: { name: "Mara", age: 7 }, comfort: "EMOTII", hoursAgo: 20,
      activities: [{ type: "STATUS", body: "Programare online creată", hoursAfter: 0 }],
    },
    {
      status: "NOU", source: "FORMULAR_CONTACT", name: "Petra Iacob", loc: "ludus", serviceCode: null, hoursAgo: 28,
      message: "Bună ziua, aș dori informații despre aparatul dentar pentru fiica mea, de 12 ani. Când ați avea disponibilitate la Luduș?",
      activities: [],
    },
    {
      status: "NOU", source: "APEL_INVERS", name: "Vlad Orban", loc: "cristesti", serviceCode: "IMP-CONSULT", hoursAgo: 3,
      preferredTime: "după ora 16", activities: [],
    },
    {
      status: "CONTACTAT", source: "TELEFON", name: "Silvia Ardelean", loc: "cristesti", serviceCode: "PR-ZR", hoursAgo: 72,
      activities: [
        { type: "APEL", body: "Nu a răspuns. Revenim mâine dimineață.", hoursAfter: 2 },
        { type: "APEL", body: "A cerut devizul pentru două coroane; revine după ce discută cu familia.", hoursAfter: 26 },
      ],
    },
    {
      status: "CONTACTAT", source: "FORMULAR_CONTACT", name: "George Bălan", loc: "ludus", serviceCode: "CON-CONSULT", hoursAgo: 50,
      message: "Aș vrea o programare pentru un control, de preferat vineri.",
      activities: [{ type: "APEL", body: "Vineri nu avem loc; i-am propus luni după-amiază, se gândește.", hoursAfter: 4 }],
    },
    {
      status: "CONTACTAT", source: "APEL_INVERS", name: "Irina Pavel", loc: "cristesti", serviceCode: "ORT-CONSULT", hoursAgo: 40,
      preferredTime: "dimineața", activities: [{ type: "NOTA", body: "Întreabă de aparatul ceramic; i-am trimis prețurile pe e-mail.", hoursAfter: 3 }],
    },
    {
      status: "PROGRAMAT", source: "PROGRAMARE_ONLINE", name: "", loc: recentPatients[0].loc, serviceCode: "CON-CONSULT",
      patient: recentPatients[0], hoursAgo: 120,
      activities: [
        { type: "STATUS", body: "Programare online creată", hoursAfter: 0 },
        { type: "APEL", body: "A confirmat ora la telefon.", hoursAfter: 3 },
        { type: "CONVERSIE", body: "Convertită în pacient", hoursAfter: 3 },
      ],
    },
    {
      status: "PROGRAMAT", source: "PROGRAMARE_ONLINE", name: "", loc: recentPatients[1].loc, serviceCode: "CON-DETARTRAJ",
      patient: recentPatients[1], hoursAgo: 96,
      activities: [
        { type: "STATUS", body: "Programare online creată", hoursAfter: 0 },
        { type: "CONVERSIE", body: "Convertită în pacient", hoursAfter: 5 },
      ],
    },
    {
      status: "PROGRAMAT", source: "APEL_INVERS", name: "", loc: recentPatients[2].loc, serviceCode: "CON-CONSULT",
      patient: recentPatients[2], hoursAgo: 150, preferredTime: "după ora 15",
      activities: [
        { type: "APEL", body: "Programat telefonic.", hoursAfter: 6 },
        { type: "CONVERSIE", body: "Convertită în pacient", hoursAfter: 6 },
      ],
    },
    {
      status: "PIERDUT", source: "FORMULAR_CONTACT", name: "Doru Rațiu", loc: "ludus", serviceCode: null, hoursAgo: 400,
      message: "Cât costă un implant?", lostReason: "A ales o clinică mai aproape de casă.",
      activities: [{ type: "APEL", body: "I-am explicat prețurile; nu dorește programare acum.", hoursAfter: 5 }],
    },
    {
      status: "PIERDUT", source: "TELEFON", name: "Nadia Covaci", loc: "cristesti", serviceCode: "CON-CONSULT", hoursAgo: 300,
      lostReason: "Nu a mai răspuns după trei apeluri.",
      activities: [
        { type: "APEL", body: "Nu a răspuns.", hoursAfter: 2 },
        { type: "APEL", body: "Nu a răspuns.", hoursAfter: 26 },
        { type: "APEL", body: "Nu a răspuns. Închidem cererea.", hoursAfter: 50 },
      ],
    },
  ];

  const leads: { id: string; plan: LeadPlan; createdAt: Date }[] = [];
  for (let n = 0; n < leadPlans.length; n += 1) {
    const plan = leadPlans[n];
    const createdAt = new Date(now.getTime() - plan.hoursAgo * 60 * MIN);
    const assignee = receptieFor(plan.loc);
    const name = plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}` : plan.name;
    const online = plan.source === "PROGRAMARE_ONLINE" || plan.source === "APEL_INVERS" || plan.source === "FORMULAR_CONTACT";
    const lead = await tx.lead.create({
      data: {
        source: plan.source,
        status: plan.status,
        name,
        phone: plan.patient?.phone ?? `+40700000${String(101 + n)}`,
        email: plan.patient?.email ?? (n % 2 === 0 ? `cerere${n + 1}@example.com` : null),
        message: plan.message ?? null,
        locationId: ctx.locations[plan.loc].id,
        serviceId: plan.serviceCode ? svc(plan.serviceCode).id : null,
        preferredTime: plan.preferredTime ?? null,
        comfort: plan.comfort ?? null,
        comfortNote: plan.comfortNote ?? null,
        wantsSedation: plan.wantsSedation ?? false,
        forChild: Boolean(plan.forChild),
        childFirstName: plan.forChild?.name ?? null,
        childAge: plan.forChild?.age ?? null,
        consentGdprAt: online ? createdAt : null,
        consentTextVersion: online ? ctx.consentTextVersion : null,
        consentSms: online && n % 3 !== 2,
        sourcePath: plan.source === "PROGRAMARE_ONLINE" ? "/programare" : plan.source === "FORMULAR_CONTACT" ? "/contact" : null,
        ipHash: online ? ipHash(n + 1) : null,
        idempotencyKey: plan.source === "PROGRAMARE_ONLINE" ? `demo-${String(n + 1).padStart(4, "0")}-2026` : null,
        assignedToId: plan.status === "NOU" ? null : assignee.id,
        patientId: plan.patient?.id ?? null,
        lostReason: plan.lostReason ?? null,
        contactedAt: plan.status === "NOU" ? null : new Date(createdAt.getTime() + 2 * 60 * MIN),
        convertedAt: plan.status === "PROGRAMAT" ? new Date(createdAt.getTime() + 3 * 60 * MIN) : null,
        createdAt,
      },
    });
    for (const a of plan.activities) {
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          type: a.type,
          body: a.body,
          authorId: a.type === "STATUS" && plan.source === "PROGRAMARE_ONLINE" && a.hoursAfter === 0 ? null : assignee.id,
          createdAt: new Date(createdAt.getTime() + a.hoursAfter * 60 * MIN),
        },
      });
    }
    if (plan.patient) {
      await tx.consent.create({
        data: {
          patientId: plan.patient.id,
          type: "GDPR_DATE_SANATATE",
          granted: true,
          method: "FORMULAR_ONLINE",
          textVersion: ctx.consentTextVersion,
          grantedAt: createdAt,
          ipHash: ipHash(n + 1),
          recordedById: assignee.id,
          notes: "Copiat din cererea online la conversie.",
        },
      });
    }
    leads.push({ id: lead.id, plan, createdAt });
  }
  summary.leads = leads.length;

  // ── 3. Appointments ──────────────────────────────────────────────────────
  const doctorBusy = new Occupancy();
  const cabinetBusy = new Occupancy();
  const patientBusy = new Occupancy();
  const sedationBusy = new Occupancy();
  const drafts: Draft[] = [];

  const shiftsOn = (dateISO: string) => ctx.shifts.filter((s) => s.weekday === isoWeekday(dateISO));
  const shiftsOf = (dateISO: string, doctorSlug: string, loc?: LocSlug) =>
    shiftsOn(dateISO).filter((s) => s.doctorSlug === doctorSlug && (!loc || s.loc === loc));

  const windows = (dateISO: string, shift: DemoContext["shifts"][number]): Interval[] => {
    let open: Interval[] = [[localToUtc(dateISO, shift.startMinute).getTime(), localToUtc(dateISO, shift.endMinute).getTime()]];
    for (const b of shift.breaks) {
      open = subtract(open, [localToUtc(dateISO, b.startMinute).getTime(), localToUtc(dateISO, b.endMinute).getTime()]);
    }
    for (const t of ctx.timeOff) {
      const applies =
        (t.doctorId === shift.doctorId && (t.locationId === null || t.locationId === shift.locationId)) ||
        (t.doctorId === null && t.locationId === shift.locationId);
      if (applies) open = subtract(open, [t.start, t.end]);
    }
    return open;
  };

  const startsFor = (dateISO: string, shift: DemoContext["shifts"][number], durationMin: number): number[] => {
    const out: number[] = [];
    for (const [a, b] of windows(dateISO, shift)) {
      for (let t = Math.ceil(a / GRID) * GRID; t + durationMin * MIN <= b; t += GRID) out.push(t);
    }
    return out;
  };

  const fits = (shift: DemoContext["shifts"][number], patient: DemoPatient | null, s: number, e: number, sedation: boolean) =>
    doctorBusy.free(shift.doctorId, s, e) &&
    (!shift.cabinetId || cabinetBusy.free(shift.cabinetId, s, e)) &&
    (!patient || patientBusy.free(patient.id, s, e)) &&
    (!sedation || sedationBusy.count(shift.locationId, s, e) < ctx.locations[shift.loc].sedationUnits);

  const reserve = (d: Draft) => {
    if (!BLOCKING.includes(d.status)) return;
    doctorBusy.add(d.doctorId, d.start, d.end);
    if (d.cabinetId) cabinetBusy.add(d.cabinetId, d.start, d.end);
    if (d.patient) patientBusy.add(d.patient.id, d.start, d.end);
    if (d.wantsSedation) sedationBusy.add(d.locationId, d.start, d.end);
  };

  const pickPatient = (loc: LocSlug, child: boolean, s: number, e: number): DemoPatient | null => {
    const pool = patients.filter((p) => p.child === child && p.createdAt.getTime() <= s && patientBusy.free(p.id, s, e));
    if (pool.length === 0) return null;
    const local = pool.filter((p) => p.loc === loc);
    return random.chance(0.85) && local.length > 0 ? random.pick(local) : random.pick(pool);
  };

  const comfortFor = (p: DemoPatient | null): { comfort: Comfort | null; comfortNote: string | null } => {
    if (!p?.comfort) return { comfort: null, comfortNote: null };
    if (p.index === MARIA) return { comfort: "FRICA", comfortNote: COMFORT_WORDS[0] };
    return { comfort: p.comfort, comfortNote: p.comfort === "FRICA" && random.chance(0.5) ? random.pick(COMFORT_WORDS) : null };
  };

  /** Places one appointment in the shift; returns null when nothing fits. */
  const place = (
    dateISO: string,
    shift: DemoContext["shifts"][number],
    opts: {
      serviceCode?: string;
      patient?: DemoPatient | null;
      status: AppointmentStatus;
      source?: AppointmentSource;
      leadId?: string | null;
      pickStart?: (starts: number[]) => number | undefined;
      noPatient?: boolean;
      label?: string;
      createdAt?: Date;
      comfort?: Comfort | null;
      comfortNote?: string | null;
      wantsSedation?: boolean;
      tooth?: number | null;
    },
  ): Draft | null => {
    let child = opts.patient ? opts.patient.child : false;
    if (!opts.patient && !opts.noPatient && PEDIATRIC_DOCTORS.has(shift.doctorSlug)) child = random.chance(0.15);
    const code =
      opts.serviceCode ??
      (child && shift.doctorSlug !== "victoria-ana-podar" ? random.weighted(CHILD_MIX) : random.weighted(SERVICE_MIX[shift.doctorSlug]));
    const service = svc(code);
    const starts = random.shuffle(startsFor(dateISO, shift, service.durationMinutes));
    const ordered = opts.pickStart ? [opts.pickStart(starts), ...starts].filter((v): v is number => v !== undefined) : starts;
    for (const s of ordered) {
      const e = s + service.durationMinutes * MIN;
      const patient = opts.noPatient ? null : opts.patient !== undefined ? opts.patient : pickPatient(shift.loc, child, s, e);
      if (!opts.noPatient && !patient) continue;
      const comfort = opts.comfort !== undefined ? { comfort: opts.comfort, comfortNote: opts.comfortNote ?? null } : comfortFor(patient);
      const wantsSedation =
        opts.wantsSedation ?? Boolean(patient && (patient.prefersSedation || (comfort.comfort === "FRICA" && random.chance(0.25))));
      const blocking = BLOCKING.includes(opts.status);
      if (blocking && !fits(shift, patient, s, e, wantsSedation)) continue;
      if (!blocking && !doctorBusy.free(shift.doctorId, s, e)) continue; // keep cancelled slots readable too
      const source: AppointmentSource =
        opts.source ?? random.weighted<AppointmentSource>([["TELEFON", 55], ["RECEPTIE", 30], ["ONLINE", 10], ["RECHEMARE", 5]]);
      const createdAt =
        opts.createdAt ?? new Date(Math.min(now.getTime() - 30 * MIN, s - random.int(1, 21) * DAY - random.int(0, 8) * 60 * MIN));
      const draft: Draft = {
        locationId: shift.locationId,
        loc: shift.loc,
        doctorId: shift.doctorId,
        doctorSlug: shift.doctorSlug,
        cabinetId: shift.cabinetId,
        patient,
        leadId: opts.leadId ?? null,
        serviceCode: code,
        reason: source === "ONLINE" ? (service.onlineLabel ?? service.name) : service.name,
        start: s,
        end: e,
        status: opts.status,
        source,
        comfort: comfort.comfort,
        comfortNote: comfort.comfortNote,
        wantsSedation,
        notes: null,
        createdAt,
        createdById: source === "ONLINE" ? null : receptieFor(shift.loc).id,
        tooth: opts.tooth ?? null,
        label: opts.label,
      };
      reserve(draft);
      drafts.push(draft);
      return draft;
    }
    return null;
  };

  /** First date at or after `fromISO` (searching up to `span` days) on which the doctor works at `loc`. */
  const findDay = (fromISO: string, doctorSlug: string, loc: LocSlug | undefined, direction: 1 | -1, span = 14) => {
    for (let k = 0; k <= span; k += 1) {
      const d = addDaysISO(fromISO, k * direction);
      const s = shiftsOf(d, doctorSlug, loc)[0];
      if (s && windows(d, s).length > 0) return { dateISO: d, shift: s };
    }
    return null;
  };

  /** The working day of the doctor at `loc` closest to `targetISO` (0, +1, −1, +2, …). */
  const findNearestDay = (targetISO: string, doctorSlug: string, loc: LocSlug, span = 7) => {
    for (let k = 0; k <= span * 2; k += 1) {
      const offset = k % 2 === 1 ? (k + 1) / 2 : -(k / 2);
      const d = addDaysISO(targetISO, offset);
      const s = shiftsOf(d, doctorSlug, loc)[0];
      if (s && windows(d, s).length > 0) return { dateISO: d, shift: s };
    }
    return null;
  };

  const maria = patients[MARIA];

  // a) Maria Suciu: implant 36 three weeks ago, abutment in about ten days (plan „Plan implant 36”).
  const implantDay = findDay(addDaysISO(today, -21), "mihail-dan-masca", "cristesti", -1);
  const bontDay = findDay(addDaysISO(today, 10), "mihail-dan-masca", "cristesti", 1);
  if (!implantDay || !bontDay) throw new Error("Nu există ture pentru programările demonstrative ale Mariei Suciu.");
  const mariaImplant = place(implantDay.dateISO, implantDay.shift, {
    serviceCode: "IMP-NEODENT", patient: maria, status: "FINALIZAT", source: "TELEFON", label: "maria-implant", wantsSedation: true, tooth: 36,
  });
  const mariaBont = place(bontDay.dateISO, bontDay.shift, {
    serviceCode: "IMP-BONT", patient: maria, status: "CONFIRMAT", source: "TELEFON", label: "maria-bont", wantsSedation: true, tooth: 36,
  });
  if (!mariaImplant || !mariaBont) throw new Error("Programările demonstrative ale Mariei Suciu nu au încăput în program.");

  // b) Hygiene visits about six months ago: the sources of the recalls due now.
  const recallOffsets = [-28, -24, -19, -15, -11, -7, -4, -1, 3, 9, -21, -12];
  const recallPatients = random
    .shuffle(patients.filter((p) => !p.child && p.index !== MARIA && p.createdAt.getTime() < now.getTime() - 220 * DAY))
    .slice(0, recallOffsets.length);
  const recallSources: { patient: DemoPatient; draft: Draft }[] = [];
  for (let r = 0; r < recallOffsets.length; r += 1) {
    const patient = recallPatients[r];
    const target = addMonthsISO(addDaysISO(today, recallOffsets[r]), -6);
    const doctorSlug = patient.loc === "cristesti" ? "andrei-marcoci" : "paul-bologa";
    const day = findNearestDay(target, doctorSlug, patient.loc);
    if (!day) continue;
    const d = place(day.dateISO, day.shift, { serviceCode: "CON-DETARTRAJ", patient, status: "FINALIZAT", label: "recall-source" });
    if (d) recallSources.push({ patient, draft: d });
  }

  // c) The past 60 days: about 260 visits; 85% done, 8% no-show, 7% cancelled.
  for (let k = 60; k >= 1; k -= 1) {
    const d = addDaysISO(today, -k);
    for (const shift of shiftsOn(d)) {
      const n = random.weighted([[0, 10], [1, 35], [2, 35], [3, 20]] as const);
      for (let j = 0; j < n; j += 1) {
        const status = random.weighted<AppointmentStatus>([["FINALIZAT", 85], ["NEPREZENTAT", 8], ["ANULAT", 7]]);
        place(d, shift, { status });
      }
    }
  }

  // d) Today: 8–12 per clinic across the doctors on shift, statuses by time of day.
  const todayShifts = shiftsOn(today);
  // Outside opening hours the demo "now" is staged at a working moment, so every status shows.
  const demoNowMinute = Math.min(Math.max(nowLocal.minute, 11 * 60), 17 * 60);
  const demoNow = localToUtc(today, demoNowMinute).getTime();
  const todayDrafts: Draft[] = [];
  for (const loc of ["cristesti", "ludus"] as const) {
    const locShifts = todayShifts.filter((s) => s.loc === loc);
    if (locShifts.length === 0) continue;
    const target = random.int(8, 12);
    let placed = 0;
    for (let attempt = 0; attempt < target * 6 && placed < target; attempt += 1) {
      const shift = locShifts[attempt % locShifts.length];
      const d = place(today, shift, {
        status: "PROGRAMAT",
        createdAt: new Date(now.getTime() - random.int(1, 15) * DAY),
      });
      if (d) {
        todayDrafts.push(d);
        placed += 1;
      }
    }
  }
  for (const loc of ["cristesti", "ludus"] as const) {
    const list = todayDrafts.filter((d) => d.loc === loc).sort((a, b) => a.start - b.start);
    let inTreatment = false;
    for (const d of list) {
      if (d.end <= demoNow) d.status = "FINALIZAT";
      else if (d.start <= demoNow) {
        d.status = inTreatment ? "SOSIT" : "IN_TRATAMENT";
        inTreatment = true;
      } else d.status = random.chance(0.6) ? "CONFIRMAT" : "PROGRAMAT";
    }
    const past = list.filter((d) => d.status === "FINALIZAT");
    if (past.length >= 2) past[random.int(0, past.length - 1)].status = "NEPREZENTAT";
    const future = list.filter((d) => d.start > demoNow);
    if (!list.some((d) => d.status === "SOSIT") && future.length > 0) future[0].status = "SOSIT"; // arrived early
    const cancellable = list.filter((d) => d.start > demoNow && d.status !== "SOSIT");
    if (cancellable.length >= 2) cancellable[cancellable.length - 1].status = "ANULAT";
    else if (past.length >= 3) past.find((d) => d.status === "FINALIZAT" && d !== past[0])!.status = "ANULAT";
  }

  // e) The next 14 days: about 120 visits, 60% confirmed, 10% booked online.
  for (let k = 1; k <= 14; k += 1) {
    const d = addDaysISO(today, k);
    for (const shift of shiftsOn(d)) {
      const n = random.weighted([[2, 20], [3, 40], [4, 30], [5, 10]] as const);
      for (let j = 0; j < n; j += 1) {
        const online = random.chance(0.1);
        place(d, shift, {
          status: random.chance(0.6) ? "CONFIRMAT" : "PROGRAMAT",
          source: online
            ? "ONLINE"
            : random.weighted<AppointmentSource>([["TELEFON", 60], ["RECEPTIE", 33], ["RECHEMARE", 7]]),
          createdAt: new Date(now.getTime() - random.int(1, 20) * DAY - random.int(0, 10) * 60 * MIN),
        });
      }
    }
  }

  // f) Online requests: tentative appointments without a patient (NOU), and converted ones (PROGRAMAT).
  for (const lead of leads) {
    const { plan } = lead;
    if (plan.source !== "PROGRAMARE_ONLINE" && !(plan.status === "PROGRAMAT")) continue;
    if (plan.status !== "NOU" && plan.status !== "PROGRAMAT") continue;
    const code = plan.serviceCode ?? "CON-CONSULT";
    const doctorSlug = plan.loc === "cristesti" ? "andrei-marcoci" : "paul-bologa";
    const day = findDay(addDaysISO(today, plan.status === "NOU" ? 2 : 3), doctorSlug, plan.loc, 1, 10);
    if (!day) continue;
    place(day.dateISO, day.shift, {
      serviceCode: code,
      patient: plan.status === "NOU" ? null : (plan.patient ?? null),
      noPatient: plan.status === "NOU",
      status: plan.status === "NOU" ? "PROGRAMAT" : "CONFIRMAT",
      source: plan.source === "PROGRAMARE_ONLINE" ? "ONLINE" : "TELEFON",
      leadId: lead.id,
      createdAt: lead.createdAt,
      comfort: plan.comfort ?? null,
      comfortNote: plan.comfortNote ?? null,
      wantsSedation: plan.wantsSedation ?? false,
      label: "lead",
    });
  }

  // Status timestamps and the reception note for tentative online bookings.
  const confirmChannels: readonly (readonly [ConfirmationChannel, number])[] = [["TELEFON", 70], ["SMS", 15], ["LINK", 10], ["RECEPTIE", 5]];
  drafts.sort((a, b) => a.start - b.start);
  const appointmentData = (d: Draft): Prisma.AppointmentUncheckedCreateInput => {
    const started = d.start;
    const isPast = d.end <= now.getTime() || d.status === "FINALIZAT" || d.status === "NEPREZENTAT";
    const confirmedAt =
      d.status !== "PROGRAMAT" && d.status !== "ANULAT" && d.status !== "NEPREZENTAT"
        ? new Date(Math.min(d.createdAt.getTime() + random.int(2, 30) * 60 * MIN, d.start - 60 * MIN, now.getTime() - MIN))
        : null;
    const arrivedAt = ["SOSIT", "IN_TRATAMENT", "FINALIZAT"].includes(d.status) ? new Date(started - random.int(0, 10) * MIN) : null;
    return {
      locationId: d.locationId,
      doctorId: d.doctorId,
      cabinetId: d.cabinetId,
      patientId: d.patient?.id ?? null,
      leadId: d.leadId,
      serviceId: svc(d.serviceCode).id,
      reason: d.reason,
      startsAt: new Date(d.start),
      endsAt: new Date(d.end),
      status: d.status,
      source: d.source,
      comfort: d.comfort,
      comfortNote: d.comfortNote,
      wantsSedation: d.wantsSedation,
      notes: d.leadId && !d.patient ? "Programare online: de confirmat telefonic." : d.notes,
      confirmedAt,
      confirmedVia: confirmedAt ? random.weighted(confirmChannels) : null,
      arrivedAt,
      startedAt: d.status === "IN_TRATAMENT" || d.status === "FINALIZAT" ? new Date(started + random.int(0, 5) * MIN) : null,
      completedAt: d.status === "FINALIZAT" ? new Date(d.end) : null,
      cancelledAt:
        d.status === "ANULAT"
          ? new Date(
              Math.max(
                d.createdAt.getTime() + 10 * MIN,
                Math.min(d.start - random.int(3, 48) * 60 * MIN, now.getTime() - MIN),
              ),
            )
          : null,
      cancelledBy: d.status === "ANULAT" ? (random.chance(0.8) ? "PACIENT" : "CLINICA") : null,
      cancelReason: d.status === "ANULAT" ? random.pick(["A anunțat telefonic că nu poate ajunge.", "Reprogramare la cererea pacientului.", "Medicul a avut o urgență."]) : null,
      noShowAt: d.status === "NEPREZENTAT" ? new Date(d.start + 15 * MIN) : null,
      reminderSentAt:
        isPast && d.patient && d.createdAt.getTime() <= d.start - 6 * 60 * MIN && d.status !== "ANULAT" ? new Date(d.start - 24 * 60 * MIN) : null,
      tokenVersion: d.status === "ANULAT" ? 1 : 0,
      createdById: d.createdById,
      updatedById: d.createdById,
      createdAt: d.createdAt,
    };
  };

  assertNoConflicts(drafts, ctx);
  for (const d of drafts) {
    const row = await tx.appointment.create({ data: appointmentData(d), select: { id: true } });
    d.id = row.id;
  }
  summary.appointments = drafts.length;
  summary.appointmentsPast = drafts.filter((d) => d.end <= localToUtc(today, 0).getTime()).length;
  summary.appointmentsToday = todayDrafts.length;
  summary.appointmentsUpcoming = drafts.filter((d) => d.start >= localToUtc(addDaysISO(today, 1), 0).getTime()).length;

  // ── 4. Treatment plans ───────────────────────────────────────────────────
  const plannedItemIds = new Map<string, string>(); // appointment id → plan item id
  type ItemPlan = { code: string | null; description?: string; tooth?: number; qty?: number; status: PlanItemStatus; phase: number; appointment?: Draft; price?: number };
  const createPlan = async (
    patient: DemoPatient,
    doctorSlug: string,
    title: string,
    status: PlanStatus,
    items: ItemPlan[],
    daysAgo: number,
    discount = 0,
  ) => {
    const createdAt = new Date(now.getTime() - daysAgo * DAY);
    const presented = status !== "CIORNA";
    const accepted = ["ACCEPTAT", "IN_CURS", "FINALIZAT"].includes(status);
    const plan = await tx.treatmentPlan.create({
      data: {
        patientId: patient.id,
        doctorId: doctorBySlug[doctorSlug].id,
        title,
        status,
        discount,
        notes: status === "RESPINS" ? "Pacientul amână tratamentul din motive financiare." : null,
        presentedAt: presented ? new Date(createdAt.getTime() + DAY) : null,
        acceptedAt: accepted ? new Date(createdAt.getTime() + 2 * DAY) : null,
        createdById: doctorBySlug[doctorSlug].userId,
        createdAt,
      },
    });
    let order = 0;
    for (const item of items) {
      const service = item.code ? svc(item.code) : null;
      const row = await tx.treatmentPlanItem.create({
        data: {
          planId: plan.id,
          serviceId: service?.id ?? null,
          tooth: item.tooth ?? null,
          description: item.description ?? service?.name ?? "",
          phase: item.phase,
          quantity: item.qty ?? 1,
          unitPrice: item.price ?? service?.priceMin ?? 0,
          status: item.status,
          appointmentId: item.appointment?.id ?? null,
          performedAt: item.status === "EFECTUAT" ? (item.appointment ? new Date(item.appointment.end) : createdAt) : null,
          performedByDoctorId: item.status === "EFECTUAT" ? doctorBySlug[doctorSlug].id : null,
          sortOrder: order++,
          createdAt,
        },
      });
      if (item.appointment?.id) plannedItemIds.set(item.appointment.id, row.id);
    }
    return plan;
  };

  await createPlan(
    maria,
    "mihail-dan-masca",
    "Plan implant 36",
    "IN_CURS",
    [
      { code: null, description: "Radiografie panoramică", status: "EFECTUAT", phase: 1, price: 0 },
      { code: "IMP-NEODENT", tooth: 36, status: "EFECTUAT", phase: 1, appointment: mariaImplant },
      { code: "IMP-BONT", tooth: 36, status: "PROGRAMAT", phase: 2, appointment: mariaBont },
      { code: "PR-ZR-IMPLANT", tooth: 36, status: "ACCEPTAT", phase: 3 },
      { code: "CON-DETARTRAJ", status: "PROPUS", phase: 3 },
    ],
    30,
  );
  const others = random.shuffle(patients.filter((p) => !p.child && p.index !== MARIA));
  await createPlan(others[0], "paul-bologa", "Plan de tratament", "CIORNA", [
    { code: "SG-OBT-COMPOZIT", tooth: 25, status: "PROPUS", phase: 1 },
    { code: "SG-ENDO-MONO", tooth: 12, status: "PROPUS", phase: 1 },
  ], 3);
  await createPlan(others[1], "andrei-marcoci", "Igienizare și obturații estetice", "PREZENTAT", [
    { code: "CON-DETARTRAJ", qty: 2, status: "PROPUS", phase: 1 },
    { code: "SG-OBT-ESTETICA", tooth: 11, status: "PROPUS", phase: 2 },
    { code: "SG-OBT-ESTETICA", tooth: 21, status: "PROPUS", phase: 2 },
  ], 8);
  await createPlan(others[2], "mihail-dan-masca", "Coroane zirconiu 14, 15", "ACCEPTAT", [
    { code: "PR-ZR", tooth: 14, status: "ACCEPTAT", phase: 1 },
    { code: "PR-ZR", tooth: 15, status: "ACCEPTAT", phase: 1 },
  ], 12, 20000);
  await createPlan(orthoPatients[0], "victoria-ana-podar", "Aparat fix bimaxilar", "IN_CURS", [
    { code: "ORT-CONSULT", status: "EFECTUAT", phase: 1 },
    { code: "ORT-METALIC", qty: 2, status: "EFECTUAT", phase: 1 },
    ...Array.from({ length: 6 }, (_, k): ItemPlan => ({ code: "ORT-CONTROL", status: k < 3 ? "EFECTUAT" : "PROPUS", phase: 2 })),
    { code: "ORT-INDEPARTARE", status: "PROPUS", phase: 3 },
  ], 120);
  await createPlan(others[3], "ana-maria-fertea", "Extracție molar de minte 38", "FINALIZAT", [
    { code: "CH-EXT-MINTE", tooth: 38, status: "EFECTUAT", phase: 1 },
    { code: "CH-SUTURA", status: "EFECTUAT", phase: 1 },
  ], 45);
  await createPlan(others[4], "mihail-dan-masca", "Plan implant 46", "RESPINS", [
    { code: "IMP-NEODENT", tooth: 46, status: "PROPUS", phase: 1 },
    { code: "IMP-BONT", tooth: 46, status: "PROPUS", phase: 2 },
    { code: "PR-MC-IMPLANT", tooth: 46, status: "PROPUS", phase: 3 },
  ], 60);
  await createPlan(others[5], "paul-bologa", "Proteză scheletată", "ANULAT", [{ code: "PR-SCHELETATA", status: "ANULAT", phase: 1 }], 90);
  summary.treatmentPlans = 8;

  // ── 5. Odontograms ───────────────────────────────────────────────────────
  let conditionCount = 0;
  const addCondition = async (
    p: DemoPatient,
    tooth: number,
    condition: ToothConditionType,
    daysAgo: number,
    extra: { surfaces?: string; resolvedDaysAgo?: number; notes?: string } = {},
  ) => {
    await tx.toothCondition.create({
      data: {
        patientId: p.id,
        tooth,
        condition,
        surfaces: extra.surfaces ?? null,
        notes: extra.notes ?? null,
        recordedAt: new Date(now.getTime() - daysAgo * DAY),
        recordedById: doctorBySlug[p.primaryDoctorSlug].userId,
        resolvedAt: extra.resolvedDaysAgo !== undefined ? new Date(now.getTime() - extra.resolvedDaysAgo * DAY) : null,
      },
    });
    conditionCount += 1;
  };
  const implantDaysAgo = Math.round((now.getTime() - mariaImplant.start) / DAY);
  await addCondition(maria, 36, "EXTRAS", 200, { resolvedDaysAgo: implantDaysAgo });
  await addCondition(maria, 36, "IMPLANT", implantDaysAgo, { notes: "Implant Neodent; vindecare 3–6 luni." });
  await addCondition(maria, 26, "OBTURATIE", 400, { surfaces: "MO" });
  await addCondition(maria, 16, "COROANA", 700);
  await addCondition(maria, 47, "CARIE", 30, { surfaces: "O" });

  const odontoPatients = random.shuffle(patients.filter((p) => p.index !== MARIA)).slice(0, 14);
  await addCondition(odontoPatients[0], 46, "IMPLANT", 500, { notes: "Implant inserat în altă clinică." });
  for (let k = 0; k < odontoPatients.length; k += 1) {
    const p = odontoPatients[k];
    const n = random.int(3, 8) - (k === 0 ? 1 : 0);
    const used = new Set<number>(k === 0 ? [46] : []);
    for (let j = 0; j < n; j += 1) {
      const tooth = p.child ? random.pick([...CHILD_TEETH, 16, 26, 36, 46]) : random.pick([...UPPER_TEETH, ...LOWER_TEETH]);
      if (used.has(tooth)) continue;
      used.add(tooth);
      const condition: ToothConditionType = p.child
        ? random.weighted<ToothConditionType>([["CARIE", 3], ["OBTURATIE", 2], ["SIGILARE", 3]])
        : random.weighted<ToothConditionType>([
            ["CARIE", 4], ["OBTURATIE", 5], ["ENDODONTIE", 2], ["COROANA", MOLARS.includes(tooth) ? 2 : 1], ["EXTRAS", 1], ["FATETA", 0.5],
          ]);
      const surfaces = condition === "CARIE" || condition === "OBTURATIE" ? random.pick(["O", "M", "D", "MO", "DO", "MOD", "V"]) : undefined;
      await addCondition(p, tooth, condition, random.int(10, 600), { surfaces });
    }
  }
  summary.toothConditions = conditionCount;

  // ── 6. Invoices and payments ─────────────────────────────────────────────
  let invoiceNo = 0;
  let receiptNo = 0;
  const debtors = new Set(random.shuffle(patients.filter((p) => !p.child)).slice(0, 10).map((p) => p.id));
  const billable = drafts.filter((d) => d.status === "FINALIZAT" && d.patient && svc(d.serviceCode).priceMin !== null && d.end <= now.getTime() + DAY);
  const lastInvoiceOf = new Map<string, Draft>();
  for (const d of billable) lastInvoiceOf.set(d.patient!.id, d);
  let invoices = 0;
  let payments = 0;
  let cancelledDone = false;
  const sedationService = svc("INH-ORA");

  for (let k = 0; k < billable.length; k += 1) {
    const d = billable[k];
    const p = d.patient!;
    const service = svc(d.serviceCode);
    const unitPrice = service.priceMax !== null && random.chance(0.5) ? service.priceMax : service.priceMin!;
    const qty = service.unit === "ARCADA" && random.chance(0.35) ? 2 : 1;
    const lines: Prisma.InvoiceItemUncheckedCreateWithoutInvoiceInput[] = [
      {
        serviceId: service.id,
        treatmentPlanItemId: d.id ? (plannedItemIds.get(d.id) ?? null) : null,
        doctorId: d.doctorId,
        description: service.name,
        tooth: d.tooth,
        quantity: qty,
        unitPrice,
        discount: 0,
        total: qty * unitPrice,
        sortOrder: 0,
      },
    ];
    if (d.wantsSedation) {
      lines.push({
        serviceId: sedationService.id,
        doctorId: d.doctorId,
        description: sedationService.name,
        quantity: 1,
        unitPrice: sedationService.priceMin!,
        discount: 0,
        total: sedationService.priceMin!,
        sortOrder: 1,
      });
    }
    if (random.chance(0.05)) {
      lines[0].discount = Math.round((lines[0].total as number) * 0.1);
      lines[0].total = (lines[0].total as number) - (lines[0].discount as number);
    }
    const subtotal = lines.reduce((sum, l) => sum + (l.quantity ?? 1) * l.unitPrice, 0);
    const discountTotal = lines.reduce((sum, l) => sum + (l.discount ?? 0), 0);
    const total = subtotal - discountTotal;
    const issuedAt = new Date(Math.min(d.end + 5 * MIN, now.getTime() - MIN));
    const cashier = receptieFor(d.loc);
    const buyer = {
      buyerName: `${p.firstName} ${p.lastName}`,
      buyerAddress: `${p.street}, ${p.city}, jud. Mureș`,
      buyerEmail: p.email,
    };

    if (!cancelledDone && k === 4) {
      // One invoice issued to the wrong patient and cancelled; the corrected one follows.
      invoiceNo += 1;
      await tx.invoice.create({
        data: {
          series: ctx.invoiceSeries,
          number: invoiceNo,
          patientId: p.id,
          locationId: d.locationId,
          status: "ANULATA",
          issuedAt,
          subtotal,
          discountTotal,
          total,
          amountPaid: 0,
          ...buyer,
          buyerName: "Pacient greșit",
          notes: "Emisă din greșeală pe alt nume.",
          createdById: cashier.id,
          cancelledAt: new Date(issuedAt.getTime() + 10 * MIN),
          cancelledById: ctx.users.admin.id,
          cancelReason: "Datele cumpărătorului au fost greșite; s-a emis o factură nouă.",
          items: { create: lines.map((l) => ({ ...l, treatmentPlanItemId: null })) },
        },
      });
      invoices += 1;
      cancelledDone = true;
    }

    invoiceNo += 1;
    const isDebt = debtors.has(p.id) && lastInvoiceOf.get(p.id) === d;
    const paid = isDebt ? (random.chance(0.3) ? 0 : round10Lei(total / 2)) : total;
    const invoice = await tx.invoice.create({
      data: {
        series: ctx.invoiceSeries,
        number: invoiceNo,
        patientId: p.id,
        locationId: d.locationId,
        status: "EMISA",
        issuedAt,
        subtotal,
        discountTotal,
        total,
        amountPaid: paid,
        ...buyer,
        createdById: cashier.id,
        items: { create: lines },
      },
      select: { id: true },
    });
    invoices += 1;
    if (paid > 0) {
      const method = random.weighted<PaymentMethod>([["CARD", 70], ["NUMERAR", 25], ["TRANSFER", 5]]);
      if (method === "NUMERAR") receiptNo += 1;
      await tx.payment.create({
        data: {
          patientId: p.id,
          invoiceId: invoice.id,
          locationId: d.locationId,
          amount: paid,
          method,
          paidAt: new Date(issuedAt.getTime() + 2 * MIN),
          receiptSeries: method === "NUMERAR" ? ctx.receiptSeries : null,
          receiptNumber: method === "NUMERAR" ? receiptNo : null,
          reference: method === "CARD" ? `POS-${String(100000 + invoiceNo)}` : method === "TRANSFER" ? `OP ${invoiceNo}` : null,
          receivedById: cashier.id,
          createdAt: new Date(issuedAt.getTime() + 2 * MIN),
        },
      });
      payments += 1;
    }
  }
  if (invoiceNo > 0) {
    await tx.numberSequence.upsert({
      where: { key: `FACTURA:${ctx.invoiceSeries}` },
      create: { key: `FACTURA:${ctx.invoiceSeries}`, value: invoiceNo },
      update: { value: invoiceNo },
    });
  }
  if (receiptNo > 0) {
    await tx.numberSequence.upsert({
      where: { key: `CHITANTA:${ctx.receiptSeries}` },
      create: { key: `CHITANTA:${ctx.receiptSeries}`, value: receiptNo },
      update: { value: receiptNo },
    });
  }
  summary.invoices = invoices;
  summary.payments = payments;

  // ── 7. Recalls ───────────────────────────────────────────────────────────
  let recalls = 0;
  for (let r = 0; r < recallSources.length; r += 1) {
    const { patient, draft } = recallSources[r];
    const completedISO = utcToLocal(new Date(draft.end)).dateISO;
    const dueISO = addMonthsISO(completedISO, 6);
    const contacted = r >= 10;
    await tx.recall.create({
      data: {
        patientId: patient.id,
        locationId: draft.locationId,
        doctorId: draft.doctorId,
        reason: "Control la 6 luni după igienizare",
        dueDate: localToUtc(dueISO, 0),
        status: contacted ? "CONTACTAT" : "DE_FACUT",
        attempts: contacted ? r - 9 : 0,
        lastAttemptAt: contacted ? new Date(now.getTime() - random.int(1, 4) * DAY) : null,
        outcomeNote: contacted ? (r === 10 ? "Nu a răspuns; revenim săptămâna aceasta." : "Revine cu un telefon după ce își vede programul.") : null,
        sourceAppointmentId: draft.id ?? null,
        createdById: null,
        createdAt: new Date(draft.end),
      },
    });
    recalls += 1;
  }
  summary.recalls = recalls;

  // ── 8. Message log ───────────────────────────────────────────────────────
  let messages = 0;
  const linkFor = (d: Draft) =>
    `${ctx.appUrl}/p/${signAppointmentTokenWithKey(ctx.keys.link, { id: d.id!, tokenVersion: 0, startsAt: new Date(d.start) })}`;
  const reminded = drafts
    .filter((d) => d.patient?.smsOptIn && d.patient.phone && d.end <= now.getTime() && d.end > now.getTime() - 10 * DAY && d.status !== "ANULAT")
    .slice(-12);
  for (const d of reminded) {
    const at = new Date(d.start - 24 * 60 * MIN);
    const body = gsm7(
      `Dental Arena: vă reamintim programarea de ${formatDateRo(new Date(d.start))}, ora ${formatTime(new Date(d.start))}, la ${ctx.locations[d.loc].name}. Confirmați sau anulați: ${linkFor(d)}`,
    );
    await tx.messageLog.create({
      data: { channel: "SMS", kind: "REMINDER", status: "SIMULAT", to: d.patient!.phone!, body, provider: "console", patientId: d.patient!.id, appointmentId: d.id!, createdAt: at },
    });
    messages += 1;
  }
  const emailed = drafts.filter((d) => d.source === "ONLINE" && d.patient?.email).slice(0, 6);
  for (const d of emailed) {
    const loc = ctx.locations[d.loc];
    const date = formatDateRo(new Date(d.start));
    const time = formatTime(new Date(d.start));
    await tx.messageLog.create({
      data: {
        channel: "EMAIL",
        kind: "CONFIRMARE_PROGRAMARE",
        status: "SIMULAT",
        to: d.patient!.email!,
        subject: `Am primit cererea de programare: ${date}, ora ${time}`,
        body: `Bună ziua, ${d.patient!.firstName},\n\nAm primit cererea dumneavoastră de programare pentru ${date}, ora ${time}, la ${loc.name}, ${loc.street}, ${loc.city}. Vă sunăm de la ${loc.phone} ca să confirmăm.\n\nPentru a confirma sau a anula: ${linkFor(d)}\n\nEchipa Dental Arena`,
        provider: "console",
        patientId: d.patient!.id,
        appointmentId: d.id!,
        createdAt: d.createdAt,
      },
    });
    messages += 1;
  }
  const newLead = leads[0];
  await tx.messageLog.create({
    data: {
      channel: "EMAIL",
      kind: "NOTIFICARE_CLINICA",
      status: "SIMULAT",
      to: "office@dentalarena.ro",
      subject: `Cerere nouă din site: ${newLead.plan.name}, ${svc(newLead.plan.serviceCode ?? "CON-CONSULT").onlineLabel ?? "consultație"}`,
      body: `O cerere nouă de programare online așteaptă confirmarea: ${ctx.appUrl}/crm/cereri/${newLead.id}`,
      provider: "console",
      leadId: newLead.id,
      createdAt: newLead.createdAt,
    },
  });
  messages += 1;
  const failed = drafts.find((d) => d.patient?.smsOptIn && d.patient.phone && d.start > now.getTime() && d.start < now.getTime() + 2 * DAY);
  if (failed) {
    await tx.messageLog.create({
      data: {
        channel: "SMS",
        kind: "REMINDER",
        status: "EROARE",
        to: failed.patient!.phone!,
        body: gsm7(`Dental Arena: vă reamintim programarea de ${formatDateRo(new Date(failed.start))}, ora ${formatTime(new Date(failed.start))}.`),
        provider: "console",
        error: "Furnizorul SMS nu a răspuns (timeout). Se reîncearcă la următoarea rulare.",
        patientId: failed.patient!.id,
        appointmentId: failed.id!,
        createdAt: new Date(now.getTime() - 2 * 60 * MIN),
      },
    });
    messages += 1;
  }
  summary.messages = messages;

  // ── 9. Audit trail ───────────────────────────────────────────────────────
  const staff = [
    { id: ctx.users.admin.id, name: ctx.users.admin.name, role: "ADMIN" as const },
    { id: ctx.users.receptie.cristesti.id, name: ctx.users.receptie.cristesti.name, role: "RECEPTIE" as const },
    { id: ctx.users.receptie.ludus.id, name: ctx.users.receptie.ludus.name, role: "RECEPTIE" as const },
    ...Object.values(doctorBySlug).map((doc) => ({ id: doc.userId, name: doc.publicName, role: "MEDIC" as const })),
  ];
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  const auditAt = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 60 * MIN);
  staff.forEach((s, k) =>
    auditRows.push({ at: auditAt(60 - k * 6), actorId: s.id, actorName: s.name, actorRole: s.role, action: "auth.login", entityType: "User", entityId: s.id, ipHash: ipHash(50 + k) }),
  );
  auditRows.push({ at: auditAt(30), action: "auth.failed", entityType: "User", ipHash: ipHash(99), metadata: JSON.stringify({ reason: "email-necunoscut" }) });
  auditRows.push({ at: auditAt(29), action: "auth.failed", entityType: "User", entityId: ctx.users.receptie.ludus.id, ipHash: ipHash(52), metadata: JSON.stringify({ reason: "parola-gresita" }) });
  const viewed = random.shuffle(patients).slice(0, 8);
  viewed.forEach((p, k) => {
    const s = staff[1 + (k % (staff.length - 1))];
    auditRows.push({ at: auditAt(20 - k), actorId: s.id, actorName: s.name, actorRole: s.role, action: "patient.view", entityType: "Patient", entityId: p.id, patientId: p.id });
  });
  const cnpPatient = patients.find((p) => cnpPatients.has(p.index) && p.index !== MARIA)!;
  auditRows.push({ at: auditAt(9), actorId: staff[1].id, actorName: staff[1].name, actorRole: "RECEPTIE", action: "patient.cnp.reveal", entityType: "Patient", entityId: cnpPatient.id, patientId: cnpPatient.id });
  auditRows.push({ at: auditAt(8), actorId: staff[0].id, actorName: staff[0].name, actorRole: "ADMIN", action: "patient.export", entityType: "Patient", entityId: cnpPatient.id, patientId: cnpPatient.id, metadata: JSON.stringify({ format: "json" }) });
  for (const d of todayDrafts.filter((x) => x.status !== "PROGRAMAT").slice(0, 4)) {
    auditRows.push({
      at: new Date(Math.min(d.start, now.getTime() - MIN)),
      actorId: receptieFor(d.loc).id,
      actorName: receptieFor(d.loc).name,
      actorRole: "RECEPTIE",
      action: "appointment.status",
      entityType: "Appointment",
      entityId: d.id,
      patientId: d.patient?.id ?? null,
      metadata: JSON.stringify({ from: "CONFIRMAT", to: d.status }),
    });
  }
  auditRows.push({ at: auditAt(26), actorId: staff[1].id, actorName: staff[1].name, actorRole: "RECEPTIE", action: "invoice.create", entityType: "Invoice", metadata: JSON.stringify({ fields: ["items", "total"] }) });
  auditRows.push({ at: auditAt(25), actorId: staff[1].id, actorName: staff[1].name, actorRole: "RECEPTIE", action: "payment.create", entityType: "Payment", metadata: JSON.stringify({ method: "CARD" }) });
  auditRows.push({ at: auditAt(24), actorId: staff[2].id, actorName: staff[2].name, actorRole: "RECEPTIE", action: "invoice.create", entityType: "Invoice", metadata: JSON.stringify({ fields: ["items", "total"] }) });
  auditRows.push({ at: auditAt(23), actorId: staff[2].id, actorName: staff[2].name, actorRole: "RECEPTIE", action: "payment.create", entityType: "Payment", metadata: JSON.stringify({ method: "NUMERAR" }) });
  auditRows.push({ at: auditAt(100), actorId: staff[0].id, actorName: staff[0].name, actorRole: "ADMIN", action: "invoice.cancel", entityType: "Invoice", metadata: JSON.stringify({ fields: ["status", "cancelReason"] }) });
  auditRows.push({ at: auditAt(200), actorId: staff[0].id, actorName: staff[0].name, actorRole: "ADMIN", action: "settings.update", entityType: "Setting", entityId: "booking", metadata: JSON.stringify({ key: "booking", fields: ["minLeadMinutes"] }) });
  auditRows.push({ at: auditAt(5), actorId: staff[4].id, actorName: staff[4].name, actorRole: "MEDIC", action: "plan.update", entityType: "TreatmentPlan", patientId: maria.id, metadata: JSON.stringify({ fields: ["items"] }) });
  await tx.auditLog.createMany({ data: auditRows });
  summary.auditLog = auditRows.length;

  // ── 10. GDPR request and notes ───────────────────────────────────────────
  const requester = patients.find((p) => !p.child && p.email && p.index !== MARIA)!;
  const receivedAt = new Date(now.getTime() - 18 * DAY);
  await tx.dataRequest.create({
    data: {
      patientId: requester.id,
      type: "ACCES",
      status: "PRIMITA",
      requesterName: `${requester.firstName} ${requester.lastName}`,
      contact: requester.email,
      details: "Solicită o copie a datelor personale și a fișei medicale, trimisă pe e-mail.",
      receivedAt,
      dueAt: new Date(receivedAt.getTime() + 30 * DAY),
    },
  });
  summary.dataRequests = 1;

  await tx.patientNote.create({
    data: {
      patientId: maria.id,
      appointmentId: mariaImplant.id ?? null,
      authorId: doctorBySlug["mihail-dan-masca"].userId,
      body: "Implant 36 inserat fără complicații. Vindecare 3–6 luni, apoi bont și coroană de zirconiu.",
      clinical: true,
      pinned: true,
      createdAt: new Date(mariaImplant.end),
    },
  });
  await tx.patientNote.create({
    data: {
      patientId: maria.id,
      authorId: ctx.users.receptie.cristesti.id,
      body: "Preferă să fie sunată după ora 17.",
      clinical: false,
      createdAt: new Date(now.getTime() - 40 * DAY),
    },
  });
  summary.patientNotes = 2;

  return summary;
}

/** The seed's own `findConflicts`: blocking appointments never overlap per doctor or cabinet and sit inside shifts. */
function assertNoConflicts(drafts: Draft[], ctx: DemoContext) {
  const problems: string[] = [];
  const blocking = drafts.filter((d) => BLOCKING.includes(d.status));
  const overlap = (a: Draft, b: Draft) => a.start < b.end && b.start < a.end;
  for (let i = 0; i < blocking.length; i += 1) {
    for (let j = i + 1; j < blocking.length; j += 1) {
      const a = blocking[i];
      const b = blocking[j];
      if (!overlap(a, b)) continue;
      if (a.doctorId === b.doctorId) problems.push(`medic suprapus ${new Date(a.start).toISOString()}`);
      if (a.cabinetId && a.cabinetId === b.cabinetId) problems.push(`cabinet suprapus ${new Date(a.start).toISOString()}`);
      if (a.patient && b.patient && a.patient.id === b.patient.id) problems.push(`pacient suprapus ${new Date(a.start).toISOString()}`);
    }
  }
  for (const d of drafts) {
    const s = utcToLocal(new Date(d.start));
    const e = utcToLocal(new Date(d.end));
    const minutes = (d.end - d.start) / MIN;
    if (!(d.start < d.end) || minutes < 5 || minutes > 480) problems.push(`durată invalidă ${minutes}`);
    if (s.minute % 5 !== 0 || e.minute % 5 !== 0) problems.push("în afara grilei de 5 minute");
    if (s.dateISO !== e.dateISO && e.minute !== 0) problems.push("programare peste miezul nopții");
    const inShift = ctx.shifts.some(
      (sh) =>
        sh.doctorId === d.doctorId &&
        sh.locationId === d.locationId &&
        sh.weekday === s.weekday &&
        s.minute >= sh.startMinute &&
        s.minute + minutes <= sh.endMinute &&
        !sh.breaks.some((b) => s.minute < b.endMinute && b.startMinute < s.minute + minutes),
    );
    if (!inShift) problems.push(`în afara turei ${s.dateISO} ${s.minute}`);
    if (BLOCKING.includes(d.status)) {
      const off = ctx.timeOff.some(
        (t) =>
          ((t.doctorId === d.doctorId && (t.locationId === null || t.locationId === d.locationId)) ||
            (t.doctorId === null && t.locationId === d.locationId)) &&
          d.start < t.end &&
          t.start < d.end,
      );
      if (off) problems.push(`în timpul unei absențe ${s.dateISO}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Programările demonstrative au conflicte (${problems.length}): ${problems.slice(0, 5).join("; ")}`);
  }
}
