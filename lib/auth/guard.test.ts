import { describe,it,expect,vi,beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { requireFullUser } from "./guard";

beforeEach(() => authMock.mockReset());

describe("requireFullUser", () => {
  it("401 when no session", async () => {
    authMock.mockResolvedValue(null);
    expect((await requireFullUser())!.status).toBe(401);
  });
  it("403 for a guest", async () => {
    authMock.mockResolvedValue({ user: { role: "guest" } });
    expect((await requireFullUser())!.status).toBe(403);
  });
});
