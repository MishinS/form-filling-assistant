import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { isTauri, detectLocalRuntime, getCachedRuntime, invokeLlmChat } from "./tauri";

describe("isTauri", () => {
  afterEach(() => { delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__; });
  it("is false in a plain environment", () => {
    expect(isTauri()).toBe(false);
  });
  it("is true when the Tauri internals marker is present", () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });
});

describe("detectLocalRuntime / getCachedRuntime", () => {
  beforeEach(() => { invokeMock.mockReset(); (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {}; });
  afterEach(() => { delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__; });

  it("returns and caches the runtime", async () => {
    const rt = { baseUrl: "http://127.0.0.1:11434/v1", kind: "ollama", models: [{ slug: "llama3.1:8b", name: "llama3.1:8b" }] };
    invokeMock.mockResolvedValueOnce(rt);
    expect(await detectLocalRuntime()).toEqual(rt);
    expect(getCachedRuntime()).toEqual(rt);
  });

  it("returns null when no runtime is found", async () => {
    invokeMock.mockResolvedValueOnce(null);
    expect(await detectLocalRuntime()).toBeNull();
  });
});

describe("invokeLlmChat", () => {
  beforeEach(() => { invokeMock.mockReset(); (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {}; });
  it("resolves the assistant text", async () => {
    invokeMock.mockResolvedValueOnce("hello");
    await expect(invokeLlmChat({ baseUrl: "x", model: "m", prompt: "p" })).resolves.toBe("hello");
  });
  it("rejects with the probe code as message", async () => {
    invokeMock.mockRejectedValueOnce("auth");
    await expect(invokeLlmChat({ baseUrl: "x", model: "m", prompt: "p" })).rejects.toThrowError("auth");
  });
});
