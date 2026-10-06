import type { ServiceContent } from "./types";

export const consultatieProfilaxie: ServiceContent = {
  slug: "consultatie-profilaxie",
  title: "Consultație și profilaxie",
  // The live site used the Ortodonție title here (design-system §12.6); this page has its own.
  seoTitle: "Consultație și igienizare dentară, Cristești, Luduș",
  description:
    "Consultație stomatologică, plan de tratament și igienizare (detartraj, periaj, air-flow) în Cristești, lângă Târgu Mureș, și în Luduș. Prețuri pe site.",
  lead: "Un control la timp vă scutește de tratamente lungi. La consultație vă evaluăm dantura și vă întocmim un plan de tratament.",
  summary: "Control periodic, plan de tratament și igienizare profesională.",
  body: [
    "Este foarte important să vă examinați periodic dantura, pentru a păstra un zâmbet sănătos pentru mult timp. De aceea, vă așteptăm la o consultație stomatologică, în urma căreia vă vom evalua problemele dentare și vă vom întocmi un plan de tratament adecvat nevoilor dumneavoastră. Specialiștii noștri vă recomandă să nu neglijați examinările dentare preventive.",
    "Igienizarea profesională înseamnă detartraj, adică îndepărtarea tartrului (depunerile întărite de pe dinți), urmat de periaj profesional. La cerere adăugăm air-flow: un jet fin de apă, aer și pulbere care curăță petele de pe smalț.",
    "Sigilarea șanțurilor acoperă adânciturile de pe suprafața măselelor cu un material protector, ca resturile de mâncare să nu se mai oprească acolo și să nu apară carii.",
  ],
  image: {
    src: "/images/clinica/radiografie-tableta.jpg",
    alt: "Medicul îi arată pacientului radiografia pe o tabletă, în cabinet",
    width: 938,
    height: 656,
    caption: "Planul de tratament îl discutăm cu radiografia în față.",
    maxDisplayWidth: 480,
    focus: "60% 40%",
  },
  priceNote:
    "Prețurile sunt orientative. Prețul consultației îl aflați la telefon, iar costul tratamentului îl stabilim împreună după consultație.",
  // Răspunsuri scrise din textele site-ului actual; de verificat de clinică.
  faqs: [
    { question: "Ce se face la o consultație stomatologică?", answer: "Medicul vă examinează dantura, vă spune ce probleme are și întocmește un plan de tratament potrivit nevoilor dumneavoastră." },
    { question: "Cât de des ar trebui să merg la control?", answer: "Vă recomandăm control stomatologic periodic. Medicul vă spune la consultație intervalul potrivit pentru dumneavoastră." },
    { question: "Ce include igienizarea profesională?", answer: "Detartrajul și periajul profesional, iar la cerere și air-flow. Prețurile sunt pe arcadă și le găsiți în lista de pe această pagină." },
  ],
  ctaTitle: "Programați o consultație sau o igienizare",
  bookingCode: "CON-CONSULT",
  comfortNote: true,
  related: ["stomatologie-generala", "parodontologie"],
};
