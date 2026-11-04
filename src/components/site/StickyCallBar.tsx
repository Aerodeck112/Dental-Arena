"use client";

import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Icon } from "@/components/ui/Icon";
import { buttonClasses } from "@/components/ui/button-styles";
import { CallSheet } from "./CallSheet";

/**
 * The phone's sticky bar: „Sunați” and „Programați-vă”, 56px, above the home indicator
 * (design-system §6.3). „Sunați” opens the clinic sheet; without JavaScript it goes to the
 * clinics on the contact page, where both numbers are.
 */
export function StickyCallBar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        data-print="ascuns"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-linie bg-suprafata px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-float md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <Link
            href="/contact#clinici"
            aria-haspopup="dialog"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            className={buttonClasses({ variant: "secondary", size: "l", className: "w-full" })}
          >
            <Icon name="phone" size={22} />
            Sunați
          </Link>
          <ButtonLink href="/programare" size="l" className="w-full">
            Programați-vă
          </ButtonLink>
        </div>
      </div>
      <CallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
