import type { ServiceContent } from "./types";

/** October 2026: „Stomatologie generală” became two pages, Odontologie and Endodonție. */
export const odontologie: ServiceContent = {
  slug: "odontologie",
  title: "Odontologie",
  seoTitle: "Tratamentul cariilor și obturații în Cristești și Luduș",
  description:
    "Tratamentul cariilor, obturații din compozit și estetice, reconstrucții ale dinților în Cristești, lângă Târgu Mureș, și în Luduș. Fără durere, cu prețuri afișate pe site.",
  lead: "Tratăm cariile și refacem dinții afectați, de la o obturație simplă până la reconstrucția cu pivot.",
  summary: "Tratamentul cariilor și refacerea dinților: obturații din compozit, estetice, reconstrucții, cu planuri de tratament personalizate.",
  body: [
    "Caria dentară apare atunci când bacteriile din cavitatea bucală produc acizi care atacă dintele. Tratată la timp, se rezolvă cu o obturație (plombă) din compozit, în culoarea dintelui.",
    "Când dintele este mult distrus, îl reconstruim: cu obturații estetice întinse sau, după un tratament de canal, cu un pivot din fibră de sticlă care susține refacerea.",
    "Pentru a preveni apariția cariilor, vă recomandăm control stomatologic periodic, folosirea regulată a aței dentare și periajul corect al dinților.",
  ],
  priceNote: "Prețurile sunt orientative. Costul exact îl aflați după consultație.",
  // Răspunsuri scrise din textele site-ului actual; de verificat de clinică.
  faqs: [
    { question: "Doare tratamentul unei carii?", answer: "Tratamentele se fac fără durere, cu anestezie locală. Dacă vă e teamă, spuneți-ne: medicul vă explică fiecare pas." },
    { question: "Ce fel de plombe faceți?", answer: "Obturații din compozit, în culoarea dintelui, obturații estetice pentru dinții din față și, la nevoie, obturații din glas-ionomer." },
    { question: "Cum previn cariile?", answer: "Prin control stomatologic periodic, folosirea regulată a aței dentare și periajul corect al dinților." },
  ],
  ctaTitle: "Programați o consultație",
  bookingCode: "CON-CONSULT",
  comfortNote: true,
  related: ["endodontie", "consultatie-profilaxie"],
};
