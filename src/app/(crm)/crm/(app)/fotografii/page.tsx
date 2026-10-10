import { PhotoUploader } from "@/components/crm/media/PhotoUploader";
import { PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/dal";
import { listSiteImages } from "@/server/media/site-images";

export const metadata = { title: "Fotografii site" };

const GROUP_INTRO: Record<string, string> = {
  "Acasă": "Fotografiile din prima pagină a site-ului.",
  Clinicile: "Apar pe prima pagină și pe pagina de contact.",
  "Despre noi": "Fotografiile din pagina „Despre noi”.",
  Servicii: "Fotografia mare din pagina fiecărui serviciu.",
};

/** `/crm/fotografii`: every photo place of the public site, changed by uploading a new photo. */
export default async function SiteImagesPage() {
  await requirePermission("settings.manage");
  const rows = await listSiteImages();
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Fotografii site"
        subtitle="Încărcați fotografiile clinicii direct de aici. Le micșorăm automat și apar pe site în câteva secunde. Fotografiile medicilor se schimbă din Echipă, pe profilul fiecăruia."
      />
      {groups.map((g) => (
        <section key={g} aria-labelledby={`grup-${g}`} className="flex flex-col gap-4">
          <div>
            <h2 id={`grup-${g}`} className="text-h3 font-semibold">
              {g}
            </h2>
            <p className="text-mic text-discret">{GROUP_INTRO[g]}</p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows
              .filter((r) => r.group === g)
              .map((r) => (
                <li key={r.key} className="flex flex-col gap-3 rounded-panou border border-linie bg-suprafata p-4">
                  <div>
                    <h3 className="text-control font-semibold">{r.label}</h3>
                    <p className="text-mic text-discret">{r.hint}</p>
                  </div>
                  <PhotoUploader target={{ key: r.key }} src={r.current.src} alt={r.current.alt} isDefault={r.isDefault} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
