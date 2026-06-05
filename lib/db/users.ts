import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { users } from "./schema";

export interface DbUser { email: string; name: string; passwordHash: string; }

/** Look up a registered DB user by (lowercased) email. */
export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const db = getDb();
  const rows = await db
    .select({ email: users.email, name: users.name, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/** Insert a new user. A primary-key conflict throws (route maps it to 409). */
export async function createUser(u: DbUser): Promise<void> {
  const db = getDb();
  await db.insert(users).values({ email: u.email.toLowerCase(), name: u.name, passwordHash: u.passwordHash });
}
