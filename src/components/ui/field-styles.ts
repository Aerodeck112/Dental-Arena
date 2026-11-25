import { cn } from "@/lib/cn";

/** Text inputs, selects and text areas: 1px linie-control border (≥3:1), carmin when invalid. */
export function inputClasses(className?: string): string {
  return cn(
    "block w-full rounded-control border border-linie-control bg-suprafata px-3.5 text-control text-cerneala",
    "placeholder:text-discret",
    "transition-colors duration-150 ease-filet hover:border-cerneala",
    "aria-[invalid=true]:border-2 aria-[invalid=true]:border-carmin",
    "disabled:cursor-not-allowed disabled:border-linie-control disabled:bg-adancit disabled:text-discret",
    "read-only:bg-adancit",
    className,
  );
}
