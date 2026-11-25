import Link from "next/link";
import { formatDateTime } from "@/lib/format";

/**
 * Audit log, read-only (docs/architecture.md §8.4). Rows are DTOs built by the page; metadata
 * holds field names and ids only, never personal values. A table from tablet width up, one block
 * per entry on phones.
 */

export type AuditRow = {
  id: string;
  at: string;
  actor: string;
  actorRole: string | null;
  action: string;
  actionLabel: string;
  entity: string;
  entityHref: string | null;
  patient: { id: string; label: string } | null;
  details: string | null;
};

const linkClass = "text-link underline-offset-2 hover:underline";

function Entity({ r }: { r: AuditRow }) {
  return r.entityHref ? (
    <Link href={r.entityHref} className={linkClass}>
      {r.entity}
    </Link>
  ) : (
    <>{r.entity}</>
  );
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <>
      <ul className="flex flex-col md:hidden" aria-label="Jurnalul de audit, cele mai noi înregistrări primele">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 border-b border-linie py-3 text-mic cifre">
            <p>
              <span className="font-semibold">{r.actionLabel}</span>, <Entity r={r} />
            </p>
            <p className="text-discret">
              {formatDateTime(new Date(r.at))}, {r.actor}
              {r.actorRole ? ` (${r.actorRole})` : ""}
            </p>
            {r.patient ? (
              <p>
                Pacient:{" "}
                <Link href={`/crm/pacienti/${r.patient.id}`} className={linkClass}>
                  {r.patient.label}
                </Link>
              </p>
            ) : null}
            {r.details ? <p className="text-discret [overflow-wrap:anywhere]">{r.details}</p> : null}
          </li>
        ))}
      </ul>

      <div className="relative hidden w-full overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-mic cifre">
          <caption className="sr-only">Jurnalul de audit, cele mai noi înregistrări primele</caption>
          <thead>
            <tr className="border-b border-linie-control text-discret">
              <th scope="col" className="px-3 pb-2 font-semibold whitespace-nowrap">
                Data și ora
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Cine
              </th>
              <th scope="col" className="min-w-44 px-3 pb-2 font-semibold">
                Acțiune
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Înregistrare
              </th>
              <th scope="col" className="px-3 pb-2 font-semibold">
                Pacient
              </th>
              <th scope="col" className="w-full min-w-56 px-3 pb-2 font-semibold">
                Detalii
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="h-rand border-b border-linie align-top">
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(new Date(r.at))}</td>
                <td className="px-3 py-2">
                  <span className="whitespace-nowrap">{r.actor}</span>
                  {r.actorRole ? <span className="block text-discret">{r.actorRole}</span> : null}
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{r.actionLabel}</span>
                  <span className="block text-micro text-discret">{r.action}</span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Entity r={r} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.patient ? (
                    <Link href={`/crm/pacienti/${r.patient.id}`} className={linkClass}>
                      {r.patient.label}
                    </Link>
                  ) : (
                    <span className="text-discret">–</span>
                  )}
                </td>
                <td className="px-3 py-2 text-discret [overflow-wrap:anywhere]">{r.details ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
