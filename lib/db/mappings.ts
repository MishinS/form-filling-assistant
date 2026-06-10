import { eq, and } from "drizzle-orm";
import { getDb } from "./client";
import { templateMappings } from "./schema";
import type { ExtractField } from "@/lib/extract/fields";

// userId is an email; stored lowercased so writers (raw session email — verbatim for
// env AUTH_USERS accounts) and readers (some callers lowercase) always agree on the key.

/** The user's saved mapping for a template, or null if they have none. */
export async function getMapping(userId: string, templateId: string): Promise<ExtractField[] | null> {
  const db = getDb();
  const [row] = await db
    .select({ fields: templateMappings.fields })
    .from(templateMappings)
    .where(and(eq(templateMappings.userId, userId.toLowerCase()), eq(templateMappings.templateId, templateId)))
    .limit(1);
  return row?.fields ?? null;
}

/** Upsert the user's mapping for a template (whole-array replace). */
export async function saveMapping(userId: string, templateId: string, fields: ExtractField[]): Promise<void> {
  const db = getDb();
  await db
    .insert(templateMappings)
    .values({ userId: userId.toLowerCase(), templateId, fields, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [templateMappings.userId, templateMappings.templateId],
      set: { fields, updatedAt: new Date() },
    });
}

/** Remove the user's mapping for a template (Reset → falls back to PT_FIELDS on next load). */
export async function deleteMapping(userId: string, templateId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(templateMappings)
    .where(and(eq(templateMappings.userId, userId.toLowerCase()), eq(templateMappings.templateId, templateId)));
}
