import { describe,it,expect,vi,beforeEach,afterEach } from "vitest";
import { proposeFields,coerceFields } from "./scan";
import type { AttemptEvent } from "@/lib/extract/llm/types";
import { PAID_LAST_RESORT } from "@/lib/extract/llm/catalog";

const SHEETS = [{ name: "Лист1", lines: ["A1: Поставщик", "B1: ___"] }];
const PROPOSAL = JSON.stringify({
  fields: [
    { label_ru: "Поставщик", label_en: "Supplier", cell: "Лист1!B1", kind: "string" },
    { label_ru: "Мусор", label_en: "Junk", cell: "Чужой!A1", kind: "string" }, // dropped: unknown sheet
  ],
});
const okResponse = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;

describe("proposeFields", () => {
  beforeEach(() => { vi.stubEnv("OPENROUTER_API_KEY", "test-key"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("maps a valid proposal (llm strategy, sequential ids), failure null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(PROPOSAL)));
    const { fields, failure } = await proposeFields(SHEETS);
    expect(failure).toBeNull();
    expect(fields).toEqual([
      { id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier", cell: "Лист1!B1", kind: "string", required: false, strategy: "llm" },
    ]);
  });

  it("failure 'llm' (not 'nofields') when models answer with unparseable junk", async () => {
    // Junk content (weak router-routed model) must NOT masquerade as «не распознала поля» —
    // the honest verdict is pool failure → «модели заняты», retry makes sense.
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("not json at all")));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
  });

  it("failure 'nofields' when a model understood the schema but no field survives", async () => {
    // Valid {"fields":[…]} → the model did the task; every entry dropped (unknown sheet).
    const understood = JSON.stringify({ fields: [{ label_ru: "Мусор", cell: "Чужой!A1", kind: "string" }] });
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(understood)));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "nofields" });
  });

  it("falls back to the paid last-resort after the free pool fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === PAID_LAST_RESORT.id) return okResponse(PROPOSAL);
      return { ok: false, status: 429 } as Response;
    }));
    const events: AttemptEvent[] = [];
    const { fields, failure } = await proposeFields(SHEETS, (ev) => events.push(ev));
    expect(failure).toBeNull();
    expect(fields).toHaveLength(1);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts[starts.length - 1].model).toBe(PAID_LAST_RESORT.id);
  });
});

describe("coerceFields", () => {
  const sheets = ["Лист1"];

  it("drops fields with no label or bad cell ref", () => {
    const out = coerceFields(
      [{ cell: "B1" }, { label_ru: "X", cell: "not-a-ref" }],
      sheets,
    );
    expect(out).toEqual([]);
  });

  it("caps at MAX_FIELDS (40)", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ label_ru: `L${i}`, cell: `A${i + 1}` }));
    expect(coerceFields(many, sheets)).toHaveLength(40);
  });
});
