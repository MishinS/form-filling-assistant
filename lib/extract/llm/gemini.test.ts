import { describe, it, expect, vi, afterEach } from "vitest";
import { geminiModel } from "./gemini";
import { ModelNotConfigured } from "./types";
import { PT_FIELDS } from "../fields";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("geminiModel", () => {
  it("throws ModelNotConfigured without an API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(geminiModel("gemini-2.0-flash").extract(PT_FIELDS, "текст"))
      .rejects.toBeInstanceOf(ModelNotConfigured);
  });

  it("parses the JSON candidate into LlmFieldResult[]", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const payload = { fields: [{ fieldId: "f1", value: 'ООО «Ромашка»', confidence: "high" }] };
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }))) as unknown as typeof fetch;

    const out = await geminiModel("gemini-2.0-flash").extract(PT_FIELDS, "текст");
    expect(out).toEqual(payload.fields);
  });
});
