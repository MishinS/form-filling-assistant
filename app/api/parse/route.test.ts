import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/parse", () => ({
  parseDocument: vi.fn(async (_buf: Buffer, mime: string, meta: { fileId: string; name: string }) => {
    if (meta.fileId === "bad") throw new Error("corrupt");
    return { fileId: meta.fileId, name: meta.name, mime, pages: 1, blocks: [], scannedPages: [], warnings: [] };
  }),
}));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "t@t.ru" } })) }));

vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}) }));

import { POST } from "./route";
import { del } from "@vercel/blob";
const delMock = del as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  global.fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))) as unknown as typeof fetch;
});

function req(body: unknown) {
  return new Request("http://t/api/parse", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/parse", () => {
  it("isolates a failing file and still returns the others", async () => {
    const res = await POST(req({ sources: [
      { fileId: "ok", url: "https://blob/ok", name: "a.pdf", mime: "application/pdf" },
      { fileId: "bad", url: "https://blob/bad", name: "b.pdf", mime: "application/pdf" },
    ]}));
    const json = await res.json();
    expect(res.status).toBe(200);
    const ok = json.docs.find((d: { fileId: string }) => d.fileId === "ok");
    const bad = json.docs.find((d: { fileId: string }) => d.fileId === "bad");
    expect(ok.warnings).toEqual([]);
    expect(bad.blocks).toEqual([]);
    expect(bad.warnings[0]).toContain("Не удалось обработать");
  });
});

import { auth as parseAuth } from "@/auth";

describe("/api/parse auth", () => {
  it("401s without a session", async () => {
    (parseAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await POST(req({ sources: [] }));
    expect(res.status).toBe(401);
  });
});

describe("/api/parse guest blob cleanup", () => {
  it("гость: удаляет загруженный Blob после парсинга", async () => {
    (parseAuth as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      user: { role: "guest" },
    });
    delMock.mockClear();
    const blobUrl = "https://store123.public.blob.vercel-storage.com/x-abc.pdf";
    const body = { sources: [{ fileId: "ok", url: blobUrl, name: "a.pdf", mime: "application/pdf" }] };
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(delMock).toHaveBeenCalledWith(blobUrl);
  });

  it("обычный юзер: Blob не удаляет", async () => {
    delMock.mockClear();
    const body = { sources: [{ fileId: "ok", url: "https://store123.public.blob.vercel-storage.com/x-abc.pdf", name: "a.pdf", mime: "application/pdf" }] };
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("гость: чужой/произвольный URL не удаляется (только наш Blob-стор)", async () => {
    (parseAuth as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce({
      user: { role: "guest" },
    });
    delMock.mockClear();
    const body = { sources: [{ fileId: "ok", url: "https://evil.example.com/x.pdf", name: "a.pdf", mime: "application/pdf" }] };
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(delMock).not.toHaveBeenCalled();
  });
});
