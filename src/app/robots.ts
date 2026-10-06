import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/server/public/seo";

/** The CRM and the API are never indexed; the patient links carry no index either. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/crm", "/api", "/p/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
