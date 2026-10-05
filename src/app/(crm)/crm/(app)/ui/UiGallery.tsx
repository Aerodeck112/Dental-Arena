"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { Logo } from "@/components/brand/Logo";
import { ThreadGlyph } from "@/components/brand/ThreadGlyph";
import { ThreadSteps } from "@/components/brand/ThreadSteps";
import {
  Accordion,
  Breadcrumbs,
  Button,
  ButtonLink,
  Checkbox,
  ChoiceButton,
  ChoicePanel,
  ConsentCheckbox,
  CountBadge,
  DataTable,
  DateInput,
  Dialog,
  Drawer,
  EmptyState,
  ErrorSummary,
  FlagTag,
  Icon,
  ICON_NAMES,
  Menu,
  PageHeader,
  Pagination,
  Panel,
  PhoneField,
  Popover,
  RadioGroup,
  SearchField,
  SegmentedControl,
  Select,
  SlotButton,
  Spinner,
  STATUS_BLOCK,
  STATUS_ICON,
  StatusChip,
  SubmitButton,
  Tabs,
  TextArea,
  TextField,
  TextLink,
  TimeInput,
  Toaster,
  useToast,
  WeekStrip,
  type WeekStripDay,
} from "@/components/ui";
import { CONTRAST_PAIRS, contrastRatio, parseColor, type RoleToken } from "@/components/ui/contrast";
import { cn } from "@/lib/cn";

type Theme = "system" | "light" | "dark";
type Density = "site" | "compact" | "confortabil";

const STATUSES: AppointmentStatus[] = [
  "PROGRAMAT",
  "CONFIRMAT",
  "SOSIT",
  "IN_TRATAMENT",
  "FINALIZAT",
  "ANULAT",
  "NEPREZENTAT",
];

const TOKENS: RoleToken[] = [
  "fundal",
  "suprafata",
  "adancit",
  "cerneala",
  "discret",
  "actiune",
  "actiune-apasat",
  "pe-actiune",
  "link",
  "focus",
  "menta",
  "pe-menta",
  "menta-pal",
  "linie",
  "linie-control",
  "mustar",
  "mustar-pal",
  "mustar-text",
  "carmin",
  "carmin-pal",
  "subsol",
  "pe-subsol",
];

const BOOKING_STEPS = ["Motivul și clinica", "Ziua și ora", "Cum vă simțiți", "Datele dumneavoastră"];
const IMPLANT_STEPS = [
  { label: "Radiografii și planul de tratament" },
  { label: "Inserarea implantului" },
  { label: "Vindecare, 3–6 luni", detail: "Implantul se prinde de os înainte să primească dintele." },
  { label: "Bontul protetic" },
  { label: "Coroana, puntea sau proteza" },
];
const ORTO_STEPS = ["Consultație", "Aparat", "Controale și activări", "Îndepărtare și fluorizare"];
const PLAN_STEPS = ["Radiografii", "Implant", "Vindecare 3–6 luni", "Bont", "Coroană"];

const WEEK: WeekStripDay[] = [
  { dateISO: "2026-10-06", label: "mar.\n6 oct.", disabled: false },
  { dateISO: "2026-10-07", label: "mie.\n7 oct.", disabled: false },
  { dateISO: "2026-10-08", label: "joi\n8 oct.", disabled: true },
  { dateISO: "2026-10-09", label: "vin.\n9 oct.", disabled: false },
  { dateISO: "2026-10-10", label: "sâm.\n10 oct.", disabled: true },
  { dateISO: "2026-10-11", label: "dum.\n11 oct.", disabled: true },
  { dateISO: "2026-10-12", label: "lun.\n12 oct.", disabled: false },
  { dateISO: "2026-10-13", label: "mar.\n13 oct.", disabled: false },
  { dateISO: "2026-10-14", label: "mie.\n14 oct.", disabled: false },
  { dateISO: "2026-10-15", label: "joi\n15 oct.", disabled: false },
  { dateISO: "2026-10-16", label: "vin.\n16 oct.", disabled: false },
  { dateISO: "2026-10-17", label: "sâm.\n17 oct.", disabled: true },
  { dateISO: "2026-10-18", label: "dum.\n18 oct.", disabled: true },
  { dateISO: "2026-10-19", label: "lun.\n19 oct.", disabled: false },
];

type PatientRow = { id: string; name: string; phone: string; lastVisit: string; balance: string };
const PATIENTS: PatientRow[] = [
  { id: "1", name: "Maria Suciu", phone: "0744 123 456", lastVisit: "14.09.2026", balance: "450 lei" },
  { id: "2", name: "Ion Pop", phone: "0745 222 310", lastVisit: "02.10.2026", balance: "0 lei" },
  { id: "3", name: "Elena Rus", phone: "0265 326 316", lastVisit: "28.08.2026", balance: "1.200 lei" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The gallery's own theme switch: changes <html data-theme> for this page only, nothing saved. */
function useGalleryTheme(theme: Theme) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = root.getAttribute("data-theme");
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    return () => {
      if (before) root.setAttribute("data-theme", before);
      else root.removeAttribute("data-theme");
    };
  }, [theme]);
}

export function UiGallery() {
  const [theme, setTheme] = useState<Theme>("system");
  const [density, setDensity] = useState<Density>("compact");
  useGalleryTheme(theme);

  return (
    <div data-density={density} className="flex flex-col gap-10 pb-24">
      <PageHeader
        title="Componente"
        subtitle="Toate componentele interfeței, în toate stările, pentru verificare. Schimbați tema și densitatea ca să vedeți cum se adaptează."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="Tema"
              value={theme}
              onChange={(v) => setTheme(v as Theme)}
              options={[
                { value: "system", label: "Sistem" },
                { value: "light", label: "Luminos" },
                { value: "dark", label: "Întunecat" },
              ]}
            />
            <SegmentedControl
              label="Densitatea"
              value={density}
              onChange={(v) => setDensity(v as Density)}
              options={[
                { value: "site", label: "Site" },
                { value: "compact", label: "Compact" },
                { value: "confortabil", label: "Confortabil" },
              ]}
            />
          </div>
        }
      />
      <nav aria-label="Secțiunile galeriei" className="flex flex-wrap gap-x-4 gap-y-1 text-mic">
        {[
          ["culori", "Culori"],
          ["tipografie", "Tipografie"],
          ["logo", "Logo"],
          ["filet", "Filetul"],
          ["butoane", "Butoane și linkuri"],
          ["formulare", "Formulare"],
          ["alegeri", "Ore și alegeri"],
          ["stari", "Stări și etichete"],
          ["suprapuneri", "Ferestre și meniuri"],
          ["navigare", "Navigare"],
          ["structura", "Structură și tabele"],
          ["iconite", "Iconițe"],
        ].map(([id, label]) => (
          <TextLink key={id} href={`#${id}`}>
            {label}
          </TextLink>
        ))}
      </nav>

      <ColorsSection theme={theme} />
      <TypeSection />
      <LogoSection />
      <ThreadSection />
      <ButtonsSection />
      <FormsSection />
      <ChoicesSection />
      <StatesSection />
      <OverlaysSection />
      <NavigationSection />
      <StructureSection />
      <IconsSection />
      <Toaster />
    </div>
  );
}

function Section({ id, title, children, intro }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titlu`} className="scroll-mt-24">
      <h2 id={`${id}-titlu`} className="text-h3 font-semibold">
        {title}
      </h2>
      {intro && <p className="mt-1 text-mic text-discret masura">{intro}</p>}
      <div className="mt-4 flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** One labelled specimen. `className` sets the layout of the specimens (default: a wrapping row). */
function Demo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-micro text-discret">{label}</p>
      <div className={className ?? "flex flex-wrap items-center gap-3"}>{children}</div>
    </div>
  );
}

/* ── Culori ─────────────────────────────────────────────────────────────────────────── */

function ColorsSection({ theme }: { theme: Theme }) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      setValues(Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(`--da-${t}`).trim()])));
    };
    // After the theme attribute is applied.
    const id = requestAnimationFrame(read);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", read);
    return () => {
      cancelAnimationFrame(id);
      media.removeEventListener("change", read);
    };
  }, [theme]);

  const rows = CONTRAST_PAIRS.map((p) => {
    const fg = parseColor(values[p.fg] ?? "");
    const bg = parseColor(values[p.bg] ?? "");
    const ratio = fg && bg ? contrastRatio(fg, bg) : null;
    return { ...p, ratio };
  });
  const failing = rows.filter((r) => r.ratio !== null && r.ratio < r.min).length;

  return (
    <Section
      id="culori"
      title="Culori"
      intro="Componentele folosesc doar aceste roluri. Valorile se schimbă în modul întunecat; Mentă, Muștar și Ardezie rămân cele din logo."
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {TOKENS.map((t) => (
          <div key={t} className="flex items-center gap-2.5">
            <span
              className="size-9 shrink-0 rounded-bloc border border-linie-control"
              style={{ background: `var(--da-${t})` }}
            />
            <span className="flex flex-col">
              <span className="text-mic font-medium">{t}</span>
              <span className="text-micro text-discret cifre">{values[t] ?? ""}</span>
            </span>
          </div>
        ))}
      </div>
      <Panel
        title="Contrast, calculat în tema afișată"
        level={3}
        actions={
          failing === 0 ? (
            <FlagTag kind="neutral">Toate perechile trec</FlagTag>
          ) : (
            <FlagTag kind="alerta">{failing} perechi sub prag</FlagTag>
          )
        }
      >
        <DataTable
          caption="Perechi de culori din design-system §11.1 și raportul lor de contrast"
          columns={[
            { key: "label", header: "Pereche" },
            {
              key: "sample",
              header: "Mostră",
              render: (r) => (
                <span
                  className="inline-flex h-6 items-center rounded-bloc px-2 font-semibold whitespace-nowrap"
                  style={{ color: `var(--da-${r.fg})`, background: `var(--da-${r.bg})` }}
                >
                  Aa ș ț
                </span>
              ),
            },
            { key: "tokens", header: "Roluri", render: (r) => `${r.fg} pe ${r.bg}` },
            { key: "min", header: "Prag", align: "right", render: (r) => r.min.toFixed(1).replace(".", ",") },
            {
              key: "ratio",
              header: "Raport",
              align: "right",
              render: (r) =>
                r.ratio === null ? (
                  "…"
                ) : (
                  <span className={cn("font-semibold", r.ratio < r.min && "text-carmin")}>
                    {r.ratio.toFixed(2).replace(".", ",")}
                    {r.ratio < r.min && <span className="sr-only">, sub prag</span>}
                  </span>
                ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.label}
        />
      </Panel>
    </Section>
  );
}

/* ── Tipografie ─────────────────────────────────────────────────────────────────────── */

function TypeSection() {
  const sample = "Fără durere, fără frică, cu precizie. Ș Ț ș ț ă â î";
  return (
    <Section
      id="tipografie"
      title="Tipografie"
      intro="Forum pentru titluri (doar de la 24px în sus), Red Hat Text pentru tot restul. Sentence case, cifre tabulare pentru prețuri și ore."
    >
      <div className="flex flex-col gap-4">
        <p className="font-display text-hero">Fără durere, fără frică, cu precizie.</p>
        <p className="font-display text-h1">text-h1: Pacienți și programări ș ț</p>
        <p className="font-display text-h2">text-h2: Cum vă simțiți când vă gândiți la dentist?</p>
        <p className="font-display text-nume">text-nume: Dr. Mihail Dan Mașca, Cristești</p>
        <p className="text-h3 font-semibold">text-h3: Implantologie, Ortodonție, Pedodonție</p>
        <p className="text-lead text-discret masura-lead">text-lead: {sample}</p>
        <p className="text-corp masura">text-corp: {sample} Respectăm ora programării, iar medicii noștri au acea „mână ușoară” pe care o căutați.</p>
        <p className="text-control font-medium">text-control: Programați-vă</p>
        <p className="text-mic text-discret">text-mic: Cabinetul cu marea pe perete</p>
        <p className="text-legal text-discret">text-legal: © 2026 Dental Arena</p>
        <p className="text-micro">text-micro: 09:15, Dr. Marcoci</p>
        <p className="text-corp cifre">
          Cifre tabulare: <span className="font-semibold">2.200 lei</span>, <span className="font-semibold">150 lei / oră</span>,{" "}
          <span className="telefon font-semibold">0265 326 316</span>, 09:30–10:00, 3–6 luni, 0 1 2 3 4 5 6 7 8 9
        </p>
      </div>
    </Section>
  );
}

/* ── Logo ───────────────────────────────────────────────────────────────────────────── */

function LogoSection() {
  return (
    <Section
      id="logo"
      title="Logo"
      intro="Redesenat în SVG după fișierul original. În modul întunecat, numele devine alb automat; varianta inversată este pentru subsol."
    >
      <Demo label="Complet (220px, minim) și mare" className="flex flex-wrap items-end gap-8">
        <Logo variant="full" />
        <Logo variant="full" className="h-auto w-[440px] max-w-full" />
      </Demo>
      <Demo label="Compact (140px, minim) și 200px" className="flex flex-wrap items-end gap-8">
        <Logo variant="compact" className="h-auto w-[140px]" />
        <Logo variant="compact" className="h-auto w-[200px]" />
      </Demo>
      <Demo label="Doar semnul: 16, 24, 32, 48, 96px; simplificat la 16px" className="flex flex-wrap items-end gap-6">
        <Logo variant="mark" className="h-4 w-auto" />
        <Logo variant="mark" className="h-6 w-auto" />
        <Logo variant="mark" className="h-8 w-auto" />
        <Logo variant="mark" className="h-12 w-auto" />
        <Logo variant="mark" className="h-24 w-auto" />
        <Logo variant="mark" simplified className="h-4 w-auto" title="Dental Arena, semn simplificat" />
      </Demo>
      <Demo label="Inversat, pe subsol" className="focus-subsol flex flex-wrap items-end gap-8 rounded-panou bg-subsol p-6">
        <Logo variant="reversed" lockup="full" />
        <Logo variant="reversed" lockup="compact" className="h-auto w-[160px]" />
        <Logo variant="reversed" lockup="mark" className="h-10 w-auto" />
      </Demo>
      <Demo label="O singură culoare (tipărire)" className="flex flex-wrap items-end gap-8">
        <Logo variant="mono" lockup="full" />
        <Logo variant="mono" lockup="mark" className="h-10 w-auto" />
      </Demo>
    </Section>
  );
}

/* ── Filetul ────────────────────────────────────────────────────────────────────────── */

function ThreadSection() {
  const [step, setStep] = useState(1);
  const [replay, setReplay] = useState(0);
  return (
    <Section
      id="filet"
      title="Filetul"
      intro="Semnul clinicii ca indicator de progres: benzi pline (încheiate), conturate în cerneală (pasul curent) și conturate discret (urmează)."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Demo label="Rail (programare), pas interactiv">
          <div className="flex flex-col gap-4">
            <ThreadSteps
              variant="rail"
              steps={BOOKING_STEPS}
              current={step}
              label="Pașii programării"
              onStepSelect={(i) => setStep(i)}
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="s" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Înapoi
              </Button>
              <Button size="s" onClick={() => setStep((s) => Math.min(BOOKING_STEPS.length, s + 1))}>
                Continuați
              </Button>
            </div>
          </div>
        </Demo>
        <Demo label="Confirmare: coroana se desenează pe filet" className="flex flex-wrap items-center gap-6">
          <ThreadGlyph key={replay} count={4} current={4} crown crownAnimated className="h-40 w-auto" />
          <div className="flex flex-col gap-3">
            <p className="font-display text-nume da-crown-text" key={`t${replay}`}>
              Ora de 10:30 este rezervată.
            </p>
            <Button variant="secondary" size="s" icon="refresh-cw" onClick={() => setReplay((r) => r + 1)}>
              Redați animația
            </Button>
          </div>
        </Demo>
        <Demo label="Inline (mobil), 28px">
          <ThreadSteps variant="inline" steps={BOOKING_STEPS} current={2} label="Pașii programării" />
        </Demo>
        <Demo label="Încărcare lentă (peste 600 ms)">
          <ThreadGlyph count={4} current={-1} loading className="h-16 w-auto" />
          <p className="text-mic text-discret">Căutăm orele libere…</p>
        </Demo>
        <Demo label="Listă „Cum decurge” (implant, 5 pași)">
          <ThreadSteps variant="list" steps={IMPLANT_STEPS} current={IMPLANT_STEPS.length} label="Cum decurge un implant" />
        </Demo>
        <Demo label="Listă în desfășurare (ortodonție, pasul 2 din 4)">
          <ThreadSteps variant="list" steps={ORTO_STEPS} current={1} label="Cum decurge tratamentul ortodontic" />
        </Demo>
        <Demo label="Plan de tratament (CRM), pasul 3 din 5">
          <ThreadSteps variant="plan" steps={PLAN_STEPS} current={2} label="Plan: implant 36" />
        </Demo>
        <Demo label="Mini (odontogramă, 14px): implant în lucru și implant finalizat" className="flex flex-wrap items-center gap-6">
          <span className="inline-flex items-center gap-2 text-mic">
            <ThreadSteps variant="mini" steps={PLAN_STEPS} current={2} label="Implant 36" /> 36
          </span>
          <span className="inline-flex items-center gap-2 text-mic">
            <ThreadSteps variant="mini" steps={PLAN_STEPS} current={5} label="Implant 46" /> 46
          </span>
        </Demo>
      </div>
    </Section>
  );
}

/* ── Butoane ────────────────────────────────────────────────────────────────────────── */

function ButtonsSection() {
  return (
    <Section id="butoane" title="Butoane și linkuri" intro="Eticheta spune rezultatul. Fără săgeți. Raza urmează tipul obiectului: 6px pentru controale.">
      {(["primary", "secondary", "text", "danger"] as const).map((variant) => (
        <Demo key={variant} label={`Varianta ${variant}: S, M, L, cu iconiță, doar iconiță, dezactivat, în lucru`} className="flex flex-wrap items-center gap-3">
          <Button variant={variant} size="s">
            Confirmați
          </Button>
          <Button variant={variant}>Programați-vă</Button>
          <Button variant={variant} size="l">
            Rezervați ora de 10:30
          </Button>
          <Button variant={variant} icon="phone">
            Sunați
          </Button>
          <Button variant={variant} icon="printer" aria-label="Tipăriți devizul" />
          <Button variant={variant} disabled>
            Indisponibil
          </Button>
          <Button variant={variant} loading>
            Se salvează
          </Button>
        </Demo>
      ))}
      <Demo label="Linkuri: în text, de sine stătătoare, extern, pagina curentă; buton-link" className="flex flex-wrap items-center gap-5">
        <p className="text-corp masura">
          Citiți <TextLink href="/politica-de-confidentialitate">politica de confidențialitate</TextLink> înainte să trimiteți.
        </p>
        <TextLink href="/preturi" standalone>
          Toate prețurile
        </TextLink>
        <TextLink href="https://anpc.ro" external>
          ANPC
        </TextLink>
        <TextLink href="/crm/ui" current>
          Componente
        </TextLink>
        <ButtonLink href="/programare">Programați-vă</ButtonLink>
        <ButtonLink href="tel:+40265326316" variant="secondary" icon="phone" aria-label="Sunați la Cristești, 0265 326 316">
          Cristești <span className="telefon">0265 326 316</span>
        </ButtonLink>
      </Demo>
    </Section>
  );
}

/* ── Formulare ──────────────────────────────────────────────────────────────────────── */

function FormsSection() {
  const [sent, setSent] = useState<string | null>(null);
  const errors = {
    nume: ["Introduceți numele și prenumele."],
    telefon: ["Introduceți un număr de telefon, de exemplu 0745 123 456."],
    gdpr: ["Bifați acordul ca să putem păstra datele programării."],
  };
  return (
    <Section id="formulare" title="Formulare" intro="Etichete mereu vizibile, erori lângă câmp și în rezumat, care primește focusul.">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <TextField label="Nume și prenume" name="g-nume" autoComplete="name" placeholder="Maria Suciu" />
          <TextField label="E-mail" name="g-email" type="email" optional hint="Pentru confirmarea programării." autoComplete="email" />
          <PhoneField label="Telefon" name="g-telefon" required error="Introduceți un număr de telefon, de exemplu 0745 123 456." defaultValue="0745 12" />
          <TextField label="Cod pacient" name="g-cod" disabled defaultValue="DA-0412" />
          <TextArea label="Ceva ce ar trebui să știm?" name="g-note" optional rows={3} />
          <Select
            label="Medic"
            name="g-medic"
            placeholder="Oricare medic"
            options={[
              { value: "marcoci", label: "Dr. Andrei Marcoci" },
              { value: "masca", label: "Dr. Mihail Dan Mașca" },
              { value: "bologa", label: "Dr. Paul Bologa" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <DateInput label="Data" name="g-data" defaultValue="2026-10-07" />
            <TimeInput label="Ora" name="g-ora" defaultValue="10:30" />
          </div>
          <SearchField label="Căutați pacient" name="g-q" placeholder="Nume sau telefon" shortcut="/" />
          <SearchField label="Căutați pacient" name="g-q2" hideLabel placeholder="Etichetă ascunsă (bara de sus)" />
        </div>
        <div className="flex flex-col gap-5">
          <Checkbox label="Aș vrea inhalosedare (150 lei / oră)" name="g-sedare" description="Rămâneți conștient, doar mult mai relaxat." />
          <Checkbox label="Trimiteți-mi un SMS cu o zi înainte" name="g-sms" defaultChecked />
          <Checkbox label="Opțiune indisponibilă" name="g-dis" disabled />
          <Checkbox label="Am citit condițiile" name="g-err" error="Bifați ca să continuați." />
          <RadioGroup
            legend="Pentru cine este programarea?"
            name="g-pentru"
            inline
            defaultValue="mine"
            options={[
              { value: "mine", label: "Pentru mine" },
              { value: "copil", label: "Pentru copilul meu" },
            ]}
          />
          <RadioGroup
            legend="Cum preferați să vă contactăm?"
            name="g-contact"
            error="Alegeți o variantă."
            options={[
              { value: "telefon", label: "Telefon", description: "Vă sunăm de la numărul clinicii." },
              { value: "sms", label: "SMS" },
              { value: "email", label: "E-mail", disabled: true, description: "Indisponibil momentan." },
            ]}
          />
          <ConsentCheckbox name="g-gdpr" required>
            Sunt de acord ca Dental Arena să folosească datele mele de sănătate pentru programare, conform{" "}
            <TextLink href="/politica-de-confidentialitate">politicii de confidențialitate</TextLink>.
          </ConsentCheckbox>
          <form
            action={async () => {
              setSent(null);
              await sleep(1800);
              setSent("Formular trimis.");
            }}
            className="flex flex-wrap items-center gap-3"
          >
            <SubmitButton pendingLabel="Se trimite">Trimiteți</SubmitButton>
            {sent && <p role="status" className="text-mic text-discret">{sent}</p>}
          </form>
        </div>
      </div>
      <Demo label="Rezumatul erorilor (în formulare primește focusul când apare)" className="max-w-2xl">
        <ErrorSummary errors={errors} message="Programarea nu a fost trimisă." autoFocus={false} />
      </Demo>
    </Section>
  );
}

/* ── Alegeri ────────────────────────────────────────────────────────────────────────── */

function ChoicesSection() {
  const [slot, setSlot] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>("2026-10-07");
  const [comfort, setComfort] = useState<string | null>(null);
  const [clinic, setClinic] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>("consult");
  return (
    <Section id="alegeri" title="Ore și alegeri" intro="Nimic nu este preselectat. Alegerea primește umplere, bifă și contur de 2px.">
      <Demo label="Ore: implicit, alese prin clic, dezactivată, ocupată">
        {["09:00", "09:30", "10:30", "14:00"].map((t) => (
          <SlotButton key={t} time={t} selected={slot === t} onClick={() => setSlot(slot === t ? null : t)} />
        ))}
        <SlotButton time="15:30" disabled />
        <SlotButton time="16:00" taken />
        <SlotButton time="11:45" selected />
      </Demo>
      <Demo label="Rânduri pe toată lățimea (panoul de pe mobil)" className="flex max-w-sm flex-col gap-3">
        <SlotButton day="marți 7 oct." time="10:30" />
        <SlotButton day="miercuri 8 oct." time="09:15" selected />
      </Demo>
      <Demo label="Zilele (14), cu zile fără ore" className="max-w-full">
        <WeekStrip days={WEEK} value={day} onChange={setDay} />
      </Demo>
      <Demo label="Întrebarea despre confort: calm (Mentă), confort (Muștar)">
        <ChoiceButton tone="calm" selected={comfort === "calm"} onClick={() => setComfort("calm")}>
          N-am emoții
        </ChoiceButton>
        <ChoiceButton tone="comfort" selected={comfort === "emotii"} onClick={() => setComfort("emotii")}>
          Am puține emoții
        </ChoiceButton>
        <ChoiceButton tone="comfort" selected={comfort === "frica"} onClick={() => setComfort("frica")}>
          Mi-e frică
        </ChoiceButton>
      </Demo>
      {comfort && comfort !== "calm" && (
        <Panel tone="mustar-pal" className="da-rise max-w-xl">
          <p className="text-corp">
            Putem lucra sub inhalosedare: rămâneți conștient, colaborați cu medicul și vă reveniți în 3–5 minute. 150 lei / oră.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Button>Programați-vă cu inhalosedare</Button>
            <TextLink href="/inhalosedare">Despre inhalosedare</TextLink>
          </div>
        </Panel>
      )}
      <Demo label="Motive (neutru), cu descriere; dezactivat">
        <ChoiceButton selected={reason === "consult"} onClick={() => setReason("consult")}>
          Consultație sau control
        </ChoiceButton>
        <ChoiceButton
          selected={reason === "durere"}
          onClick={() => setReason("durere")}
          description="Vă arătăm imediat numerele clinicilor."
        >
          Am o durere acum
        </ChoiceButton>
        <ChoiceButton disabled>Aparat dentar</ChoiceButton>
      </Demo>
      <Demo label="Panouri de clinică, împărțite pe axă" className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <ChoicePanel title="Cristești" selected={clinic === "cristesti"} onClick={() => setClinic("cristesti")}>
          <span>str. Principală 536J/1, lângă Târgu Mureș</span>
          <span className="text-cerneala cifre">Prima oră liberă: mar. 7 oct., 10:30</span>
        </ChoicePanel>
        <ChoicePanel title="Luduș" selected={clinic === "ludus"} onClick={() => setClinic("ludus")}>
          <span>str. Gheorghe Barițiu nr. 6</span>
          <span className="text-cerneala cifre">Prima oră liberă: joi 9 oct., 11:00</span>
        </ChoicePanel>
      </Demo>
      <Demo label="Comutator segmentat: client, formular (merge fără JS), linkuri" className="flex flex-wrap items-center gap-5">
        <SegmentedControl
          label="Clinica"
          value={clinic ?? "ambele"}
          onChange={(v) => setClinic(v === "ambele" ? null : v)}
          options={[
            { value: "cristesti", label: "Cristești" },
            { value: "ludus", label: "Luduș" },
            { value: "ambele", label: "Ambele" },
          ]}
        />
        <form>
          <SegmentedControl
            label="Vizualizare"
            name="vizualizare"
            value="zi"
            size="s"
            options={[
              { value: "zi", label: "Zi" },
              { value: "saptamana", label: "Săptămână" },
            ]}
          />
        </form>
        <SegmentedControl
          label="Perioada"
          value="azi"
          options={[
            { value: "azi", label: "Azi", href: "/crm/ui?perioada=azi" },
            { value: "luna", label: "Luna aceasta", href: "/crm/ui?perioada=luna" },
          ]}
        />
      </Demo>
    </Section>
  );
}

/* ── Stări ──────────────────────────────────────────────────────────────────────────── */

function StatesSection() {
  return (
    <Section
      id="stari"
      title="Stări și etichete"
      intro="Fiecare stare are umplere, margine, iconiță și cuvânt. Muștarul înseamnă confort, roșul înseamnă risc clinic; nu se schimbă între ele."
    >
      <Demo label="Cele 7 stări ale programării (M)">
        {STATUSES.map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </Demo>
      <Demo label="Mărimea S, doar iconiță (blocuri sub 30 de minute), cu cronometru">
        {STATUSES.map((s) => (
          <StatusChip key={s} status={s} size="s" />
        ))}
        {STATUSES.map((s) => (
          <StatusChip key={`i-${s}`} status={s} size="s" iconOnly />
        ))}
        <StatusChip status="IN_TRATAMENT" detail="12 min" />
        <StatusChip status="SOSIT" detail="5 min" size="s" />
      </Demo>
      <Demo label="Aceleași modele ca blocuri de calendar (pentru AppointmentBlock)" className="grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <div key={s} className={cn("flex min-h-12 flex-col justify-center px-2 py-1 text-micro", STATUS_BLOCK[s])}>
            <span className="flex items-center gap-1 font-semibold">
              <Icon name={STATUS_ICON[s]} size={14} strokeWidth={2} />
              <span data-status-text="">Maria Suciu</span>
            </span>
            <span data-status-text="">09:30 Obturație 26</span>
          </div>
        ))}
      </Demo>
      <Demo label="Cele 4 suprapuneri: confort, alertă medicală, copil, online; plus sedare și neutru">
        <FlagTag kind="confort">Mi-e frică</FlagTag>
        <FlagTag kind="confort">Emoții</FlagTag>
        <FlagTag kind="alerta">Alergie: penicilină</FlagTag>
        <FlagTag kind="alerta">Anticoagulante</FlagTag>
        <FlagTag kind="copil">Copil, 7 ani</FlagTag>
        <FlagTag kind="online">Online</FlagTag>
        <FlagTag kind="sedare">Preferă inhalosedare</FlagTag>
        <FlagTag kind="neutral">Pacient nou</FlagTag>
      </Demo>
      <Demo label="Contoare" className="flex flex-wrap items-center gap-6">
        <span className="inline-flex items-center gap-2 text-control">
          Cereri online <CountBadge count={3} label="3 cereri noi" />
        </span>
        <span className="inline-flex items-center gap-2 text-control">
          De rechemat <CountBadge count={12} label="12 pacienți de rechemat" />
        </span>
        <span className="inline-flex items-center gap-2 text-control">
          Mesaje <CountBadge count={140} label="140 de mesaje" />
        </span>
      </Demo>
    </Section>
  );
}

/* ── Suprapuneri ────────────────────────────────────────────────────────────────────── */

function OverlaysSection() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [themeChoice, setThemeChoice] = useState("sistem");
  const toast = useToast();
  return (
    <Section id="suprapuneri" title="Ferestre și meniuri" intro="Plutesc, deci au umbra. Se închid cu Esc sau cu un clic în afara lor; focusul revine pe buton.">
      <Demo label="Dialog, panou lateral">
        <Button variant="danger" onClick={() => setDialog(true)}>
          Anulați programarea
        </Button>
        <Button variant="secondary" onClick={() => setDrawer(true)}>
          Deschideți programarea
        </Button>
      </Demo>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Anulați programarea?"
        description="Maria Suciu, marți, 7 octombrie, ora 10:30, Dr. Mașca."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(false)}>
              Păstrați programarea
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialog(false);
                toast.show({ kind: "success", message: "Programare anulată" });
              }}
            >
              Anulați programarea
            </Button>
          </>
        }
      >
        <RadioGroup
          legend="Cine a anulat?"
          name="g-anulat"
          defaultValue="pacient"
          options={[
            { value: "pacient", label: "Pacientul" },
            { value: "clinica", label: "Clinica" },
          ]}
        />
      </Dialog>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Maria Suciu"
        subtitle="marți, 7 octombrie, 09:30–10:15, Dr. Mașca"
        footer={
          <>
            <Button onClick={() => toast.show({ kind: "success", message: "Programare confirmată" })}>Confirmați programarea</Button>
            <Button variant="secondary">Mutați</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <StatusChip status="PROGRAMAT" />
            <FlagTag kind="confort">Mi-e frică</FlagTag>
            <FlagTag kind="alerta">Alergie: penicilină</FlagTag>
            <FlagTag kind="online">Online</FlagTag>
          </div>
          <Panel tone="mustar-pal" title="În cuvintele pacientei" level={3}>
            <p>„Am avut o extracție grea acum mulți ani.”</p>
          </Panel>
          <p className="text-corp">Obturație 26, Cabinetul 2, Cristești.</p>
        </div>
      </Drawer>
      <Demo label="Popover (creare rapidă), meniuri" className="flex flex-wrap items-start gap-4">
        <Popover trigger="Programare rapidă" label="Programare rapidă" triggerSize="m">
          {(close) => (
            <form
              className="flex w-72 flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                close();
                toast.show({ kind: "success", message: "Programare creată la 11:30" });
              }}
            >
              <SearchField label="Pacient" name="g-pop-pacient" placeholder="Nume sau telefon" />
              <TimeInput label="Ora" name="g-pop-ora" defaultValue="11:30" />
              <Button type="submit">Creați programarea</Button>
            </form>
          )}
        </Popover>
        <Menu
          trigger="Sunați"
          triggerVariant="secondary"
          label="Ce clinică sunați?"
          items={[
            { label: "Cristești", detail: "0265 326 316", href: "tel:+40265326316", icon: "phone", ariaLabel: "Sunați la Cristești, 0265 326 316" },
            { label: "Luduș", detail: "0365 430 125", href: "tel:+40365430125", icon: "phone", ariaLabel: "Sunați la Luduș, 0365 430 125" },
          ]}
        />
        <Menu
          trigger="Ana, Recepție"
          triggerVariant="text"
          align="start"
          label="Contul meu"
          items={[
            { label: "Contul meu", href: "/crm/cont", icon: "user" },
            { separator: true },
            { label: "Luminos", checked: themeChoice === "luminos", onSelect: () => setThemeChoice("luminos") },
            { label: "Întunecat", checked: themeChoice === "intunecat", onSelect: () => setThemeChoice("intunecat") },
            { label: "Sistem", checked: themeChoice === "sistem", onSelect: () => setThemeChoice("sistem") },
            { separator: true },
            { label: "Arhivați", icon: "file", disabled: true },
            { label: "Ieșiți din cont", icon: "log-out", tone: "danger", onSelect: () => toast.show({ kind: "error", message: "Doar o demonstrație: nu ați ieșit din cont." }) },
          ]}
        />
      </Demo>
      <Demo label="Notificări: succes, cu anulare (6 s), eroare">
        <Button variant="secondary" onClick={() => toast.show({ kind: "success", message: "Programare confirmată" })}>
          Succes
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.show({
              kind: "success",
              message: "Programare mutată la 11:30",
              undo: () => toast.show({ kind: "success", message: "Programarea a revenit la 10:30" }),
            })
          }
        >
          Cu „Anulați”
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.show({ kind: "error", message: "Dr. Mașca are deja o programare la 10:30. Alegeți altă oră sau alt medic." })
          }
        >
          Eroare
        </Button>
      </Demo>
    </Section>
  );
}

/* ── Navigare ───────────────────────────────────────────────────────────────────────── */

function NavigationSection() {
  return (
    <Section id="navigare" title="Navigare">
      <Demo label="File (linkuri), cea activă după adresă" className="max-w-full">
        <Tabs
          label="Fișa pacientului"
          items={[
            { href: "/crm/ui", label: "Prezentare" },
            { href: "/crm/ui/odontograma", label: "Odontogramă" },
            { href: "/crm/ui/plan", label: "Plan de tratament", count: 2 },
            { href: "/crm/ui/programari", label: "Programări" },
            { href: "/crm/ui/documente", label: "Documente" },
          ]}
        />
      </Demo>
      <Demo label="Cale de navigare">
        <Breadcrumbs items={[{ href: "/servicii", label: "Servicii" }, { label: "Implantologie" }]} />
      </Demo>
      <Demo label="Paginare (păstrează filtrele)">
        <Pagination page={3} pageCount={9} baseHref="/crm/ui" searchParams={{ q: "pop", pagina: "3" }} />
      </Demo>
      <Demo label="Întrebări (acordeon)" className="max-w-2xl">
        <Accordion
          items={[
            {
              question: "Doare inserarea unui implant?",
              answer: "Intervenția se face cu anestezie locală. Dacă vă e teamă, se poate face și sub inhalosedare.",
            },
            {
              question: "Cât durează vindecarea?",
              answer: "De obicei 3–6 luni, până când implantul se prinde de os. Apoi se pune bontul și coroana.",
            },
          ]}
        />
      </Demo>
    </Section>
  );
}

/* ── Structură ──────────────────────────────────────────────────────────────────────── */

function StructureSection() {
  return (
    <Section id="structura" title="Structură și tabele">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="De făcut" actions={<CountBadge count={3} label="3 cereri noi" />}>
          <p className="text-corp">Ana Man, consultație, mar. 7 oct. 10:30.</p>
        </Panel>
        <Panel tone="menta-pal" title="Programați o consultație de implantologie">
          <p className="text-corp">Cristești 0265 326 316, Luduș 0365 430 125.</p>
        </Panel>
        <Panel tone="mustar-pal" title="Vă e teamă?">
          <p className="text-corp">
            Intervenția se poate face sub inhalosedare. <TextLink href="/inhalosedare">Despre inhalosedare</TextLink>
          </p>
        </Panel>
      </div>
      <EmptyState
        title="Nicio cerere nouă. Cererile din site apar aici imediat ce sunt trimise."
        action={<ButtonLink href="/crm/programari/noua" variant="secondary">Programare nouă</ButtonLink>}
      />
      <DataTable<PatientRow>
        caption="Pacienți, ordonați după nume"
        captionVisible
        columns={[
          { key: "name", header: "Pacient", sortable: true },
          { key: "phone", header: "Telefon", render: (r) => <span className="telefon">{r.phone}</span> },
          { key: "lastVisit", header: "Ultima vizită", sortable: true },
          { key: "balance", header: "Sold", align: "right", sortable: true },
        ]}
        rows={PATIENTS}
        rowKey={(r) => r.id}
        rowHref={(r) => `/crm/pacienti/${r.id}`}
        sort={{ key: "name", dir: "asc" }}
        sortHref={(key, dir) => `/crm/ui?ordine=${key}&dir=${dir}`}
      />
      <DataTable<PatientRow>
        caption="Pacienți găsiți"
        captionVisible
        columns={[
          { key: "name", header: "Pacient" },
          { key: "phone", header: "Telefon" },
        ]}
        rows={[]}
        empty={<EmptyState title="Niciun pacient cu acest nume. Verificați ortografia sau căutați după telefon." />}
      />
      <Demo label="Așteptare" className="flex flex-wrap items-center gap-4">
        <Spinner label="Se încarcă" />
        <span className="inline-flex items-center gap-2 text-mic text-discret">
          <Spinner size={16} /> Se salvează
        </span>
      </Demo>
    </Section>
  );
}

function IconsSection() {
  return (
    <Section id="iconite" title="Iconițe" intro="Contur de 1,5px, capete rotunjite. Doar unde ajută la recunoaștere; niciodată pe liste de servicii.">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {ICON_NAMES.map((name) => (
          <div key={name} className="flex items-center gap-2 text-micro text-discret">
            <Icon name={name} size={20} className="text-cerneala" />
            {name}
          </div>
        ))}
      </div>
    </Section>
  );
}
