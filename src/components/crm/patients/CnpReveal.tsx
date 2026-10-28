"use client";

import { useEffect, useState } from "react";
import { revealCnpAction } from "@/app/(crm)/crm/(app)/pacienti/[id]/date/actions";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { maskCnp } from "@/lib/format";

export const REVEAL_SECONDS = 30;

/**
 * The CNP masked („1••••••••••23”) with „Afișați CNP-ul”. Revealing is a separate server action,
 * audited as `patient.cnp.reveal`; the clear CNP stays on screen for 30 seconds, then is dropped.
 */
export function CnpReveal({ patientId, last2 }: { patientId: string; last2: string }) {
  const [cnp, setCnp] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!cnp) return;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setCnp(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cnp]);

  async function reveal() {
    setPending(true);
    const r = await revealCnpAction({ id: patientId });
    setPending(false);
    if (!r.ok) {
      showToast({ kind: "error", message: r.error });
      return;
    }
    setCnp(r.data.cnp);
    setLeft(REVEAL_SECONDS);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="cifre text-corp tracking-wider text-cerneala" aria-live="polite">
        {cnp ?? maskCnp(last2)}
        {cnp && <span className="sr-only">. CNP-ul se ascunde în {left} secunde.</span>}
      </span>
      {cnp ? (
        <>
          <span className="text-mic text-discret cifre" aria-hidden="true">
            se ascunde în {left} s
          </span>
          <Button type="button" variant="text" size="s" icon="eye-off" onClick={() => setCnp(null)}>
            Ascundeți
          </Button>
        </>
      ) : (
        <Button type="button" variant="secondary" size="s" icon="eye" loading={pending} onClick={reveal}>
          Afișați CNP-ul
        </Button>
      )}
    </div>
  );
}
