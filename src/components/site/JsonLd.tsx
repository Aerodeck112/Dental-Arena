/**
 * Structured data. The only allowed use of dangerouslySetInnerHTML (architecture §8.3):
 * serialised with JSON.stringify and every „<” escaped, so no value can close the script tag.
 * U+2028 and U+2029 are escaped too, because some parsers treat them as line breaks.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
