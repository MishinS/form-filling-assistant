import { describe, it, expect, vi, afterEach } from "vitest";
import { openrouterModel } from "./openrouter";
import { ModelNotConfigured } from "./types";
import { PT_FIELDS } from "../fields";

const MODEL = "moonshotai/kimi-k2.6:free";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("openrouterModel", () => {
  it("throws ModelNotConfigured without an API key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(openrouterModel(MODEL).extract(PT_FIELDS, "текст"))
      .rejects.toBeInstanceOf(ModelNotConfigured);
  });

  it("parses the JSON message content into LlmFieldResult[]", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const payload = { fields: [{ fieldId: "f1", value: 'ООО «Ромашка»', confidence: "high" }] };
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }))) as unknown as typeof fetch;

    const out = await openrouterModel(MODEL).extract(PT_FIELDS, "текст");
    expect(out).toEqual(payload.fields);
  });

  it("throws on a non-OK HTTP response", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    global.fetch = vi.fn(async () => new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    await expect(openrouterModel(MODEL).extract(PT_FIELDS, "текст")).rejects.toThrow("OpenRouter HTTP 429");
  });
});
