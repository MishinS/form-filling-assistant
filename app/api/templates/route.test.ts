import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { zipSync, strToU8 } from "fflate";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/templates", () => ({ createTemplate: vi.fn(async () => {}) }));
vi.mock("@/lib/db/mappings", () => ({ saveMapping: vi.fn(async () => {}) }));
vi.mock("@/lib/templates/scan", () => ({ proposeFields: vi.fn(async () => []) }));

import { POST } from "./route";
import { auth } from "@/auth";
import { createTemplate } from "@/lib/db/templates";
import { saveMapping } from "@/lib/db/mappings";
import { proposeFields } from "@/lib/templates/scan";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockPropose = proposeFields as unknown as ReturnType<typeof vi.fn>;
const OK_URL = "https://abc.public.blob.vercel-storage.com/tpl-1.xlsx";
const FIELD = { id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier", cell: "Лист1!B1", kind: "string", required: false, strategy: "llm" };

const xlsxBytes = () => zipSync({
  "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="Лист1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
  "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`),
  "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData/></worksheet>`),
});

const post = (b: unknown) =>
  new Request("http://t/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } });
  mockPropose.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => xlsxBytes().buffer }) as unknown as Response));
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/templates", () => {
  it("creates a template (sheets parsed, LLM fields saved as the initial mapping)", async () => {
    mockPropose.mockResolvedValueOnce([FIELD]);
    const res = await POST(post({ name: "Моя форма", desc: "тест", url: OK_URL }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: string; fields: number };
    expect(data.ok).toBe(true);
    expect(data.id).toMatch(/^tpl-/);
    expect(data.fields).toBe(1);
    expect(createTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: "Моя форма", desc: "тест", fileKey: OK_URL, sheets: ["Лист1"], userId: "u@x.ru", defaultFields: [FIELD],
    }));
    expect(saveMapping).toHaveBeenCalledWith("u@x.ru", data.id, [FIELD]);
  });
  it("creates with zero fields when the LLM scan fails (no mapping write)", async () => {
    mockPropose.mockRejectedValueOnce(new Error("llm down"));
    const res = await POST(post({ name: "Форма", url: OK_URL }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, fields: 0 });
    expect(saveMapping).not.toHaveBeenCalled();
  });
  it("400 on empty name", async () => {
    expect((await POST(post({ name: "  ", url: OK_URL }))).status).toBe(400);
  });
  it("400 on a foreign blob url", async () => {
    expect((await POST(post({ name: "Ф", url: "https://evil.example.com/x.xlsx" }))).status).toBe(400);
    expect(createTemplate).not.toHaveBeenCalled();
  });
  it("400 when the blob is not an XLSX", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => strToU8("garbage").buffer }) as unknown as Response));
    expect((await POST(post({ name: "Ф", url: OK_URL }))).status).toBe(400);
  });
  it("401 without a session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    expect((await POST(post({ name: "Ф", url: OK_URL }))).status).toBe(401);
  });
});
