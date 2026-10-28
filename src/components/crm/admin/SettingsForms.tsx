"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TimeInput } from "@/components/ui/TimeInput";
import type { ActionResult } from "@/lib/actions";
import { SETTING_KEY_LABEL, type SettingKey, type SettingsMap } from "@/lib/settings-schema";
import { minutesToHHMM } from "@/lib/time";
import {
  saveBookingSettingsAction,
  saveClinicSettingsAction,
  saveGdprSettingsAction,
  saveInvoicingSettingsAction,
  saveRemindersSettingsAction,
  saveUiSettingsAction,
} from "@/app/(crm)/crm/(app)/setari/actions";
import { useActionForm } from "./use-action-form";

type Action = (prev: unknown, fd: FormData) => Promise<ActionResult<null>>;
type Errors = Record<string, string[]> | undefined;

const PLACEHOLDER = "[de completat]";

/** One settings group: its own form, its own save button, errors next to the fields. */
function SettingsSection({
  id,
  title,
  description,
  action,
  saveLabel,
  children,
}: {
  id: SettingKey;
  title: string;
  description: string;
  action: Action;
  saveLabel: string;
  children: (errors: Errors, ids: (n: string) => string) => ReactNode;
}) {
  const f = useActionForm(action);
  const ids = (n: string) => `${id}-${n}`;
  return (
    <section id={id} aria-labelledby={`${id}-titlu`} className="scroll-mt-4 rounded-panou border border-linie bg-suprafata p-5">
      <h2 id={`${id}-titlu`} className="text-h3 font-semibold">
        {title}
      </h2>
      <p className="mt-1 mb-4 text-mic text-discret masura">{description}</p>
      <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="flex flex-col gap-4">
        {(f.errors || f.formError) && <ErrorSummary errors={f.errors} message={f.formError} idFor={ids} />}
        {children(f.errors, ids)}
        <div className="flex flex-wrap gap-3 border-t border-linie pt-4">
          <SubmitButton icon="check" pendingLabel="Se salvează">
            {saveLabel}
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

const legal = (v: string) => (v === PLACEHOLDER ? "" : v);

export function SettingsForms({
  values,
  services,
  onlineServices,
}: {
  values: SettingsMap;
  /** Services with a code, for the booking defaults. */
  services: { code: string; name: string }[];
  onlineServices: { id: string; name: string; onlineLabel: string | null }[];
}) {
  const { clinic, booking, reminders, invoicing, gdpr, ui } = values;
  const serviceOptions = services.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }));
  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        id="clinic"
        title={SETTING_KEY_LABEL.clinic}
        description="Apar pe facturi, în subsolul site-ului și în paginile legale. Datele legale lăsate goale apar pe facturi marcate „de completat”."
        action={saveClinicSettingsAction}
        saveLabel="Salvați datele clinicii"
      >
        {(e, ids) => (
          <div className="grid items-end gap-4 md:grid-cols-2">
            <TextField id={ids("displayName")} label="Numele afișat" name="displayName" required defaultValue={clinic.displayName} error={e?.displayName} />
            <TextField id={ids("legalName")} label="Denumirea legală" name="legalName" optional defaultValue={legal(clinic.legalName)} placeholder="de exemplu SC Dental Arena SRL" error={e?.legalName} />
            <TextField id={ids("cui")} label="CUI" name="cui" optional defaultValue={legal(clinic.cui)} error={e?.cui} />
            <TextField id={ids("regCom")} label="Nr. Reg. Com." name="regCom" optional defaultValue={legal(clinic.regCom)} placeholder="J26/…/…" error={e?.regCom} />
            <TextField id={ids("registeredAddress")} label="Sediul social" name="registeredAddress" optional defaultValue={legal(clinic.registeredAddress)} error={e?.registeredAddress} className="md:col-span-2" />
            <TextField id={ids("iban")} label="IBAN" name="iban" optional defaultValue={clinic.iban ?? ""} error={e?.iban} inputClassName="cifre" />
            <TextField id={ids("bank")} label="Banca" name="bank" optional defaultValue={clinic.bank ?? ""} error={e?.bank} />
            <TextField id={ids("email")} label="E-mail" name="email" type="email" required defaultValue={clinic.email} error={e?.email} />
            <TextField id={ids("dpoEmail")} label="E-mail pentru protecția datelor" name="dpoEmail" type="email" required defaultValue={clinic.dpoEmail} error={e?.dpoEmail} />
            <TextField id={ids("facebookUrl")} label="Pagina de Facebook" name="facebookUrl" optional defaultValue={clinic.facebookUrl ?? ""} error={e?.facebookUrl} />
            <TextField id={ids("instagramUrl")} label="Pagina de Instagram" name="instagramUrl" optional defaultValue={clinic.instagramUrl ?? ""} error={e?.instagramUrl} />
            <TextField id={ids("foundedYear")} label="Anul înființării" name="foundedYear" inputMode="numeric" required defaultValue={String(clinic.foundedYear)} error={e?.foundedYear} className="max-w-40" inputClassName="cifre" />
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        id="booking"
        title={SETTING_KEY_LABEL.booking}
        description="Regulile după care site-ul oferă ore libere. Ce servicii se pot programa online se alege în Servicii și prețuri."
        action={saveBookingSettingsAction}
        saveLabel="Salvați regulile de programare"
      >
        {(e, ids) => (
          <>
            <Checkbox name="onlineEnabled" label="Programarea online este deschisă" description="Debifat, site-ul arată doar telefoanele clinicilor." defaultChecked={booking.onlineEnabled} />
            <div className="grid items-end gap-4 md:grid-cols-3">
              <Select
                id={ids("slotStepMinutes")}
                label="Pasul orelor oferite"
                name="slotStepMinutes"
                defaultValue={String(booking.slotStepMinutes)}
                options={[5, 10, 15, 20, 30, 60].map((m) => ({ value: String(m), label: `la ${m} minute` }))}
                error={e?.slotStepMinutes}
              />
              <TextField id={ids("minLeadMinutes")} label="Cel mai devreme peste (minute)" name="minLeadMinutes" inputMode="numeric" defaultValue={String(booking.minLeadMinutes)} hint="120 = cel puțin 2 ore de acum." error={e?.minLeadMinutes} inputClassName="cifre" />
              <TextField id={ids("horizonDays")} label="Cel mai târziu peste (zile)" name="horizonDays" inputMode="numeric" defaultValue={String(booking.horizonDays)} error={e?.horizonDays} inputClassName="cifre" />
              <TextField id={ids("maxDaysPerRequest")} label="Zile afișate odată" name="maxDaysPerRequest" inputMode="numeric" defaultValue={String(booking.maxDaysPerRequest)} hint="Între 1 și 14." error={e?.maxDaysPerRequest} inputClassName="cifre" />
              <TextField id={ids("bufferMinutes")} label="Pauză între programări (minute)" name="bufferMinutes" inputMode="numeric" defaultValue={String(booking.bufferMinutes)} error={e?.bufferMinutes} inputClassName="cifre" />
              <TextField id={ids("cancelCutoffHours")} label="Anulare din link cu cel puțin (ore)" name="cancelCutoffHours" inputMode="numeric" defaultValue={String(booking.cancelCutoffHours)} error={e?.cancelCutoffHours} inputClassName="cifre" />
              <TimeInput id={ids("morningEndsAtMinute")} label="Dimineața se termină la" name="morningEndsAtMinute" step={300} defaultValue={minutesToHHMM(booking.morningEndsAtMinute)} error={e?.morningEndsAtMinute} />
              <Select id={ids("homeServiceCode")} label="Serviciul de pe pagina de acasă" name="homeServiceCode" defaultValue={booking.homeServiceCode} options={serviceOptions} error={e?.homeServiceCode} />
              <Select id={ids("unsureServiceCode")} label="Serviciul pentru „Nu știu ce am nevoie”" name="unsureServiceCode" defaultValue={booking.unsureServiceCode} options={serviceOptions} error={e?.unsureServiceCode} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-control font-medium">Servicii programabile online ({onlineServices.length})</p>
              {onlineServices.length === 0 ? (
                <p className="text-mic text-discret">Niciun serviciu. Bifați „Se poate programa online” la serviciile dorite.</p>
              ) : (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-mic">
                  {onlineServices.map((s) => (
                    <li key={s.id}>
                      <a href={`/crm/servicii/${s.id}`} className="text-link underline underline-offset-2">
                        {s.onlineLabel ?? s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SettingsSection>

      <SettingsSection
        id="reminders"
        title={SETTING_KEY_LABEL.reminders}
        description="Mesajele trimise automat înainte de programare. În intervalul de liniște nu pleacă SMS-uri."
        action={saveRemindersSettingsAction}
        saveLabel="Salvați reamintirile"
      >
        {(e, ids) => (
          <>
            <div className="flex flex-col gap-2">
              <Checkbox name="enabled" label="Reamintirile automate sunt pornite" defaultChecked={reminders.enabled} />
              <Checkbox name="smsEnabled" label="Prin SMS" defaultChecked={reminders.smsEnabled} />
              <Checkbox name="emailEnabled" label="Prin e-mail" defaultChecked={reminders.emailEnabled} />
              <Checkbox name="smsStripDiacritics" label="SMS fără diacritice" description="Un SMS cu diacritice are mai puține caractere și costă mai mult." defaultChecked={reminders.smsStripDiacritics} />
            </div>
            <div className="grid items-end gap-4 md:grid-cols-3">
              <TextField id={ids("hoursBefore")} label="Cu câte ore înainte" name="hoursBefore" inputMode="numeric" defaultValue={String(reminders.hoursBefore)} error={e?.hoursBefore} inputClassName="cifre" />
              <TimeInput id={ids("quietStartMinute")} label="Liniște de la" name="quietStartMinute" step={300} defaultValue={minutesToHHMM(reminders.quietStartMinute)} error={e?.quietStartMinute} />
              <TimeInput id={ids("quietEndMinute")} label="Liniște până la" name="quietEndMinute" step={300} defaultValue={minutesToHHMM(reminders.quietEndMinute)} error={e?.quietEndMinute} />
            </div>
          </>
        )}
      </SettingsSection>

      <SettingsSection
        id="invoicing"
        title={SETTING_KEY_LABEL.invoicing}
        description="Seriile de numerotare și mențiunea de TVA de pe facturi. O serie nouă începe numerotarea de la 1."
        action={saveInvoicingSettingsAction}
        saveLabel="Salvați setările de facturare"
      >
        {(e, ids) => (
          <div className="grid items-end gap-4 md:grid-cols-3">
            <TextField id={ids("invoiceSeries")} label="Seria facturilor" name="invoiceSeries" required defaultValue={invoicing.invoiceSeries} hint="De exemplu DA → DA-000001." error={e?.invoiceSeries} />
            <TextField id={ids("receiptSeries")} label="Seria chitanțelor" name="receiptSeries" required defaultValue={invoicing.receiptSeries} hint="Pentru plățile în numerar." error={e?.receiptSeries} />
            <TextField id={ids("paymentTermDays")} label="Termen de plată (zile)" name="paymentTermDays" inputMode="numeric" defaultValue={String(invoicing.paymentTermDays)} hint="0 = scadentă la emitere." error={e?.paymentTermDays} inputClassName="cifre" />
            <TextField id={ids("defaultVatRate")} label="Cota TVA implicită (%)" name="defaultVatRate" inputMode="numeric" defaultValue={String(invoicing.defaultVatRate)} hint="Serviciile medicale sunt de regulă scutite (0)." error={e?.defaultVatRate} inputClassName="cifre" />
            <TextArea id={ids("vatExemptionNote")} label="Mențiunea de scutire de TVA" name="vatExemptionNote" rows={2} defaultValue={invoicing.vatExemptionNote} hint="De confirmat cu contabilul clinicii." error={e?.vatExemptionNote} className="md:col-span-2" />
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        id="gdpr"
        title={SETTING_KEY_LABEL.gdpr}
        description="Cât timp se păstrează cererile neconvertite și textul mesajelor. Perioadele se confirmă cu consilierul juridic."
        action={saveGdprSettingsAction}
        saveLabel="Salvați perioadele de păstrare"
      >
        {(e, ids) => (
          <div className="grid items-end gap-4 md:grid-cols-3">
            <TextField id={ids("consentTextVersion")} label="Versiunea textului de consimțământ" name="consentTextVersion" required defaultValue={gdpr.consentTextVersion} error={e?.consentTextVersion} />
            <TextField id={ids("leadRetentionDays")} label="Cereri neconvertite (zile)" name="leadRetentionDays" inputMode="numeric" defaultValue={String(gdpr.leadRetentionDays)} error={e?.leadRetentionDays} inputClassName="cifre" />
            <TextField id={ids("messageBodyRetentionDays")} label="Textul mesajelor (zile)" name="messageBodyRetentionDays" inputMode="numeric" defaultValue={String(gdpr.messageBodyRetentionDays)} error={e?.messageBodyRetentionDays} inputClassName="cifre" />
          </div>
        )}
      </SettingsSection>

      <SettingsSection id="ui" title={SETTING_KEY_LABEL.ui} description="Densitatea implicită pentru conturile noi. Fiecare utilizator o poate schimba în Contul meu." action={saveUiSettingsAction}
        saveLabel="Salvați aspectul">
        {(e, ids) => (
          <Select
            id={ids("defaultDensity")}
            label="Densitatea"
            name="defaultDensity"
            defaultValue={ui.defaultDensity}
            options={[
              { value: "COMPACT", label: "Compactă (rânduri de 36 px)" },
              { value: "CONFORTABIL", label: "Confortabilă (rânduri de 44 px, pentru tabletă)" },
            ]}
            error={e?.defaultDensity}
            className="max-w-sm"
          />
        )}
      </SettingsSection>
    </div>
  );
}
