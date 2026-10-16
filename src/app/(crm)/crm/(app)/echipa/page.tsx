import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, DataTable, EmptyState, FlagTag, PageHeader } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/DataTable";
import { requirePermission } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { formatDateRo } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { listStaff, type StaffRow } from "@/server/staff/service";

export const metadata: Metadata = { title: "Echipă" };

/**
 * Echipă: staff accounts and doctor profiles. Everyone sees the list; ADMIN opens and edits
 * accounts, everyone with `schedules.view` opens a doctor's „Program”.
 */
export default async function TeamPage() {
  const user = await requirePermission("staff.view");
  const rows = await listStaff();
  const canManage = can(user, "staff.manage");
  const canSchedules = can(user, "schedules.view");
  const active = rows.filter((r) => r.active).length;

  const columns: DataTableColumn<StaffRow>[] = [
    {
      key: "name",
      header: "Nume",
      render: (r) => <span className={cn("font-semibold", !r.active && "text-discret")}>{r.name}</span>,
    },
    { key: "role", header: "Rol", render: (r) => (r.role ? ROLE_LABEL[r.role] : <span className="text-discret">Fără cont</span>) },
    { key: "email", header: "E-mail", render: (r) => r.email ?? <span className="text-discret">–</span> },
    { key: "home", header: "Clinica", render: (r) => r.homeLocation ?? (r.role ? "Ambele" : "–") },
    {
      key: "doctor",
      header: "Profil public",
      render: (r) =>
        r.doctor ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {r.doctor.publicName}
            {!r.doctor.publicVisible && <FlagTag kind="neutral">Ascuns pe site</FlagTag>}
            {r.doctor.publicVisible && !r.doctor.acceptsOnlineBooking && <FlagTag kind="neutral">Fără programare online</FlagTag>}
          </span>
        ) : (
          <span className="text-discret">–</span>
        ),
    },
    {
      key: "state",
      header: "Stare",
      render: (r) => (r.active ? "Activ" : <FlagTag kind="neutral">Inactiv</FlagTag>),
    },
    {
      key: "login",
      header: "Ultima intrare",
      render: (r) => (r.lastLoginAt ? formatDateRo(r.lastLoginAt, "short") : <span className="text-discret">–</span>),
    },
    ...(canSchedules
      ? [
          {
            key: "program",
            header: <span className="sr-only">Program</span>,
            align: "right" as const,
            render: (r: StaffRow) =>
              r.doctor ? (
                <Link href={`/crm/echipa/${r.doctor.id}/program`} className="relative z-10 text-link underline underline-offset-2">
                  Program
                </Link>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageHeader
        title="Echipă"
        subtitle={`${active} ${active === 1 ? "persoană activă" : "persoane active"}. Profilurile publice ale medicilor apar pe site, în Echipă, și la programarea online.`}
        actions={
          canManage && (
            <>
              <ButtonLink href="/crm/echipa/nou?tip=medic" variant="secondary" icon="plus">
                Profil de medic fără cont
              </ButtonLink>
              <ButtonLink href="/crm/echipa/nou" icon="plus">
                Utilizator nou
              </ButtonLink>
            </>
          )
        }
      />
      <DataTable
        caption="Echipa"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        rowHref={canManage ? (r) => `/crm/echipa/${r.id}` : undefined}
        empty={<EmptyState title="Niciun utilizator. Adăugați primul cont de recepție sau de medic." />}
      />
    </div>
  );
}
