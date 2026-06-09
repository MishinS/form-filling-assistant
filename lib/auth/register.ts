// Pure registration-input validation — no NextAuth/DB imports, unit-tested in isolation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  inviteCode: string;
}

export type RegisterValidation =
  | { ok: true; email: string; name: string }
  | { ok: false; error: "invite" | "email" | "name" | "password" };

/** Password policy — single source of truth (shared by registration and password change). */
export function isValidPassword(pw: string): boolean {
  return (pw ?? "").length >= 8;
}

/**
 * Gate registration input. Order matters (first failure wins): invite code →
 * email → name → password. Registration is CLOSED when expectedCode is empty/undefined.
 * On success returns the normalized email (lowercased+trimmed) and name (trimmed).
 */
export function validateRegistration(input: RegisterInput, expectedCode: string | undefined): RegisterValidation {
  if (!expectedCode || input.inviteCode !== expectedCode) return { ok: false, error: "invite" };
  const email = (input.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "email" };
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "name" };
  if (!isValidPassword(input.password)) return { ok: false, error: "password" };
  return { ok: true, email, name };
}
