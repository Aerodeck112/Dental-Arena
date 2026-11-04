import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { getCurrentUser } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/next-path";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Intrați în cont" };

/** CRM login (docs/architecture.md §5.1). A signed-in user goes straight to `next`. */
export default async function LoginPage({ searchParams }: PageProps<"/crm/login">) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext);

  if (await getCurrentUser()) redirect(next);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-1">
          <Logo variant="compact" className="h-11 w-auto self-start" title="Dental Arena" />
          <p className="mt-3 text-mic text-discret">Cabinet, aplicația clinicii pentru recepție și medici</p>
        </div>
        <div className="rounded-panou border border-linie bg-suprafata p-6">
          <h1 className="mb-5 font-display text-h1">Intrați în cont</h1>
          <LoginForm next={next} />
        </div>
        <p className="mt-4 text-mic text-discret">
          Ați uitat parola? Cereți-i administratorului clinicii o parolă nouă.
        </p>
      </div>
    </main>
  );
}
