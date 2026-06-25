import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encryptSecret, decryptSecret, maskKey } from "./secrets";

const KEY_B64 = Buffer.alloc(32, 7).toString("base64"); // deterministic 32-byte key

beforeEach(() => vi.stubEnv("BYOK_ENCRYPTION_KEY", KEY_B64));
afterEach(() => vi.unstubAllEnvs());

describe("secrets", () => {
  it("round-trips encrypt → decrypt", () => {
    const plain = "sk-or-v1-abcdef0123456789";
    const blob = encryptSecret(plain);
    expect(blob).not.toContain(plain);
    expect(decryptSecret(blob)).toBe(plain);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered blob", () => {
    const blob = encryptSecret("hello");
    const bytes = Buffer.from(blob, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a ciphertext byte → GCM tag fails
    expect(() => decryptSecret(bytes.toString("base64"))).toThrow();
  });

  it("throws when the master key is missing", () => {
    vi.stubEnv("BYOK_ENCRYPTION_KEY", "");
    expect(() => encryptSecret("x")).toThrow(/BYOK_ENCRYPTION_KEY/);
  });

  it("masks first 2 + last 4, rest stars", () => {
    expect(maskKey("sk-or-v1-abcdab12")).toBe("sk" + "•".repeat(11) + "ab12");
  });

  it("fully masks short keys (≤ 6 chars)", () => {
    expect(maskKey("abc123")).toBe("••••••");
    expect(maskKey("")).toBe("");
  });
});
