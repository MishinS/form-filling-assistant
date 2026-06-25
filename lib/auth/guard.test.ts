import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { isGuest, requireFullUser } from "./guard";

beforeEach(() => authMock.mockReset());

describe("isGuest", () => {
  it("true for role guest, false otherwise", () => {
    expect(isGuest({ user: { role: "guest" } })).toBe(true);
    expect(isGuest({ user: { role: "user" } })).toBe(false);
    expect(isGuest({ user: {} })).toBe(false);
    expect(isGuest(null)).toBe(false);
  });
});

describe("requireFullUser", () => {
  it("401 when no session", async () => {
    authMock.mockResolvedValue(null);
    expect((await requireFullUser())!.status).toBe(401);
  });
  it("403 for a guest", async () => {
    authMock.mockResolvedValue({ user: { role: "guest" } });
    expect((await requireFullUser())!.status).toBe(403);
  });
  it("null (allowed) for a full user", async () => {
    authMock.mockResolvedValue({ user: { email: "t@t.ru", role: "user" } });
    expect(await requireFullUser()).toBeNull();
  });
});
