import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/fills", () => ({ createFill: vi.fn(async () => "fill-1") }));

import { POST } from "./route";
import { auth } from "@/auth";
import { createFill } from "@/lib/db/fills";

const body = {
  templateId: "pt",
  values: [{ fieldId: "f1", value: "X", confidence: "high", source: { fileId: null, locator: "" } }],
  sources: [{ fileId: "u0", name: "a.pdf", mime: "application/pdf", size: "1 КБ", pages: 1, blobKey: null }],
};
const req = (b: unknown) => new Request("http://t/api/fills", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/fills", () => {
  it("401s without a session", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(req(body));
    expect(res.status).toBe(401);
    expect(createFill).not.toHaveBeenCalled();
  });

  it("creates a fill for the session user", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { email: "me@x.ru" } });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "fill-1" });
    expect(createFill).toHaveBeenCalledWith("me@x.ru", expect.objectContaining({ templateId: "pt" }));
  });

  it("400s on a malformed body", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { email: "me@x.ru" } });
    const res = await POST(req({ templateId: "pt" }));
    expect(res.status).toBe(400);
    expect(createFill).not.toHaveBeenCalled();
  });
});
