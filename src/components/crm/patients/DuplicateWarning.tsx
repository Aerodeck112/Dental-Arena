import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatDateRo, formatPhone } from "@/lib/format";
import type { DuplicateMatch, DuplicateReason } from "@/server/patients/types";

const REASON: Record<DuplicateReason, string> = {
  telefon: "același telefon",
  cnp: "același CNP",
  "nume-data-nasterii": "același nume și aceeași dată a nașterii",
  email: "același e-mail",
};

/**
 * Shown while creating a patient when the phone, the CNP hash or the name plus birth date match an
 * existing file. The user opens the existing file, or confirms it is a different person.
 */
export function DuplicateWarning({ matches, onConfirm, blocking }: { matches: DuplicateMatch[]; onConfirm?: () => void; blocking?: boolean }) {
  if (matches.length === 0) return null;
  return (
    <section role={blocking ? "alert" : "status"} className="flex flex-col gap-3 rounded-panou border border-linie-control bg-menta-pal p-4">
      <h2 className="flex items-center gap-2 text-h3 font-semibold text-cerneala">
        <Icon name="users" size={18} />
        {matches.length === 1 ? "Poate există deja o fișă pentru acest pacient" : "Poate există deja fișe pentru acest pacient"}
      </h2>
      <ul className="flex flex-col gap-2">
        {matches.map((m) => (
          <li key={m.id} className="text-corp text-cerneala">
            <Link href={`/crm/pacienti/${m.id}`} className="font-semibold text-link underline underline-offset-4" target="_blank">
              {m.name}, fișa nr. {m.fileNumber}
            </Link>
            <span className="text-discret">
              {m.phone ? `, ${formatPhone(m.phone)}` : ""}
              {m.birthDate ? `, născut(ă) ${formatDateRo(m.birthDate, "short")}` : ""}
            </span>
            <span className="block text-mic text-discret">Potrivire: {m.reasons.map((r) => REASON[r]).join(", ")}.</span>
          </li>
        ))}
      </ul>
      {onConfirm && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" size="s" onClick={onConfirm}>
            Este alt pacient, creați fișa
          </Button>
        </div>
      )}
    </section>
  );
}
