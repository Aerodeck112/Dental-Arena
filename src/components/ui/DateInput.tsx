import type { TextFieldProps } from "./TextField";
import { Field } from "./Field";
import { splitFieldProps } from "./TextField";
import { inputClasses } from "./field-styles";

/** A calendar day as ISO `YYYY-MM-DD` (the native date picker; the browser shows it in local format). */
export function DateInput(props: Omit<TextFieldProps, "type">) {
  const { field, native } = splitFieldProps(props);
  const { inputClassName, ...rest } = native as typeof native & { inputClassName?: string };
  return (
    <Field {...field}>
      <input type="date" className={inputClasses(`h-control cifre ${inputClassName ?? ""}`)} {...rest} />
    </Field>
  );
}
