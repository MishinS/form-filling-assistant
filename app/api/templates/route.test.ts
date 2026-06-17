import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { zipSync, strToU8 } from "fflate";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/templates", () => ({ createTemplate: vi.fn(async () => {}) }));
vi.mock("@/lib/db/mappings", () => ({ saveMapping: vi.fn(async () => {}) }));
vi.mock("@/lib/templates/scan", () => ({ proposeFields: vi.fn(async () => ({ fields: [], failure: "llm" })) }));

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

/** Drain the NDJSON response into parsed event objects. */
const events = async (res: Response) =>
  (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
const terminal = (evs: Record<string, unknown>[]) => evs[evs.length - 1];

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } });
  mockPropose.mockResolvedValue({ fields: [], failure: "llm" });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => xlsxBytes().buffer }) as unknown as Response));
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/templates", () => {
  it("streams stages → result; creates template + initial mapping", async () => {
    mockPropose.mockResolvedValueOnce({ fields: [FIELD], failure: null });
    const res = await POST(post({ name: "Моя форма", desc: "тест", url: OK_URL }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const evs = await events(res);
    expect(evs.map(e => e.type)).toEqual(["stage", "stage", "result"]);
    expect(evs[0]).toEqual({ type: "stage", stage: "sheets" });
    expect(evs[1]).toEqual({ type: "stage", stage: "save" });
    const last = terminal(evs) as { type: string; id: string; fields: number };
    expect(last.id).toMatch(/^tpl-/);
    expect(last.fields).toBe(1);
    expect(createTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: "Моя форма", desc: "тест", fileKey: OK_URL, sheets: ["Лист1"], userId: "u@x.ru", defaultFields: [FIELD],
    }));
    expect(saveMapping).toHaveBeenCalledWith("u@x.ru", last.id, [FIELD]);
  });

  it("forwards attempt/fail/win events from the scan race", async () => {
    mockPropose.mockImplementationOnce(async (_sheets: unknown, onAttempt?: (ev: Record<string, unknown>) => void) => {
      onAttempt?.({ phase: "start", model: "m1", total: 5 });
      onAttempt?.({ phase: "fail", model: "m1", reason: "HTTP 429" });
      onAttempt?.({ phase: "start", model: "m2", total: 5 });
      onAttempt?.({ phase: "win", model: "m2" });
      return { fields: [FIELD], failure: null };
    });
    const evs = await events(await POST(post({ name: "Ф", url: OK_URL })));
    expect(evs).toContainEqual({ type: "attempt", model: "m1", total: 5 });
    expect(evs).toContainEqual({ type: "attempt-fail", model: "m1", reason: "HTTP 429" });
    expect(evs).toContainEqual({ type: "attempt-win", model: "m2" });
  });

  it("empty scan (llm) → terminal error, template NOT created", async () => {
    mockPropose.mockResolvedValueOnce({ fields: [], failure: "llm" });
    const evs = await events(await POST(post({ name: "Ф", url: OK_URL })));
    expect(terminal(evs)).toEqual({ type: "error", code: "llm" });
    expect(createTemplate).not.toHaveBeenCalled();
    expect(saveMapping).not.toHaveBeenCalled();
  });

  it("empty scan (nofields) → terminal error code nofields", async () => {
    mockPropose.mockResolvedValueOnce({ fields: [], failure: "nofields" });
    const evs = await events(await POST(post({ name: "Ф", url: OK_URL })));
    expect(terminal(evs)).toEqual({ type: "error", code: "nofields" });
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("non-XLSX blob → terminal error code xlsx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => strToU8("garbage").buffer }) as unknown as Response));
    const evs = await events(await POST(post({ name: "Ф", url: OK_URL })));
    expect(terminal(evs)).toEqual({ type: "error", code: "xlsx" });
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("blob fetch failure → terminal error code file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as unknown as Response));
    const evs = await events(await POST(post({ name: "Ф", url: OK_URL })));
    expect(terminal(evs)).toEqual({ type: "error", code: "file" });
  });

  it("DB failure → terminal error code server", async () => {
    mockPropose.mockResolvedValueOnce({ fields: [FIELD], failure: null });
    (createTemplate as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
    const evs = await events(await POST(post({ name: "Ф", url: OK_URL })));
    expect(terminal(evs)).toEqual({ type: "error", code: "server" });
  });

  it("saveMapping failure is recoverable → still result (retry must not mint a duplicate)", async () => {
    mockPropose.mockResolvedValueOnce({ fields: [FIELD], failure: null });
    (saveMapping as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("cold start"));
    const evs = await events(await POST(post({ name: "Ф", url: OK_URL })));
    expect((terminal(evs) as { type: string }).type).toBe("result");
    expect(createTemplate).toHaveBeenCalledTimes(1);
  });

  it("400 on empty name (plain JSON before the stream)", async () => {
    const res = await POST(post({ name: "  ", url: OK_URL }));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("400 on a foreign blob url", async () => {
    expect((await POST(post({ name: "Ф", url: "https://evil.example.com/x.xlsx" }))).status).toBe(400);
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it("401 without a session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    expect((await POST(post({ name: "Ф", url: OK_URL }))).status).toBe(401);
  });
});
