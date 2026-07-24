import { describe, it, expect } from "vitest";
import { isOwnBlobUrl } from "./avatar";

describe("isOwnBlobUrl", () => {
  it("accepts a public Vercel Blob https URL", () => {
    expect(isOwnBlobUrl("https://abc123.public.blob.vercel-storage.com/avatar-xyz.png")).toBe(true);
  });
  it("rejects http (non-TLS)", () => {
    expect(isOwnBlobUrl("http://abc.public.blob.vercel-storage.com/x.png")).toBe(false);
  });
  it("rejects a foreign or look-alike host", () => {
    expect(isOwnBlobUrl("https://evil.example.com/x.png")).toBe(false);
    expect(isOwnBlobUrl("https://public.blob.vercel-storage.com.evil.com/x.png")).toBe(false);
  });
  it("rejects garbage", () => {
    expect(isOwnBlobUrl("not a url")).toBe(false);
    expect(isOwnBlobUrl("")).toBe(false);
  });
  // The helper is the allowlist behind the /api/parse SSRF guard, so the shapes
  // that try to look like the store from the outside belong here.
  it("rejects an authority that only looks like the store", () => {
    // Credentials segment: the real host is what follows the "@".
    expect(isOwnBlobUrl("https://store123.public.blob.vercel-storage.com@evil.example.com/x.pdf")).toBe(false);
    // Registrable domain that spells the store with dashes.
    expect(isOwnBlobUrl("https://public-blob-vercel-storage.com/x.pdf")).toBe(false);
    // No subdomain: the bare apex is not a store host.
    expect(isOwnBlobUrl("https://public.blob.vercel-storage.com/x.pdf")).toBe(false);
  });
  it("rejects IP-literal hosts, including the metadata endpoint", () => {
    expect(isOwnBlobUrl("https://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isOwnBlobUrl("https://10.0.0.5/x.pdf")).toBe(false);
    expect(isOwnBlobUrl("https://[::1]/x.pdf")).toBe(false);
  });
});
