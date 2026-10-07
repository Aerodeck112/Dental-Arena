import type { MetadataRoute } from "next";
import { isTestSite } from "@/lib/site-mode";
import { absoluteUrl } from "@/server/public/seo";

/**
 * The CRM and the API are never indexed; the patient links carry no index either.
 * A test copy (SITE_MODE=test) is not indexed at all.
 */
export default function robots(): MetadataRoute.Robots {
  if (isTestSite) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/crm", "/api", "/p/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
