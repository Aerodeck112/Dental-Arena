import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp5.db";
});

import type { CurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { DEFAULT_TEMPLATES, SAMPLE_VARIABLES } from "../default-templates";
import {
  allowedVariables,
  escapeHtml,
  getTemplate,
  renderTemplate,
  renderText,
  resetTemplate,
  saveTemplate,
  templateProblems,
  templateVariables,
  textToEmailHtml,
} from "../templates";
import { TEMPLATE_KEYS, TEMPLATE_VARIABLES } from "../types";

const admin: CurrentUser = {
  id: "admin-templates-test",
  role: "ADMIN",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Test",
  displayName: "Admin Test",
  doctorId: null,
  homeLocationId: null,
  theme: "SISTEM",
  density: "COMPACT",
  mustChangePassword: false,
};

describe("template syntax", () => {
  it("lists variables once, in order", () => {
    expect(templateVariables("{{ora}} {{data}}, {{ ora }} {{link}}")).toEqual(["ora", "data", "link"]);
  });

  it("renders variables and blanks unknown or missing ones", () => {
    expect(renderText("Bună ziua, {{prenume}}. {{necunoscut}}Ora: {{ora}}", { prenume: "Maria" })).toBe("Bună ziua, Maria. Ora: ");
    expect(renderText("{{ data }}", { data: "marți, 7 octombrie" })).toBe("marți, 7 octombrie");
  });

  it("rejects unknown variables, unbalanced braces and motiv in patient messages", () => {
    const patient = allowedVariables("reminder.sms");
    expect(templateProblems("Ora {{ora}} la {{clinica}}", patient)).toEqual([]);
    expect(templateProblems("Salut {{prenumele}}", patient)).toEqual(["Variabila {{prenumele}} nu există. Folosiți doar variabilele din listă."]);
    expect(templateProblems("Ora {{ora}", patient)[0]).toContain("Acoladele nu sunt închise corect");
    expect(templateProblems("{{motiv}}", patient)[0]).toContain("{{motiv}} nu se folosește în mesajele către pacienți");
    expect(templateProblems("{{}}", patient)[0]).toContain("fără nume");
    expect(templateProblems("{{motiv}}", allowedVariables("clinic.newLead.email"))).toEqual([]);
  });
});

describe("default templates", () => {
  it("cover every key, use only known variables and keep motiv out of patient messages", () => {
    for (const key of TEMPLATE_KEYS) {
      const t = DEFAULT_TEMPLATES[key];
      expect(t.key).toBe(key);
      expect(templateProblems(t.body, allowedVariables(key))).toEqual([]);
      if (t.subject) expect(templateProblems(t.subject, allowedVariables(key))).toEqual([]);
      expect(t.channel === "EMAIL").toBe(t.subject !== null);
      if (t.audience === "pacient") expect(t.body + (t.subject ?? "")).not.toContain("{{motiv}}");
    }
  });

  it("use the formal register: no exclamation marks, comma-below ș ț only", () => {
    for (const t of Object.values(DEFAULT_TEMPLATES)) {
      const all = `${t.name} ${t.description} ${t.subject ?? ""} ${t.body}`;
      expect(all).not.toMatch(/!/);
      expect(all).not.toMatch(/[şţŞŢ]/);
    }
  });

  it("put the confirm-or-cancel link in reminders and match the copy of the confirmation SMS", () => {
    expect(DEFAULT_TEMPLATES["reminder.sms"].body).toBe(
      "Dental Arena: vă reamintim programarea de {{data}}, ora {{ora}}, la {{clinica}}. Confirmați sau anulați: {{link}}",
    );
    expect(DEFAULT_TEMPLATES["reminder.email"].body).toContain("{{link}}");
    expect(DEFAULT_TEMPLATES["reminder.email"].body).toContain("buletinul și lista medicamentelor pe care le luați");
    expect(renderText(DEFAULT_TEMPLATES["booking.confirmed.sms"].body, SAMPLE_VARIABLES)).toBe(
      "Programarea de marți, 7 octombrie, ora 10:30, la Dental Arena Cristești este confirmată. Dacă nu mai puteți veni, sunați la 0265 326 316.",
    );
    expect(DEFAULT_TEMPLATES["booking.received.email"].subject).toBe("Am primit cererea de programare: {{data}}, ora {{ora}}");
    expect(DEFAULT_TEMPLATES["clinic.newLead.email"].subject).toBe("Cerere nouă din site: {{nume}}, {{motiv}}");
  });

  it("have sample values for every variable", () => {
    for (const v of TEMPLATE_VARIABLES) expect(SAMPLE_VARIABLES[v]).toBeTruthy();
  });
});

describe("e-mail HTML", () => {
  it("escapes everything, including values from variables, then links URLs", () => {
    const text = renderText("Bună ziua, {{prenume}},\n\nLink: {{link}}.", {
      prenume: '<script>alert("x")</script>',
      link: "https://dentalarena.ro/p/abc?x=1&y=2",
    });
    const html = textToEmailHtml(text);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain('<a href="https://dentalarena.ro/p/abc?x=1&amp;y=2"');
    expect(html).toContain("</a>.");
    expect(html).not.toMatch(/<img/);
    expect(escapeHtml(`'&'`)).toBe("&#39;&amp;&#39;");
  });
});

describe("DB overrides", () => {
  it("use the default until an ADMIN saves, validate variables, and reset back", async () => {
    const key = "moved.sms" as const;
    await prisma.messageTemplate.deleteMany({ where: { key } });
    expect((await getTemplate(key)).overridden).toBe(false);

    await expect(saveTemplate(key, { body: "Mutat: {{data}} {{ora}} {{necunoscut}}", active: true }, admin)).rejects.toBeInstanceOf(DomainError);
    await expect(saveTemplate(key, { body: "Mutat: {{motiv}}", active: true }, admin)).rejects.toMatchObject({ code: "VALIDATION" });

    await saveTemplate(key, { body: "Programarea s-a mutat pe {{data}}, ora {{ora}}. {{link}}", active: true }, admin);
    const t = await getTemplate(key);
    expect(t.overridden).toBe(true);
    expect(t.body).toBe("Programarea s-a mutat pe {{data}}, ora {{ora}}. {{link}}");
    const rendered = await renderTemplate(key, { data: "joi, 9 octombrie", ora: "11:00", link: "L" });
    expect(rendered?.text).toBe("Programarea s-a mutat pe joi, 9 octombrie, ora 11:00. L");

    const audits = await prisma.auditLog.count({ where: { action: "template.update", entityId: key, actorId: admin.id } });
    expect(audits).toBeGreaterThanOrEqual(1);

    await saveTemplate(key, { body: "Oprit {{ora}}", active: false }, admin);
    expect(await renderTemplate(key, { ora: "10:00" })).toBeNull();

    await resetTemplate(key, admin);
    const back = await getTemplate(key);
    expect(back.overridden).toBe(false);
    expect(back.body).toBe(DEFAULT_TEMPLATES[key].body);
  });

  it("requires a subject for e-mail templates", async () => {
    await expect(saveTemplate("cancel.email", { subject: " ", body: "Anulat {{data}}", active: true }, admin)).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { subject: ["Scrieți subiectul e-mailului."] },
    });
  });
});
