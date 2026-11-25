"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

export type SubmitButtonProps = Omit<ButtonProps, "type" | "loading"> & {
  /** Label while the form is being sent, e.g. „Se trimite”. Defaults to the normal label. */
  pendingLabel?: string;
};

/** Submit button that shows the pending state of its parent <form> (useFormStatus). */
export function SubmitButton({ pendingLabel, children, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
