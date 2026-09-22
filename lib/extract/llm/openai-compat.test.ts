import { describe,it,expect,afterEach,vi } from "vitest";
import { openaiCompatModel,parseFieldsLenient } from "./openai-compat";
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

  it("throws a typed LlmRequestError on 401", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    await expect(openaiCompatModel(cfg).extract(PT_FIELDS, "текст"))
      .rejects.toMatchObject({ code: "auth" });
  });
});

describe("parseFieldsLenient (local-model recovery)", () => {

  // Verbatim malformed output from an LM Studio qwen2.5-3b run: a `{` dropped before f9.
  it("recovers all fields when the model drops a brace between objects", () => {
    const txt = '{"fields":[{"fieldId":"f1","value":""},{"fieldId":"f2","value":"АО Семейный доктор","confidence":"high"},{"fieldId":"f8","value":"НД"},"fieldId":"f9","value":"100% предоплаты","confidence":"high"},{"fieldId":"f10","value":"","confidence":"low"},{"fieldId":"f11","value":""}]}';
    const out = parseFieldsLenient(txt);
    expect(out.map((f) => f.fieldId)).toEqual(["f1", "f2", "f8", "f9", "f10", "f11"]);
    expect(out.find((f) => f.fieldId === "f9")?.value).toBe("100% предоплаты");
    expect(out.find((f) => f.fieldId === "f2")?.value).toBe("АО Семейный доктор");
    expect(out.find((f) => f.fieldId === "f11")?.confidence).toBe("low"); // defaulted
  });

  it("returns [] when no field markers are present (genuine garbage)", () => {
    expect(parseFieldsLenient("the model refused to answer")).toEqual([]);
  });
});
