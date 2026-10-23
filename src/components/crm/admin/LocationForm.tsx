"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { PhoneField } from "@/components/ui/PhoneField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { updateLocationAction } from "@/app/(crm)/crm/(app)/locatii/actions";
import { useActionForm } from "./use-action-form";

export type LocationFormValues = {
  id: string;
  name: string;
  shortName: string;
  street: string;
  city: string;
  county: string;
  postalCode: string | null;
  phone: string;
  email: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  publishHours: boolean;
  sedationUnits: number;
  sortOrder: number;
  active: boolean;
};

/** A clinic's address, phone, map and capacity. The site shows these on Contact and in the footer. */
export function LocationForm({ location, readOnly = false }: { location: LocationFormValues; readOnly?: boolean }) {
  const f = useActionForm(updateLocationAction);
  const e = f.errors;
  const ids = (n: string) => (["publishHours", "active"].includes(n) ? `field-${n}` : `clinica-${n}`);
  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="flex flex-col gap-5">
      {(e || f.formError) && <ErrorSummary errors={e} message={f.formError} idFor={ids} />}
      <input type="hidden" name="id" value={location.id} />
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
        <legend className="sr-only">Datele clinicii</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField id={ids("name")} label="Numele" name="name" required defaultValue={location.name} maxLength={120} error={e?.name} />
          <TextField id={ids("shortName")} label="Numele scurt" name="shortName" required defaultValue={location.shortName} maxLength={40} hint="În calendar și în comutatorul de clinici." error={e?.shortName} />
          <TextField id={ids("street")} label="Strada și numărul" name="street" required defaultValue={location.street} maxLength={160} error={e?.street} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_9.5rem]">
            <TextField id={ids("city")} label="Localitatea" name="city" required defaultValue={location.city} error={e?.city} />
            <TextField id={ids("county")} label="Județul" name="county" required defaultValue={location.county} error={e?.county} />
            <TextField id={ids("postalCode")} label="Cod poștal" name="postalCode" optional inputMode="numeric" defaultValue={location.postalCode ?? ""} error={e?.postalCode} inputClassName="cifre" />
          </div>
          <PhoneField id={ids("phone")} label="Telefon" name="phone" required defaultValue={location.phone} hint="Apare pe site lângă numele clinicii." error={e?.phone} />
          <TextField id={ids("email")} label="E-mail" name="email" type="email" optional defaultValue={location.email ?? ""} error={e?.email} />
        </div>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <TextField id={ids("mapsUrl")} label="Link Google Maps (embed)" name="mapsUrl" optional defaultValue={location.mapsUrl ?? ""} error={e?.mapsUrl} hint="Harta se încarcă pe site doar după acordul vizitatorului." />
          <TextField id={ids("latitude")} label="Latitudine" name="latitude" optional inputMode="decimal" defaultValue={location.latitude?.toString() ?? ""} error={e?.latitude} inputClassName="cifre" />
          <TextField id={ids("longitude")} label="Longitudine" name="longitude" optional inputMode="decimal" defaultValue={location.longitude?.toString() ?? ""} error={e?.longitude} inputClassName="cifre" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            id={ids("sedationUnits")}
            label="Aparate de inhalosedare"
            name="sedationUnits"
            inputMode="numeric"
            defaultValue={String(location.sedationUnits)}
            hint="Câte programări cu inhalosedare pot avea loc în același timp."
            error={e?.sedationUnits}
            inputClassName="cifre"
          />
          <TextField id={ids("sortOrder")} label="Ordinea" name="sortOrder" inputMode="numeric" defaultValue={String(location.sortOrder)} hint="Ordinea în comutatorul de clinici și pe site." error={e?.sortOrder} inputClassName="cifre" />
        </div>
        <div className="flex flex-col gap-2">
          <Checkbox
            name="publishHours"
            label="Programul apare pe site"
            description="Lăsați debifat până când clinica confirmă orele. Programarea online funcționează oricum."
            defaultChecked={location.publishHours}
            error={e?.publishHours}
          />
          <Checkbox name="active" label="Clinică activă" defaultChecked={location.active} error={e?.active} />
        </div>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap gap-3 border-t border-linie pt-4">
          <SubmitButton icon="check" pendingLabel="Se salvează">
            Salvați datele clinicii
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
