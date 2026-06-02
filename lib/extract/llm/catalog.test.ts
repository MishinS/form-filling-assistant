import { describe, it, expect } from "vitest";
import { FREE_MODELS, FREE_MODEL_IDS, DEFAULT_MODEL } from "./catalog";

describe("free-model catalog", () => {
  it("lists only namespaced :free OpenRouter slugs", () => {
    for (const m of FREE_MODELS) {
      expect(m.id).toContain("/");
      expect(m.id.endsWith(":free")).toBe(true);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.provider.length).toBeGreaterThan(0);
    }
  });

  it("derives ids and a default from the catalog", () => {
    expect(FREE_MODEL_IDS).toEqual(FREE_MODELS.map((m) => m.id));
    expect(DEFAULT_MODEL).toBe(FREE_MODELS[0].id);
  });

  it("has no duplicate ids", () => {
    expect(new Set(FREE_MODEL_IDS).size).toBe(FREE_MODEL_IDS.length);
  });
});
