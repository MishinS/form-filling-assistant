import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/users", () => ({ getUserByEmail: vi.fn(), updateUserPassword: vi.fn(async () => {}) }));

import { POST } from "./route";
import { auth } from "@/auth";
import { getUserByEmail, updateUserPassword } from "@/lib/db/users";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGet = getUserByEmail as unknown as ReturnType<typeof vi.fn>;
const hash = bcrypt.hashSync("currentpass", 8);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } });
  mockGet.mockResolvedValue({ email: "u@x.ru", name: "U", passwordHash: hash });
});

const req = (b: unknown) =>
  new Request("http://t/api/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/account/password", () => {
  it("400 'wrong_password' when current is wrong", async () => {
    const res = await POST(req({ currentPassword: "nope", newPassword: "newlongpass" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "wrong_password" });
    expect(updateUserPassword).not.toHaveBeenCalled();
  });
  it("401 when not signed in", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(req({ currentPassword: "x", newPassword: "newlongpass" }));
    expect(res.status).toBe(401);
  });
});
