import type { InputHTMLAttributes, ReactNode } from "react";
import { Checkbox } from "./Checkbox";

export type ConsentCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "children"> & {
  name: string;
  required?: boolean;
  /** The consent sentence, with links (e.g. to Politica de confidențialitate). */
  children: ReactNode;
  error?: string | string[] | null;
  className?: string;
};

/**
 * A consent: unticked by default, never pre-checked. A required consent says so in words
 * after the sentence; the server records the text version with the answer.
 */
export function ConsentCheckbox({ name, required = false, children, error, className, ...rest }: ConsentCheckboxProps) {
  return (
    <Checkbox
      name={name}
      required={required}
      error={error}
      className={className}
      label={
        <>
          {children}
          {required ? (
            <span className="text-discret"> (obligatoriu)</span>
          ) : (
            <span className="text-discret"> (opțional)</span>
          )}
        </>
      }
      {...rest}
    />
  );
}
