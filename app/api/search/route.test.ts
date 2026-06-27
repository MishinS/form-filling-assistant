import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/search", () => ({ searchAll: vi.fn() }));

import { GET } from "./route";
import { auth } from "@/auth";
import { searchAll } from "@/lib/db/search";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const searchMock = searchAll as unknown as ReturnType<typeof vi.fn>;
const req = (q: string) => new Request(`http://x/api/search?q=${encodeURIComponent(q)}`);

beforeEach(() => { authMock.mockReset(); searchMock.mockReset(); });

describe("GET /api/search", () => {
  it("returns 401 + empty when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req("ромашка"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ fills: [], sources: [] });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("short-circuits queries shorter than 2 chars without hitting the DB", async () => {
    authMock.mockResolvedValue({ user: { email: "u@x.ru" } });
    const res = await GET(req("a"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fills: [], sources: [] });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("returns searchAll results for a valid query", async () => {
    authMock.mockResolvedValue({ user: { email: "u@x.ru" } });
    const hits = { fills: [{ fillId: "F1", title: "ООО", subtitle: null, ext: "", kind: "fill" }], sources: [] };
    searchMock.mockResolvedValue(hits);
    const res = await GET(req("ООО"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(hits);
    expect(searchMock).toHaveBeenCalledWith("u@x.ru", "ООО");
  });

  it("never 500s — DB error yields empty results", async () => {
    authMock.mockResolvedValue({ user: { email: "u@x.ru" } });
    searchMock.mockRejectedValue(new Error("neon down"));
    const res = await GET(req("ромашка"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fills: [], sources: [] });
  });
});
