import { describe,it,expect,vi,beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/mappings", () => ({
  saveMapping: vi.fn(async () => {}), deleteMapping: vi.fn(async () => {}), getMapping: vi.fn(async () => null),
  getTemplateLayers: vi.fn(async () => null), saveTemplateLayers: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/templates")>();
  return { getTemplate: vi.fn(async () => null), isTemplateAccessible: actual.isTemplateAccessible };
});

import { POST,DELETE } from "./route";
import { auth } from "@/auth";
import { saveMapping,deleteMapping } from "@/lib/db/mappings";

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

  it("400s when fields fail validation (bad cell)", async () => {
    asAuthed();
    const res = await POST(body({ templateId: "pt", fields: [{ ...validField, cell: "9D" }] }));
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

  it("гость → 403 (not 401/200)", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { role: "guest" } });
    const res = await DELETE(delReq({ templateId: "pt" }));
    expect(res.status).toBe(403);
    expect(deleteMapping).not.toHaveBeenCalled();
  });
});

import { GET } from "./route";
import { getTemplate } from "@/lib/db/templates";

const mockGetTemplate2 = getTemplate as unknown as ReturnType<typeof vi.fn>;
const CUSTOM = { id: "tpl-abc", sheets: ["Форма"], userId: "me@x.ru", deletedAt: null,
  defaultFields: [{ id: "f1", group: "req", label_ru: "X", label_en: "X", cell: "Форма!B2", kind: "string", required: false, strategy: "llm" }],
  code: "T", nameRu: "n", nameEn: "n", descRu: "", descEn: "", format: "xlsx", fileKey: "k" };
const FOREIGN = { ...CUSTOM, id: "tpl-foreign", userId: "other@x.ru" };
const getReq = (tid: string) => new Request(`http://t/api/mappings?templateId=${encodeURIComponent(tid)}`);

describe("GET /api/mappings", () => {
  beforeEach(() => asAuthed());
  it("404s for a foreign custom template", async () => {
    mockGetTemplate2.mockResolvedValueOnce(FOREIGN);
    const res = await GET(getReq("tpl-foreign"));
    expect(res.status).toBe(404);
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
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { getTemplateLayers,saveTemplateLayers } from "@/lib/db/mappings";
import { ED_FIELDS,ED_INSTRUCTION } from "@/lib/render/ed";

const ED_SKELETON = readFileSync(path.join(process.cwd(), "lib/render/templates/ed.html"), "utf8");
const mockLayers = getTemplateLayers as unknown as ReturnType<typeof vi.fn>;
const mockSaveLayers = saveTemplateLayers as unknown as ReturnType<typeof vi.fn>;
const edSave = (b: Record<string, unknown>) => body({ templateId: "ed", fields: null, instruction: null, skeleton: null, ...b });

describe("GET /api/mappings — ed", () => {
  it("no saved row → the repository layers, nothing marked custom", async () => {
    asAuthed();
    const res = await GET(getReq("ed"));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.instruction).toBe(ED_INSTRUCTION);
    expect(j.skeleton).toBe(ED_SKELETON);
    expect(j.fields.map((f: { id: string }) => f.id)).toEqual(ED_FIELDS.map(f => f.id));
    expect(j.custom).toEqual({ fields: false, instruction: false, skeleton: false });
    expect(j.defaults.skeleton).toBe(ED_SKELETON);
    expect(mockLayers).toHaveBeenCalledWith("me@x.ru", "ed");
  });
});

describe("POST /api/mappings — ed", () => {
  it("stores a partial save verbatim, null layers staying null", async () => {
    asAuthed();
    const res = await POST(edSave({ instruction: "своя инструкция" }));
    expect(res.status).toBe(200);
    expect(mockSaveLayers).toHaveBeenCalledWith("me@x.ru", "ed", { fields: null, instruction: "своя инструкция", skeleton: null });
  });

  it("stores edited fields with a fourth ЦФО option and no body markup", async () => {
    asAuthed();
    const fields = ED_FIELDS.map(f => f.id === "e11"
      ? { ...f, options: [...f.options!, { value: "Иванов", label_ru: "ИТ", label_en: "IT" }] }
      : { ...f, paragraphHtml: "<p><script>x</script>{}</p>", listSeparator: "<b>|</b>" });
    const res = await POST(edSave({ fields }));
    expect(res.status).toBe(200);
    const saved = mockSaveLayers.mock.calls[0][2].fields as typeof ED_FIELDS;
    expect(saved.find(f => f.id === "e11")!.options).toHaveLength(4);
    expect(saved.every(f => f.paragraphHtml === undefined && f.listSeparator === undefined)).toBe(true);
  });

  it("a slot no field addresses → 400 naming it", async () => {
    asAuthed();
    const res = await POST(edSave({ skeleton: ED_SKELETON + "<p><!--slot:delivery--></p>" }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.code).toBe("unaddressed_slot");
    expect(j.name).toBe("delivery");
    expect(j.error).toMatch(/delivery/);
    expect(mockSaveLayers).not.toHaveBeenCalled();
  });

  it("an element the editor would drop → 400", async () => {
    asAuthed();
    const res = await POST(edSave({ skeleton: ED_SKELETON + "<script>x</script>" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("subset");
  });

  it("гость → 403", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { role: "guest" } });
    expect((await POST(edSave({ instruction: "x" }))).status).toBe(403);
    expect(mockSaveLayers).not.toHaveBeenCalled();
  });
});
