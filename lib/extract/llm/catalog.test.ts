import { describe, it, expect } from "vitest";
import { FREE_MODELS, FREE_MODEL_IDS, DEFAULT_MODEL, isFreeSlug } from "./catalog";

describe("free-model catalog", () => {
  it("lists only namespaced free OpenRouter slugs", () => {
    for (const m of FREE_MODELS) {
      expect(m.id).toContain("/");
      expect(isFreeSlug(m.id)).toBe(true);
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

  it("ends with the openrouter/free auto-router as the last-resort entry", () => {
    expect(FREE_MODEL_IDS[FREE_MODEL_IDS.length - 1]).toBe("openrouter/free");
    expect(DEFAULT_MODEL).not.toBe("openrouter/free");
  });

  it("isFreeSlug accepts :free slugs and the auto-router, rejects paid slugs", () => {
    expect(isFreeSlug("openai/gpt-oss-120b:free")).toBe(true);
    expect(isFreeSlug("openrouter/free")).toBe(true);
    expect(isFreeSlug("openai/gpt-4o")).toBe(false);
  });
});
