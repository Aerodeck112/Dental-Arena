"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Error boundary for CRM pages: says what happened and what to do (design system §12.4). */
export default function CrmError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Only the digest: the message may contain personal data.
    console.error(`[crm] eroare la afișarea paginii${error.digest ? ` (${error.digest})` : ""}`);
  }, [error.digest]);

  return (
    <section aria-labelledby="eroare-titlu" className="max-w-xl py-8">
      <h1 id="eroare-titlu" className="font-display text-h1">
        Pagina nu a putut fi afișată
      </h1>
      <p className="mt-3 text-corp text-discret">
        A apărut o eroare neașteptată. Încercați din nou; dacă se repetă, reveniți la Azi și anunțați
        administratorul.
        {error.digest ? <span className="cifre"> Cod: {error.digest}.</span> : null}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="apasat inline-flex h-control items-center rounded-control bg-actiune px-4 text-control font-medium text-pe-actiune hover:bg-actiune-apasat"
        >
          Încercați din nou
        </button>
        <Link
          href="/crm"
          className="inline-flex h-control items-center rounded-control px-4 text-control font-medium text-link underline underline-offset-4"
        >
          Înapoi la Azi
        </Link>
      </div>
    </section>
  );
}
