"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { PhoneField } from "@/components/ui/PhoneField";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import type { Role } from "@/generated/prisma/enums";
import { formatPhone } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import {
  createUserAction,
  resetPasswordAction,
  revokeSessionsAction,
  setUserActiveAction,
  updateUserAction,
} from "@/app/(crm)/crm/(app)/echipa/actions";
import { useActionForm } from "./use-action-form";

export type UserFormValues = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  locationIds: string[];
  active: boolean;
};

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Toate modulele, inclusiv setări, facturi anulate și audit.",
  MEDIC: "Agenda proprie, fișe clinice, planuri. Fără facturare.",
  RECEPTIE: "Programări, cereri, pacienți, facturi și încasări. Și pentru asistente.",
};

const PASSWORD_HINT = "Cel puțin 10 caractere, diferită de e-mail. Utilizatorul o schimbă la prima intrare.";

/**
 * Create or edit a staff account: name, e-mail, phone, role and home clinic. On creation, the
 * initial password (policy checked on the server) and, for a MEDIC, the doctor profile to link.
 */
export function UserForm({
  user,
  locations,
  unlinkedDoctors = [],
  isSelf = false,
}: {
  user?: UserFormValues;
  locations: { id: string; shortName: string }[];
  unlinkedDoctors?: { id: string; publicName: string }[];
  isSelf?: boolean;
}) {
  const [role, setRole] = useState<Role>(user?.role ?? "RECEPTIE");
  const f = useActionForm(user ? updateUserAction : createUserAction);
  const e = f.errors;
  const ids = (n: string) => (n === "role" ? "field-role" : `cont-${n}`);

  return (
    <form action={f.formAction} onSubmit={f.onSubmit} noValidate className="flex flex-col gap-5">
      {(e || f.formError) && <ErrorSummary errors={e} message={f.formError} idFor={ids} />}
      {user && <input type="hidden" name="id" value={user.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField id={ids("firstName")} label="Prenume" name="firstName" required autoComplete="off" defaultValue={user?.firstName} maxLength={80} error={e?.firstName} />
        <TextField id={ids("lastName")} label="Nume" name="lastName" required autoComplete="off" defaultValue={user?.lastName} maxLength={80} error={e?.lastName} />
        <TextField id={ids("email")} label="E-mail" name="email" type="email" required autoComplete="off" defaultValue={user?.email} error={e?.email} hint="Cu el se intră în cont." />
        <PhoneField id={ids("phone")} label="Telefon" name="phone" optional defaultValue={user?.phone ? formatPhone(user.phone) : ""} hint="De exemplu 0745 123 456." error={e?.phone} />
      </div>
      <RadioGroup
        legend="Rolul"
        name="role"
        value={role}
        onChange={(v) => setRole(v as Role)}
        options={(["RECEPTIE", "MEDIC", "ADMIN"] as Role[]).map((r) => ({
          value: r,
          label: ROLE_LABEL[r],
          description: ROLE_HELP[r],
          disabled: isSelf && user?.role === "ADMIN" && r !== "ADMIN",
        }))}
        hint={isSelf && user?.role === "ADMIN" ? "Nu vă puteți schimba singur rolul de administrator." : "Schimbarea rolului deconectează utilizatorul de pe toate dispozitivele."}
        error={e?.role}
      />
      <fieldset id={ids("locationIds")} tabIndex={-1} className="flex flex-col gap-1">
        <legend className="text-control font-medium">Clinica în care lucrează</legend>
        <p className="text-mic text-discret">
          {role === "ADMIN"
            ? "Administratorul vede oricum ambele clinici. Bifați clinica unde lucrează de obicei."
            : "Utilizatorul vede doar programările, cererile și facturile clinicilor bifate."}
        </p>
        {e?.locationIds && (
          <p role="alert" className="text-mic font-medium text-carmin">
            {e.locationIds.join(" ")}
          </p>
        )}
        <div className="flex flex-wrap gap-x-8">
          {locations.map((l) => (
            <Checkbox
              key={l.id}
              name="locationIds"
              value={l.id}
              label={l.shortName}
              defaultChecked={user ? user.locationIds.includes(l.id) : locations.length === 1}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        {!user && role === "MEDIC" && unlinkedDoctors.length > 0 && (
          <Select
            id={ids("linkDoctorId")}
            label="Profilul de medic"
            name="linkDoctorId"
            defaultValue=""
            options={[{ value: "", label: "Îl creez după salvare" }, ...unlinkedDoctors.map((d) => ({ value: d.id, label: d.publicName }))]}
            hint="Legați contul de profilul public existent, ca să-și vadă agenda."
            error={e?.linkDoctorId}
          />
        )}
        {!user && (
          <TextField
            id={ids("password")}
            label="Parola inițială"
            name="password"
            type="text"
            required
            autoComplete="new-password"
            hint={PASSWORD_HINT}
            error={e?.password}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-linie pt-4">
        <SubmitButton icon={user ? "check" : "plus"} pendingLabel="Se salvează">
          {user ? "Salvați contul" : "Creați contul"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Reset password, deactivate or reactivate, close all sessions. Guards are enforced on the server. */
export function UserAccountActions({ user, isSelf, isLastAdmin }: { user: UserFormValues; isSelf: boolean; isLastAdmin: boolean }) {
  const [dialog, setDialog] = useState<null | "parola" | "stare" | "sesiuni">(null);
  const close = () => setDialog(null);
  const reset = useActionForm(resetPasswordAction, { onSuccess: close });
  const active = useActionForm(setUserActiveAction, { onSuccess: close });
  const sessions = useActionForm(revokeSessionsAction, { onSuccess: close });
  const cannotDeactivate = user.active && (isSelf || isLastAdmin);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" icon="lock" onClick={() => setDialog("parola")}>
          Resetați parola
        </Button>
        <Button type="button" variant="secondary" icon="log-out" onClick={() => setDialog("sesiuni")}>
          Deconectați toate sesiunile
        </Button>
        <Button
          type="button"
          variant={user.active ? "danger" : "secondary"}
          icon={user.active ? "user-x" : "check"}
          disabled={cannotDeactivate}
          aria-describedby={cannotDeactivate ? "cont-dezactivare-nota" : undefined}
          onClick={() => setDialog("stare")}
        >
          {user.active ? "Dezactivați contul" : "Reactivați contul"}
        </Button>
      </div>
      {cannotDeactivate && (
        <p id="cont-dezactivare-nota" className="text-mic text-discret">
          {isSelf ? "Nu vă puteți dezactiva propriul cont." : "Este singurul administrator activ. Numiți întâi alt administrator."}
        </p>
      )}

      <Dialog
        open={dialog === "parola"}
        onClose={close}
        size="s"
        title="Resetați parola"
        description={`${user.firstName} ${user.lastName} va fi deconectat și va alege o parolă nouă la prima intrare.`}
        footer={
          <>
            <Button type="button" variant="text" onClick={close}>
              Renunțați
            </Button>
            <Button type="submit" form="form-parola" loading={reset.pending}>
              Setați parola
            </Button>
          </>
        }
      >
        <form id="form-parola" action={reset.formAction} onSubmit={reset.onSubmit} noValidate className="flex flex-col gap-3">
          {reset.formError && <p className="text-corp text-carmin">{reset.formError}</p>}
          <input type="hidden" name="id" value={user.id} />
          <TextField id="parola-noua" label="Parola temporară" name="password" type="text" required autoComplete="new-password" hint={PASSWORD_HINT} error={reset.errors?.password} />
        </form>
      </Dialog>

      <Dialog
        open={dialog === "sesiuni"}
        onClose={close}
        size="s"
        title="Deconectați toate sesiunile"
        description="Utilizatorul este scos din cont pe toate dispozitivele și intră din nou cu parola lui."
        footer={
          <>
            <Button type="button" variant="text" onClick={close}>
              Renunțați
            </Button>
            <form action={sessions.formAction} onSubmit={sessions.onSubmit}>
              <input type="hidden" name="id" value={user.id} />
              <Button type="submit" loading={sessions.pending}>
                Deconectați
              </Button>
            </form>
          </>
        }
      >
        {sessions.formError && <p className="text-corp text-carmin">{sessions.formError}</p>}
      </Dialog>

      <Dialog
        open={dialog === "stare"}
        onClose={close}
        size="s"
        title={user.active ? "Dezactivați contul" : "Reactivați contul"}
        description={
          user.active
            ? "Utilizatorul nu mai poate intra și este deconectat imediat. Istoricul lui rămâne în fișe și în audit."
            : "Utilizatorul poate intra din nou cu parola lui."
        }
        footer={
          <>
            <Button type="button" variant="text" onClick={close}>
              Renunțați
            </Button>
            <form action={active.formAction} onSubmit={active.onSubmit}>
              <input type="hidden" name="id" value={user.id} />
              {!user.active && <input type="hidden" name="active" value="true" />}
              <Button type="submit" variant={user.active ? "danger" : "primary"} loading={active.pending}>
                {user.active ? "Dezactivați" : "Reactivați"}
              </Button>
            </form>
          </>
        }
      >
        {active.formError && <p className="text-corp text-carmin">{active.formError}</p>}
      </Dialog>
    </div>
  );
}
