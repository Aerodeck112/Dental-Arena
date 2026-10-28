import type { TextFieldProps } from "./TextField";
import { Field } from "./Field";
import { splitFieldProps } from "./TextField";
import { inputClasses } from "./field-styles";

/** A time of day as `HH:MM` (24h). `step` defaults to 15 minutes, the calendar grid. */
export function TimeInput(props: Omit<TextFieldProps, "type">) {
  const { field, native } = splitFieldProps(props);
  const { inputClassName, step = 900, ...rest } = native as typeof native & { inputClassName?: string };
  return (
    <Field {...field}>
      <input type="time" step={step} className={inputClasses(`h-control cifre ${inputClassName ?? ""}`)} {...rest} />
    </Field>
  );
}
