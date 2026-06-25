import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/users", () => ({ getUserByEmail: vi.fn(async () => null), createUser: vi.fn(async () => {}) }));

import { POST } from "./route";
import { getUserByEmail, createUser } from "@/lib/db/users";
import bcrypt from "bcryptjs";

const asMock = <T,>(f: T) => f as unknown as ReturnType<typeof vi.fn>;

const envHash = bcrypt.hashSync("ownerpass", 8);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INVITE_CODE = "LETMEIN";
  process.env.AUTH_USERS = JSON.stringify([{ email: "owner@x.ru", name: "Owner", hash: envHash }]);
  asMock(getUserByEmail).mockResolvedValue(null);
});

afterEach(() => { vi.unstubAllEnvs(); });

const req = (b: unknown) => new Request("http://t/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const good = { email: "new@user.ru", name: "Иван", password: "longenough", inviteCode: "LETMEIN", acceptTos: true };

describe("POST /api/register", () => {
  it("400 'invite' on wrong code; no user created", async () => {
    const res = await POST(req({ ...good, inviteCode: "nope" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invite" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("400 on malformed/short fields", async () => {
    const res = await POST(req({ ...good, password: "short" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "password" });
  });

  it("409 'email_taken' when the email is an env user", async () => {
    const res = await POST(req({ ...good, email: "Owner@x.ru", acceptTos: true }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "email_taken" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("409 'email_taken' when the email already exists in the DB", async () => {
    (getUserByEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ email: "new@user.ru", name: "X", passwordHash: "h" });
    const res = await POST(req(good));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "email_taken" });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("409 when createUser hits a unique-violation race (23505)", async () => {
    (createUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }));
    const res = await POST(req(good));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "email_taken" });
  });

  it("500 when the DB errors for a non-unique reason (e.g. connectivity)", async () => {
    (createUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("connect timeout"));
    const res = await POST(req(good));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "server" });
  });

  it("200 creates the user with a bcrypt hash and normalized email", async () => {
    const res = await POST(req({ ...good, email: "New@User.ru", acceptTos: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(createUser).toHaveBeenCalledTimes(1);
    const arg = asMock(createUser).mock.calls[0][0];
    expect(arg.email).toBe("new@user.ru");
    expect(arg.name).toBe("Иван");
    expect(bcrypt.compareSync("longenough", arg.passwordHash)).toBe(true);
  });
});

describe("register consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INVITE_CODE = "LETMEIN";
    process.env.AUTH_USERS = "[]";
    asMock(getUserByEmail).mockResolvedValue(null);
  });

  it("rejects without acceptTos", async () => {
    const res = await POST(req({ ...good, acceptTos: undefined }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("consent");
    expect(asMock(createUser)).not.toHaveBeenCalled();
  });

  it("creates the user and persists consent when acceptTos is true", async () => {
    const res = await POST(req({ ...good, acceptTos: true }));
    expect(res.status).toBe(200);
    const arg = asMock(createUser).mock.calls[0][0];
    expect(arg.tosAcceptedAt).toBeInstanceOf(Date);
  });
});
