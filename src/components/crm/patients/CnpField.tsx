"use client";

import { useState } from "react";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextField } from "@/components/ui/TextField";
import { CnpReveal } from "./CnpReveal";

/** Birth date and sex from a well-formed CNP (client-side convenience; the server re-validates). */
export function cnpHints(cnp: string): { birthDate: string; sex: "F" | "M" } | null {
  if (!/^\d{13}$/.test(cnp)) return null;
  const s = Number(cnp[0]);
  const century = s === 1 || s === 2 ? 1900 : s === 3 || s === 4 ? 1800 : s === 5 || s === 6 ? 2000 : null;
  if (century === null) return null;
  const y = century + Number(cnp.slice(1, 3));
  const birthDate = `${y}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`;
  const d = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== birthDate) return null;
  return { birthDate, sex: s % 2 === 1 ? "M" : "F" };
}

type Props = {
  error?: string[];
  /** Create: a plain input. Edit: the masked value with reveal, and keep / change / clear. */
  existing?: { patientId: string; last2: string | null } | null;
  onCnp?: (hints: { birthDate: string; sex: "F" | "M" }) => void;
};

/** CNP input: validated and encrypted on the server, never sent back to the form in clear. */
export function CnpField({ error, existing, onCnp }: Props) {
  const [mode, setMode] = useState<"keep" | "set" | "clear">(existing?.last2 ? "keep" : "set");
  const input = (
    <TextField
      label="CNP"
      name="cnp"
      optional
      inputMode="numeric"
      autoComplete="off"
      maxLength={13}
      hint="13 cifre. Data nașterii și sexul se completează din CNP."
      error={error}
      inputClassName="cifre tracking-wider"
      onChange={(e) => {
        const h = cnpHints(e.target.value.replace(/\s/g, ""));
        if (h) onCnp?.(h);
      }}
    />
  );
  if (!existing) return input;
  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="cnpAction" value={mode} />
      {existing.last2 ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-control font-semibold text-cerneala">CNP</span>
            <CnpReveal patientId={existing.patientId} last2={existing.last2} />
          </div>
          <RadioGroup
            legend="CNP-ul din fișă"
            hideLegend
            name="cnpChoice"
            inline
            value={mode}
            onChange={(v) => setMode(v as typeof mode)}
            options={[
              { value: "keep", label: "Păstrați" },
              { value: "set", label: "Schimbați" },
              { value: "clear", label: "Ștergeți" },
            ]}
          />
          {mode === "set" && input}
        </>
      ) : (
        input
      )}
    </div>
  );
}
