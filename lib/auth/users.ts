// Pure credential helpers — no NextAuth imports, so they unit-test in isolation.
import bcrypt from "bcryptjs";

export interface AuthUser {
  email: string;
  name: string;
}
interface StoredUser extends AuthUser {
  hash: string;
}

/** Tolerant parse of the AUTH_USERS env JSON. Returns [] on missing/garbage/wrong-shape. */
export function parseUsers(json: string | undefined): StoredUser[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (u): u is StoredUser =>
        !!u && typeof u === "object" &&
        typeof (u as Record<string, unknown>).email === "string" &&
        typeof (u as Record<string, unknown>).name === "string" &&
        typeof (u as Record<string, unknown>).hash === "string",
    );
  } catch {
    return [];
  }
}

/** Find a user by case-insensitive email and bcrypt-compare the password. */
export async function verifyCredentials(
  email: string,
  password: string,
  users: StoredUser[],
): Promise<AuthUser | null> {
  if (!email || !password) return null;
  const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase());
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.hash);
  return ok ? { email: u.email, name: u.name } : null;
}
