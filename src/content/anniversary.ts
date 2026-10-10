/**
 * „/15ani”, kept as a brand-history page (architecture §0.2). The July–August 2024 promotion has
 * expired: it is told in the past tense and never offered as a live deal.
 */

export const ANNIVERSARY = {
  title: "15 ani împreună cu Dental Arena",
  seoTitle: "15 ani împreună cu Dental Arena",
  description:
    "În 2024, Dental Arena a împlinit 15 ani de stomatologie în județul Mureș. Povestea clinicii din Cristești și Luduș și a pacienților care ne-au fost alături.",
  lead: "În vara lui 2024, Dental Arena Clinic a împlinit 15 ani de stomatologie. Le-am mulțumit atunci pacienților care ne-au fost alături, cu o aniversare care a durat două luni.",
  celebration: {
    title: "Cum am sărbătorit",
    intro: "În lunile iulie și august 2024 am pregătit câte ceva pentru fiecare pacient:",
    items: [
      {
        title: "Pentru pacienții noștri fideli",
        text: "o igienizare dentară și o consultație gratuite, ca mulțumire pentru încrederea de până atunci.",
      },
      {
        title: "Pentru pacienții noi",
        text: "o reducere de 15% la toate serviciile clinicii, ca să ne cunoască mai ușor.",
      },
    ],
    closed: "Promoția aniversară s-a încheiat în august 2024. Prețurile actuale le găsiți pe pagina de prețuri.",
  },
  values: {
    title: "Ce am adunat în 15 ani",
    items: [
      { title: "Experiență", text: "Am acumulat experiență în toate ramurile stomatologiei, de la prevenție la implanturi." },
      { title: "Oameni dedicați", text: "Echipa noastră este formată din medici stomatologi dedicați îngrijirii dumneavoastră." },
      { title: "Tehnologie modernă", text: "Folosim echipamente moderne și tehnici noi, ca tratamentele să fie precise și fără durere." },
      { title: "O atmosferă prietenoasă", text: "Ne străduim ca fiecare vizită să fie liniștită, pentru toți pacienții noștri." },
    ],
  },
  closing: "Vă așteptăm în continuare, în Cristești și în Luduș, cu aceeași grijă.",
  images: {
    main: {
      src: "/images/clinica/perete-muschi.jpg",
      alt: "Peretele de mușchi viu din clinică, cu sigla Dental Arena",
      width: 1500,
      height: 2000,
    },
    second: {
      src: "/images/clinica/ludus-seara.jpg",
      alt: "Clinica Dental Arena din Luduș seara, cu aleea luminată",
      width: 1440,
      height: 1800,
    },
  },
} as const;
