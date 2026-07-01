import { describe, it, expect, afterEach, vi } from "vitest";
import { openaiCompatModel, classifyStatus, LlmRequestError, parseFieldsLenient } from "./openai-compat";
import { PT_FIELDS } from "../fields";

const cfg = { baseUrl: "https://api.example.com/v1", apiKey: "sk-test", modelSlug: "gpt-x" };
const okBody = (fields: unknown[]) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ fields }) } }] }));

afterEach(() => vi.restoreAllMocks());

describe("openaiCompatModel", () => {
  it("returns parsed fields on success", async () => {
    const payload = [{ fieldId: "f1", value: "ООО «Ромашка»", confidence: "high" }];
    global.fetch = vi.fn(async () => okBody(payload)) as unknown as typeof fetch;
    const out = await openaiCompatModel(cfg).extract(PT_FIELDS, "текст");
    expect(out).toEqual(payload);
  });

  it("posts to <baseUrl>/chat/completions with the model and bearer key", async () => {
    const spy = vi.fn(async () => okBody([]));
    global.fetch = spy as unknown as typeof fetch;
    await openaiCompatModel(cfg).extract(PT_FIELDS, "текст");
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(init.body as string).model).toBe("gpt-x");
  });

  it("classifies HTTP statuses", () => {
    expect(classifyStatus(401)).toBe("auth");
    expect(classifyStatus(403)).toBe("auth");
    expect(classifyStatus(404)).toBe("model_not_found");
    expect(classifyStatus(429)).toBe("rate_limited");
    expect(classifyStatus(503)).toBe("provider_error");
  });

  it("throws a typed LlmRequestError on 401", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    await expect(openaiCompatModel(cfg).extract(PT_FIELDS, "текст"))
      .rejects.toMatchObject({ code: "auth" });
  });

  it("throws bad_response on non-JSON model output", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }))) as unknown as typeof fetch;
    await expect(openaiCompatModel(cfg).extract(PT_FIELDS, "текст"))
      .rejects.toMatchObject({ code: "bad_response" });
    expect(LlmRequestError).toBeDefined();
  });

  it("throws unreachable on network failure", async () => {
    global.fetch = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(openaiCompatModel(cfg).extract(PT_FIELDS, "текст"))
      .rejects.toMatchObject({ code: "unreachable" });
  });

  it("applies default timeout when no signal is provided", async () => {
    const spy = vi.fn(async () => okBody([]));
    global.fetch = spy as unknown as typeof fetch;
    await openaiCompatModel(cfg).extract(PT_FIELDS, "текст");
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    // The signal should exist and not throw a TypeError
    expect(init.signal).toBeDefined();
  });

  it("uses caller-provided signal unchanged", async () => {
    const customSignal = AbortSignal.timeout(5000);
    const spy = vi.fn(async () => okBody([]));
    global.fetch = spy as unknown as typeof fetch;
    // Call chatComplete directly with the custom signal
    const { chatComplete } = await import("./openai-compat");
    await chatComplete(cfg, "test prompt", customSignal);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    // Verify the caller's signal is used
    expect(init.signal).toBe(customSignal);
  });

  it("handles trailing slash in baseUrl", async () => {
    const cfgWithTrailingSlash = { ...cfg, baseUrl: "https://api.example.com/v1/" };
    const spy = vi.fn(async () => okBody([]));
    global.fetch = spy as unknown as typeof fetch;
    await openaiCompatModel(cfgWithTrailingSlash).extract(PT_FIELDS, "текст");
    const [url] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
  });
});

describe("parseFieldsLenient (local-model recovery)", () => {
  it("parses valid JSON like the strict parser", () => {
    const txt = JSON.stringify({ fields: [{ fieldId: "f1", value: "x", confidence: "high" }] });
    expect(parseFieldsLenient(txt)).toEqual([{ fieldId: "f1", value: "x", confidence: "high" }]);
  });

  it("strips a ```json fence before parsing", () => {
    const txt = "```json\n" + JSON.stringify({ fields: [{ fieldId: "f1", value: "x", confidence: "low" }] }) + "\n```";
    expect(parseFieldsLenient(txt).map((f) => f.fieldId)).toEqual(["f1"]);
  });

  // Verbatim malformed output from an LM Studio qwen2.5-3b run: a `{` dropped before f9.
  it("recovers all fields when the model drops a brace between objects", () => {
    const txt = '{"fields":[{"fieldId":"f1","value":""},{"fieldId":"f2","value":"АО Семейный доктор","confidence":"high"},{"fieldId":"f8","value":"НД"},"fieldId":"f9","value":"100% предоплаты","confidence":"high"},{"fieldId":"f10","value":"","confidence":"low"},{"fieldId":"f11","value":""}]}';
    const out = parseFieldsLenient(txt);
    expect(out.map((f) => f.fieldId)).toEqual(["f1", "f2", "f8", "f9", "f10", "f11"]);
    expect(out.find((f) => f.fieldId === "f9")?.value).toBe("100% предоплаты");
    expect(out.find((f) => f.fieldId === "f2")?.value).toBe("АО Семейный доктор");
    expect(out.find((f) => f.fieldId === "f11")?.confidence).toBe("low"); // defaulted
  });

  // Verbatim malformed output: a stray `"{` before f9's fieldId.
  it("recovers all fields when the model emits a stray quote-brace", () => {
    const txt = '{"fields":[{"fieldId":"f1","value":""},{"fieldId":"f2","value":"АО Семейный доктор","confidence":"high"},{"fieldId":"f8","value":"НД"},"{fieldId":"f9","value":"","confidence":"low"},{"fieldId":"f10","value":"","confidence":"low"},{"fieldId":"f11","value":"","confidence":"low"}]}';
    expect(parseFieldsLenient(txt).map((f) => f.fieldId)).toEqual(["f1", "f2", "f8", "f9", "f10", "f11"]);
  });

  it("returns [] when no field markers are present (genuine garbage)", () => {
    expect(parseFieldsLenient("the model refused to answer")).toEqual([]);
  });
});
