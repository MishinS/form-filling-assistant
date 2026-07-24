import { describe, it, expect, afterEach, vi } from "vitest";
import { persistAccent } from "./accent-persist";

afterEach(() => vi.restoreAllMocks());

describe("persistAccent", () => {
  it("returns true on an ok response and POSTs the accent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await persistAccent("teal")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/account/accent");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ accent: "teal" });
  });

  it("returns false on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await persistAccent("rose")).toBe(false);
  });

  it("returns false when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await persistAccent("plum")).toBe(false);
  });
});
