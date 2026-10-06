import { SITE } from "./site";

/**
 * Home page copy (design-system §6.4). The headline is the clinic's own promise, in the correct
 * pairing; the comfort question is the home's main feature.
 */

export type ComfortAnswer = "fara-emotii" | "emotii" | "frica";

export const COMFORT_STORAGE_KEY = "da-confort";

export const HOME = {
  title: SITE.homeTitle,
  description:
    "Clinică stomatologică de familie în Cristești, lângă Târgu Mureș, și în Luduș: consultații, implanturi, ortodonție, copii și tratament fără frică, sub inhalosedare.",

  hero: {
    lines: ["Fără durere,", "fără frică,", "cu precizie."],
    lead: "Clinică stomatologică în Cristești, lângă Târgu Mureș, și în Luduș. Dacă vă e teamă de dentist, putem lucra cu inhalosedare: rămâneți conștient, doar mult mai relaxat.",
    image: {
      src: "/images/clinica/receptie.jpg",
      alt: "La recepția Dental Arena, asistenta în uniformă verde îi dă unui pacient documentele vizitei",
      width: 1430,
      height: 953,
      /** 4:5 crop on the hand-over (desktop); 4:3 on phones. */
      focusTall: "38% 50%",
      focusWide: "40% 45%",
    },
  },

  availability: {
    title: "Primele ore libere pentru o consultație",
    fallback: "Sunați-ne și vă găsim o oră.",
  },

  comfort: {
    question: "Cum vă simțiți când vă gândiți la dentist?",
    intro: "Răspunsul ne ajută să ne pregătim. Medicul îl vede înainte să intrați.",
    answers: [
      {
        value: "fara-emotii" as ComfortAnswer,
        label: "N-am emoții",
        reply: "Atunci alegeți direct o oră.",
        cta: "Alegeți o oră",
      },
      {
        value: "emotii" as ComfortAnswer,
        label: "Am puține emoții",
        // Clinic to approve (design-system §6.4).
        reply: "Spuneți-ne la început ce vă îngrijorează. Medicul vă explică fiecare pas înainte să înceapă.",
        cta: "Programați-vă",
      },
      {
        value: "frica" as ComfortAnswer,
        label: "Mi-e frică",
        reply:
          "Putem lucra sub inhalosedare: rămâneți conștient, colaborați cu medicul și vă reveniți în 3–5 minute. Se poate folosi și la copii.",
        cta: "Programați-vă cu inhalosedare",
        link: { href: "/inhalosedare", label: "Despre inhalosedare" },
      },
    ],
    image: {
      src: "/images/clinica/sala-asteptare.jpg",
      alt: "Sala de așteptare: canapeaua galbenă, fotolii cu model colorat și un tablou mare în roșu, galben și albastru",
      width: 1500,
      height: 2000,
      caption: "Sala de așteptare, cu canapeaua galbenă.",
    },
  },

  doctors: {
    title: "Medicii",
    lead: "Respectăm ora programării, iar medicii noștri au acea „mână ușoară” pe care o căutați.",
    all: "Despre echipă",
  },

  services: {
    title: "Ce tratăm",
    lead: "Zece servicii, cu prețurile din clinică. Prețul exact îl aflați după consultație.",
    allPrices: "Toate prețurile",
  },

  children: {
    title: "Copiii",
    body: [
      "Dantura copiilor trebuie îngrijită din timp: o carie netratată la dinții de lapte se complică și afectează creșterea dinților definitivi. Prevenim cariile prin fluorizare și prin sigilarea șanțurilor de pe dinți.",
      "Iar pentru a învinge frica micuților de dentist, avem o metodă de sedare conștientă și sigură: inhalosedarea. Copiii se întorc la noi cu plăcere și fără frică.",
    ],
    /** The three prices shown, by Service.code. */
    priceCodes: ["PED-FLUOR", "PED-SIGILARE", "PED-OBT-TEMP"],
    link: { href: "/pedodontie", label: "Despre stomatologia pentru copii" },
    image: {
      src: "/images/clinica/cabinet-plaja.jpg",
      alt: "Fotoliul stomatologic din cabinetul cu o plajă tropicală pictată pe perete",
      width: 1500,
      height: 2000,
      caption: "Cabinetul cu marea pe perete.",
    },
  },

  visit: {
    title: "Cum decurge prima vizită",
    steps: [
      { title: "Programarea", text: "Alegeți online o oră liberă sau sunați la clinica la care veniți. Vă confirmăm programarea." },
      { title: "Consultația", text: "Medicul vă examinează și, dacă e nevoie, face o radiografie. Vă spune pe înțeles ce a găsit." },
      { title: "Planul de tratament", text: "Primiți planul cu etapele și prețul fiecăreia, înainte să începem orice tratament." },
      { title: "Tratamentul", text: "Lucrăm fără durere. Dacă vă e teamă, putem lucra sub inhalosedare." },
    ],
  },

  clinics: {
    title: "Clinicile",
    lead: "Ne găsiți în Cristești, lângă Târgu Mureș, și în Luduș. Sunați direct la clinica la care veniți.",
  },
} as const;
