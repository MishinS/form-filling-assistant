import { describe, it, expect } from "vitest";
import { resolveBaseUrl, isBlockedIp, assertSafeBaseUrl, BadEndpointError, PROVIDER_PRESETS } from "./providers";

describe("providers", () => {
  it("resolves preset base URLs", () => {
    expect(resolveBaseUrl("openrouter")).toBe(PROVIDER_PRESETS.openrouter.baseUrl);
    expect(resolveBaseUrl("openai")).toBe("https://api.openai.com/v1");
  });

  it("uses the custom URL for provider=custom", () => {
    expect(resolveBaseUrl("custom", "https://api.example.com/v1")).toBe("https://api.example.com/v1");
  });

  it("flags private / loopback / link-local / metadata IPs", () => {
    for (const ip of ["10.0.0.5", "192.168.1.1", "172.16.0.1", "127.0.0.1", "169.254.169.254", "::1"]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
    expect(isBlockedIp("1.1.1.1")).toBe(false);
  });

  it("rejects non-https URLs", async () => {
    await expect(assertSafeBaseUrl("http://api.example.com/v1")).rejects.toBeInstanceOf(BadEndpointError);
  });

  it("rejects a host that resolves to a private IP", async () => {
    const lookup = async () => [{ address: "10.1.2.3" }];
    await expect(assertSafeBaseUrl("https://evil.example.com/v1", lookup)).rejects.toBeInstanceOf(BadEndpointError);
  });

  it("allows a host that resolves to a public IP", async () => {
    const lookup = async () => [{ address: "1.1.1.1" }];
    await expect(assertSafeBaseUrl("https://api.example.com/v1", lookup)).resolves.toBeUndefined();
  });
});
