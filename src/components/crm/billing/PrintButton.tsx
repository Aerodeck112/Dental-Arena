"use client";

import { Button } from "@/components/ui/Button";

/** Opens the browser's print dialog (A4, light palette, no CRM chrome). */
export function PrintButton({ label = "Tipăriți" }: { label?: string }) {
  return (
    <Button type="button" icon="printer" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
