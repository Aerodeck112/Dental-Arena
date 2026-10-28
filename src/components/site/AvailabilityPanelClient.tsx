"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import type { ClinicAvailability } from "@/server/public/types";
import { PhoneLink } from "./PhoneLink";

const STORAGE_KEY = "da-clinica-acasa";

const SLOT =
  "apasat flex items-center rounded-control border border-linie-control bg-suprafata text-control text-cerneala transition-colors duration-150 hover:border-cerneala hover:bg-menta-pal";

function ClinicSlots({ clinic, fallback, layout }: { clinic: ClinicAvailability; fallback: string; layout: "tiles" | "rows" }) {
  if (clinic.slots.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-corp text-cerneala">{fallback}</p>
        <PhoneLink clinic={clinic.shortName} phone={clinic.phone} icon className="self-start text-h3" numberClassName="font-semibold" />
      </div>
    );
  }
  return (
    <>
      <ul className={layout === "tiles" ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2"}>
        {clinic.slots.map((s) => (
          <li key={s.startsAt}>
            <Link
              href={s.href}
              className={cn(
                SLOT,
                layout === "tiles"
                  ? "min-h-[4.5rem] flex-col items-start justify-center px-3 py-2"
                  : "min-h-control-l justify-between gap-4 px-4",
              )}
            >
              <span className={cn("cifre", layout === "tiles" ? "text-mic text-discret" : "text-control")}>
                {layout === "tiles" ? s.dayShort : s.dayLong}
              </span>
              <span className="text-h3 font-semibold cifre">
                {s.time}
                <span className="sr-only">, la {clinic.shortName}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={clinic.allHref}
        className="mt-3 inline-flex min-h-control items-center gap-1.5 font-medium text-link underline underline-offset-[0.2em] hover:decoration-2"
      >
        <Icon name="calendar" size={20} />
        Toate orele din {clinic.shortName}
      </Link>
    </>
  );
}

/**
 * The client half of the hero panel. Desktop: both clinics side by side, split on the axis.
 * Phone: a segmented switch that remembers the last clinic (localStorage), with 56px rows.
 * No slot is ever preselected; a slot is a link that opens the wizard with clinic and time set.
 */
export function AvailabilityPanelClient({
  clinics,
  title,
  fallback,
  className,
}: {
  clinics: ClinicAvailability[];
  title: string;
  fallback: string;
  className?: string;
}) {
  const headingId = useId();
  const [chosen, setChosen] = useState(clinics[0]?.clinic ?? "cristesti");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && clinics.some((c) => c.clinic === saved)) setChosen(saved as typeof chosen);
    } catch {
      /* storage blocked: keep the first clinic */
    }
  }, [clinics]);

  const choose = (v: string) => {
    setChosen(v as typeof chosen);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* storage blocked */
    }
  };

  const none = clinics.every((c) => c.slots.length === 0);
  const current = clinics.find((c) => c.clinic === chosen) ?? clinics[0];

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-panou bg-suprafata p-5 shadow-float sm:p-6 lg:p-8", className)}
    >
      <h2 id={headingId} className="text-h3 font-semibold text-cerneala">
        {title}
      </h2>

      {none ? (
        <div className="mt-4">
          <p className="text-corp text-cerneala">{fallback}</p>
          <ul className="relative mt-2 grid gap-y-1 md:grid-cols-2">
            <span aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px bg-linie md:block" />
            {clinics.map((c, i) => (
              <li key={c.clinic} className={i === 0 ? "md:pr-8" : "md:pl-8"}>
                <PhoneLink clinic={c.shortName} phone={c.phone} icon className="gap-3 text-h3" numberClassName="font-semibold" />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {/* Desktop and tablet: both clinics, split on the axis. */}
          <div className="relative mt-5 hidden md:grid md:grid-cols-2">
            <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-linie" />
            {clinics.map((c, i) => (
              <div key={c.clinic} className={i === 0 ? "pr-8" : "pl-8"}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-display text-nume text-cerneala">{c.shortName}</h3>
                  <PhoneLink clinic={c.shortName} phone={c.phone} showClinic={false} className="text-mic text-discret" />
                </div>
                <ClinicSlots clinic={c} fallback={fallback} layout="tiles" />
              </div>
            ))}
          </div>

          {/* Phone: one clinic at a time. */}
          <div className="mt-4 md:hidden">
            <SegmentedControl
              label="Clinica"
              value={current.clinic}
              onChange={choose}
              options={clinics.map((c) => ({ value: c.clinic, label: c.shortName }))}
              className="w-full"
            />
            <div className="mt-4">
              <ClinicSlots clinic={current} fallback={fallback} layout="rows" />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
