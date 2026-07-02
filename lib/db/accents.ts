import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { userAccents } from "./schema";
import { parseAccentId, type AccentId } from "../accent-core";

/** The user's saved accent, or null if none set. */
export async function getAccent(email: string): Promise<AccentId | null> {
  const db = getDb();
  const [row] = await db
    .select({ accent: userAccents.accent })
    .from(userAccents)
    .where(eq(userAccents.email, email.toLowerCase()))
    .limit(1);
  return row ? parseAccentId(row.accent) : null;
}

/** Upsert the user's accent. */
export async function setAccent(email: string, accent: AccentId): Promise<void> {
  const db = getDb();
  const e = email.toLowerCase();
  await db
    .insert(userAccents)
    .values({ email: e, accent, updatedAt: new Date() })
    .onConflictDoUpdate({ target: userAccents.email, set: { accent, updatedAt: new Date() } });
}
