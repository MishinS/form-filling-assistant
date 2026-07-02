import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/accents", () => ({ setAccent: vi.fn() }));

import { auth } from "@/auth";
import * as db from "@/lib/db/accents";
import { POST } from "./route";

const asMock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
afterEach(() => vi.clearAllMocks());

const req = (body: unknown) =>
  new Request("http://x/api/account/accent", { method: "POST", body: JSON.stringify(body) });
const full = { user: { email: "a@b.co", role: "user" } };

describe("/api/account/accent", () => {
  it("rejects a guest with 403 and saves nothing", async () => {
    asMock(auth).mockResolvedValue({ user: { email: "g", role: "guest" } });
    const res = await POST(req({ accent: "teal" }));
    expect(res.status).toBe(403);
    expect(asMock(db.setAccent)).not.toHaveBeenCalled();
  });

  it("401 when unauthenticated", async () => {
    asMock(auth).mockResolvedValue(null);
    expect((await POST(req({ accent: "teal" }))).status).toBe(401);
  });

  it("400 on an unknown accent id and saves nothing", async () => {
    asMock(auth).mockResolvedValue(full);
    const res = await POST(req({ accent: "purple" }));
    expect(res.status).toBe(400);
    expect(asMock(db.setAccent)).not.toHaveBeenCalled();
  });

  it("saves a valid accent and echoes it", async () => {
    asMock(auth).mockResolvedValue(full);
    const res = await POST(req({ accent: "rose" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, accent: "rose" });
    expect(asMock(db.setAccent)).toHaveBeenCalledWith("a@b.co", "rose");
  });
});
