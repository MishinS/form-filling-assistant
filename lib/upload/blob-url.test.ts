import { describe, it, expect, beforeEach, vi } from "vitest";
import { isOwnBlobUrl } from "./blob-url";

// The expected host is derived from the write credential, so every case needs a
// token. Store id "abc123" matches the fixture host the accept case already used.
beforeEach(() => vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_abc123_secretpart"));

describe("isOwnBlobUrl", () => {
  it("accepts a public Vercel Blob https URL on our store", () => {
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

  // Anyone can create a Vercel account and upload to their own store, so a
  // well-formed URL under a different store id is the attack this guard exists
  // to stop — the suffix check it replaced accepted every one of them.
  it("rejects another store on the same blob service", () => {
    expect(isOwnBlobUrl("https://other456.public.blob.vercel-storage.com/x.pdf")).toBe(false);
  });
  it("rejects a non-default port on our own store host", () => {
    expect(isOwnBlobUrl("https://abc123.public.blob.vercel-storage.com:8443/x.pdf")).toBe(false);
  });
  it("matches a mixed-case store id against the lower-case hostname", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_AbC123_secretpart");
    expect(isOwnBlobUrl("https://abc123.public.blob.vercel-storage.com/x.pdf")).toBe(true);
  });

  // Fail closed: without a usable credential nothing can be uploaded or deleted,
  // so no legitimate blob URL can exist — widening the allowlist instead would
  // restore the hole precisely when the deployment is most misconfigured.
  it("rejects everything when the write credential is absent", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect(isOwnBlobUrl("https://abc123.public.blob.vercel-storage.com/x.pdf")).toBe(false);
  });
  it("rejects everything when the write credential does not parse", () => {
    for (const token of [
      "not-a-token",
      "vercel_blob_rw_abc123",              // secret segment missing
      "vercel_blob_ro_abc123_secretpart",   // wrong prefix
      "vercel_blob_rw__secretpart",         // empty store id
      "vercel_blob_rw_abc.123_secretpart",  // illegal character in the store id
    ]) {
      vi.stubEnv("BLOB_READ_WRITE_TOKEN", token);
      expect(isOwnBlobUrl("https://abc123.public.blob.vercel-storage.com/x.pdf")).toBe(false);
    }
  });
});
