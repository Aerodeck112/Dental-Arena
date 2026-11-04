"use client";

import { startTransition, useActionState, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { formatPhone, telHref } from "@/lib/format";
import { onlineBookingSchema } from "@/server/leads/schemas";
import type { BookingOptions, Slot } from "@/server/scheduling/types";
import { submitBooking } from "@/app/(site)/programare/actions";
import { BookingConfirmation, type ConfirmationData } from "./BookingConfirmation";
import { BookingSummary } from "./BookingSummary";
import { CallbackForm } from "./CallbackForm";
import { StepComfort } from "./StepComfort";
import { StepDetails, type FieldErrors } from "./StepDetails";
import { StepRail } from "./StepRail";
import { StepReasonClinic } from "./StepReasonClinic";
import { eligibleDoctors, StepSlot } from "./StepSlot";
import { EMPTY_STATE, STEP_COUNT, useBookingState, type BookingState } from "./useBookingState";

type SubmitResult = ActionResult<ConfirmationData> | null;

const FORM_ID = "programare-formular";
/** Fields that live on step 4; an error on any other field sends the visitor back to that step. */
const DETAIL_FIELDS = new Set(["name", "phone", "email", "forWhom", "childFirstName", "childAge", "note", "consentGdpr", "consentSms"]);

/** FormData → plain object, as the server sees it ("" → missing, "on" → true). */
function formObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || v === "") continue;
    out[k] = v === "on" ? true : v;
  }
  return out;
}

function zodErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".") || "form";
    const list = (out[key] ??= []);
    if (!list.includes(i.message)) list.push(i.message);
  }
  return out;
}

/**
 * The online booking wizard (docs/architecture.md §6.5, design system §6.7): four numbered steps
 * with the thread rail, a summary, query-param prefill that skips to the first unanswered step,
 * the „Am o durere acum” branch, the callback request and the confirmation. State lives in the URL
 * and sessionStorage, so going back never loses anything.
 */
export function BookingWizard({
  options,
  initial,
  prefilled,
  idempotencyKey: initialKey,
  callbackKey,
  honeypot,
  callbackHoneypot,
}: {
  options: BookingOptions;
  initial: BookingState;
  prefilled: boolean;
  idempotencyKey: string;
  callbackKey: string;
  honeypot: ReactNode;
  callbackHoneypot: ReactNode;
}) {
  const { state, update, step, goTo, idempotencyKey, finish, serviceId } = useBookingState({
    initial,
    prefilled,
    idempotencyKey: initialKey,
    options,
  });
  const [stepErrors, setStepErrors] = useState<{ reason?: string; clinic?: string; slot?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [slow, setSlow] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmationData | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const clinic = options.clinics.find((c) => c.id === state.locationId) ?? null;

  const changeStep = useCallback(
    (n: number) => {
      moved.current = true;
      setStepErrors({});
      goTo(n);
    },
    [goTo],
  );

  // After a step change made by the visitor: show the top of the step and move focus to its question.
  useEffect(() => {
    if (!moved.current) return;
    const root = contentRef.current;
    const heading = root?.querySelector<HTMLElement>("h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    const top = (root?.getBoundingClientRect().top ?? 0) + window.scrollY - 16;
    if (window.scrollY > top) window.scrollTo({ top });
  }, [step, confirmed]);

  const onSlowLoading = useCallback((v: boolean) => setSlow(v), []);

  const [result, formAction, pending] = useActionState<SubmitResult, FormData>(async (_prev, fd) => {
    const local = onlineBookingSchema.safeParse(formObject(fd));
    if (!local.success) {
      const fieldErrors = zodErrors(local.error.issues);
      return { ok: false, code: "VALIDATION", error: "Verificați câmpurile marcate și încercați din nou.", fieldErrors };
    }
    const r = (await submitBooking(fd)) as SubmitResult;
    if (!r) return r;
    if (r.ok) {
      setConfirmed(r.data);
      finish();
      moved.current = true;
      return r;
    }
    const fields = Object.keys(r.fieldErrors ?? {});
    if (r.code === "SLOT_TAKEN" || fields.includes("startsAt")) {
      setNotice(r.error);
      update({ startsAt: null, localTime: null });
      setReloadKey((n) => n + 1);
      changeStep(1);
    } else if (fields.includes("doctorId")) {
      setNotice(r.fieldErrors?.doctorId?.[0] ?? r.error);
      update({ doctorId: null, startsAt: null, localTime: null });
      changeStep(1);
    } else if (fields.includes("serviceId") || fields.includes("locationId")) {
      setStepErrors({ reason: r.fieldErrors?.serviceId?.[0], clinic: r.fieldErrors?.locationId?.[0] });
      moved.current = true;
      goTo(0);
    }
    return r;
  }, null);

  const detailErrors: FieldErrors = useMemo(() => {
    if (!result || result.ok) return {};
    const out: FieldErrors = {};
    for (const [k, v] of Object.entries(result.fieldErrors ?? {})) if (DETAIL_FIELDS.has(k)) out[k] = v;
    return out;
  }, [result]);
  const generalError =
    result && !result.ok && Object.keys(detailErrors).length === 0 && !["SLOT_TAKEN"].includes(result.code) ? result.error : null;

  // Submit through the dispatcher instead of the form's `action` prop: React resets a form after an
  // action, which would visually undo controlled radios and checkboxes when there are errors.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };

  const next = () => {
    if (step === 0) {
      const errs = {
        reason: state.reasonKey ? undefined : "Alegeți motivul vizitei.",
        clinic: state.locationId ? undefined : "Alegeți clinica.",
      };
      if (errs.reason || errs.clinic) {
        setStepErrors(errs);
        window.setTimeout(() => document.getElementById(errs.reason ? "field-reasonKey" : "field-locationId")?.focus(), 0);
        return;
      }
    }
    if (step === 1 && !state.startsAt) {
      setStepErrors({ slot: "Alegeți o oră din listă." });
      return;
    }
    setNotice(null);
    changeStep(step + 1);
  };

  const back = () => changeStep(step - 1);

  const onReason = (key: string) => {
    const reasonServiceId = key === "nu-stiu" ? options.unsureServiceId : key;
    const stillEligible =
      !state.doctorId || eligibleDoctors(options, reasonServiceId, state.locationId).some((d) => d.id === state.doctorId);
    setStepErrors((e) => ({ ...e, reason: undefined }));
    if (key === state.reasonKey) return;
    update({ reasonKey: key, startsAt: null, localTime: null, ...(stillEligible ? {} : { doctorId: null }) });
  };

  const onClinic = (locationId: string) => {
    setStepErrors((e) => ({ ...e, clinic: undefined }));
    if (locationId === state.locationId) return;
    const doctorWorksThere = state.doctorId ? options.doctors.some((d) => d.id === state.doctorId && d.locationIds.includes(locationId)) : true;
    update({ locationId, startsAt: null, localTime: null, ...(doctorWorksThere ? {} : { doctorId: null }) });
  };

  const onDoctor = useCallback((doctorId: string | null) => update({ doctorId, startsAt: null, localTime: null }), [update]);
  const onDay = useCallback((dateISO: string) => update({ dateISO }), [update]);
  const onSlot = useCallback(
    (slot: Slot | null, dateISO: string | null) => {
      setStepErrors({});
      update(slot ? { startsAt: slot.startsAt, localTime: slot.localTime, dateISO } : { startsAt: null, localTime: null });
    },
    [update],
  );

  const newBooking = () => {
    setConfirmed(null);
    setNotice(null);
    update({ ...EMPTY_STATE, name: state.name, phone: state.phone, email: state.email });
    changeStep(0);
  };

  if (!options.onlineEnabled) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 py-10">
        <h1 className="font-display text-h1 text-cerneala">Programări la telefon</h1>
        <p className="text-lead text-discret">Programările online sunt oprite momentan. Sunați-ne și vă găsim o oră.</p>
        <ul className="flex flex-col gap-2">
          {options.clinics.map((c) => (
            <li key={c.id}>
              <a href={telHref(c.phone)} aria-label={`Sunați la ${c.shortName}, ${formatPhone(c.phone)}`} className="text-h3 text-link underline underline-offset-4">
                {c.shortName} <span className="telefon">{formatPhone(c.phone)}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div ref={contentRef}>
        <BookingConfirmation data={confirmed} clinic={clinic} comfort={state.comfort} wantsSedation={state.wantsSedation} onNewBooking={newBooking} />
      </div>
    );
  }

  const isLast = step === STEP_COUNT - 1;
  const submitLabel = state.localTime ? `Rezervați ora de ${state.localTime}` : "Rezervați ora";

  return (
    <div className="pb-28 lg:pb-0">
      <h1 className="sr-only">Programare online</h1>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-6">
            <StepRail variant="rail" current={step} onSelect={changeStep} loading={slow} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-6">
          <div className="flex flex-col gap-4 lg:hidden">
            <StepRail variant="inline" current={step} onSelect={changeStep} loading={slow} />
            <BookingSummary options={options} state={state} variant="collapsed" />
          </div>

          <div ref={contentRef} key={step} className="da-fade flex flex-col gap-8">
            {step === 0 && <StepReasonClinic options={options} state={state} onReason={onReason} onClinic={onClinic} errors={stepErrors} />}
            {step === 1 && serviceId && (
              <StepSlot
                options={options}
                state={state}
                serviceId={serviceId}
                onDoctor={onDoctor}
                onDay={onDay}
                onSlot={onSlot}
                onSlowLoading={onSlowLoading}
                notice={notice ?? stepErrors.slot ?? null}
                reloadKey={reloadKey}
                callback={
                  <CallbackForm
                    honeypot={callbackHoneypot}
                    idempotencyKey={callbackKey}
                    context={{ locationId: state.locationId, serviceId, doctorId: state.doctorId, comfort: state.comfort }}
                    defaults={{ name: state.name, phone: state.phone }}
                  />
                }
              />
            )}
            {step === 2 && <StepComfort state={state} update={update} />}
            {step === 3 && (
              <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
                {(Object.keys(detailErrors).length > 0 || generalError) && (
                  <ErrorSummary errors={detailErrors} message={generalError} />
                )}
                {honeypot}
                <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
                <input type="hidden" name="sourcePath" value="/programare" />
                <input type="hidden" name="serviceId" value={serviceId ?? ""} />
                <input type="hidden" name="locationId" value={state.locationId ?? ""} />
                <input type="hidden" name="doctorId" value={state.doctorId ?? ""} />
                <input type="hidden" name="startsAt" value={state.startsAt ?? ""} />
                <input type="hidden" name="comfort" value={state.comfort ?? ""} />
                <input type="hidden" name="comfortNote" value={state.comfort === "EMOTII" || state.comfort === "FRICA" ? state.comfortNote : ""} />
                <input type="hidden" name="wantsSedation" value={state.wantsSedation ? "on" : ""} />
                <StepDetails state={state} update={update} errors={detailErrors} />
              </form>
            )}
          </div>

          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 bg-suprafata px-margine pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-float",
              "lg:static lg:mt-4 lg:bg-transparent lg:p-0 lg:shadow-none",
            )}
          >
            {step > 0 ? (
              <Button variant="text" icon="chevron-left" onClick={back}>
                Înapoi
              </Button>
            ) : (
              <span />
            )}
            {isLast ? (
              // Distinct keys: reusing the "Continuați" <button> as the submit button would let the
              // click that opened this step also submit the form (errors shown before typing).
              <Button key="trimite" type="submit" form={FORM_ID} size="l" loading={pending} className="min-w-0">
                {pending ? "Se trimite" : submitLabel}
              </Button>
            ) : (
              <Button key="continua" size="l" onClick={next}>
                Continuați
              </Button>
            )}
          </div>
        </div>

        <div className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-6">
            <BookingSummary options={options} state={state} variant="aside" />
          </div>
        </div>
      </div>
    </div>
  );
}
