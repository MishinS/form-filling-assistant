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
});
