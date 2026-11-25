import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageHeaderProps = {
  /** Forum: in the CRM this is one of only two places it appears (with the patient's name). */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons on the right (wrap under the title on narrow screens). */
  actions?: ReactNode;
  /** Above the title: breadcrumbs. Never an eyebrow label. */
  before?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, before, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {before}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-h1 text-cerneala">{title}</h1>
          {subtitle && <p className="mt-1.5 text-corp text-discret masura">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
