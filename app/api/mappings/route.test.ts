import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/mappings", () => ({ saveMapping: vi.fn(async () => {}), deleteMapping: vi.fn(async () => {}), getMapping: vi.fn(async () => null) }));
vi.mock("@/lib/db/templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/templates")>();
  return { getTemplate: vi.fn(async () => null), isTemplateAccessible: actual.isTemplateAccessible };
});

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

  it("гость → 403 (not 401/200)", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { role: "guest" } });
    const res = await POST(body({ templateId: "pt", fields: [validField] }));
    expect(res.status).toBe(403);
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

  it("гость → 403 (not 401/200)", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { role: "guest" } });
    const res = await DELETE(delReq({ templateId: "pt" }));
    expect(res.status).toBe(403);
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

import { GET } from "./route";
import { getMapping } from "@/lib/db/mappings";
import { getTemplate } from "@/lib/db/templates";

const mockGetMapping = getMapping as unknown as ReturnType<typeof vi.fn>;
const mockGetTemplate2 = getTemplate as unknown as ReturnType<typeof vi.fn>;
const CUSTOM = { id: "tpl-abc", sheets: ["Форма"], userId: "me@x.ru", deletedAt: null,
  defaultFields: [{ id: "f1", group: "req", label_ru: "X", label_en: "X", cell: "Форма!B2", kind: "string", required: false, strategy: "llm" }],
  code: "T", nameRu: "n", nameEn: "n", descRu: "", descEn: "", format: "xlsx", fileKey: "k" };
const FOREIGN = { ...CUSTOM, id: "tpl-foreign", userId: "other@x.ru" };
const getReq = (tid: string) => new Request(`http://t/api/mappings?templateId=${encodeURIComponent(tid)}`);

describe("GET /api/mappings", () => {
  beforeEach(() => asAuthed());
  it("returns null fields for pt with no saved mapping (client falls back to PT_FIELDS)", async () => {
    const res = await GET(getReq("pt"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ fields: null });
  });
  it("returns the saved mapping when present", async () => {
    mockGetMapping.mockResolvedValueOnce(CUSTOM.defaultFields);
    await expect((await GET(getReq("tpl-abc"))).json()).resolves.toEqual({ fields: CUSTOM.defaultFields });
  });
  it("falls back to the template defaultFields for a custom template", async () => {
    mockGetTemplate2.mockResolvedValueOnce(CUSTOM);
    await expect((await GET(getReq("tpl-abc"))).json()).resolves.toEqual({ fields: CUSTOM.defaultFields });
  });
  it("404s for a foreign custom template", async () => {
    mockGetTemplate2.mockResolvedValueOnce(FOREIGN);
    const res = await GET(getReq("tpl-foreign"));
    expect(res.status).toBe(404);
  });
  it("404s for a non-existent template", async () => {
    mockGetTemplate2.mockResolvedValueOnce(null);
    const res = await GET(getReq("tpl-missing"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/mappings — custom sheets", () => {
  beforeEach(() => asAuthed());
  it("accepts custom-sheet cells for a custom template", async () => {
    mockGetTemplate2.mockResolvedValueOnce(CUSTOM);
    const res = await POST(new Request("http://t/api/mappings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: "tpl-abc", fields: CUSTOM.defaultFields }),
    }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/mappings — ownership gate", () => {
  it("404s when the custom template is foreign", async () => {
    asAuthed();
    mockGetTemplate2.mockResolvedValueOnce(FOREIGN);
    const res = await POST(body({ templateId: "tpl-foreign", fields: [{ ...validField, cell: "Форма!B2" }] }));
    expect(res.status).toBe(404);
    expect(saveMapping).not.toHaveBeenCalled();
  });
  it("404s when the custom template does not exist", async () => {
    asAuthed();
    mockGetTemplate2.mockResolvedValueOnce(null);
    const res = await POST(body({ templateId: "tpl-missing", fields: [{ ...validField, cell: "Форма!B2" }] }));
    expect(res.status).toBe(404);
    expect(saveMapping).not.toHaveBeenCalled();
  });
  it("500s when the template lookup throws", async () => {
    asAuthed();
    mockGetTemplate2.mockRejectedValueOnce(new Error("db down"));
    const res = await POST(body({ templateId: "tpl-abc", fields: [{ ...validField, cell: "Форма!B2" }] }));
    expect(res.status).toBe(500);
    expect(saveMapping).not.toHaveBeenCalled();
  });
});
