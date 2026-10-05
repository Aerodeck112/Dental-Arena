import type { PriceUnit } from "../../src/generated/prisma/enums";

/**
 * The catalog (docs/architecture.md §10.3): the 10 public service categories and every price on
 * the current site (research/content.json → services[*] price lists), with the diacritics
 * restored. Prices here are in lei; the seed stores bani. Durations are demo estimates for the
 * clinic to confirm.
 */

export type SeedCategory = { slug: string; name: string; summary: string; sortOrder: number };

/** Summaries are the teasers of the current site (general.serviceList), verbatim. */
export const CATEGORIES: readonly SeedCategory[] = [
  {
    slug: "consultatie-profilaxie",
    name: "Consultație și profilaxie",
    summary: "Este foarte important să vă examinați periodic dantura, pentru a păstra un zâmbet sănătos pentru mult timp.",
    sortOrder: 1,
  },
  {
    slug: "stomatologie-generala",
    name: "Stomatologie generală",
    summary: "Planuri de tratament personalizate în funcție de cerințele și nevoile pacientului.",
    sortOrder: 2,
  },
  {
    slug: "inhalosedare",
    name: "Inhalosedare",
    summary: "Pacientul este relaxat și cooperant în timpul anesteziei prin inhalosedare.",
    sortOrder: 3,
  },
  {
    slug: "implantologie",
    name: "Implantologie",
    summary: "Medici pregătiți pentru cele mai complexe cazuri de implantologie și chirurgie dentară.",
    sortOrder: 4,
  },
  {
    slug: "chirurgie-dento-alveolara",
    name: "Chirurgie dento-alveolară",
    summary:
      "Medicii noștri sunt pregătiți pentru cele mai complexe cazuri de chirurgie dentară, atât la adulți, cât și la copii: extracții laborioase, rezecții apicale, chistectomii dentare și odontectomii.",
    sortOrder: 5,
  },
  {
    slug: "protetica-dentara",
    name: "Protetică dentară",
    summary:
      "Folosim concepte noi în medicina dentară. Planificarea, designul și realizarea lucrărilor dentare au la bază un sistem computerizat de cea mai mare precizie.",
    sortOrder: 6,
  },
  {
    slug: "pedodontie",
    name: "Pedodonție",
    summary: "Stomatologie pentru copii, care se întorc de fiecare dată cu plăcere și fără frică.",
    sortOrder: 7,
  },
  {
    slug: "ortodontie",
    name: "Ortodonție",
    summary:
      "Problemele de poziție ale dinților afectează masticația și oferă un aspect neplăcut zâmbetului. Pot fi corectate cu ajutorul aparatelor dentare, care sunt de mai multe tipuri – fixe, mobile, vizibile (cu brackeți metalici), invizibile (cu brackeți ceramici).",
    sortOrder: 8,
  },
  {
    slug: "parodontologie",
    name: "Parodontologie",
    summary:
      "Boala parodontală sau parodontoza este cauzată în principal de placa bacteriană. În timp, dacă este lăsată netratată, duce la pierderea dinților.",
    sortOrder: 9,
  },
  {
    slug: "estetica-dentara",
    name: "Estetică dentară",
    summary:
      "Aspectul zâmbetului influențează viața de zi cu zi mai mult decât ne-am dori. De aceea, există metode de înfrumusețare după înlăturarea problemelor dentare.",
    sortOrder: 10,
  },
];

export type SeedService = {
  code: string;
  category: string;
  name: string;
  /** Lei; null = „Prețul îl aflați la telefon”. */
  price: number | null;
  /** Lei; only for „900 / 1.100 lei” ranges. */
  priceMax?: number;
  priceFrom?: boolean;
  unit?: PriceUnit;
  durationMinutes: number;
  representative?: boolean;
  online?: { label: string; hint?: string };
  urgent?: boolean;
  toothSpecific?: boolean;
  recallMonths?: number;
  publicVisible?: boolean;
};

export const SERVICES: readonly SeedService[] = [
  // 1. Consultație și profilaxie
  {
    code: "CON-CONSULT",
    category: "consultatie-profilaxie",
    name: "Consultație și plan de tratament",
    price: null,
    durationMinutes: 30,
    online: { label: "Consultație sau control", hint: "Și dacă nu știți sigur de ce aveți nevoie." },
  },
  {
    code: "CON-DETARTRAJ",
    category: "consultatie-profilaxie",
    name: "Detartraj și periaj profesional / arcadă",
    price: 200,
    unit: "ARCADA",
    durationMinutes: 45,
    representative: true,
    online: { label: "Igienizare (detartraj)" },
    recallMonths: 6,
  },
  {
    code: "CON-AIRFLOW",
    category: "consultatie-profilaxie",
    name: "Detartraj, periaj și air-flow / arcadă",
    price: 250,
    unit: "ARCADA",
    durationMinutes: 60,
    recallMonths: 6,
  },
  { code: "CON-ALBIRE", category: "consultatie-profilaxie", name: "Albire dentară", price: 1000, durationMinutes: 60 },
  { code: "CON-SIGILARE", category: "consultatie-profilaxie", name: "Sigilare șanțuri", price: 130, durationMinutes: 30 },

  // 2. Stomatologie generală
  {
    code: "SG-URGENTA",
    category: "stomatologie-generala",
    name: "Consultație de urgență (durere)",
    price: null,
    durationMinutes: 30,
    online: { label: "Am o durere acum" },
    urgent: true,
    publicVisible: false,
  },
  { code: "SG-PANSAMENT", category: "stomatologie-generala", name: "Pansament calmant", price: 50, durationMinutes: 30 },
  {
    code: "SG-OBT-COMPOZIT",
    category: "stomatologie-generala",
    name: "Obturație compozit",
    price: 200,
    priceFrom: true,
    unit: "DINTE",
    durationMinutes: 45,
    representative: true,
    toothSpecific: true,
  },
  {
    code: "SG-OBT-ESTETICA",
    category: "stomatologie-generala",
    name: "Obturație estetică",
    price: 300,
    priceFrom: true,
    unit: "DINTE",
    durationMinutes: 60,
    toothSpecific: true,
  },
  { code: "SG-PIVOT", category: "stomatologie-generala", name: "Reconstrucție cu pivot din fibră de sticlă", price: 550, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  { code: "SG-OBT-GIC", category: "stomatologie-generala", name: "Obturație glas-ionomer", price: 120, unit: "DINTE", durationMinutes: 30, toothSpecific: true },
  { code: "SG-ENDO-MONO", category: "stomatologie-generala", name: "Tratament endodontic rotativ, monoradiculari", price: 350, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  { code: "SG-ENDO-PLURI", category: "stomatologie-generala", name: "Tratament endodontic rotativ, pluriradiculari", price: 400, unit: "DINTE", durationMinutes: 90, toothSpecific: true },
  { code: "SG-RETRAT-MONO", category: "stomatologie-generala", name: "Retratament, monoradiculari", price: 400, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  { code: "SG-RETRAT-PLURI", category: "stomatologie-generala", name: "Retratament, pluriradiculari", price: 600, unit: "DINTE", durationMinutes: 90, toothSpecific: true },

  // 3. Inhalosedare
  {
    code: "INH-ORA",
    category: "inhalosedare",
    name: "Inhalosedare",
    price: 150,
    unit: "ORA",
    durationMinutes: 60,
    representative: true,
  },

  // 4. Implantologie
  {
    code: "IMP-CONSULT",
    category: "implantologie",
    name: "Consultație de implantologie",
    price: null,
    durationMinutes: 30,
    online: { label: "Implant sau lucrare dentară" },
    publicVisible: false,
  },
  { code: "IMP-NEODENT", category: "implantologie", name: "Implant Neodent", price: 2200, unit: "DINTE", durationMinutes: 90, representative: true, toothSpecific: true },
  { code: "IMP-BONT", category: "implantologie", name: "Bont protetic drept sau angulat", price: 550, unit: "DINTE", durationMinutes: 30, toothSpecific: true },
  { code: "IMP-KHOURY", category: "implantologie", name: "Adiție de os, tehnica Khoury", price: 3000, durationMinutes: 120 },
  { code: "IMP-ADITIE", category: "implantologie", name: "Adiție de os preimplantară", price: 1500, durationMinutes: 90 },
  { code: "IMP-PLASA", category: "implantologie", name: "Augmentare osoasă cu plasă de titan", price: 3500, durationMinutes: 120 },
  { code: "IMP-PROT-MAND2", category: "implantologie", name: "Proteză mandibulară pe două implanturi", price: 9000, durationMinutes: 60 },
  { code: "IMP-PROT-MAX4", category: "implantologie", name: "Proteză maxilară pe 4 implanturi", price: 15000, durationMinutes: 60 },

  // 5. Chirurgie dento-alveolară
  { code: "CH-EXT-PARODONTOTIC", category: "chirurgie-dento-alveolara", name: "Extracție dinte parodontotic", price: 100, unit: "DINTE", durationMinutes: 30, toothSpecific: true },
  {
    code: "CH-EXT-MONO",
    category: "chirurgie-dento-alveolara",
    name: "Extracție dinte monoradicular",
    price: 200,
    unit: "DINTE",
    durationMinutes: 30,
    representative: true,
    toothSpecific: true,
  },
  { code: "CH-EXT-PLURI", category: "chirurgie-dento-alveolara", name: "Extracție dinte pluriradicular", price: 250, unit: "DINTE", durationMinutes: 45, toothSpecific: true },
  { code: "CH-EXT-MINTE", category: "chirurgie-dento-alveolara", name: "Extracție molar de minte erupt", price: 300, unit: "DINTE", durationMinutes: 45, toothSpecific: true },
  { code: "CH-EXT-ALVEOLOTOMIE", category: "chirurgie-dento-alveolara", name: "Extracție cu alveolotomie", price: 350, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  { code: "CH-ODONTECTOMIE", category: "chirurgie-dento-alveolara", name: "Odontectomie, chistectomie, rezecție apicală", price: 600, unit: "DINTE", durationMinutes: 90, toothSpecific: true },
  { code: "CH-CHIURETAJ", category: "chirurgie-dento-alveolara", name: "Chiuretaj alveolar", price: 150, durationMinutes: 30 },
  { code: "CH-INCIZIE", category: "chirurgie-dento-alveolara", name: "Incizie abces", price: 100, durationMinutes: 30 },
  { code: "CH-SEPARARE", category: "chirurgie-dento-alveolara", name: "Separare de rădăcini", price: 50, unit: "DINTE", durationMinutes: 15 },
  { code: "CH-SUTURA", category: "chirurgie-dento-alveolara", name: "Sutură", price: 100, durationMinutes: 15 },
  { code: "CH-HEMORAGIE", category: "chirurgie-dento-alveolara", name: "Tratamentul hemoragiei postextracționale", price: 100, durationMinutes: 30 },

  // 6. Protetică dentară
  { code: "PR-INDEPARTARE", category: "protetica-dentara", name: "Îndepărtare coroană", price: 80, unit: "DINTE", durationMinutes: 30 },
  { code: "PR-PROV-CABINET", category: "protetica-dentara", name: "Coroană provizorie în cabinet", price: 120, unit: "DINTE", durationMinutes: 30, toothSpecific: true },
  { code: "PR-PROV-PMMA", category: "protetica-dentara", name: "Coroană provizorie PMMA", price: 200, priceMax: 350, unit: "DINTE", durationMinutes: 30 },
  { code: "PR-MC", category: "protetica-dentara", name: "Coroană metalo-ceramică total fizionomică", price: 900, priceMax: 1100, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  {
    code: "PR-ZR",
    category: "protetica-dentara",
    name: "Coroană zirconiu monolitic",
    price: 900,
    priceMax: 1200,
    unit: "DINTE",
    durationMinutes: 60,
    representative: true,
    toothSpecific: true,
  },
  { code: "PR-MC-IMPLANT", category: "protetica-dentara", name: "Coroană metalo-ceramică pe implant", price: 1000, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  { code: "PR-ZR-IMPLANT", category: "protetica-dentara", name: "Coroană zirconiu monolitic pe implant", price: 1100, priceMax: 1500, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  { code: "PR-EMAX", category: "protetica-dentara", name: "Coroană EMAX", price: 1500, unit: "DINTE", durationMinutes: 60, toothSpecific: true },
  { code: "PR-SCHELETATA", category: "protetica-dentara", name: "Proteză dentară scheletată metalică", price: 3800, durationMinutes: 60 },
  { code: "PR-BIOHPP", category: "protetica-dentara", name: "Proteză dentară scheletată Bio-HPP", price: 5200, durationMinutes: 60 },
  { code: "PR-REBAZARE", category: "protetica-dentara", name: "Rebazare proteză acrilică", price: 350, durationMinutes: 45 },
  { code: "PR-WAXUP", category: "protetica-dentara", name: "Wax-up și mock-up / dinte", price: 150, unit: "DINTE", durationMinutes: 30 },

  // 7. Pedodonție
  { code: "PED-FLUOR", category: "pedodontie", name: "Fluorizare / arcadă", price: 50, unit: "ARCADA", durationMinutes: 20, representative: true },
  { code: "PED-SIGILARE", category: "pedodontie", name: "Sigilare dinte temporar / permanent", price: 100, unit: "DINTE", durationMinutes: 20 },
  { code: "PED-OBT-TEMP", category: "pedodontie", name: "Obturație dinte temporar", price: 120, unit: "DINTE", durationMinutes: 30, toothSpecific: true },
  {
    code: "PED-OBT-PERM",
    category: "pedodontie",
    name: "Obturație dinte permanent",
    price: 200,
    priceFrom: true,
    unit: "DINTE",
    durationMinutes: 45,
    toothSpecific: true,
  },
  { code: "PED-PANSAMENT", category: "pedodontie", name: "Pansament calmant endodontic", price: 100, unit: "DINTE", durationMinutes: 30 },

  // 8. Ortodonție
  {
    code: "ORT-CONSULT",
    category: "ortodontie",
    name: "Consultație ortodontică",
    price: 150,
    durationMinutes: 30,
    online: { label: "Aparat dentar" },
  },
  { code: "ORT-METALIC", category: "ortodontie", name: "Aparat fix cu brackeți metalici", price: 2400, unit: "ARCADA", durationMinutes: 90, representative: true },
  { code: "ORT-CERAMIC", category: "ortodontie", name: "Aparat fix cu brackeți ceramici", price: 3500, unit: "ARCADA", durationMinutes: 90 },
  { code: "ORT-MOBILIZABIL", category: "ortodontie", name: "Aparat mobilizabil", price: 900, durationMinutes: 30 },
  { code: "ORT-CONTROL", category: "ortodontie", name: "Control și activare aparat fix", price: 100, priceMax: 150, unit: "SEDINTA", durationMinutes: 30 },
  { code: "ORT-INDEPARTARE", category: "ortodontie", name: "Îndepărtare aparat fix și fluorizare", price: 700, durationMinutes: 60 },

  // 9. Parodontologie
  { code: "PAR-PARODONTOMETRIE", category: "parodontologie", name: "Parodontometrie", price: 200, durationMinutes: 30 },
  { code: "PAR-IMOBILIZARE", category: "parodontologie", name: "Imobilizare cu bandă din fibră de sticlă", price: 450, durationMinutes: 60 },
  {
    code: "PAR-CHIURETAJ",
    category: "parodontologie",
    name: "Chiuretaj parodontal subgingival / arcadă",
    price: 700,
    unit: "ARCADA",
    durationMinutes: 60,
    representative: true,
  },
  { code: "PAR-GINGIVECTOMIE", category: "parodontologie", name: "Gingivectomie / dinte", price: 100, unit: "DINTE", durationMinutes: 30 },

  // 10. Estetică dentară
  {
    code: "EST-OPALESCENCE",
    category: "estetica-dentara",
    name: "Albire profesională Opalescence Boost",
    price: 800,
    durationMinutes: 90,
    representative: true,
  },
  { code: "EST-ALBIRE-INTERNA", category: "estetica-dentara", name: "Albire internă dinte", price: 200, unit: "DINTE", durationMinutes: 45 },
  { code: "EST-BIJUTERIE", category: "estetica-dentara", name: "Aplicare bijuterie dentară", price: 200, durationMinutes: 30 },
  { code: "EST-GUTIERA", category: "estetica-dentara", name: "Gutieră bruxism / arcadă", price: 300, unit: "ARCADA", durationMinutes: 30 },
];

/** Lei → bani. */
export const lei = (value: number) => Math.round(value * 100);
