import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { formatDateRo } from "@/lib/format";
import { fillLegal, type LegalBlock, type LegalDoc, type LegalValues } from "@/content/legal";
import { Container } from "./Section";

function Block({ block, values }: { block: LegalBlock; values: Partial<LegalValues> }) {
  if (block.kind === "p") return <p className="text-corp text-cerneala masura">{fillLegal(block.text, values)}</p>;
  if (block.kind === "ul") {
    return (
      <ul className="flex list-disc flex-col gap-2 pl-6 text-corp text-cerneala masura marker:text-discret">
        {block.items.map((item, i) => (
          <li key={i}>{fillLegal(item, values)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="-mx-margine overflow-x-auto px-margine">
      <table className="w-full min-w-[36rem] border-collapse text-left text-mic text-cerneala">
        <caption className="mb-3 text-left text-mic text-discret">{block.caption}</caption>
        <thead>
          <tr className="border-b border-linie-control">
            {block.head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 align-bottom font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-b border-linie align-top">
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="py-3 pr-4 font-medium">
                    {fillLegal(cell, values)}
                  </th>
                ) : (
                  <td key={j} className="py-3 pr-4">
                    {fillLegal(cell, values)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A legal page (Termeni, Confidențialitate, Cookies): a structured draft whose company details come
 * from the clinic settings and read „[de completat]” until an administrator enters them. The
 * review note stays on top until the clinic's legal adviser signs the text off.
 */
export function LegalPage({
  doc,
  values,
  extras,
}: {
  doc: LegalDoc;
  values: Partial<LegalValues>;
  /** Something to show after a section, by section id (e.g. the cookie settings button). */
  extras?: Record<string, ReactNode>;
}) {
  return (
    <Container className="pt-6 pb-sectiune md:pt-10">
      <Breadcrumbs items={[{ href: "/", label: "Acasă" }, { label: doc.title }]} />
      <div className="mt-8 grid grid-cols-1 gap-x-gutter gap-y-10 lg:mt-12 lg:grid-cols-12">
        <header className="lg:col-span-8">
          <h1 className="font-display text-h1 text-cerneala">{doc.title}</h1>
          <p className="mt-4 text-mic text-discret cifre">Versiunea din {formatDateRo(doc.updated, "full")}</p>
          {doc.reviewNote && (
            <p className="mt-6 flex gap-3 rounded-panou bg-adancit p-4 text-mic text-cerneala masura">
              <Icon name="info" size={20} className="mt-0.5 shrink-0 text-discret" />
              {doc.reviewNote}
            </p>
          )}
          <p className="mt-8 text-lead text-discret masura-lead">{fillLegal(doc.intro, values)}</p>
        </header>

        <nav aria-label="Cuprins" className="lg:col-span-3 lg:col-start-10 lg:row-span-2">
          <div className="lg:sticky lg:top-28">
            <p className="text-control font-semibold text-cerneala">Cuprins</p>
            <ol className="mt-2 flex flex-col text-mic">
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="inline-flex min-h-control items-center text-link underline decoration-1 underline-offset-[0.2em] hover:decoration-2">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-12 lg:col-span-8">
          {doc.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titlu`} className="scroll-mt-28">
              <h2 id={`${s.id}-titlu`} className="font-display text-h2 text-cerneala">
                {s.title}
              </h2>
              <div className="mt-5 flex flex-col gap-4">
                {s.blocks.map((b, i) => (
                  <Block key={i} block={b} values={values} />
                ))}
                {extras?.[s.id]}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Container>
  );
}
