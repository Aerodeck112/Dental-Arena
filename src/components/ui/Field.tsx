import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { errorList, fieldIds } from "./field-ids";

export type FieldProps = {
  label: ReactNode;
  name: string;
  /** Defaults to `field-<name>`, the id ErrorSummary links to. */
  id?: string;
  hint?: ReactNode;
  error?: string | string[] | null;
  required?: boolean;
  /** Shows „(opțional)” after the label. */
  optional?: boolean;
  /** Keeps the label for screen readers only (top-bar search). Labels are otherwise always visible. */
  hideLabel?: boolean;
  className?: string;
};

type ControlProps = {
  id?: string;
  name?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * Label, hint and error around one control. Wires `id`, `name`, `aria-describedby`,
 * `aria-invalid` and `required` onto the child element.
 */
export function Field({
  label,
  name,
  id,
  hint,
  error,
  required,
  optional,
  hideLabel,
  className,
  children,
}: FieldProps & { children: ReactNode }) {
  const { controlId, hintId, errorId } = fieldIds(name, id);
  const errors = errorList(error);
  const describedBy = [hint ? hintId : null, errors.length ? errorId : null].filter(Boolean).join(" ") || undefined;

  let control = children;
  if (isValidElement<ControlProps>(children)) {
    const own = children.props;
    control = cloneElement(children as ReactElement<ControlProps>, {
      id: own.id ?? controlId,
      name: own.name ?? name,
      required: own.required ?? required,
      "aria-describedby": [own["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined,
      "aria-invalid": errors.length ? true : own["aria-invalid"],
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className={cn("text-control font-medium text-cerneala", hideLabel && "sr-only")}>
        {label}
        {optional && <span className="font-normal text-discret"> (opțional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="-mt-0.5 text-mic text-discret">
          {hint}
        </p>
      )}
      {errors.length > 0 && <FieldError id={errorId} errors={errors} />}
      {control}
    </div>
  );
}

export function FieldError({ id, errors }: { id: string; errors: string[] }) {
  return (
    <div id={id} className="flex flex-col gap-0.5">
      {errors.map((message, i) => (
        <p key={i} className="flex items-start gap-1.5 text-mic font-medium text-carmin">
          <Icon name="alert-triangle" size={16} className="mt-[0.2em]" />
          <span>
            <span className="sr-only">Eroare: </span>
            {message}
          </span>
        </p>
      ))}
    </div>
  );
}
