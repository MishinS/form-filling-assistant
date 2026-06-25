export type GuestUser = { id: string; name: string; email: null; role: "guest" };

/** Anonymous, DB-less guest principal. NEVER returns a real email or role:"user". */
export function guestUser(): GuestUser {
  return { id: "guest:" + crypto.randomUUID(), name: "Гость", email: null, role: "guest" };
}
