import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("node:dns/promises", async () => {
  const real = await vi.importActual<typeof import("node:dns/promises")>("node:dns/promises");
  return {
    ...real,
    lookup: vi.fn((host: string) => {
      if (host === "api.example.com") return Promise.resolve([{ address: "1.1.1.1" }]);
      return (real.lookup as (h: string, o: { all: true }) => Promise<unknown>)(host, { all: true });
    }),
  };
});

import { probeModel } from "./probe";

const cfg = { baseUrl: "https://api.example.com/v1", apiKey: "sk-test", modelSlug: "gpt-x" };
afterEach(() => vi.restoreAllMocks());

describe("probeModel", () => {
  it("returns ok on a 200 chat response", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }))) as unknown as typeof fetch;
    expect(await probeModel(cfg)).toEqual({ ok: true });
  });

  it("returns code=auth on 401", async () => {
    global.fetch = vi.fn(async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    expect(await probeModel(cfg)).toEqual({ ok: false, code: "auth" });
  });

  it("returns code=model_not_found on 404", async () => {
    global.fetch = vi.fn(async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    expect(await probeModel(cfg)).toEqual({ ok: false, code: "model_not_found" });
  });

  it("returns code=bad_endpoint for a blocked base URL (no fetch)", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    expect(await probeModel({ ...cfg, baseUrl: "http://localhost/v1" })).toEqual({ ok: false, code: "bad_endpoint" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
