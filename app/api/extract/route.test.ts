import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "t@t.ru" } })) }));
vi.mock("@/lib/extract/extract", () => ({
  extractFields: vi.fn(async (_docs: unknown, _model: unknown, _fields: unknown, onAttempt?: (e: unknown) => void) => {
    onAttempt?.({ phase: "start", model: "m", index: 1, total: 1 });
    return {
      values: [{ fieldId: "f3", value: "Счёт №8 от 02.06.2026", confidence: "high", source: { fileId: "u1", locator: "стр. 1" } }],
      warnings: [],
      llmFailed: false,
      usedModel: "m",
    };
  }),
}));

import { POST } from "./route";
import { auth } from "@/auth";
import { PT_FIELDS } from "@/lib/extract/fields";
import { DEFAULT_MODEL } from "@/lib/extract/llm/catalog";

function req(body: unknown) {
  return new Request("http://t/api/extract", { method: "POST", body: JSON.stringify(body) });
}

async function ndjson(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

describe("POST /api/extract", () => {
  it("streams attempt + result events for a valid request", async () => {
    const res = await POST(req({ templateId: "pt", model: "gemini-2.0-flash", docs: [] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await ndjson(res);
    expect(events.some(e => e.type === "attempt")).toBe(true);
    const result = events.find(e => e.type === "result")!;
    expect(result).toBeDefined();
    expect((result.values as { fieldId: string }[])[0].fieldId).toBe("f3");
    expect(result.llmFailed).toBe(false);
    expect(events[events.length - 1].type).toBe("result");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ model: 123, docs: "nope" }));
    expect(res.status).toBe(400);
  });

  it("401s without a session", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(req({ model: "m", docs: [] }));
    expect(res.status).toBe(401);
  });

  it("гость: форсит DEFAULT_MODEL + PT_FIELDS + freeOnly, игнорируя тело", async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: { role: "guest" } });
    const { extractFields } = await import("@/lib/extract/extract");
    (extractFields as unknown as { mockClear: () => void }).mockClear();
    const customField = { ...PT_FIELDS[0], id: "z" };
    const res = await POST(req({ templateId: "custom", model: "openai/gpt-4.1-nano", docs: [], fields: [customField] }));
    await ndjson(res);
    const call = (extractFields as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[1]).toBe(DEFAULT_MODEL);
    expect(call[2]).toBe(PT_FIELDS);
    expect(call[4]).toEqual({ freeOnly: true });
  });
});

describe("/api/extract field validation", () => {
  const call = (body: unknown) =>
    POST(new Request("http://t/api/extract", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));

  it("400s on a malformed fields list", async () => {
    const res = await call({ model: "m", docs: [], fields: [{ id: "f1", cell: "9D" }] });
    expect(res.status).toBe(400);
  });
  it("200s with a valid fields list (no docs → empty values)", async () => {
    const res = await call({ model: "m", docs: [], fields: PT_FIELDS });
    expect(res.status).toBe(200);
  });
  it("200s when fields is omitted (defaults to PT)", async () => {
    const res = await call({ model: "m", docs: [] });
    expect(res.status).toBe(200);
  });
});
