import { Icon } from "@/components/ui/Icon";
import { formatPhone, telHref } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * A clinic phone number: grouped with no-break spaces, never wrapping, a tel: link, and always
 * named with its clinic, for screen readers first („Sunați la Cristești, 0265 326 316”, §11.2).
 */
export function PhoneLink({
  clinic,
  phone,
  showClinic = true,
  icon = false,
  className,
  numberClassName,
}: {
  /** „Cristești” */
  clinic: string;
  phone: string;
  /** Show the clinic name before the number (otherwise it is spoken only). */
  showClinic?: boolean;
  icon?: boolean;
  className?: string;
  numberClassName?: string;
}) {
  const number = formatPhone(phone);
  return (
    <a
      href={telHref(phone)}
      aria-label={`Sunați la ${clinic}, ${number}`}
      className={cn(
        "group inline-flex min-h-control items-center gap-2 text-cerneala underline decoration-linie-control decoration-1 underline-offset-[0.25em] hover:decoration-2 hover:decoration-current",
        className,
      )}
    >
      {icon && <Icon name="phone" size={20} className="shrink-0 text-discret group-hover:text-current" />}
      {showClinic && <span>{clinic}</span>}
      <span className={cn("telefon", numberClassName)}>{number}</span>
    </a>
  );
}
