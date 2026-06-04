import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "t@t.ru" } })) }));
vi.mock("@vercel/blob/client", () => ({ handleUpload: vi.fn(async () => ({ ok: true })) }));

import { POST } from "./route";
import { auth } from "@/auth";

const req = (body: unknown) =>
  new Request("http://t/api/blob/upload", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/blob/upload", () => {
  it("401s without a session (before handleUpload)", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(req({ type: "blob.generate-client-token" }));
    expect(res.status).toBe(401);
  });
  it("delegates to handleUpload when authed", async () => {
    const res = await POST(req({ type: "blob.generate-client-token" }));
    expect(res.status).toBe(200);
  });
});
