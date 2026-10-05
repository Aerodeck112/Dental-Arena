/**
 * Structured data. The only allowed use of dangerouslySetInnerHTML (architecture §8.3):
 * serialised with JSON.stringify and every „<” escaped, so no value can close the script tag.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/ /g, "\\u2028").replace(/ /g, "\\u2029");
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
