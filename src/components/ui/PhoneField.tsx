import type { TextFieldProps } from "./TextField";
import { Field } from "./Field";
import { splitFieldProps } from "./TextField";
import { inputClasses } from "./field-styles";

/**
 * A phone number: `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, tabular figures.
 * Validation and normalisation to E.164 happen on the server (zPhoneRo).
 */
export function PhoneField(props: Omit<TextFieldProps, "type">) {
  const { field, native } = splitFieldProps(props);
  const { inputClassName, autoComplete = "tel", ...rest } = native as typeof native & { inputClassName?: string };
  return (
    <Field {...field}>
      <input
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        className={inputClasses(`h-control cifre ${inputClassName ?? ""}`)}
        {...rest}
      />
    </Field>
  );
}
