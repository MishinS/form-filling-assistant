import { describe,it,expect } from "vitest";
import { FREE_MODEL_IDS,isFreeSlug,PAID_LAST_RESORT } from "./catalog";

describe("free-model catalog", () => {

  it("isFreeSlug accepts :free slugs and the auto-router, rejects paid slugs", () => {
    expect(isFreeSlug("openai/gpt-oss-120b:free")).toBe(true);
    expect(isFreeSlug("openrouter/free")).toBe(true);
    expect(isFreeSlug("openai/gpt-4o")).toBe(false);
  });
});

describe("paid last-resort", () => {

  it("is NOT part of the free chain (free-каталог semantics intact)", () => {
    expect(FREE_MODEL_IDS).not.toContain(PAID_LAST_RESORT.id);
    expect(isFreeSlug(PAID_LAST_RESORT.id)).toBe(false);
  });
});
