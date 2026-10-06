"use client";

import { useState } from "react";
import { Checkbox, CheckboxBox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { saveDoctorProfileAction } from "@/app/(crm)/crm/(app)/echipa/actions";
import { useActionForm } from "./use-action-form";

export type DoctorProfileValues = {
  id: string;
  slug: string;
  honorific: string;
  firstName: string;
  lastName: string;
  publicName: string;
  roleLine: string;
  bio: string | null;
  photoPath: string | null;
  monogram: string | null;
  publicVisible: boolean;
  acceptsOnlineBooking: boolean;
  active: boolean;
  sortOrder: number;
  categories: { categoryId: string; showOnSite: boolean }[];
};

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The doctor's public profile (site team pages, booking): address, public name, role line, photo
 * or monogram, the categories they treat (and on which service pages they appear), online booking,
 * visibility and order.
 */
export function DoctorProfileForm({
  doctor,
  userId,
  categories,
  defaults,
}: {
  doctor?: DoctorProfileValues;
  /** Create the profile linked to this MEDIC account. */
  userId?: string;
  categories: { id: string; name: string }[];
  defaults?: { firstName: string; lastName: string };
}) {
  const [firstName, setFirstName] = useState(doctor?.firstName ?? defaults?.firstName ?? "");
  const [lastName, setLastName] = useState(doctor?.lastName ?? defaults?.lastName ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(doctor));
  const [slug, setSlug] = useState(doctor?.slug ?? slugify(`${firstName} ${lastName}`));
  const [publicTouched, setPublicTouched] = useState(Boolean(doctor));
  const [publicName, setPublicName] = useState(doctor?.publicName ?? (firstName || lastName ? `Dr. ${firstName} ${lastName}`.trim() : ""));
  const [treated, setTreated] = useState<Set<string>>(new Set(doctor?.categories.map((c) => c.categoryId)));
  const f = useActionForm(saveDoctorProfileAction);
  const e = f.errors;
  const ids = (n: string) => `medic-${n}`;

  const onName = (fn: string, ln: string) => {
    if (!slugTouched) setSlug(slugify(`${fn} ${ln}`));
    if (!publicTouched) setPublicName(`Dr. ${fn} ${ln}`.replace(/\s+/g, " ").trim());
  };
  const shown = new Set(doctor?.categories.filter((c) => c.showOnSite).map((c) => c.categoryId));

  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="flex flex-col gap-5">
      {(e || f.formError) && <ErrorSummary errors={e} message={f.formError} idFor={ids} />}
      {doctor && <input type="hidden" name="doctorId" value={doctor.id} />}
      {!doctor && userId && <input type="hidden" name="userId" value={userId} />}
      <div className="grid gap-4 md:grid-cols-[6rem_1fr_1fr]">
        <TextField id={ids("honorific")} label="Titlu" name="honorific" defaultValue={doctor?.honorific ?? "Dr."} maxLength={20} error={e?.honorific} />
        <TextField
          id={ids("firstName")}
          label="Prenume"
          name="firstName"
          required
          value={firstName}
          onChange={(ev) => {
            setFirstName(ev.target.value);
            onName(ev.target.value, lastName);
          }}
          error={e?.firstName}
        />
        <TextField
          id={ids("lastName")}
          label="Nume"
          name="lastName"
          required
          value={lastName}
          onChange={(ev) => {
            setLastName(ev.target.value);
            onName(firstName, ev.target.value);
          }}
          error={e?.lastName}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id={ids("publicName")}
          label="Numele public"
          name="publicName"
          required
          value={publicName}
          onChange={(ev) => {
            setPublicTouched(true);
            setPublicName(ev.target.value);
          }}
          hint="Prenume, apoi nume, de exemplu Dr. Andrei Marcoci."
          error={e?.publicName}
        />
        <TextField
          id={ids("slug")}
          label="Adresa paginii"
          name="slug"
          required
          value={slug}
          onChange={(ev) => {
            setSlugTouched(true);
            setSlug(ev.target.value);
          }}
          hint={`Pagina pe site: /echipa/${slug || "…"}`}
          error={e?.slug}
        />
        <TextField id={ids("roleLine")} label="Specializarea" name="roleLine" required defaultValue={doctor?.roleLine} maxLength={160} hint="De exemplu Medic dentist, stomatologie generală." error={e?.roleLine} className="md:col-span-2" />
        <TextField
          id={ids("photoPath")}
          label="Fotografia"
          name="photoPath"
          optional
          defaultValue={doctor?.photoPath ?? ""}
          hint="Calea din /images/, de exemplu /images/echipa/andrei-marcoci.jpg. Fără fotografie, site-ul arată monograma."
          error={e?.photoPath}
        />
        <TextField id={ids("monogram")} label="Monograma" name="monogram" optional defaultValue={doctor?.monogram ?? ""} maxLength={3} hint="1–3 litere, de exemplu VP." error={e?.monogram} />
      </div>
      <TextArea id={ids("bio")} label="Prezentare" name="bio" optional rows={5} maxLength={3000} defaultValue={doctor?.bio ?? ""} error={e?.bio} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-control font-medium">Ce tratează</legend>
        <p className="text-mic text-discret">Bifați categoriile; „Pe pagina serviciului” îl arată în „Cine vă tratează”.</p>
        <ul className="grid gap-x-6 gap-y-1 md:grid-cols-2">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-linie py-1.5">
              <label className="flex items-center gap-2 text-corp">
                <CheckboxBox
                  name="categoryIds"
                  value={c.id}
                  checked={treated.has(c.id)}
                  onChange={(ev) => {
                    const next = new Set(treated);
                    if (ev.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setTreated(next);
                  }}
                />
                {c.name}
              </label>
              {treated.has(c.id) && (
                <label className="flex items-center gap-2 text-mic text-discret">
                  <CheckboxBox name="showOnSiteIds" value={c.id} defaultChecked={shown.has(c.id)} />
                  Pe pagina serviciului
                </label>
              )}
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        <Checkbox name="publicVisible" label="Apare pe site, în Echipă" defaultChecked={doctor?.publicVisible ?? true} />
        <Checkbox name="acceptsOnlineBooking" label="Se poate programa online la acest medic" defaultChecked={doctor?.acceptsOnlineBooking ?? true} />
        <Checkbox name="active" label="Activ" description="Un medic inactiv nu mai apare în calendar și la programări noi." defaultChecked={doctor?.active ?? true} />
        <TextField id={ids("sortOrder")} label="Ordinea pe site" name="sortOrder" inputMode="numeric" defaultValue={String(doctor?.sortOrder ?? 0)} className="max-w-32" error={e?.sortOrder} />
      </div>
      <div className="flex flex-wrap gap-3 border-t border-linie pt-4">
        <SubmitButton icon="check" pendingLabel="Se salvează">
          {doctor ? "Salvați profilul" : "Creați profilul"}
        </SubmitButton>
      </div>
    </form>
  );
}
