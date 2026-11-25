import "server-only";
import { headers } from "next/headers";
import { REQUEST_PATH_HEADER } from "./auth/session";
import { hmacHash } from "./pii";

/**
 * Request metadata for Server Actions, Route Handlers and Server Components.
 * IP addresses are only ever stored as `hmacHash(ip, "ip")` (docs/architecture.md §8.4).
 */

/** First hop of `x-forwarded-for`, else `x-real-ip`, else "0.0.0.0". */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  const real = h.get("x-real-ip")?.trim();
  return real || "0.0.0.0";
}

export async function getIpHash(): Promise<string> {
  return hmacHash(await getClientIp(), "ip");
}

export async function getUserAgent(): Promise<string | null> {
  const ua = (await headers()).get("user-agent");
  return ua ? ua.slice(0, 300) : null;
}

/** The path of the current /crm request, as forwarded by the proxy; null elsewhere. */
export async function getRequestPath(): Promise<string | null> {
  return (await headers()).get(REQUEST_PATH_HEADER);
}
