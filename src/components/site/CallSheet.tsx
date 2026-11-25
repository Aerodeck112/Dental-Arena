"use client";

import { useId } from "react";
import { Icon } from "@/components/ui/Icon";
import { useNativeDialog } from "@/components/ui/use-dialog";
import { formatPhone, telHref } from "@/lib/format";
import { CLINIC_ORDER, CLINICS } from "@/content/site";

/**
 * The phone's bottom sheet „Ce clinică sunați?”: two 56px rows, one per clinic (design-system
 * §6.3). A native modal <dialog>: focus moves in, Esc and the backdrop close it.
 */
export function CallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useNativeDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={[
        "da-overlay fixed inset-x-0 top-auto bottom-0 m-0 h-auto max-h-[85dvh] w-full max-w-none p-0",
        "rounded-t-panou border-t border-linie bg-suprafata text-cerneala shadow-float",
        "open:da-rise",
      ].join(" ")}
    >
      <div className="px-margine pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-display text-nume">
            Ce clinică sunați?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Închideți"
            className="apasat -mr-2 inline-flex size-control shrink-0 items-center justify-center rounded-control text-discret hover:bg-adancit hover:text-cerneala"
          >
            <Icon name="x" size={22} />
          </button>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {CLINIC_ORDER.map((slug) => {
            const c = CLINICS[slug];
            const number = formatPhone(c.phone);
            return (
              <li key={slug}>
                <a
                  href={telHref(c.phone)}
                  aria-label={`Sunați la ${c.shortName}, ${number}`}
                  className="apasat flex min-h-control-l items-center justify-between gap-4 rounded-control border border-linie-control px-4 text-control hover:border-cerneala hover:bg-menta-pal"
                >
                  <span className="inline-flex items-center gap-3 font-medium">
                    <Icon name="phone" size={20} className="text-discret" />
                    {c.shortName}
                  </span>
                  <span className="telefon font-semibold">{number}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
