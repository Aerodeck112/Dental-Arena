/**
 * The two Târgu Mureș landing pages (design-system §6.2). They keep their WordPress URLs and
 * point to the Cristești clinic, „lângă Târgu Mureș” (no invented distance, design-system §0.4). Each has its own
 * copy, so neither duplicates the home page.
 */

export type LandingSlug = "dentist-targu-mures" | "cabinet-stomatologic-targu-mures";

export type LandingContent = {
  slug: LandingSlug;
  title: string;
  seoTitle: string;
  description: string;
  lead: string;
  intro: string[];
  /** Heading of the services index. */
  servicesTitle: string;
  /** Heading of the doctors row (dentist page) or of the price list (cabinet page). */
  focusTitle: string;
  focusLead: string;
  comfortTitle: string;
  comfortText: string;
  clinicTitle: string;
  ludusNote: string;
};

export const LANDINGS: Record<LandingSlug, LandingContent> = {
  "dentist-targu-mures": {
    slug: "dentist-targu-mures",
    title: "Dentist lângă Târgu Mureș",
    seoTitle: "Dentist lângă Târgu Mureș, în Cristești",
    description:
      "Căutați un dentist în Târgu Mureș? Dental Arena are clinica în Cristești, lângă oraș: implanturi, aparat dentar, copii și tratament fără frică.",
    lead: "Clinica Dental Arena din Cristești este lângă Târgu Mureș, pe str. Principală 536J/1. Vedeți pe site medicii, prețurile și orele libere, apoi vă programați online sau la telefon.",
    intro: [
      "Suntem o clinică stomatologică de familie, cu cinci medici, în care punem pe primul loc confortul și siguranța pacientului. Se respectă programările, iar tratamentele sunt făcute fără durere.",
      "Dacă vă e teamă de dentist, spuneți-ne. Putem lucra sub inhalosedare: rămâneți conștient, doar mult mai relaxat.",
    ],
    servicesTitle: "Ce tratăm în Cristești",
    focusTitle: "Medicii",
    focusLead: "Respectăm ora programării, iar medicii noștri au acea „mână ușoară” pe care o căutați.",
    comfortTitle: "Vă e teamă de dentist?",
    comfortText:
      "Nu sunteți singurul. Tratamentul se poate face sub inhalosedare: respirați un amestec care vă relaxează, colaborați cu medicul și vă reveniți în 3–5 minute.",
    clinicTitle: "Clinica din Cristești",
    ludusNote: "Avem și o clinică în Luduș, pe str. Gheorghe Barițiu nr. 6.",
  },
  "cabinet-stomatologic-targu-mures": {
    slug: "cabinet-stomatologic-targu-mures",
    title: "Cabinet stomatologic lângă Târgu Mureș",
    seoTitle: "Cabinet stomatologic lângă Târgu Mureș, în Cristești",
    description:
      "Cabinet stomatologic în Cristești, lângă Târgu Mureș: carii, implanturi, extracții, aparat dentar și stomatologie pentru copii. Prețuri pe site.",
    lead: "În Cristești, lângă Târgu Mureș, Dental Arena are un cabinet stomatologic de familie: de la controlul periodic și igienizare până la implanturi și aparate dentare.",
    intro: [
      "Planificăm tratamentele după radiografii, iar lucrările dentare le proiectăm pe calculator, cu o precizie foarte mare. Prețurile le vedeți mai jos, înainte să veniți.",
      "Cabinetul nostru este un loc pozitiv, cu o atmosferă plăcută. Copiii se întorc cu plăcere și fără frică.",
    ],
    servicesTitle: "Serviciile cabinetului",
    focusTitle: "Prețuri orientative",
    focusLead: "Câte un preț pentru fiecare serviciu. Lista completă este pe pagina de prețuri.",
    comfortTitle: "Fără durere, fără frică",
    comfortText:
      "Pentru pacienții care se tem de dentist, și pentru copii, lucrăm și sub inhalosedare: o sedare conștientă din care vă reveniți în 3–5 minute.",
    clinicTitle: "Unde este cabinetul",
    ludusNote: "Avem și o clinică în Luduș, pe str. Gheorghe Barițiu nr. 6.",
  },
};
