/**
 * Exports what the PHP version of the site reads (php/README.md): the texts, the clinics, the
 * services with their prices, the team, the icons and the line drawings, as JSON in php/app/data.
 * The TypeScript files stay the single source; run `npm run build:php` after changing them.
 */
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { DentalArt, SERVICE_ART, type DentalArtName } from "../../src/components/site/DentalArt";
import { ICON_NAMES, Icon } from "../../src/components/ui/Icon";
import { ABOUT } from "../../src/content/about";
import { ANNIVERSARY } from "../../src/content/anniversary";
import { HOME } from "../../src/content/home";
import { LANDINGS } from "../../src/content/landing";
import { CONFIDENTIALITATE, COOKIES, REVIEW_NOTE, TERMENI } from "../../src/content/legal";
import { PORTRAITS } from "../../src/content/portraits";
import { SERVICE_LIST } from "../../src/content/services";
import { SITE_IMAGE_SLOTS } from "../../src/content/site-images";
import { ANPC_BADGES, CLINIC_ORDER, CLINICS, FOOTER_NAV, LEGAL_NAV, MAIN_NAV, SITE } from "../../src/content/site";
import { CATEGORIES, SERVICES } from "../../prisma/seed-data/services";
import { DOCTORS } from "../../prisma/seed-data/team";

const out = path.resolve(__dirname, "../../php/app/data");
fs.mkdirSync(out, { recursive: true });
const write = (name: string, data: unknown) =>
  fs.writeFileSync(path.join(out, name), `${JSON.stringify(data, null, 1)}\n`);

write("content.json", {
  site: SITE,
  clinics: CLINICS,
  clinicOrder: CLINIC_ORDER,
  mainNav: MAIN_NAV,
  footerNav: FOOTER_NAV,
  legalNav: LEGAL_NAV,
  anpc: ANPC_BADGES,
  home: HOME,
  about: ABOUT,
  anniversary: ANNIVERSARY,
  landings: LANDINGS,
  services: SERVICE_LIST,
  serviceArt: SERVICE_ART,
  legal: { termeni: TERMENI, confidentialitate: CONFIDENTIALITATE, cookies: COOKIES, reviewNote: REVIEW_NOTE },
  siteImageSlots: SITE_IMAGE_SLOTS,
  portraits: PORTRAITS,
});

// The first data the installer writes into MySQL; afterwards the clinic edits it in /admin.
write("seed.json", {
  categories: CATEGORIES,
  services: SERVICES.map((s) => ({
    code: s.code,
    category: s.category,
    name: s.name,
    price: s.price,
    priceMax: s.priceMax ?? null,
    priceFrom: !!s.priceFrom,
    unit: s.unit ?? null,
    representative: !!s.representative,
    publicVisible: s.publicVisible !== false,
  })),
  doctors: DOCTORS.map((d) => ({
    slug: d.slug,
    firstName: d.firstName,
    lastName: d.lastName,
    publicName: d.publicName,
    roleLine: d.roleLine,
    photoPath: d.photoPath,
    monogram: d.monogram,
    sortOrder: d.sortOrder,
    categories: d.categories,
  })),
});

// Inner SVG markup only; PHP wraps it with the size and class.
const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
write(
  "icons.json",
  Object.fromEntries(ICON_NAMES.map((n) => [n, inner(renderToStaticMarkup(<Icon name={n} />))])),
);
const ART: DentalArtName[] = [
  "molar", "incisiv", "implant", "oglinda", "sonda", "pensa", "clesti", "coroana", "aparat",
  "periuta", "masca", "culori", "plomba", "gingie", "consult", "copil", "pereche", "tava",
];
write(
  "art.json",
  Object.fromEntries(
    ART.map((n) => {
      const svg = renderToStaticMarkup(<DentalArt name={n} />);
      return [n, { viewBox: svg.match(/viewBox="([^"]+)"/)![1], body: inner(svg) }];
    }),
  ),
);
console.log(`Date exportate în ${path.relative(process.cwd(), out)}`);
