import { describe, it, expect } from "vitest";
import { FREE_MODELS, FREE_MODEL_IDS, DEFAULT_MODEL, isFreeSlug, PAID_LAST_RESORT, isPaidModel, modelLabel } from "./catalog";

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

describe("paid last-resort", () => {
  it("defines the paid last-resort model with a non-empty name/provider", () => {
    expect(PAID_LAST_RESORT.id).toBe("openai/gpt-4.1-nano");
    expect(PAID_LAST_RESORT.name.length).toBeGreaterThan(0);
    expect(PAID_LAST_RESORT.provider.length).toBeGreaterThan(0);
  });

  it("is NOT part of the free chain (free-каталог semantics intact)", () => {
    expect(FREE_MODEL_IDS).not.toContain(PAID_LAST_RESORT.id);
    expect(isFreeSlug(PAID_LAST_RESORT.id)).toBe(false);
  });

  it("isPaidModel matches only the paid id", () => {
    expect(isPaidModel(PAID_LAST_RESORT.id)).toBe(true);
    expect(isPaidModel("openai/gpt-oss-120b:free")).toBe(false);
    expect(isPaidModel("openrouter/free")).toBe(false);
  });
});

describe("modelLabel", () => {
  it("resolves a free slug to its catalog name", () => {
    expect(modelLabel(FREE_MODELS[0].id)).toBe(FREE_MODELS[0].name);
  });
  it("resolves the paid last-resort slug to its name (marked платная)", () => {
    expect(modelLabel(PAID_LAST_RESORT.id)).toBe(PAID_LAST_RESORT.name);
    expect(modelLabel(PAID_LAST_RESORT.id)).toContain("платная");
  });
  it("falls back to the raw slug for an unknown model", () => {
    expect(modelLabel("acme/unknown-model")).toBe("acme/unknown-model");
  });
});
