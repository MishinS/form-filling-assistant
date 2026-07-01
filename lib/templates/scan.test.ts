import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { proposeFields, coerceFields, buildScanPrompt } from "./scan";
import type { AttemptEvent } from "@/lib/extract/llm/types";
import { FREE_MODEL_IDS, PAID_LAST_RESORT } from "@/lib/extract/llm/catalog";

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

  it("lenient: sheet-less cell → first sheet, `label` key fallback, unknown kind → string", async () => {
    const proposal = JSON.stringify({ fields: [{ label: "Сумма", cell: "B2", kind: "money" }] });
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(proposal)));
    const { fields, failure } = await proposeFields(SHEETS);
    expect(failure).toBeNull();
    expect(fields).toEqual([
      { id: "f1", group: "req", label_ru: "Сумма", label_en: "Сумма", cell: "Лист1!B2", kind: "string", required: false, strategy: "llm" },
    ]);
  });

  it("tolerates a ```json fence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("```json\n" + PROPOSAL + "\n```")));
    const { fields } = await proposeFields(SHEETS);
    expect(fields).toHaveLength(1);
  });

  it("skips empty sheets so a sheet-less cell qualifies to the first sheet WITH content", async () => {
    const sheets = [
      { name: "Лист1", lines: [] },                    // empty leading sheet (dropped)
      { name: "Форма", lines: ["A1: Поставщик"] },
    ];
    const proposal = JSON.stringify({ fields: [{ label_ru: "Поставщик", cell: "B1", kind: "string" }] });
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(proposal)));
    const { fields, failure } = await proposeFields(sheets);
    expect(failure).toBeNull();
    expect(fields[0].cell).toBe("Форма!B1"); // qualified to the content sheet, not empty «Лист1»
  });

  it("failure 'llm' without an API key (no fetch made)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("failure 'llm' when every model is rejected (HTTP errors)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 }) as Response));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
  });

  it("failure 'llm' (not 'nofields') when models answer with unparseable junk", async () => {
    // Junk content (weak router-routed model) must NOT masquerade as «не распознала поля» —
    // the honest verdict is pool failure → «модели заняты», retry makes sense.
    vi.stubGlobal("fetch", vi.fn(async () => okResponse("not json at all")));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
  });

  it("failure 'llm' when the answer is JSON but without a fields[] array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse('{"data":"что-то не то"}')));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "llm" });
  });

  it("failure 'nofields' when a model understood the schema but no field survives", async () => {
    // Valid {"fields":[…]} → the model did the task; every entry dropped (unknown sheet).
    const understood = JSON.stringify({ fields: [{ label_ru: "Мусор", cell: "Чужой!A1", kind: "string" }] });
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(understood)));
    expect(await proposeFields(SHEETS)).toEqual({ fields: [], failure: "nofields" });
  });

  it("emits a start for every free racer and a win", async () => {
    const events: AttemptEvent[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as { model: string };
      if (body.model === FREE_MODEL_IDS[0]) return { ok: false, status: 429 } as Response;
      return okResponse(PROPOSAL);
    }));
    const { fields } = await proposeFields(SHEETS, (ev) => events.push(ev));
    expect(fields).toHaveLength(1);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts).toHaveLength(FREE_MODEL_IDS.length);
    expect(starts.every((e) => e.total === FREE_MODEL_IDS.length)).toBe(true);
    expect(events.some((e) => e.phase === "fail" && e.reason === "HTTP 429")).toBe(true);
    expect(events.some((e) => e.phase === "win")).toBe(true);
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

  it("a hung model does not block the scan — a healthy racer wins immediately", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) => {
      call += 1;
      if (call === 1) return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
      return Promise.resolve(okResponse(PROPOSAL));
    }));
    const { fields, failure } = await proposeFields(SHEETS);
    expect(failure).toBeNull();
    expect(fields).toHaveLength(1);
  });
});

describe("coerceFields", () => {
  const sheets = ["Лист1"];

  it("coerces valid fields, qualifying sheet-less cell refs", () => {
    const out = coerceFields(
      [{ label_ru: "Поставщик", label_en: "Supplier", cell: "B1", kind: "string" }],
      sheets,
    );
    expect(out).toEqual([{
      id: "f1", group: "req", label_ru: "Поставщик", label_en: "Supplier",
      cell: "Лист1!B1", kind: "string", required: false, strategy: "llm",
    }]);
  });

  it("drops fields with no label or bad cell ref", () => {
    const out = coerceFields(
      [{ cell: "B1" }, { label_ru: "X", cell: "not-a-ref" }],
      sheets,
    );
    expect(out).toEqual([]);
  });

  it("falls back to label_ru for label_en and defaults unknown kind to string", () => {
    const out = coerceFields(
      [{ label_ru: "Сумма", cell: "Лист1!C2", kind: "weird" }],
      sheets,
    );
    expect(out[0]).toMatchObject({ label_en: "Сумма", kind: "string", cell: "Лист1!C2" });
  });

  it("caps at MAX_FIELDS (40)", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ label_ru: `L${i}`, cell: `A${i + 1}` }));
    expect(coerceFields(many, sheets)).toHaveLength(40);
  });

  it("keeps labelled fields with a missing/invalid cell as unmapped (cell='') when keepUnmapped", () => {
    // A weak local model often returns field labels without cell refs; keep them so a
    // template is still created and the user assigns cells in the mapping editor.
    const out = coerceFields(
      [{ label_ru: "Контрагент" }, { label_ru: "Сумма", cell: "not-a-ref", kind: "amount" }],
      sheets,
      { keepUnmapped: true },
    );
    expect(out).toEqual([
      { id: "f1", group: "req", label_ru: "Контрагент", label_en: "Контрагент", cell: "", kind: "string", required: false, strategy: "llm" },
      { id: "f2", group: "req", label_ru: "Сумма", label_en: "Сумма", cell: "", kind: "amount", required: false, strategy: "llm" },
    ]);
  });

  it("still drops unlabelled items even with keepUnmapped", () => {
    expect(coerceFields([{ cell: "B1" }], sheets, { keepUnmapped: true })).toEqual([]);
  });

  it("normalises a valid cell even when keepUnmapped is set", () => {
    const out = coerceFields([{ label_ru: "X", cell: "B1" }], sheets, { keepUnmapped: true });
    expect(out[0].cell).toBe("Лист1!B1");
  });
});

describe("buildScanPrompt", () => {
  it("includes sheet names and the strict-JSON instruction", () => {
    const p = buildScanPrompt([{ name: "Лист1", lines: ["A1: Поставщик"] }]);
    expect(p).toContain('Лист "Лист1"');
    expect(p).toContain('{"fields":[');
  });
});
