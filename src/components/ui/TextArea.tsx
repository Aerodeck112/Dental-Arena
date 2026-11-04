import type { TextareaHTMLAttributes } from "react";
import { Field, type FieldProps } from "./Field";
import { splitFieldProps } from "./TextField";
import { inputClasses } from "./field-styles";

export type TextAreaProps = FieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id" | "className"> & { inputClassName?: string };

export function TextArea(props: TextAreaProps) {
  const { field, native } = splitFieldProps(props);
  const { inputClassName, rows = 4, ...rest } = native as typeof native & { inputClassName?: string };
  return (
    <Field {...field}>
      <textarea rows={rows} className={inputClasses(`min-h-24 resize-y py-2.5 ${inputClassName ?? ""}`)} {...rest} />
    </Field>
  );
}
