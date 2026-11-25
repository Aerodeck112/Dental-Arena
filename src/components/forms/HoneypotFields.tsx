import { FORM_TS_FIELD, HONEYPOT_FIELD, signFormTimestamp } from "@/lib/honeypot";
import { FormTimestampInput } from "@/lib/honeypot-client";

/**
 * Hidden anti-bot fields for public forms (docs/architecture.md §8.2). Server component: put it
 * inside the `<form>`. The honeypot input is invisible and skipped by keyboard and screen readers;
 * people never see it, bots that fill every field give themselves away.
 */
export function HoneypotFields() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
      >
        <label>
          Lăsați acest câmp gol
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <FormTimestampInput name={FORM_TS_FIELD} initial={signFormTimestamp()} />
    </>
  );
}
