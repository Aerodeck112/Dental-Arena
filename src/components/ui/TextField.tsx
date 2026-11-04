import type { InputHTMLAttributes } from "react";
import { Field, type FieldProps } from "./Field";
import { inputClasses } from "./field-styles";

export type TextFieldProps = FieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "className"> & {
    /** Classes for the <input>; `className` styles the wrapper. */
    inputClassName?: string;
  };

/** Split Field props from the native input attributes. */
export function splitFieldProps<T extends FieldProps>(props: T) {
  const { label, name, id, hint, error, required, optional, hideLabel, className, ...native } = props;
  return { field: { label, name, id, hint, error, required, optional, hideLabel, className }, native };
}

export function TextField(props: TextFieldProps) {
  const { field, native } = splitFieldProps(props);
  const { inputClassName, type = "text", ...rest } = native as typeof native & { inputClassName?: string };
  return (
    <Field {...field}>
      <input type={type} className={inputClasses(`h-control ${inputClassName ?? ""}`)} {...rest} />
    </Field>
  );
}
