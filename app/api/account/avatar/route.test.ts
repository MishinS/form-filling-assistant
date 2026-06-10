import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/avatars", () => ({
  getAvatar: vi.fn(async () => null),
  setAvatar: vi.fn(async () => {}),
  deleteAvatar: vi.fn(async () => {}),
}));
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}) }));

import { POST, DELETE } from "./route";
import { auth } from "@/auth";
import { getAvatar, setAvatar, deleteAvatar } from "@/lib/db/avatars";
import { del } from "@vercel/blob";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetAvatar = getAvatar as unknown as ReturnType<typeof vi.fn>;
const mockDel = del as unknown as ReturnType<typeof vi.fn>;
const OK_URL = "https://abc.public.blob.vercel-storage.com/avatar-1.png";
const OLD_URL = "https://abc.public.blob.vercel-storage.com/avatar-0.png";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } });
  mockGetAvatar.mockResolvedValue(null);
  mockDel.mockResolvedValue(undefined);
});

const post = (b: unknown) =>
  new Request("http://t/api/account/avatar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/account/avatar", () => {
  it("saves a valid own-blob url", async () => {
    const res = await POST(post({ url: OK_URL }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, url: OK_URL });
    expect(setAvatar).toHaveBeenCalledWith("u@x.ru", OK_URL);
  });
  it("400 on a foreign-host url", async () => {
    const res = await POST(post({ url: "https://evil.example.com/x.png" }));
    expect(res.status).toBe(400);
    expect(setAvatar).not.toHaveBeenCalled();
  });
  it("401 without a session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(post({ url: OK_URL }));
    expect(res.status).toBe(401);
    expect(setAvatar).not.toHaveBeenCalled();
  });
  it("deletes the replaced blob", async () => {
    mockGetAvatar.mockResolvedValueOnce(OLD_URL);
    const res = await POST(post({ url: OK_URL }));
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith(OLD_URL);
  });
  it("does not call del when there was no previous avatar", async () => {
    const res = await POST(post({ url: OK_URL }));
    expect(res.status).toBe(200);
    expect(del).not.toHaveBeenCalled();
  });
  it("still 200 when blob deletion fails (best-effort cleanup)", async () => {
    mockGetAvatar.mockResolvedValueOnce(OLD_URL);
    mockDel.mockRejectedValueOnce(new Error("blob down"));
    const res = await POST(post({ url: OK_URL }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, url: OK_URL });
  });
});

describe("DELETE /api/account/avatar", () => {
  it("clears the avatar", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteAvatar).toHaveBeenCalledWith("u@x.ru");
  });
  it("401 without a session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(deleteAvatar).not.toHaveBeenCalled();
  });
  it("deletes the stored blob", async () => {
    mockGetAvatar.mockResolvedValueOnce(OLD_URL);
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith(OLD_URL);
  });
  it("still 200 when blob deletion fails (best-effort cleanup)", async () => {
    mockGetAvatar.mockResolvedValueOnce(OLD_URL);
    mockDel.mockRejectedValueOnce(new Error("blob down"));
    const res = await DELETE();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
