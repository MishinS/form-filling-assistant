import { describe,it,expect,vi,afterEach } from "vitest";
import { geminiModel } from "./gemini";
import { PT_FIELDS } from "../fields";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("geminiModel", () => {

  it("parses the JSON candidate into LlmFieldResult[]", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const payload = { fields: [{ fieldId: "f1", value: 'ООО «Ромашка»', confidence: "high" }] };
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }))) as unknown as typeof fetch;

    const out = await geminiModel("gemini-2.0-flash").extract(PT_FIELDS, "текст");
    expect(out).toEqual(payload.fields);
  });

  // A key in the query string leaks into proxy, CDN, and server access logs;
  // Google documents a header for exactly this reason.
  it("sends the API key as a header, never in the URL", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"fields":[]}' }] } }],
    })));
    global.fetch = fetchMock as unknown as typeof fetch;

    await geminiModel("gemini-2.0-flash").extract(PT_FIELDS, "текст");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("key=");
    expect(url).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });
});
