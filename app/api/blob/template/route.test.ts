import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}) }));

import { DELETE } from "./route";
import { auth } from "@/auth";
import { del } from "@vercel/blob";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockDel = del as unknown as ReturnType<typeof vi.fn>;
const OWN_URL = "https://abc.public.blob.vercel-storage.com/tpl-1.xlsx";
const delReq = (b: unknown) =>
  new Request("http://t/api/blob/template", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } });
  mockDel.mockResolvedValue(undefined);
});

describe("DELETE /api/blob/template", () => {
  it("401s without a session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await DELETE(delReq({ url: OWN_URL }));
    expect(res.status).toBe(401);
    expect(mockDel).not.toHaveBeenCalled();
  });
  it("400s on a non-own url", async () => {
    const res = await DELETE(delReq({ url: "https://evil.example.com/x.xlsx" }));
    expect(res.status).toBe(400);
    expect(mockDel).not.toHaveBeenCalled();
  });
  it("400s on a missing url", async () => {
    const res = await DELETE(delReq({}));
    expect(res.status).toBe(400);
    expect(mockDel).not.toHaveBeenCalled();
  });
  it("deletes an own blob and returns ok", async () => {
    const res = await DELETE(delReq({ url: OWN_URL }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith(OWN_URL);
  });
});
