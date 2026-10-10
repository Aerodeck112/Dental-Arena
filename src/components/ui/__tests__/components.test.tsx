import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/labels";
import {
  Accordion,
  Breadcrumbs,
  Button,
  Checkbox,
  ConsentCheckbox,
  CountBadge,
  DataTable,
  EmptyState,
  ErrorSummary,
  FlagTag,
  ICON_NAMES,
  Icon,
  PageHeader,
  Pagination,
  pageHref,
  Panel,
  PhoneField,
  RadioGroup,
  Select,
  SlotButton,
  STATUS_BLOCK,
  STATUS_ICON,
  StatusChip,
  TextField,
} from "..";
import { fieldId } from "../field-ids";
import { pageWindow } from "../Pagination";

/**
 * Server-rendered markup of the UI kit (docs/architecture.md WP2 contracts): ids and ARIA wiring,
 * the „never colour alone” rules, and the props consumers rely on. Rendered with
 * react-dom/server, so these run in node without a browser.
 */
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

/** Parses one rendered element's attribute (first match). */
function attr(markup: string, selectorRe: RegExp, name: string): string | null {
  const tag = markup.match(selectorRe)?.[0];
  if (!tag) return null;
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;
}

describe("Field and the text controls", () => {
  it("wires id, label, hint and error with aria-describedby and aria-invalid", () => {
    const out = html(<TextField label="Nume și prenume" name="nume" hint="Ca în buletin." error="Introduceți numele." required />);
    const id = fieldId("nume");
    expect(out).toContain(`<label for="${id}"`);
    expect(attr(out, /<input[^>]*>/, "id")).toBe(id);
    expect(attr(out, /<input[^>]*>/, "name")).toBe("nume");
    expect(attr(out, /<input[^>]*>/, "aria-describedby")).toBe(`${id}-indiciu ${id}-eroare`);
    expect(attr(out, /<input[^>]*>/, "aria-invalid")).toBe("true");
    expect(out).toMatch(/<input[^>]*required=""/);
    expect(out).toContain(`id="${id}-eroare"`);
    expect(out).toContain("Introduceți numele.");
  });

  it("leaves aria-invalid off and describes nothing when there is no hint or error", () => {
    const out = html(<TextField label="Oraș" name="oras" />);
    expect(out).not.toContain("aria-invalid");
    expect(out).not.toContain("aria-describedby");
  });

  it("marks optional fields in words, not only by the absence of an asterisk", () => {
    expect(html(<TextField label="E-mail" name="email" optional />)).toContain("(opțional)");
  });

  it("PhoneField sets type, inputMode and autoComplete for phones", () => {
    const input = html(<PhoneField label="Telefon" name="telefon" />).match(/<input[^>]*>/)![0];
    expect(input).toContain('type="tel"');
    expect(input).toContain('inputMode="tel"');
    expect(input).toContain('autoComplete="tel"');
  });

  it("Select renders the placeholder as an empty first option", () => {
    const out = html(
      <Select
        label="Medic"
        name="medic"
        placeholder="Oricare medic"
        options={[
          { value: "a", label: "Dr. Andrei Marcoci" },
          { value: "b", label: "Dr. Mihail Dan Mașca" },
        ]}
      />,
    );
    expect(out).toMatch(/<select[^>]*>\s*<option value=""[^>]*>Oricare medic<\/option>/);
    expect(out).toContain('<option value="b">Dr. Mihail Dan Mașca</option>');
  });

  it("Checkbox and ConsentCheckbox keep a visible label and link the error", () => {
    const box = html(<Checkbox label="Trimiteți-mi un SMS" name="sms" error="Bifați ca să continuați." />);
    expect(box).toMatch(/<label[^>]*>[\s\S]*Trimiteți-mi un SMS/);
    expect(attr(box, /<input[^>]*>/, "aria-invalid")).toBe("true");
    const consent = html(
      <ConsentCheckbox name="gdpr" required>
        Sunt de acord
      </ConsentCheckbox>,
    );
    expect(consent).toMatch(/<input[^>]*required=""/);
    expect(consent).toContain("Sunt de acord");
  });

  it("RadioGroup is a fieldset named by its legend", () => {
    const out = html(
      <RadioGroup
        legend="Pentru cine este programarea?"
        name="pentru"
        options={[
          { value: "mine", label: "Pentru mine" },
          { value: "copil", label: "Pentru copilul meu", description: "Copiii vin însoțiți." },
        ]}
        error="Alegeți o variantă."
      />,
    );
    expect(out).toMatch(/^<fieldset/);
    expect(out).toMatch(/<legend[^>]*>Pentru cine este programarea\?<\/legend>/);
    expect(out.match(/type="radio"/g)).toHaveLength(2);
    expect(out).toContain("Alegeți o variantă.");
  });
});

describe("ErrorSummary", () => {
  it("links each message to the field id that Field generates", () => {
    const out = html(
      <ErrorSummary errors={{ nume: ["Introduceți numele."], telefon: ["Introduceți telefonul."] }} autoFocus={false} />,
    );
    expect(out).toContain(`href="#${fieldId("nume")}"`);
    expect(out).toContain(`href="#${fieldId("telefon")}"`);
    expect(out).toContain('tabindex="-1"');
    expect(out).toContain("Corectați datele de mai jos");
  });

  it("renders nothing when there are no errors", () => {
    expect(html(<ErrorSummary errors={{}} />)).toBe("");
  });
});

describe("Button and SlotButton", () => {
  it("keeps the label while loading, and blocks a second click", () => {
    const out = html(<Button loading>Se salvează</Button>);
    expect(out).toContain("Se salvează");
    expect(out).toContain('aria-busy="true"');
    expect(out).toMatch(/<button[^>]*disabled=""/);
    expect(out).toContain('type="button"');
  });

  it("uses the S/M/L control heights from the density tokens", () => {
    expect(html(<Button size="s">A</Button>)).toContain("h-control-s");
    expect(html(<Button>A</Button>)).toContain("h-control");
    expect(html(<Button size="l">A</Button>)).toContain("h-control-l");
  });

  it("SlotButton announces selection with aria-pressed and a check, and a taken slot in words", () => {
    const selected = html(<SlotButton time="10:30" selected />);
    expect(selected).toContain('aria-pressed="true"');
    expect(selected).toContain("<svg");
    const taken = html(<SlotButton time="16:00" taken />);
    expect(taken).toMatch(/disabled=""/);
    expect(taken).toContain("line-through");
    expect(taken).toContain(", ocupat");
  });
});

describe("Statuses and overlays (never colour alone)", () => {
  const statuses = Object.keys(STATUS_ICON) as AppointmentStatus[];

  it("covers the 7 statuses of architecture §0.2", () => {
    expect(statuses).toEqual(["PROGRAMAT", "CONFIRMAT", "SOSIT", "IN_TRATAMENT", "FINALIZAT", "ANULAT", "NEPREZENTAT"]);
    expect(new Set(Object.values(STATUS_ICON)).size).toBe(7);
  });

  it.each(statuses)("%s has an icon, its word and its own edge pattern", (status) => {
    const out = html(<StatusChip status={status} />);
    expect(out).toContain(`data-status="${status}"`);
    expect(out).toContain("<svg");
    expect(out).toContain(APPOINTMENT_STATUS_LABEL[status]);
    expect(STATUS_BLOCK[status]).toContain("rounded-bloc");
  });

  it("codes the edges as specified: dashed Programat, solid bar Confirmat, struck-through Anulat, red bar Neprezentat", () => {
    expect(STATUS_BLOCK.PROGRAMAT).toContain("border-dashed");
    expect(STATUS_BLOCK.CONFIRMAT).toContain("border-l-4");
    expect(STATUS_BLOCK.SOSIT).toContain("bg-menta");
    expect(STATUS_BLOCK.IN_TRATAMENT).toContain("bg-menta");
    expect(STATUS_BLOCK.FINALIZAT).toContain("bg-adancit");
    expect(STATUS_BLOCK.ANULAT).toContain("line-through");
    expect(STATUS_BLOCK.NEPREZENTAT).toMatch(/border-l-4 border-carmin/);
    expect(html(<StatusChip status="ANULAT" />)).toContain("line-through");
  });

  it("keeps the word for screen readers when only the icon shows", () => {
    const out = html(<StatusChip status="SOSIT" iconOnly />);
    expect(out).toContain("sr-only");
    expect(out).toContain(APPOINTMENT_STATUS_LABEL.SOSIT);
  });

  it("joins the running timer with a comma, never a middle dot", () => {
    const out = html(<StatusChip status="IN_TRATAMENT" detail="12 min" />);
    expect(out).toContain(`${APPOINTMENT_STATUS_LABEL.IN_TRATAMENT}, 12 min`);
    expect(out).not.toContain("·");
  });

  it("FlagTag: mustard means comfort, red means clinical risk", () => {
    const comfort = html(<FlagTag kind="confort">Mi-e frică</FlagTag>);
    expect(comfort).toContain("bg-mustar-pal");
    expect(comfort).toContain("Mi-e frică");
    expect(comfort).not.toContain("carmin");
    const alert = html(<FlagTag kind="alerta">Alergie: penicilină</FlagTag>);
    expect(alert).toContain("border-carmin");
    expect(alert).toContain("<svg");
    expect(alert).not.toContain("mustar");
  });

  it("CountBadge is cerneala on menta-pal, caps at 99+, and can carry a spoken label", () => {
    const out = html(<CountBadge count={140} label="140 de mesaje" />);
    expect(out).toContain("99+");
    expect(out).toContain("bg-menta-pal");
    expect(out).toContain("text-cerneala");
    expect(out).toContain('<span class="sr-only">140 de mesaje</span>');
    expect(out).not.toMatch(/mustar|carmin/);
  });
});

describe("Structure and navigation", () => {
  type Row = { id: string; name: string; balance: string };
  const rows: Row[] = [
    { id: "1", name: "Maria Suciu", balance: "450 lei" },
    { id: "2", name: "Ion Pop", balance: "0 lei" },
  ];

  it("DataTable has a caption, right-aligned numeric columns and row links", () => {
    const out = html(
      <DataTable<Row>
        caption="Pacienți"
        columns={[
          { key: "name", header: "Pacient" },
          { key: "balance", header: "Sold", align: "right" },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/crm/pacienti/${r.id}`}
      />,
    );
    expect(out).toMatch(/<caption[^>]*>Pacienți<\/caption>/);
    expect(out).toContain('href="/crm/pacienti/1"');
    expect(out).toContain("text-right");
    expect(out).toContain("cifre");
    expect(out.match(/<tr/g)).toHaveLength(3);
  });

  it("DataTable shows the empty state in place of rows", () => {
    const out = html(
      <DataTable<Row>
        caption="Pacienți găsiți"
        columns={[{ key: "name", header: "Pacient" }]}
        rows={[]}
        empty={<EmptyState title="Niciun pacient cu acest nume." />}
      />,
    );
    expect(out).toContain("Niciun pacient cu acest nume.");
  });

  it("Pagination keeps the other filters, marks the current page and hides itself for one page", () => {
    expect(pageHref("/crm/pacienti", { q: "pop", pagina: "3" }, "pagina", 4)).toBe("/crm/pacienti?q=pop&pagina=4");
    expect(pageHref("/crm/pacienti", { q: "pop", pagina: "3" }, "pagina", 1)).toBe("/crm/pacienti?q=pop");
    expect(pageWindow(5, 9)).toEqual([1, null, 4, 5, 6, null, 9]);
    const out = html(<Pagination page={3} pageCount={9} baseHref="/crm/pacienti" searchParams={{ q: "pop" }} />);
    expect(out).toContain('aria-label="Paginare"');
    expect(out).toMatch(/aria-current="page"[^>]*>[\s\S]*?3/);
    expect(out).toContain('href="/crm/pacienti?q=pop&amp;pagina=4"');
    expect(html(<Pagination page={1} pageCount={1} baseHref="/x" searchParams={{}} />)).toBe("");
  });

  it("Breadcrumbs mark the current page", () => {
    const out = html(<Breadcrumbs items={[{ href: "/servicii", label: "Servicii" }, { label: "Implantologie" }]} />);
    expect(out).toContain('href="/servicii"');
    expect(out).toMatch(/aria-current="page"[^>]*>Implantologie/);
  });

  it("Accordion is built on details and summary", () => {
    const out = html(<Accordion items={[{ question: "Doare?", answer: "Nu." }]} />);
    expect(out).toMatch(/<details[\s\S]*<summary[\s\S]*Doare\?[\s\S]*Nu\./);
  });

  it("PageHeader and Panel render their titles as headings", () => {
    expect(html(<PageHeader title="Pacienți" />)).toMatch(/<h1[^>]*>Pacienți<\/h1>/);
    expect(html(<Panel title="De făcut">x</Panel>)).toMatch(/<h2[^>]*>De făcut<\/h2>/);
  });
});

describe("Icon", () => {
  it("offers the curated lucide subset from the contract", () => {
    const required = [
      "phone", "map-pin", "calendar", "clock", "check", "check-check", "x", "alert-triangle", "door-open", "activity",
      "user-x", "circle-slash", "search", "plus", "chevron-left", "chevron-right", "menu", "log-out", "settings", "file",
      "upload", "download", "printer", "mail", "message-square",
    ];
    for (const name of required) expect(ICON_NAMES).toContain(name);
  });

  it("is decorative unless it gets a label, and draws a 1.5px stroke", () => {
    const decorative = html(<Icon name="phone" />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).toContain('stroke-width="1.5"');
    const labelled = html(<Icon name="alert-triangle" label="Alertă medicală" />);
    expect(labelled).toContain('aria-label="Alertă medicală"');
    expect(labelled).toContain('role="img"');
  });
});
