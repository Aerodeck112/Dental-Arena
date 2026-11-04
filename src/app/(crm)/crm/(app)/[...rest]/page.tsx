import { notFound } from "next/navigation";

/**
 * Any /crm address that no page matches. Without this, an unknown CRM URL falls through to the
 * root (public-site) 404 and leaves the shell; here it renders `(app)/not-found.tsx` inside the
 * sidebar and top bar. Real routes (static or dynamic segments) always take precedence over a
 * catch-all, so this never shadows a page.
 */
export default function CrmUnknownPage(): never {
  notFound();
}
