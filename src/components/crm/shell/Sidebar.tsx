"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType } from "react";
import {
  CalendarDays,
  CalendarOff,
  ChartLine,
  FileText,
  House,
  Inbox,
  MapPin,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import type { ShellUser } from "./AppShell";
import { useShell } from "./AppShell";
import { isNavItemActive, navItemsFor, type NavCountKey, type NavIcon } from "./nav";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;

const ICONS: Record<NavIcon, IconComponent> = {
  azi: House,
  calendar: CalendarDays,
  cereri: Inbox,
  pacienti: Users,
  rechemari: PhoneCall,
  incasari: ReceiptText,
  facturi: FileText,
  servicii: Tags,
  echipa: UsersRound,
  absente: CalendarOff,
  locatii: MapPin,
  mesaje: MessageSquare,
  rapoarte: ChartLine,
  gdpr: ShieldCheck,
  audit: ScrollText,
  setari: Settings,
};

/** Count badge: `cerneala` on `menta-pal`, never mustard or red (design system §3.4). */
function Count({ value, rail }: { value: number; rail: boolean }) {
  return (
    <span
      className={cn(
        "cifre inline-flex min-w-5 items-center justify-center rounded-chip border border-linie bg-menta-pal px-1.5 text-micro font-semibold text-cerneala",
        rail && "absolute -right-1 -top-1 min-w-4 px-1",
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

function NavList({
  user,
  counts,
  rail,
  onNavigate,
}: {
  user: ShellUser;
  counts: Partial<Record<NavCountKey, number>>;
  /** Icons only (labels stay available to screen readers). */
  rail: "always" | "below-lg" | "never";
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "/crm";
  const items = navItemsFor(user);
  const labelClass =
    rail === "always" ? "sr-only" : rail === "below-lg" ? "sr-only lg:not-sr-only lg:truncate" : "truncate";
  const itemLayout =
    rail === "always" ? "justify-center px-0" : rail === "below-lg" ? "justify-center px-0 lg:justify-start lg:px-3" : "px-3";

  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isNavItemActive(item, pathname);
        const count = item.count ? (counts[item.count] ?? 0) : 0;
        const countLabel = count > 0 ? `, ${count} ${item.count === "leadsNew" ? "noi" : "de rezolvat"}` : "";
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={rail === "never" ? undefined : item.label}
              className={cn(
                "relative flex h-9 items-center gap-3 rounded-control text-control text-cerneala transition-colors duration-150 hover:bg-adancit",
                itemLayout,
                active &&
                  "bg-menta-pal font-semibold before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-actiune hover:bg-menta-pal",
              )}
            >
              <span className="relative inline-flex shrink-0">
                <Icon className="size-[18px]" aria-hidden strokeWidth={1.5} />
                {count > 0 && rail === "always" ? <Count value={count} rail /> : null}
                {count > 0 && rail === "below-lg" ? (
                  <span className="lg:hidden">
                    <Count value={count} rail />
                  </span>
                ) : null}
              </span>
              <span className={cn("min-w-0 flex-1", labelClass)}>
                {item.label}
                <span className="sr-only">{countLabel}</span>
              </span>
              {count > 0 && rail !== "always" ? (
                <span className={rail === "below-lg" ? "hidden lg:inline-flex" : "inline-flex"} aria-hidden="true">
                  <Count value={count} rail={false} />
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserFooter({ user, compact }: { user: ShellUser; compact: "always" | "below-lg" | "never" }) {
  const textClass = compact === "always" ? "sr-only" : compact === "below-lg" ? "sr-only lg:not-sr-only" : "";
  return (
    <div className={cn("min-w-0 px-3 py-2 text-mic", textClass)}>
      <p className="truncate font-semibold text-cerneala">{user.firstName}</p>
      <p className="truncate text-discret">{user.roleLabel}</p>
    </div>
  );
}

/**
 * Sidebar (design system §6.8): 240px on `fundal`; a 64px rail with the mark only when collapsed
 * (by the user, or automatically between 768 and 1024px); an overlay sheet below 768px.
 */
export function Sidebar({ user, counts }: { user: ShellUser; counts: Partial<Record<NavCountKey, number>> }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useShell();
  const rail = collapsed ? "always" : "below-lg";
  const sheetRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close the mobile sheet on navigation and on Escape; move focus into it when it opens.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  return (
    <>
      <aside
        aria-label="Meniul principal"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col bg-fundal py-3 md:flex",
          collapsed ? "w-16 px-2" : "w-16 px-2 lg:w-60 lg:px-3",
        )}
      >
        <Link
          href="/crm"
          className={cn("mb-4 flex h-10 items-center gap-2 rounded-control", collapsed ? "justify-center" : "justify-center lg:justify-start lg:px-2")}
        >
          <Logo variant="mark" className="h-8 w-auto shrink-0" title="Dental Arena" />
          <span className={cn("text-h3 font-semibold text-cerneala", collapsed ? "sr-only" : "sr-only lg:not-sr-only")}>
            Cabinet
          </span>
        </Link>
        <nav aria-label="Module" className="min-h-0 flex-1 overflow-y-auto">
          <NavList user={user} counts={counts} rail={rail} />
        </nav>
        <div className="mt-3 flex flex-col gap-1 border-t border-linie pt-3">
          <UserFooter user={user} compact={rail} />
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "hidden h-8 items-center gap-2 rounded-control text-mic text-discret hover:bg-adancit hover:text-cerneala lg:flex",
              collapsed ? "justify-center" : "px-3",
            )}
            aria-label={collapsed ? "Extindeți meniul" : "Restrângeți meniul"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" aria-hidden strokeWidth={1.5} />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" aria-hidden strokeWidth={1.5} />
                <span>Restrângeți meniul</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default bg-cerneala/40"
            aria-label="Închideți meniul"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Meniul principal"
            className="da-drawer absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-fundal px-3 py-3 shadow-float"
          >
            <div className="mb-4 flex items-center justify-between">
              <Link href="/crm" className="flex h-10 items-center gap-2 px-2" onClick={() => setMobileOpen(false)}>
                <Logo variant="mark" className="h-8 w-auto" title="Dental Arena" />
                <span className="text-h3 font-semibold">Cabinet</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex size-10 items-center justify-center rounded-control text-discret hover:bg-adancit hover:text-cerneala"
                aria-label="Închideți meniul"
              >
                <X className="size-5" aria-hidden strokeWidth={1.5} />
              </button>
            </div>
            <nav aria-label="Module" className="min-h-0 flex-1 overflow-y-auto">
              <NavList user={user} counts={counts} rail="never" onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="mt-3 border-t border-linie pt-3">
              <UserFooter user={user} compact="never" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
