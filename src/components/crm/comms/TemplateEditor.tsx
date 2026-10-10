"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button, Checkbox, Dialog, ErrorSummary, Panel, SubmitButton, TextArea, TextField, Toaster, showToast } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";
import type { MessageChannel, TemplatePreview } from "@/server/notify/types";

/**
 * Mesaje → Șabloane → editor (docs/architecture.md §9.2). The preview renders the draft with
 * sample data on the server (the same renderer that sends), lists unknown variables as you type,
 * and, for SMS, shows the text as it will be sent and how many segments it takes.
 */

type PreviewFn = (input: { key: string; subject?: string; body: string }) => Promise<ActionResult<TemplatePreview>>;
type SaveFn = (prev: unknown, input: FormData) => Promise<ActionResult<{ key: string }>>;
type ResetFn = (input: { key: string }) => Promise<ActionResult<{ key: string }>>;

type Props = {
  templateKey: string;
  channel: MessageChannel;
  audience: "pacient" | "clinica";
  subject: string | null;
  body: string;
  active: boolean;
  overridden: boolean;
  defaultSubject: string | null;
  defaultBody: string;
  variables: { name: string; hint: string; sample: string }[];
  previewAction: PreviewFn;
  saveAction: SaveFn;
  resetAction: ResetFn;
};

type SaveResult = ActionResult<{ key: string }> | null;

export function TemplateEditor(p: Props) {
  const isEmail = p.channel === "EMAIL";
  const [subject, setSubject] = useState(p.subject ?? "");
  const [body, setBody] = useState(p.body);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [isOverridden, setOverridden] = useState(p.overridden);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, startReset] = useTransition();
  const [, startPreview] = useTransition();
  const lastField = useRef<"subject" | "body">("body");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const [state, formAction] = useActionState<SaveResult, FormData>(async (prev, fd) => {
    const r = await p.saveAction(prev, fd);
    if (r.ok) {
      setOverridden(true);
      showToast({ kind: "success", message: r.message ?? "Șablonul a fost salvat." });
    }
    return r;
  }, null);

  // Live preview, debounced.
  useEffect(() => {
    const t = setTimeout(() => {
      startPreview(async () => {
        const r = await p.previewAction({ key: p.templateKey, subject: isEmail ? subject : undefined, body });
        if (r.ok) setPreview(r.data);
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body]);

  useEffect(() => {
    bodyRef.current = document.getElementById("field-body") as HTMLTextAreaElement | null;
    subjectRef.current = document.getElementById("field-subject") as HTMLInputElement | null;
  }, []);

  const insert = (name: string) => {
    const token = `{{${name}}}`;
    const target = lastField.current === "subject" && isEmail ? subjectRef.current : bodyRef.current;
    const value = lastField.current === "subject" && isEmail ? subject : body;
    const set = lastField.current === "subject" && isEmail ? setSubject : setBody;
    const start = target?.selectionStart ?? value.length;
    const end = target?.selectionEnd ?? value.length;
    set(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      target?.focus();
      target?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const doReset = () =>
    startReset(async () => {
      const r = await p.resetAction({ key: p.templateKey });
      setConfirmReset(false);
      if (r.ok) {
        setSubject(p.defaultSubject ?? "");
        setBody(p.defaultBody);
        setOverridden(false);
        showToast({ kind: "success", message: r.message ?? "S-a revenit la textul implicit." });
      } else {
        showToast({ kind: "error", message: r.error });
      }
    });

  const serverErrors = state && !state.ok ? state.fieldErrors : null;
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;
  const liveBody = preview?.problems.body ?? [];
  const liveSubject = preview?.problems.subject ?? [];
  const isDefault = subject === (p.defaultSubject ?? "") && body === p.defaultBody;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Toaster />
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {(serverErrors || formError) && <ErrorSummary errors={serverErrors} message={formError} />}
        <input type="hidden" name="key" value={p.templateKey} />
        {isEmail && (
          <TextField
            label="Subiect"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => (lastField.current = "subject")}
            error={serverErrors?.subject ?? (liveSubject.length ? liveSubject : undefined)}
            maxLength={300}
            required
          />
        )}
        <TextArea
          label="Text"
          name="body"
          rows={isEmail ? 14 : 5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => (lastField.current = "body")}
          error={serverErrors?.body ?? (liveBody.length ? liveBody : undefined)}
          hint={p.audience === "pacient" ? "Nu scrieți motivul vizitei și nicio informație medicală." : undefined}
          required
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-corp font-semibold">Variabile</legend>
          <p className="text-mic text-discret">Apăsați o variabilă ca să o adăugați unde se află cursorul.</p>
          <ul className="flex flex-wrap gap-2">
            {p.variables.map((v) => (
              <li key={v.name}>
                <button
                  type="button"
                  onClick={() => insert(v.name)}
                  title={`${v.hint}, de exemplu „${v.sample}”`}
                  className="inline-flex h-control-s items-center rounded-chip border border-linie-control px-3 text-mic hover:bg-adancit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="cifre">{`{{${v.name}}}`}</span>
                  <span className="sr-only">: {v.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <Checkbox
          label="Șablon activ"
          name="active"
          defaultChecked={p.active}
          description="Un șablon oprit nu se mai trimite. Reamintirile pe acest canal se opresc și ele."
        />

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Se salvează">Salvați șablonul</SubmitButton>
          {(isOverridden || !isDefault) && (
            <Button type="button" variant="text" icon="refresh-cw" onClick={() => setConfirmReset(true)}>
              Reveniți la textul implicit
            </Button>
          )}
        </div>
      </form>

      <Panel title="Previzualizare cu date de exemplu" level={2} className="lg:sticky lg:top-4">
        <div aria-live="polite" className="flex flex-col gap-3">
          {!preview ? (
            <p className="text-mic text-discret">Se pregătește previzualizarea.</p>
          ) : (
            <>
              {isEmail && (
                <p className="text-corp">
                  <span className="text-discret">Subiect: </span>
                  <span className="font-semibold">{preview.subject}</span>
                </p>
              )}
              <div className="rounded-control border border-linie bg-fundal p-4 text-corp whitespace-pre-line [overflow-wrap:anywhere] masura">
                {preview.sms ? preview.sms.text : preview.text}
              </div>
              {preview.sms && (
                <p className="text-mic text-discret cifre">
                  {preview.sms.units} caractere, {preview.sms.segments} {preview.sms.segments === 1 ? "segment" : "segmente"} SMS (
                  {preview.sms.encoding === "GSM-7" ? "fără diacritice" : "cu diacritice"}, {preview.sms.perSegment} de caractere pe segment).
                </p>
              )}
            </>
          )}
        </div>
      </Panel>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reveniți la textul implicit?"
        description="Textul modificat se pierde. Mesajele trimise de acum folosesc textul implicit."
        size="s"
        footer={
          <>
            <Button type="button" variant="text" onClick={() => setConfirmReset(false)}>
              Renunțați
            </Button>
            <Button type="button" onClick={doReset} loading={resetting}>
              Reveniți la textul implicit
            </Button>
          </>
        }
      />
    </div>
  );
}
