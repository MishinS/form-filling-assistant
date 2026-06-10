import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { userAvatars } from "./schema";

/** The user's avatar URL, or null if none set. */
export async function getAvatar(email: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ url: userAvatars.url })
    .from(userAvatars)
    .where(eq(userAvatars.email, email.toLowerCase()))
    .limit(1);
  return row?.url ?? null;
}

/** Upsert the user's avatar URL. */
export async function setAvatar(email: string, url: string): Promise<void> {
  const db = getDb();
  const e = email.toLowerCase();
  await db
    .insert(userAvatars)
    .values({ email: e, url, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userAvatars.email, set: { url, updatedAt: new Date() } });
}

/** Remove the user's avatar (→ initials). */
export async function deleteAvatar(email: string): Promise<void> {
  const db = getDb();
  await db.delete(userAvatars).where(eq(userAvatars.email, email.toLowerCase()));
}
