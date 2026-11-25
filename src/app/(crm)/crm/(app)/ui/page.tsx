import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { UiGallery } from "./UiGallery";

export const metadata: Metadata = { title: "Componente" };

/**
 * Component gallery for QA (architecture §4.2, WP2): every UI-kit component in every state,
 * in light, dark and every density. Administrators only.
 */
export default async function UiGalleryPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/crm/acces-interzis");
  return <UiGallery />;
}
