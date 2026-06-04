import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/mappings", () => ({ saveMapping: vi.fn(async () => {}), deleteMapping: vi.fn(async () => {}) }));

import { POST, DELETE } from "./route";
import { auth } from "@/auth";
import { saveMapping, deleteMapping } from "@/lib/db/mappings";

const validField = { id: "f1", group: "req", label_ru: "Контрагент", label_en: "Counterparty", cell: "ПТ!D9", kind: "string", required: true, strategy: "llm" };
const body = (b: unknown) => new Request("http://t/api/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const delReq = (b: unknown) => new Request("http://t/api/mappings", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const asAuthed = () => (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { email: "me@x.ru" } });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/mappings", () => {
  it("401s without a session", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(body({ templateId: "pt", fields: [validField] }));
    expect(res.status).toBe(401);
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("upserts a valid mapping for the session user", async () => {
    asAuthed();
    const res = await POST(body({ templateId: "pt", fields: [validField] }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(saveMapping).toHaveBeenCalledWith("me@x.ru", "pt", expect.arrayContaining([expect.objectContaining({ id: "f1", cell: "ПТ!D9" })]));
  });

  it("400s when fields fail validation (bad cell)", async () => {
    asAuthed();
    const res = await POST(body({ templateId: "pt", fields: [{ ...validField, cell: "9D" }] }));
    expect(res.status).toBe(400);
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("400s when fields[] exceeds the length cap", async () => {
    asAuthed();
    const big = Array.from({ length: 101 }, (_, i) => ({ ...validField, id: `f${i}` }));
    const res = await POST(body({ templateId: "pt", fields: big }));
    expect(res.status).toBe(400);
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("400s on a malformed body (missing fields)", async () => {
    asAuthed();
    const res = await POST(body({ templateId: "pt" }));
    expect(res.status).toBe(400);
    expect(saveMapping).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/mappings", () => {
  it("401s without a session", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await DELETE(delReq({ templateId: "pt" }));
    expect(res.status).toBe(401);
    expect(deleteMapping).not.toHaveBeenCalled();
  });

  it("deletes the mapping for the session user", async () => {
    asAuthed();
    const res = await DELETE(delReq({ templateId: "pt" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteMapping).toHaveBeenCalledWith("me@x.ru", "pt");
  });
});
