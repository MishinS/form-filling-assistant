import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/user-models", () => ({
  listModels: vi.fn(), insertModel: vi.fn(), getModelById: vi.fn(), deleteModel: vi.fn(),
  toDTO: (row: { id: string }, _k: string) => ({ id: row.id, masked: true }),
}));
vi.mock("@/lib/db/users", () => ({ getUserByEmail: vi.fn(), acceptTos: vi.fn() }));
vi.mock("@/lib/extract/llm/probe", () => ({ probeModel: vi.fn() }));

import { auth } from "@/auth";
import * as db from "@/lib/db/user-models";
import * as users from "@/lib/db/users";
import { probeModel } from "@/lib/extract/llm/probe";
import { GET, POST } from "./route";

const asMock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => vi.stubEnv("BYOK_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64")));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

const req = (body: unknown) => new Request("http://x/api/models", { method: "POST", body: JSON.stringify(body) });
const full = { user: { email: "a@b.co", role: "user" } };

describe("/api/models", () => {
  it("GET rejects a guest with 403", async () => {
    asMock(auth).mockResolvedValue({ user: { email: "g", role: "guest" } });
    expect((await GET()).status).toBe(403);
  });

  it("GET 401 when unauthenticated", async () => {
    asMock(auth).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("POST requires consent when tosAcceptedAt is null and acceptTos not set", async () => {
    asMock(auth).mockResolvedValue(full);
    asMock(users.getUserByEmail).mockResolvedValue({ email: "a@b.co", tosAcceptedAt: null });
    const res = await POST(req({ provider: "openai", modelSlug: "gpt-4o", apiKey: "sk-x", label: "L" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("consent_required");
  });

  it("POST validates, encrypts, inserts, returns masked DTO on success", async () => {
    asMock(auth).mockResolvedValue(full);
    asMock(users.getUserByEmail).mockResolvedValue({ email: "a@b.co", tosAcceptedAt: new Date() });
    asMock(probeModel).mockResolvedValue({ ok: true });
    const res = await POST(req({ provider: "openai", modelSlug: "gpt-4o", apiKey: "sk-x", label: "L" }));
    expect(res.status).toBe(201);
    expect(asMock(db.insertModel)).toHaveBeenCalledTimes(1);
    const inserted = asMock(db.insertModel).mock.calls[0][0];
    expect(inserted.keyCipher).not.toContain("sk-x"); // encrypted at rest
  });

  it("POST returns the probe error code on failure and inserts nothing", async () => {
    asMock(auth).mockResolvedValue(full);
    asMock(users.getUserByEmail).mockResolvedValue({ email: "a@b.co", tosAcceptedAt: new Date() });
    asMock(probeModel).mockResolvedValue({ ok: false, code: "auth" });
    const res = await POST(req({ provider: "openai", modelSlug: "gpt-4o", apiKey: "bad", label: "L" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("auth");
    expect(asMock(db.insertModel)).not.toHaveBeenCalled();
  });
});
