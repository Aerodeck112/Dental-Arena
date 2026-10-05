import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { FieldError } from "./Field";
import { Icon } from "./Icon";
import { errorList, fieldIds } from "./field-ids";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  label: ReactNode;
  name: string;
  /** Plain sentence under the label. */
  description?: ReactNode;
  error?: string | string[] | null;
  className?: string;
};

/** Native checkbox, drawn to the system: 1.5px linie-control box, actiune fill and a check when on. */
export function Checkbox({ label, name, id, description, error, className, value = "on", ...rest }: CheckboxProps) {
  const ids = fieldIds(id ? id : value === "on" ? name : `${name}-${String(value)}`, id);
  const errors = errorList(error);
  const describedBy =
    [description ? ids.hintId : null, errors.length ? ids.errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {errors.length > 0 && <FieldError id={ids.errorId} errors={errors} />}
      <label htmlFor={ids.controlId} className="group flex min-h-control-s cursor-pointer items-start gap-3 py-1.5">
        <CheckboxBox
          id={ids.controlId}
          name={name}
          value={value}
          aria-describedby={describedBy}
          aria-invalid={errors.length ? true : undefined}
          {...rest}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-corp text-cerneala group-has-[:disabled]:text-discret">{label}</span>
          {description && (
            <span id={ids.hintId} className="text-mic text-discret">
              {description}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

/** The drawn box alone (tables, custom layouts). Sized in em so it follows the density. */
export function CheckboxBox(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const { className, ...rest } = props;
  return (
    <span className="relative mt-[0.12em] inline-flex shrink-0 text-corp">
      <input
        type="checkbox"
        className={cn(
          "peer size-[1.3em] cursor-pointer appearance-none rounded-bloc border-[1.5px] border-linie-control bg-suprafata",
          "transition-colors duration-100 ease-filet hover:border-cerneala",
          "checked:border-actiune checked:bg-actiune",
          "aria-[invalid=true]:border-2 aria-[invalid=true]:border-carmin",
          "disabled:cursor-not-allowed disabled:border-linie-control disabled:bg-adancit",
          className,
        )}
        {...rest}
      />
      <Icon
        name="check"
        size={16}
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto size-[0.95em] text-pe-actiune opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
