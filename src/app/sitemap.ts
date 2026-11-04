import type { MetadataRoute } from "next";
import { SERVICE_SLUGS } from "@/content/services";
import { absoluteUrl } from "@/server/public/seo";
import { getPublicDoctors } from "@/server/public/queries";

export const revalidate = 3600;

/** Every public page that WP3 serves (architecture §4.1), the services and the doctor profiles. */
const STATIC_PAGES: readonly { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/programare", priority: 0.9 },
  { path: "/servicii", priority: 0.8 },
  { path: "/preturi", priority: 0.8 },
  { path: "/echipa", priority: 0.7 },
  { path: "/contact", priority: 0.7 },
  { path: "/despre-noi", priority: 0.6 },
  { path: "/dentist-targu-mures", priority: 0.6 },
  { path: "/cabinet-stomatologic-targu-mures", priority: 0.6 },
  { path: "/15ani", priority: 0.3 },
  { path: "/termeni-si-conditii", priority: 0.2 },
  { path: "/politica-de-confidentialitate", priority: 0.2 },
  { path: "/politica-cookies", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let doctors: { slug: string }[] = [];
  try {
    doctors = await getPublicDoctors();
  } catch {
    doctors = [];
  }
  return [
    ...STATIC_PAGES.map((p) => ({ url: absoluteUrl(p.path), priority: p.priority })),
    ...SERVICE_SLUGS.map((s) => ({ url: absoluteUrl(`/${s}`), priority: 0.8 })),
    ...doctors.map((d) => ({ url: absoluteUrl(`/echipa/${d.slug}`), priority: 0.5 })),
  ];
}
