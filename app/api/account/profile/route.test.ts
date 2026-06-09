import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/users", () => ({ getUserByEmail: vi.fn(), updateUserName: vi.fn(async () => {}) }));

import { PATCH } from "./route";
import { auth } from "@/auth";
import { getUserByEmail, updateUserName } from "@/lib/db/users";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGet = getUserByEmail as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru", name: "Old" } });
  mockGet.mockResolvedValue({ email: "u@x.ru", name: "Old", passwordHash: "h" });
});

const req = (b: unknown) =>
  new Request("http://t/api/account/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

describe("PATCH /api/account/profile", () => {
  it("updates the name", async () => {
    const res = await PATCH(req({ name: "Новое Имя" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, name: "Новое Имя" });
    expect(updateUserName).toHaveBeenCalledWith("u@x.ru", "Новое Имя");
  });
  it("401 when not signed in", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await PATCH(req({ name: "X" }));
    expect(res.status).toBe(401);
    expect(updateUserName).not.toHaveBeenCalled();
  });
  it("400 on empty name", async () => {
    const res = await PATCH(req({ name: "   " }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "name" });
  });
  it("409 for an env-only account (no DB row)", async () => {
    mockGet.mockResolvedValueOnce(null);
    const res = await PATCH(req({ name: "X" }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "env_account" });
    expect(updateUserName).not.toHaveBeenCalled();
  });
});
