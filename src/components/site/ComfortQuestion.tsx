"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ChoiceButton } from "@/components/ui/ChoiceButton";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { COMFORT_STORAGE_KEY, HOME, type ComfortAnswer } from "@/content/home";
import { bookingHref } from "@/content/site";
import { useHydrated } from "./use-hydrated";

type Answer = (typeof HOME.comfort.answers)[number];

const toneOf = (v: ComfortAnswer) => (v === "fara-emotii" ? "calm" : "comfort");

/** The answer travels to booking step 3: sessionStorage for the wizard, the query for no-JS. */
export function rememberComfort(value: ComfortAnswer): void {
  try {
    window.sessionStorage.setItem(COMFORT_STORAGE_KEY, value);
  } catch {
    /* storage blocked: the link still carries ?confort= */
  }
}

/**
 * „Cum vă simțiți când vă gândiți la dentist?” (design-system §6.4). Nothing is preselected. A
 * choice fills the button (Mentă for „N-am emoții”, Muștar for the other two), opens the clinic's
 * reply and ends in one primary button that carries the answer into booking. Without JavaScript
 * the three answers are plain links into the wizard.
 */
export function ComfortQuestion({ sedationPrice, headingId }: { sedationPrice: string | null; headingId: string }) {
  const hydrated = useHydrated();
  const [answer, setAnswer] = useState<ComfortAnswer | null>(null);
  const replyId = useId();
  const chosen: Answer | undefined = HOME.comfort.answers.find((a) => a.value === answer);

  const choose = (v: ComfortAnswer) => {
    setAnswer(v);
    rememberComfort(v);
  };

  if (!hydrated) {
    return (
      <ul className="flex flex-wrap gap-3" aria-labelledby={headingId}>
        {HOME.comfort.answers.map((a) => (
          <li key={a.value}>
            <Link
              href={bookingHref({ confort: a.value })}
              className="apasat inline-flex min-h-control-l items-center rounded-control border border-linie-control bg-suprafata px-5 text-control font-medium text-cerneala hover:border-cerneala"
            >
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-3">
        {HOME.comfort.answers.map((a) => (
          <ChoiceButton
            key={a.value}
            tone={toneOf(a.value)}
            selected={answer === a.value}
            aria-controls={replyId}
            onClick={() => choose(a.value)}
            className="px-5"
          >
            {a.label}
          </ChoiceButton>
        ))}
      </div>

      <div id={replyId} aria-live="polite" className="mt-6 min-h-0">
        {chosen && (
          <div
            key={chosen.value}
            className={cn(
              "da-rise rounded-panou p-5 sm:p-6",
              chosen.value === "fara-emotii" ? "bg-menta-pal" : "bg-mustar-pal",
            )}
          >
            <p className="text-corp text-cerneala masura">
              {chosen.reply}
              {chosen.value === "frica" && sedationPrice && (
                <>
                  {" "}
                  <span className="font-semibold whitespace-nowrap cifre">{sedationPrice}</span>.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <ButtonLink
                href={bookingHref({ confort: chosen.value })}
                size="l"
                onClick={() => rememberComfort(chosen.value)}
              >
                {chosen.cta}
              </ButtonLink>
              {"link" in chosen && chosen.link && (
                <Link
                  href={chosen.link.href}
                  className="inline-flex min-h-control items-center gap-1.5 font-medium text-cerneala underline underline-offset-[0.2em] hover:decoration-2"
                >
                  {chosen.link.label}
                </Link>
              )}
            </div>
            {chosen.value !== "fara-emotii" && (
              <p className="mt-4 flex items-center gap-2 text-mic text-mustar-text">
                <Icon name="check" size={18} />
                Medicul vede răspunsul înainte să intrați.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
