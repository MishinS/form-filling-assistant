import { describe, it, expect } from "vitest";
import { getModel } from "./registry";
import { ModelNotConfigured } from "./types";

describe("getModel", () => {
  it("returns a Gemini adapter for gemini-* ids", () => {
    expect(getModel("gemini-2.0-flash").id).toBe("gemini-2.0-flash");
  });
  it("returns an OpenRouter adapter for namespaced slugs", () => {
    expect(getModel("moonshotai/kimi-k2.6:free").id).toBe("moonshotai/kimi-k2.6:free");
  });
  it("throws ModelNotConfigured for bare unwired ids", () => {
    expect(() => getModel("llama-3.3-70b")).toThrow(ModelNotConfigured);
  });
});
