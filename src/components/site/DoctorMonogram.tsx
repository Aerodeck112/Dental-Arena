import { cn } from "@/lib/cn";

/**
 * The plate for a doctor without a real portrait (design-system §9.3): `menta-pal`, initials in
 * Forum, inside the same 4:5 frame as the photos. Never a stock face.
 */
export function DoctorMonogram({ monogram, size = "row", className }: { monogram: string; size?: "row" | "profile"; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex size-full items-center justify-center bg-menta-pal font-display text-cerneala", className)}
    >
      <span className={cn("leading-none", size === "profile" ? "text-[4.5rem]" : "text-[3rem]")}>{monogram}</span>
    </div>
  );
}
