import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toDTO } from "./user-models";

beforeEach(() => vi.stubEnv("BYOK_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

describe("toDTO", () => {
  it("masks the plaintext key and drops the cipher", () => {
    const row = {
      id: "u1", email: "a@b.co", label: "My GPT", provider: "openai",
      baseUrl: "https://api.openai.com/v1", modelSlug: "gpt-4o",
      keyCipher: "ignored", createdAt: new Date(), updatedAt: new Date(), lastOkAt: null,
    };
    const dto = toDTO(row, "sk-test-abcdef1234");
    expect(dto).toEqual({
      id: "u1", label: "My GPT", provider: "openai", modelSlug: "gpt-4o",
      maskedKey: "sk" + "•".repeat("sk-test-abcdef1234".length - 6) + "1234", lastOkAt: null,
    });
    expect(JSON.stringify(dto)).not.toContain("ignored");
  });
});
