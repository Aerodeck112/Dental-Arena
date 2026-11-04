import { personName } from "@/lib/format";
import { utcToLocal } from "@/lib/time";
import type { PatientSummary } from "./types";

/** Shared `select` and mapper for `PatientSummary` (no PII beyond what the summary shows). */
export const PATIENT_SUMMARY_SELECT = {
  id: true,
  fileNumber: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  birthDate: true,
  anonymizedAt: true,
} as const;

export function localDateOrNull(d: Date | null | undefined): string | null {
  return d ? utcToLocal(d).dateISO : null;
}

export function toPatientSummary(p: {
  id: string;
  fileNumber: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  birthDate: Date | null;
  anonymizedAt: Date | null;
}): PatientSummary {
  return {
    id: p.id,
    fileNumber: p.fileNumber,
    name: personName(p),
    phone: p.phone,
    email: p.email,
    birthDate: localDateOrNull(p.birthDate),
    anonymized: p.anonymizedAt !== null,
  };
}
