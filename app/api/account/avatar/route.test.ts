import { describe,it,expect,vi,beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/avatars", () => ({
  getAvatar: vi.fn(async () => null),
  setAvatar: vi.fn(async () => {}),
  deleteAvatar: vi.fn(async () => {}),
}));
vi.mock("@vercel/blob", () => ({ del: vi.fn(async () => {}) }));

import { POST,DELETE } from "./route";
import { auth } from "@/auth";
import { getAvatar,setAvatar,deleteAvatar } from "@/lib/db/avatars";
import { del } from "@vercel/blob";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetAvatar = getAvatar as unknown as ReturnType<typeof vi.fn>;
const mockDel = del as unknown as ReturnType<typeof vi.fn>;
const OK_URL = "https://abc.public.blob.vercel-storage.com/avatar-1.png";

beforeEach(() => {
  vi.clearAllMocks();
  // The origin guard pins the store host to the write credential; this token
  // names the store the fixture URLs live on.
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_abc_secretpart");
  mockAuth.mockResolvedValue({ user: { email: "u@x.ru" } });
  mockGetAvatar.mockResolvedValue(null);
  mockDel.mockResolvedValue(undefined);
});

const post = (b: unknown) =>
  new Request("http://t/api/account/avatar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/account/avatar", () => {
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
});

describe("DELETE /api/account/avatar", () => {
  it("401 without a session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(deleteAvatar).not.toHaveBeenCalled();
  });
});
