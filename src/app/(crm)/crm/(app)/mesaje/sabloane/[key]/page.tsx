import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/crm/comms/TemplateEditor";
import { Breadcrumbs, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth/dal";
import { MESSAGE_CHANNEL_LABEL } from "@/lib/labels";
import { DEFAULT_TEMPLATES, SAMPLE_VARIABLES } from "@/server/notify/default-templates";
import { allowedVariables, getTemplate, isTemplateKey } from "@/server/notify/templates";
import { previewTemplate, resetTemplateAction, saveTemplateAction } from "../../actions";

export async function generateMetadata({ params }: PageProps<"/crm/mesaje/sabloane/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: isTemplateKey(key) ? DEFAULT_TEMPLATES[key].name : "Șablon" };
}

const VARIABLE_HINT: Record<string, string> = {
  prenume: "prenumele pacientului",
  nume: "numele complet",
  data: "ziua programării",
  ora: "ora programării",
  clinica: "numele clinicii",
  clinicaScurt: "localitatea clinicii",
  adresa: "adresa clinicii",
  telefonClinica: "telefonul clinicii",
  medic: "medicul",
  link: "linkul de confirmare sau anulare",
  motiv: "tipul cererii (doar pentru clinică)",
};

/** Template editor: subject and text with variables, live preview with sample data. ADMIN only. */
export default async function TemplateEditorPage({ params }: PageProps<"/crm/mesaje/sabloane/[key]">) {
  await requirePermission("templates.manage");
  const { key } = await params;
  if (!isTemplateKey(key)) notFound();
  const t = await getTemplate(key);
  const def = DEFAULT_TEMPLATES[key];
  const vars = allowedVariables(key).map((name) => ({ name, hint: VARIABLE_HINT[name] ?? "", sample: SAMPLE_VARIABLES[name] }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        before={
          <Breadcrumbs
            items={[
              { href: "/crm/mesaje", label: "Mesaje" },
              { href: "/crm/mesaje/sabloane", label: "Șabloane" },
              { label: t.name },
            ]}
          />
        }
        title={t.name}
        subtitle={`${MESSAGE_CHANNEL_LABEL[t.channel]}. ${t.description}`}
      />
      <TemplateEditor
        templateKey={key}
        channel={t.channel}
        audience={t.audience}
        subject={t.subject}
        body={t.body}
        active={t.active}
        overridden={t.overridden}
        defaultSubject={def.subject}
        defaultBody={def.body}
        variables={vars}
        previewAction={previewTemplate}
        saveAction={saveTemplateAction}
        resetAction={resetTemplateAction}
      />
    </div>
  );
}
