"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/TextField";
import type { PriceUnit } from "@/generated/prisma/enums";
import { formatLei } from "@/lib/format";
import { parsePriceText, PRICE_INPUT_HINT } from "@/server/catalog/price";

/**
 * A price as the clinic writes it: „1.200”, „900 / 1.100” or „de la 200” (blank = set at the
 * consultation). Below it, how the site will show it, with the same `formatLei` the site uses.
 */
export function PriceInput({
  name = "price",
  defaultValue = "",
  unit,
  error,
  disabled,
}: {
  name?: string;
  defaultValue?: string;
  unit?: PriceUnit;
  error?: string | string[];
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const parsed = parsePriceText(value);
  const preview = parsed.ok
    ? `Pe site: ${formatLei(parsed.value.priceMin, { from: parsed.value.priceFrom, max: parsed.value.priceMax, unit })}`
    : parsed.error;
  return (
    <div className="flex flex-col gap-1">
      <TextField
        label="Preț (lei)"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        hint={PRICE_INPUT_HINT}
        error={error}
        autoComplete="off"
        disabled={disabled}
        inputClassName="cifre"
      />
      <p aria-live="polite" className={parsed.ok ? "text-mic text-discret cifre" : "text-mic text-carmin"}>
        {preview}
      </p>
    </div>
  );
}
