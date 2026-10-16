"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";

type Target = { key: string } | { doctorId: string };

/**
 * One photo place: the current photo, „Încărcați altă fotografie” and, when it was changed,
 * „Reveniți la fotografia inițială” (or „Scoateți fotografia” for a portrait). The file goes to
 * /api/crm/fotografii, which resizes it; the page refreshes when it is saved.
 */
export function PhotoUploader({
  target,
  src,
  alt,
  isDefault,
  aspect = "aspect-[4/3]",
  withAlt = true,
  resetLabel = "Reveniți la fotografia inițială",
  emptyLabel,
}: {
  target: Target;
  src: string | null;
  alt: string;
  isDefault: boolean;
  aspect?: string;
  withAlt?: boolean;
  resetLabel?: string;
  /** Shown instead of a photo when there is none (a portrait without photo). */
  emptyLabel?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [altText, setAltText] = useState(alt);
  const [pending, startTransition] = useTransition();
  const idBase = "key" in target ? `foto-${target.key.replace(/\W+/g, "-")}` : `foto-medic-${target.doctorId}`;

  const send = (fd: FormData, okMessage: string) => {
    setError(null);
    setDone(null);
    if ("key" in target) fd.set("key", target.key);
    else fd.set("doctorId", target.doctorId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/crm/fotografii", { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(body.error ?? "Fotografia nu a putut fi salvată. Încercați din nou.");
          setPreview(null);
          return;
        }
        setDone(okMessage);
        setPreview(null);
        router.refresh();
      } catch {
        setError("Nu există conexiune. Verificați internetul și încercați din nou.");
      }
    });
  };

  const onPick = (file: File | undefined) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("file", file);
    if (withAlt) fd.set("alt", altText);
    send(fd, "Fotografia a fost salvată. Apare pe site în câteva secunde.");
    if (input.current) input.current.value = "";
  };

  const shown = preview ?? src;
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("relative w-full overflow-hidden rounded-panou border border-linie bg-adancit", aspect)}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- previews of local files and uploads
          <img src={shown} alt={alt} className={cn("size-full object-cover", pending && "opacity-60")} />
        ) : (
          <span className="flex size-full items-center justify-center p-4 text-center text-mic text-discret">{emptyLabel ?? "Fără fotografie"}</span>
        )}
        {pending && <span className="absolute inset-x-0 bottom-0 bg-suprafata/90 px-3 py-1.5 text-mic font-medium">Se încarcă…</span>}
      </div>
      {withAlt && (
        <TextField
          id={`${idBase}-alt`}
          label="Descrierea fotografiei"
          name="alt"
          optional
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          hint="O propoziție despre ce se vede. O citesc cei care nu văd imaginea."
          maxLength={200}
        />
      )}
      <input
        ref={input}
        id={`${idBase}-fisier`}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="s" disabled={pending} onClick={() => input.current?.click()}>
          <ImageUp aria-hidden className="size-4" />
          {src && !isDefault ? "Încărcați altă fotografie" : "Încărcați o fotografie"}
        </Button>
        {!isDefault && (
          <Button
            type="button"
            variant="text"
            size="s"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("action", "reset");
              send(fd, "Gata. Se folosește din nou fotografia inițială.");
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
            {resetLabel}
          </Button>
        )}
      </div>
      <p aria-live="polite" className={cn("text-mic", error ? "font-medium text-carmin" : "text-discret")}>
        {error ?? done ?? "JPG, PNG, WebP sau HEIC, cel mult 15 MB. O micșorăm automat."}
      </p>
    </div>
  );
}
