import type { ServiceContent } from "./types";

export const ortodontie: ServiceContent = {
  slug: "ortodontie",
  title: "Ortodonție",
  seoTitle: "Aparat dentar fix și mobil în Cristești și Luduș",
  description:
    "Aparat dentar fix (brackeți metalici sau ceramici) și mobil, pentru copii și adulți, în Cristești și Luduș, lângă Târgu Mureș. Prețuri afișate pe site.",
  lead: "Dinții care nu stau drept se pot îndrepta la orice vârstă, cu un aparat dentar fix sau mobil.",
  summary: "Aparate dentare fixe și mobile, pentru copii și pentru adulți.",
  body: [
    "Problemele de poziție ale dinților afectează masticația și oferă un aspect neplăcut zâmbetului. Pot fi corectate cu ajutorul aparatelor dentare, care sunt de mai multe tipuri: fixe sau mobile, cu brackeți metalici, care se văd, ori cu brackeți ceramici, de culoarea dinților, mai discreți.",
    "Ortodonția nu se adresează doar copiilor, ci și adulților. Datorită tehnicilor folosite în prezent, dinții pot fi îndreptați la orice vârstă.",
    "Durata unui astfel de tratament variază în funcție de complexitatea cazului, însă în general este de 18–24 de luni.",
  ],
  steps: [
    { label: "Consultația ortodontică", detail: "Medicul vă examinează dantura și vă explică ce aparat se potrivește." },
    { label: "Montarea aparatului", detail: "Fix, cu brackeți metalici sau ceramici, ori mobilizabil." },
    { label: "Controale și activări", detail: "Reveniți periodic, pe toată durata tratamentului." },
    { label: "Îndepărtarea aparatului și fluorizarea", detail: "La final, aparatul se scoate, iar dinții se protejează cu fluor." },
  ],
  stepsNote: "De obicei, tratamentul durează 18–24 de luni.",
  priceNote: "Prețurile sunt orientative. Costul exact îl aflați după consultația ortodontică.",
  // Răspunsuri scrise din textele site-ului actual; de verificat de clinică.
  faqs: [
    { question: "Ce tipuri de aparat dentar există?", answer: "Aparate fixe, cu brackeți metalici sau ceramici, și aparate mobilizabile. Medicul ortodont vă recomandă varianta potrivită după consultație." },
    { question: "Se poate purta aparat dentar la vârsta adultă?", answer: "Da. Aparatele dentare corectează poziția dinților atât la copii, cât și la adulți." },
    { question: "Cât durează tratamentul ortodontic?", answer: "Durata depinde de fiecare caz; de obicei tratamentul cu aparat fix durează 18–24 de luni." },
  ],
  ctaTitle: "Programați o consultație ortodontică",
  bookingCode: "ORT-CONSULT",
  comfortNote: true,
  related: ["pedodontie", "estetica-dentara"],
};
