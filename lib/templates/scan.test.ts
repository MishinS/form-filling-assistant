import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proposeFields } from "./scan";

const SHEETS = [{ name: "Лист1", lines: ["A1: Поставщик", "B1: ___"] }];
const PROPOSAL = JSON.stringify({
  fields: [
    { label_ru: "Поставщик", label_en: "Supplier", cell: "Лист1!B1", kind: "string" },
    { label_ru: "Мусор", label_en: "Junk", cell: "Чужой!A1", kind: "string" },     // dropped: unknown sheet
    { label_ru: "Мусор2", label_en: "Junk2", cell: "Лист1!C1", kind: "nope" },     // dropped: bad kind
  ],
});
const okResponse = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;

describe("proposeFields", () => {
  beforeEach(() => { vi.stubEnv("OPENROUTER_API_KEY", "test-key"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("maps a valid proposal to ExtractFields (llm strategy, sequential ids)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(PROPOSAL)));
    const out = await proposeFields(SHEETS);
    expect(out).toEqual([
      { id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier", cell: "Лист1!B1", kind: "string", required: false, strategy: "llm" },
    ]);
  });
  it("tolerates a ```json fence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("```json\n" + PROPOSAL + "\n```")));
    expect(await proposeFields(SHEETS)).toHaveLength(1);
  });
  it("returns [] without an API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(await proposeFields(SHEETS)).toEqual([]);
  });
  it("returns [] when every model fails or returns garbage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("not json at all")));
    expect(await proposeFields(SHEETS)).toEqual([]);
  });
});
