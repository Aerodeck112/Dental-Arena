import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file:./prisma/test-wp1.db";
});

import { GET, dynamic } from "../route";

describe("GET /api/health", () => {
  it("returns { ok: true, db: true } when the database answers", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it("is never cached", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
