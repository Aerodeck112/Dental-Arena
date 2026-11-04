import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { AppearanceForm, PasswordForm, ProfileForm } from "./AccountForms";

export const metadata: Metadata = { title: "Contul meu" };

/** „Contul meu”: name, password (with the policy), theme and density. Any signed-in user. */
export default async function AccountPage({ searchParams }: PageProps<"/crm/cont">) {
  const user = await requireUser();
  const params = await searchParams;
  const forced = user.mustChangePassword || params.schimbare === "1";
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <header>
        <h1 className="font-display text-h1">Contul meu</h1>
        <p className="mt-1 text-corp text-discret">
          {user.email}, {ROLE_LABEL[user.role]}
        </p>
      </header>
      {forced ? <PasswordForm forced /> : null}
      <ProfileForm
        firstName={user.firstName}
        lastName={user.lastName}
        phone={row?.phone ? formatPhone(row.phone).replace(/ /g, " ") : ""}
      />
      {forced ? null : <PasswordForm forced={false} />}
      <AppearanceForm theme={user.theme} density={user.density} />
    </div>
  );
}
