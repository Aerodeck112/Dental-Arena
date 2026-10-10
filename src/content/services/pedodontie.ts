import type { ServiceContent } from "./types";

export const pedodontie: ServiceContent = {
  slug: "pedodontie",
  title: "Pedodonție",
  seoTitle: "Dentist pentru copii în Cristești și Luduș",
  description:
    "Dentist pentru copii în Cristești și Luduș: fluorizare, sigilare și plombe pentru dinții de lapte. Pentru copiii cu frică, tratament sub inhalosedare.",
  lead: "Copiii se întorc la noi cu plăcere și fără frică. Prevenim cariile din timp, ca dinții definitivi să crească sănătoși.",
  summary: "Stomatologie pentru copii, care se întorc de fiecare dată cu plăcere și fără frică.",
  body: [
    "La Dental Arena Clinic oferim și servicii de stomatologie pentru copii. Dantura lor trebuie îngrijită și nu este recomandat să așteptați până la apariția durerilor. Caria netratată apărută la dinții de lapte se complică și afectează creșterea dinților definitivi.",
    "Există tratamente cu ajutorul cărora se pot preveni cariile: fluorizarea și sigilarea șanțurilor și fosetelor, adică a adânciturilor de pe suprafața dinților.",
    "Iar pentru a învinge frica micuților de dentist, avem o metodă de sedare conștientă și sigură: inhalosedarea.",
  ],
  image: {
    src: "/images/clinica/cabinet-plaja.jpg",
    alt: "Fotoliul stomatologic din cabinetul cu o plajă tropicală pictată pe perete",
    width: 1500,
    height: 2000,
    caption: "Cabinetul cu marea pe perete.",
    focus: "50% 55%",
  },
  priceNote: "Prețurile sunt orientative. Costul exact îl aflați după consultație.",
  // Răspunsuri scrise din textele site-ului actual; de verificat de clinică.
  faqs: [
    { question: "De la ce vârstă îmi aduc copilul la dentist?", answer: "Dantura copiilor trebuie îngrijită din timp, de la apariția dinților de lapte. O carie netratată la dinții de lapte se complică și poate afecta dinții definitivi." },
    { question: "Ce faceți dacă copilului îi e frică de dentist?", answer: "Lucrăm cu răbdare, iar pentru copiii cărora le e frică avem inhalosedarea: o metodă de sedare conștientă și sigură." },
    { question: "Cum previn cariile la copii?", answer: "Prin fluorizare și prin sigilarea șanțurilor de pe dinți, alături de periajul corect și controlul periodic." },
  ],
  ctaTitle: "Programați o consultație pentru copilul dumneavoastră",
  bookingCode: "CON-CONSULT",
  comfortNote: true,
  related: ["inhalosedare", "ortodontie"],
};
