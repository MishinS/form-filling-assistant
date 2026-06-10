import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "t@t.ru" } })) }));
vi.mock("@/lib/db/templates", () => ({ getTemplate: vi.fn() }));
import { POST } from "./route";
import type { ExtractedValue } from "@/lib/types";
import { PT_FIELDS } from "@/lib/extract/fields";

const ev = (fieldId: string, value: string): ExtractedValue => ({
  fieldId, value, confidence: "high", source: { fileId: null, locator: "" },
});
const post = (body: unknown) =>
  POST(new Request("http://t/api/fill", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/fill", () => {
  it("returns a filled xlsx with download headers", async () => {
    const res = await post({ templateId: "pt", values: [ev("f1", 'ООО «Тест»'), ev("f4", "100 000,00")] });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type"))
      .toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toContain("filename*=UTF-8''");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  it("400 on unknown templateId", async () => {
    const res = await post({ templateId: "nope", values: [] });
    expect(res.status).toBe(400);
  });

  it("400 on malformed body", async () => {
    const res = await POST(new Request("http://t/api/fill", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });
});

describe("/api/fill field validation", () => {
  const call = (body: unknown) =>
    POST(new Request("http://t/api/fill", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));

  it("400s on a malformed fields list", async () => {
    const res = await call({ templateId: "pt", values: [], fields: [{ id: "f1", cell: "9D" }] });
    expect(res.status).toBe(400);
  });
  it("200s with a valid fields list", async () => {
    const res = await call({ templateId: "pt", values: [], fields: PT_FIELDS });
    expect(res.status).toBe(200);
  });
});

import { auth as fillAuth } from "@/auth";

describe("/api/fill auth", () => {
  it("401s without a session", async () => {
    (fillAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(new Request("http://t/api/fill", { method: "POST", body: JSON.stringify({ templateId: "pt", values: [] }) }));
    expect(res.status).toBe(401);
  });
});

import { getTemplate } from "@/lib/db/templates";
import { zipSync as zipC, strToU8 as s2u } from "fflate";

const mockGetTemplate = getTemplate as unknown as ReturnType<typeof vi.fn>;
const customXlsx = () => zipC({
  "xl/workbook.xml": s2u(`<workbook><sheets><sheet name="Форма" sheetId="1" r:id="rId1"/></sheets></workbook>`),
  "xl/_rels/workbook.xml.rels": s2u(`<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`),
  "xl/worksheets/sheet1.xml": s2u(`<worksheet><sheetData/></worksheet>`),
});
const TPL_ROW = {
  id: "tpl-abc", code: "TPL-ABC", nameRu: "Моя форма", nameEn: "My form",
  descRu: "", descEn: "", format: "xlsx", fileKey: "https://abc.public.blob.vercel-storage.com/t.xlsx",
  sheets: ["Форма"], userId: "t@t.ru", deletedAt: null, defaultFields: null,
};
const CUSTOM_FIELD = { id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier", cell: "Форма!B2", kind: "string", required: false, strategy: "llm" };
const customBody = (over: Record<string, unknown> = {}) => ({
  templateId: "tpl-abc",
  values: [{ fieldId: "f1", value: "ООО Тест", confidence: "high" }],
  fields: [CUSTOM_FIELD],
  ...over,
});
const postFill = (b: unknown) =>
  new Request("http://t/api/fill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/fill — custom template", () => {
  beforeEach(() => {
    mockGetTemplate.mockResolvedValue(TPL_ROW);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => customXlsx().buffer }) as unknown as Response));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fills the blob-stored template", async () => {
    const res = await POST(postFill(customBody()));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
  });
  it("400 when the template belongs to someone else", async () => {
    mockGetTemplate.mockResolvedValueOnce({ ...TPL_ROW, userId: "other@x.ru" });
    expect((await POST(postFill(customBody()))).status).toBe(400);
  });
  it("400 when the template is soft-deleted", async () => {
    mockGetTemplate.mockResolvedValueOnce({ ...TPL_ROW, deletedAt: new Date() });
    expect((await POST(postFill(customBody()))).status).toBe(400);
  });
  it("400 without a field list", async () => {
    expect((await POST(postFill(customBody({ fields: undefined })))).status).toBe(400);
  });
});
