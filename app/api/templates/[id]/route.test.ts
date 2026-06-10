import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/templates", () => ({
  renameTemplate: vi.fn(async () => true),
  softDeleteTemplate: vi.fn(async () => ({ ok: true, fileKey: "https://abc.public.blob.vercel-storage.com/t.xlsx" })),
}));
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}) }));

import { PATCH, DELETE } from "./route";
import { auth } from "@/auth";
import { renameTemplate, softDeleteTemplate } from "@/lib/db/templates";
import { del } from "@vercel/blob";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockRename = renameTemplate as unknown as ReturnType<typeof vi.fn>;
const mockSoftDelete = softDeleteTemplate as unknown as ReturnType<typeof vi.fn>;
const ctx = { params: { id: "tpl-abc" } };
const patch = (b: unknown) =>
  new Request("http://t/api/templates/tpl-abc", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const delReq = () => new Request("http://t/api/templates/tpl-abc", { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } });
  mockRename.mockResolvedValue(true);
  mockSoftDelete.mockResolvedValue({ ok: true, fileKey: "https://abc.public.blob.vercel-storage.com/t.xlsx" });
});

describe("PATCH /api/templates/[id]", () => {
  it("renames an owned template", async () => {
    const res = await PATCH(patch({ name: "Новое имя", desc: "и описание" }), ctx);
    expect(res.status).toBe(200);
    expect(renameTemplate).toHaveBeenCalledWith("tpl-abc", "u@x.ru", { name: "Новое имя", desc: "и описание" });
  });
  it("403 when not owned / built-in", async () => {
    mockRename.mockResolvedValueOnce(false);
    expect((await PATCH(patch({ name: "X" }), ctx)).status).toBe(403);
  });
  it("400 on empty name", async () => {
    expect((await PATCH(patch({ name: "  " }), ctx)).status).toBe(400);
    expect(renameTemplate).not.toHaveBeenCalled();
  });
  it("401 without a session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    expect((await PATCH(patch({ name: "X" }), ctx)).status).toBe(401);
  });
});

describe("DELETE /api/templates/[id]", () => {
  it("soft-deletes and removes the blob best-effort", async () => {
    const res = await DELETE(delReq(), ctx);
    expect(res.status).toBe(200);
    expect(softDeleteTemplate).toHaveBeenCalledWith("tpl-abc", "u@x.ru");
    expect(del).toHaveBeenCalledWith("https://abc.public.blob.vercel-storage.com/t.xlsx");
  });
  it("403 when not owned / built-in", async () => {
    mockSoftDelete.mockResolvedValueOnce({ ok: false, fileKey: null });
    expect((await DELETE(delReq(), ctx)).status).toBe(403);
    expect(del).not.toHaveBeenCalled();
  });
});
