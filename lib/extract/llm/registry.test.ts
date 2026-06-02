import { describe, it, expect } from "vitest";
import { getModel } from "./registry";
import { ModelNotConfigured } from "./types";

describe("getModel", () => {
  it("returns a Gemini adapter for gemini-* ids", () => {
    expect(getModel("gemini-2.0-flash").id).toBe("gemini-2.0-flash");
  });
  it("throws ModelNotConfigured for unwired providers", () => {
    expect(() => getModel("llama-3.3-70b")).toThrow(ModelNotConfigured);
  });
});
