import Link from "next/link";

/** 404 inside the CRM: an invitation to act, not an apology (design system §12.4). */
export default function CrmNotFound() {
  return (
    <section aria-labelledby="negasit-titlu" className="max-w-xl py-8">
      <h1 id="negasit-titlu" className="font-display text-h1">
        Pagina nu există
      </h1>
      <p className="mt-3 text-corp text-discret">
        Înregistrarea a fost ștearsă sau adresa este greșită. Căutați pacientul din bara de sus sau
        reveniți la Azi.
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
