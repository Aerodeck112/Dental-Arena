import type { InputHTMLAttributes } from "react";
import type { TextFieldProps } from "./TextField";
import { Field } from "./Field";
import { Icon } from "./Icon";
import { splitFieldProps } from "./TextField";
import { inputClasses } from "./field-styles";

/**
 * A search box with a leading magnifier. Put it in a GET <form> (e.g. /crm/pacienti?q=).
 * `shortcut` shows a hint such as „/” and is announced with aria-keyshortcuts.
 */
export function SearchField(props: Omit<TextFieldProps, "type"> & { shortcut?: string }) {
  const { field, native } = splitFieldProps(props);
  const { inputClassName, shortcut, autoComplete = "off", ...rest } = native as typeof native & {
    inputClassName?: string;
    shortcut?: string;
  };
  return (
    <Field {...field}>
      <SearchControl
        shortcut={shortcut}
        autoComplete={autoComplete}
        className={inputClassName}
        {...rest}
      />
    </Field>
  );
}

function SearchControl({
  shortcut,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { shortcut?: string }) {
  return (
    <span className="relative block">
      <Icon
        name="search"
        size={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-discret"
      />
      <input
        type="search"
        enterKeyHint="search"
        aria-keyshortcuts={shortcut}
        className={inputClasses(`h-control pl-10 ${shortcut ? "pr-10" : ""} ${className ?? ""}`)}
        {...rest}
      />
      {shortcut && (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-bloc border border-linie px-1.5 text-micro text-discret"
        >
          {shortcut}
        </kbd>
      )}
    </span>
  );
}
