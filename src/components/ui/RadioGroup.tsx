import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FieldError } from "./Field";
import { errorList, fieldIds } from "./field-ids";

export type RadioOption = { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean };

export type RadioGroupProps = {
  legend: ReactNode;
  name: string;
  options: RadioOption[];
  defaultValue?: string;
  /** Controlled value (client forms); pair with onChange. */
  value?: string;
  onChange?: (value: string) => void;
  error?: string | string[] | null;
  hint?: ReactNode;
  required?: boolean;
  /** Lay the options out in a row when they are short („Pentru mine”, „Pentru copilul meu”). */
  inline?: boolean;
  hideLegend?: boolean;
  className?: string;
};

/** A <fieldset> of native radios: arrow keys move the choice, the legend names the question. */
export function RadioGroup({
  legend,
  name,
  options,
  defaultValue,
  value,
  onChange,
  error,
  hint,
  required,
  inline = false,
  hideLegend = false,
  className,
}: RadioGroupProps) {
  const ids = fieldIds(name);
  const errors = errorList(error);
  const describedBy = [hint ? ids.hintId : null, errors.length ? ids.errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset
      id={ids.controlId}
      tabIndex={-1}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      data-invalid={errors.length ? "" : undefined}
      className={cn("group/radios flex min-w-0 flex-col gap-1.5", className)}
    >
      <legend className={cn("mb-1.5 text-control font-medium text-cerneala", hideLegend && "sr-only")}>{legend}</legend>
      {hint && (
        <p id={ids.hintId} className="-mt-1 text-mic text-discret">
          {hint}
        </p>
      )}
      {errors.length > 0 && <FieldError id={ids.errorId} errors={errors} />}
      <div className={cn("flex", inline ? "flex-row flex-wrap gap-x-6" : "flex-col")}>
        {options.map((o) => {
          const id = `${ids.controlId}-${o.value.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
          const descId = o.description ? `${id}-desc` : undefined;
          const checkedProps =
            value !== undefined
              ? { checked: value === o.value, onChange: () => onChange?.(o.value) }
              : { defaultChecked: defaultValue === o.value };
          return (
            <label key={o.value} htmlFor={id} className="group flex min-h-control-s cursor-pointer items-start gap-3 py-1.5">
              <span className="relative mt-[0.12em] inline-flex shrink-0 text-corp">
                <input
                  type="radio"
                  id={id}
                  name={name}
                  value={o.value}
                  required={required}
                  disabled={o.disabled}
                  aria-describedby={descId}
                  className={cn(
                    "size-[1.3em] cursor-pointer appearance-none rounded-full border-[1.5px] border-linie-control bg-suprafata",
                    "transition-[border-color,box-shadow] duration-100 ease-filet hover:border-cerneala",
                    "checked:border-actiune checked:bg-actiune checked:shadow-[inset_0_0_0_0.22em_var(--da-suprafata)]",
                    "group-data-[invalid]/radios:border-2 group-data-[invalid]/radios:border-carmin",
                    "disabled:cursor-not-allowed disabled:bg-adancit",
                  )}
                  {...checkedProps}
                />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-corp text-cerneala group-has-[:disabled]:text-discret">{o.label}</span>
                {o.description && (
                  <span id={descId} className="text-mic text-discret">
                    {o.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
