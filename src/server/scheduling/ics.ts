import "server-only";

/**
 * iCalendar (RFC 5545) file for one appointment, served at `/p/[token]/ics` (docs/architecture.md
 * §4.1, §6.6). Pure. It names the clinic, the address, the doctor and the clinic phone, never the
 * reason for the visit or any health information.
 */

export type IcsEvent = {
  uid: string;
  startsAt: Date;
  endsAt: Date;
  /** Instant the file is generated (DTSTAMP). */
  stamp: Date;
  summary: string;
  location: string;
  description: string;
  url?: string;
  status: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  /** Increases on every reschedule or cancellation (Appointment.tokenVersion). */
  sequence: number;
  /** Minutes before the start for a display alarm; omit for none. */
  alarmMinutesBefore?: number;
};

const CRLF = "\r\n";

/** 20261007T073000Z */
export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes TEXT values: backslash, semicolon, comma and newlines. */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line at 75 octets (UTF-8), never splitting a multi-byte character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // continuation lines start with one space
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

export function buildIcs(e: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dental Arena//Programari//RO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(e.stamp)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(e.endsAt)}`,
    `SEQUENCE:${Math.max(0, Math.floor(e.sequence))}`,
    `STATUS:${e.status}`,
    `SUMMARY:${escapeText(e.summary)}`,
    `LOCATION:${escapeText(e.location)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    ...(e.url ? [`URL:${e.url}`] : []),
    ...(e.alarmMinutesBefore && e.alarmMinutesBefore > 0 && e.status !== "CANCELLED"
      ? [
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeText(e.summary)}`,
          `TRIGGER:-PT${Math.floor(e.alarmMinutesBefore)}M`,
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
