import { describe,it,expect } from "vitest";
import { isBlockedIp,assertSafeBaseUrl,BadEndpointError } from "./providers";

describe("providers", () => {

  it("flags private / loopback / link-local / metadata IPs", () => {
    for (const ip of ["10.0.0.5", "192.168.1.1", "172.16.0.1", "127.0.0.1", "169.254.169.254", "::1", "::ffff:169.254.169.254", "::ffff:10.0.0.1", "fe80::1", "febf::1"]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("2606:4700::1111")).toBe(false);
  });

  it("rejects non-https URLs", async () => {
    await expect(assertSafeBaseUrl("http://api.example.com/v1")).rejects.toBeInstanceOf(BadEndpointError);
  });

  it("rejects a host that resolves to a private IP", async () => {
    const lookup = async () => [{ address: "10.1.2.3" }];
    await expect(assertSafeBaseUrl("https://evil.example.com/v1", lookup)).rejects.toBeInstanceOf(BadEndpointError);
  });
});
