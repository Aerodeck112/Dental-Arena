/**
 * „Despre noi” (design-system §6.4 note, §12.6): the clinic story in the formal voice, and
 * „Fără durere / Fără frică / Precizie” with the texts in their correct pairing.
 */

export const ABOUT = {
  title: "Despre noi",
  seoTitle: "Despre clinica stomatologică din Cristești și Luduș",
  description:
    "Dental Arena, clinică stomatologică de familie din Cristești, lângă Târgu Mureș, și din Luduș: medici tineri, programări respectate, tratamente fără durere.",
  lead: "O clinică stomatologică în care vă întoarceți cu plăcere de fiecare dată.",
  story: [
    "La Dental Arena, problemele dentare vă sunt rezolvate cu răbdare, pasiune, dedicare și seriozitate, de o echipă de medici tineri și profesioniști, în care puteți avea încredere. Este un loc pozitiv, cu o atmosferă plăcută, în care punem pe primul loc confortul și siguranța pacientului.",
    "Este locul unde se respectă programările și unde medicii au acea „mână ușoară” pe care o căutați, pentru că nu vreți să vă doară. Tratamentele dentare sunt realizate fără durere, pentru că tehnologia este de partea noastră: folosim soluții moderne de diagnostic și tratament și concepte noi în medicina dentară pentru planificarea, designul și realizarea lucrărilor dentare.",
  ],
  years: {
    text: "Suntem alături de pacienții noștri de peste 15 ani.",
    link: { href: "/15ani", label: "Povestea celor 15 ani" },
  },
  heroImage: {
    src: "/images/clinica/receptie.jpg",
    alt: "La recepția Dental Arena, asistenta în uniformă verde îi dă unui pacient documentele vizitei",
    width: 1430,
    height: 953,
  },
  principlesTitle: "Experiență completă la stomatolog",
  principles: [
    {
      title: "Fără durere",
      text: "Problemele dentare se pot rezolva fără durere, datorită tehnologiei din cabinet și specialiștilor noștri.",
      image: {
        src: "/images/clinica/floare-canapea.jpg",
        alt: "O gerberă galbenă și o ramă cu un citat, în fața canapelei galbene din sala de așteptare",
        width: 1430,
        height: 953,
      },
    },
    {
      title: "Fără frică",
      text: "Pacienții noștri nu cunosc acest cuvânt, „frică”. Vin cu zâmbetul pe buze în clinică și pleacă mult mai fericiți.",
      image: {
        src: "/images/clinica/perete-muschi.jpg",
        alt: "Peretele de mușchi viu din clinică, cu sigla Dental Arena",
        width: 1500,
        height: 2000,
      },
    },
    {
      title: "Precizie",
      text: "Un dinte bine tratat are o durată de viață mai mare, de aceea realizăm toate tratamentele dentare cu cea mai mare precizie. Facem radiografii înainte și după fiecare intervenție, ca să tratăm cu exactitate fiecare problemă dentară.",
      image: {
        src: "/images/clinica/radiografie-tableta.jpg",
        alt: "Medicul îi arată pacientului radiografia pe o tabletă, în cabinet",
        width: 938,
        height: 656,
      },
    },
  ],
  teamTitle: "Echipa",
  teamText: "Cinci medici: stomatologie generală, implantologie, chirurgie dento-alveolară și ortodonție.",
  clinicsTitle: "Unde ne găsiți",
} as const;
