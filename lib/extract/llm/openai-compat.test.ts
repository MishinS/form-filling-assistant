import { describe, it, expect, afterEach, vi } from "vitest";
import { openaiCompatModel, classifyStatus, LlmRequestError } from "./openai-compat";
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
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
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
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
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
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    // Verify the caller's signal is used
    expect(init.signal).toBe(customSignal);
  });

  it("handles trailing slash in baseUrl", async () => {
    const cfgWithTrailingSlash = { ...cfg, baseUrl: "https://api.example.com/v1/" };
    const spy = vi.fn(async () => okBody([]));
    global.fetch = spy as unknown as typeof fetch;
    await openaiCompatModel(cfgWithTrailingSlash).extract(PT_FIELDS, "текст");
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
  });
});
