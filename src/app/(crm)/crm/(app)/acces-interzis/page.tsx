import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Acces interzis" };

/** 403 page: every `requirePermission()` failure lands here (docs/architecture.md §0.1). */
export default async function AccessDeniedPage() {
  const user = await requireUser();
  return (
    <section aria-labelledby="interzis-titlu" className="max-w-xl py-8">
      <h1 id="interzis-titlu" className="font-display text-h1">
        Nu aveți acces la această pagină
      </h1>
      <p className="mt-3 text-corp text-discret">
        Contul dumneavoastră ({ROLE_LABEL[user.role]}) nu include această secțiune. Dacă aveți nevoie de
        ea, cereți-i administratorului clinicii drepturile necesare.
      </p>
      <div className="mt-5">
        <Link
          href="/crm"
          className="apasat inline-flex h-control items-center rounded-control bg-actiune px-4 text-control font-medium text-pe-actiune hover:bg-actiune-apasat"
        >
          Înapoi la Azi
        </Link>
      </div>
    </section>
  );
}
