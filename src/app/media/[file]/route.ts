import { readMediaFile } from "@/server/media/site-images";

/**
 * GET /media/[file]: photos uploaded from the CRM (site places and doctor portraits). File names
 * carry a unique suffix, so a new upload gets a new URL and the files can be cached for a year.
 */
export async function GET(_request: Request, ctx: RouteContext<"/media/[file]">): Promise<Response> {
  const { file } = await ctx.params;
  const data = await readMediaFile(file);
  if (!data) return new Response("Fotografia nu există.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
