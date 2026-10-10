import type { SelectHTMLAttributes } from "react";
import { Field, type FieldProps } from "./Field";
import { Icon } from "./Icon";
import { splitFieldProps } from "./TextField";
import { inputClasses } from "./field-styles";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = FieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "id" | "className" | "children"> & {
    options: SelectOption[];
    /** First, empty choice („Alegeți”). Selected when there is no value. */
    placeholder?: string;
    inputClassName?: string;
  };

/** A native select (keyboard and screen readers for free) with the system chevron replaced. */
export function Select(props: SelectProps) {
  const { field, native } = splitFieldProps(props);
  const { options, placeholder, inputClassName, defaultValue, value, ...rest } = native as typeof native & {
    options: SelectOption[];
    placeholder?: string;
    inputClassName?: string;
  };
  const controlled = value !== undefined;
  return (
    <Field {...field}>
      <SelectControl
        options={options}
        placeholder={placeholder}
        className={inputClassName}
        {...rest}
        {...(controlled ? { value } : { defaultValue: defaultValue ?? (placeholder ? "" : undefined) })}
      />
    </Field>
  );
}

function SelectControl({
  options,
  placeholder,
  className,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & { options: SelectOption[]; placeholder?: string }) {
  return (
    <span className="relative block">
      <select className={inputClasses(`h-control cursor-pointer appearance-none pr-11 ${className ?? ""}`)} {...rest}>
        {placeholder !== undefined && (
          <option value="" disabled={rest.required}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        size={20}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-discret"
      />
    </span>
  );
}
