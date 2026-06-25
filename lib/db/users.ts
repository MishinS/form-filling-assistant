import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { users } from "./schema";

export interface DbUser { email: string; name: string; passwordHash: string; tosAcceptedAt?: Date | null; tosVersion?: string | null; }

/** Look up a registered DB user by (lowercased) email. */
export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const db = getDb();
  const rows = await db
    .select({ email: users.email, name: users.name, passwordHash: users.passwordHash, tosAcceptedAt: users.tosAcceptedAt })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/** Insert a new user. A primary-key conflict throws (route maps it to 409). */
export async function createUser(u: DbUser): Promise<void> {
  const db = getDb();
  await db.insert(users).values({ email: u.email.toLowerCase(), name: u.name, passwordHash: u.passwordHash, tosAcceptedAt: u.tosAcceptedAt ?? null, tosVersion: u.tosVersion ?? null });
}

/** Update a registered user's display name. */
export async function updateUserName(email: string, name: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ name }).where(eq(users.email, email.toLowerCase()));
}

/** Update a registered user's bcrypt password hash. */
export async function updateUserPassword(email: string, passwordHash: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ passwordHash }).where(eq(users.email, email.toLowerCase()));
}

/** Record that a user accepted the Terms of Service at a specific version. */
export async function acceptTos(email: string, version: string): Promise<void> {
  const db = getDb();
  await db.update(users).set({ tosAcceptedAt: new Date(), tosVersion: version })
    .where(eq(users.email, email.toLowerCase()));
}
