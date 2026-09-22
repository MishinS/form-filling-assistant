import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "t@t.ru" } })) }));
vi.mock("@/lib/db/templates", () => ({ getTemplate: vi.fn() }));
vi.mock("@/lib/db/mappings", () => ({ getTemplateLayers: vi.fn(async () => null) }));
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

describe("/api/fill guest access", () => {
  it("гость + не-ПТ шаблон → 403", async () => {
    (fillAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { role: "guest" } });
    const res = await POST(new Request("http://t/api/fill", { method: "POST",
      body: JSON.stringify({ templateId: "custom", values: [] }) }));
    expect(res.status).toBe(403);
  });
  it("гость + ПТ → отдаёт xlsx (без email)", async () => {
    (fillAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { role: "guest" } });
    const res = await POST(new Request("http://t/api/fill", { method: "POST",
      body: JSON.stringify({ templateId: "pt", values: [{ fieldId: "f1", value: "ООО Тест" }] }) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheet");
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

describe("/api/fill with an HTML template", () => {
  const call = (body: unknown) =>
    POST(new Request("http://t/api/fill", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));

  it("returns the rendered document as JSON, not a download", async () => {
    const res = await call({ templateId: "ed", values: [ev("e2", "Стоматологическая мебель")] });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toBeNull();
    const body = (await res.json()) as { html: string };
    expect(body.html).toContain("Паспорт Заказа и договора");
    expect(body.html).toContain("Стоматологическая мебель");
    expect(body.html).not.toContain("<!--slot:");
  });

  it("writes the mandated constant without being asked", async () => {
    const res = await call({ templateId: "ed", values: [] });
    const body = (await res.json()) as { html: string };
    expect(body.html).toContain("Мишин С. С.");
  });

  it("escapes a hostile value from a supplier document", async () => {
    const res = await call({ templateId: "ed", values: [ev("e2", '<img src=x onerror="steal()">')] });
    const body = (await res.json()) as { html: string };
    expect(body.html).not.toContain("onerror=\"");
    expect(body.html).toContain("&lt;img");
  });

  it("400s on a choice value outside its list", async () => {
    const res = await call({ templateId: "ed", values: [ev("e11", "Иванов")] });
    expect(res.status).toBe(400);
  });

  it("accepts a choice value from its list", async () => {
    const res = await call({ templateId: "ed", values: [ev("e11", "Вознесенская")] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { html: string };
    expect(body.html).toContain("Вознесенская");
  });

  it("ignores a field list sent by the client — the catalog comes from the repo", async () => {
    const hostile = [{
      id: "e2", group: "order", label_ru: "Предмет", label_en: "Subject", kind: "text",
      required: true, strategy: "llm", cell: "subject", slotMode: "paragraphs",
      paragraphHtml: '<p onclick="steal()">{}</p>',
    }];
    const res = await call({ templateId: "ed", values: [ev("e2", "мебель")], fields: hostile });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { html: string };
    expect(body.html).not.toContain("onclick");
  });
});

describe("/api/fill rejects a malformed value list", () => {
  const call = (body: unknown) =>
    POST(new Request("http://t/api/fill", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));

  it("400s on a non-string value instead of 500ing on trim()", async () => {
    const res = await call({ templateId: "ed", values: [{ fieldId: "e2", value: 5 }] });
    expect(res.status).toBe(400);
  });

  it("400s on a null entry", async () => {
    const res = await call({ templateId: "ed", values: [null] });
    expect(res.status).toBe(400);
  });

  it("400s on a malformed value list for the workbook template too", async () => {
    const res = await call({ templateId: "pt", values: [{ fieldId: "f1" }] });
    expect(res.status).toBe(400);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { auth } from "@/auth";
import { getTemplateLayers } from "@/lib/db/mappings";
import { ED_FIELDS } from "@/lib/render/ed";

describe("/api/fill renders the user's own order passport", () => {
  const skeleton = readFileSync(path.join(process.cwd(), "lib/render/templates/ed.html"), "utf8");
  const mockLayers = vi.mocked(getTemplateLayers);
  const html = async (res: Response) => ((await res.json()) as { html: string }).html;

  it("a renamed section in the saved skeleton appears in the document", async () => {
    mockLayers.mockResolvedValueOnce({ fields: null, instruction: null,
      skeleton: skeleton.replace("Штрафы, пени по договору", "Неустойка") });
    const res = await post({ templateId: "ed", values: [] });
    expect(res.status).toBe(200);
    const out = await html(res);
    expect(out).toContain("Неустойка");
    expect(out).not.toContain("Штрафы, пени по договору");
  });

  it("a fourth ЦФО option the user added is accepted", async () => {
    const fields = ED_FIELDS.map((f) => f.id === "e11"
      ? { ...f, options: [...f.options!, { value: "Иванов", label_ru: "ИТ", label_en: "IT" }] } : f);
    mockLayers.mockResolvedValueOnce({ fields, instruction: null, skeleton: null });
    const res = await post({ templateId: "ed", values: [ev("e11", "Иванов")] });
    expect(res.status).toBe(200);
    expect(await html(res)).toContain("Иванов");
  });

  it("fields and markup in the request body have no effect", async () => {
    const hostile = ED_FIELDS.map((f) => ({ ...f, paragraphHtml: "<script>x</script>{}", slotMode: "paragraphs" }));
    const res = await post({ templateId: "ed", values: [ev("e2", "мебель")], fields: hostile, skeleton: "<script>x</script>" });
    expect(res.status).toBe(200);
    expect(await html(res)).not.toContain("<script>");
  });

  it("a stored version that no longer validates → 422 with a message pointing at the reset", async () => {
    mockLayers.mockResolvedValueOnce({ fields: null, instruction: null, skeleton: skeleton + '<p id="x">a</p>' });
    const res = await post({ templateId: "ed", values: [] });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/по умолчанию/);
  });

  it("a guest renders the repository skeleton without a DB lookup", async () => {
    mockLayers.mockClear();
    vi.mocked(auth).mockResolvedValueOnce({ user: { role: "guest" } } as never);
    const res = await post({ templateId: "ed", values: [] });
    expect(res.status).toBe(200);
    expect(mockLayers).not.toHaveBeenCalled();
    expect(await html(res)).toContain("Штрафы, пени по договору");
  });
});
