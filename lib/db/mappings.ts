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

/** Слои пользовательской версии html-шаблона. Каждый null — «как в репозитории». */
export interface TemplateLayers {
  fields: ExtractField[] | null;
  instruction: string | null;
  skeleton: string | null;
}

/** Строка таблицы → слои; нет строки — нет и настроек. */
export function toLayers(row: TemplateLayers | undefined): TemplateLayers | null {
  if (!row) return null;
  return { fields: row.fields ?? null, instruction: row.instruction ?? null, skeleton: row.skeleton ?? null };
}

/** All three layers of the user's customization of a template, or null if none. */
export async function getTemplateLayers(userId: string, templateId: string): Promise<TemplateLayers | null> {
  const db = getDb();
  const [row] = await db
    .select({ fields: templateMappings.fields, instruction: templateMappings.instruction, skeleton: templateMappings.skeleton })
    .from(templateMappings)
    .where(and(eq(templateMappings.userId, userId.toLowerCase()), eq(templateMappings.templateId, templateId)))
    .limit(1);
  return toLayers(row);
}

/** Upsert all three layers at once; a null layer is stored as null, not as a copy of the default. */
export async function saveTemplateLayers(userId: string, templateId: string, layers: TemplateLayers): Promise<void> {
  const db = getDb();
  const set = { fields: layers.fields, instruction: layers.instruction, skeleton: layers.skeleton, updatedAt: new Date() };
  await db
    .insert(templateMappings)
    .values({ userId: userId.toLowerCase(), templateId, ...set })
    .onConflictDoUpdate({ target: [templateMappings.userId, templateMappings.templateId], set });
}

/** Remove the user's mapping for a template (Reset → falls back to PT_FIELDS on next load). */
export async function deleteMapping(userId: string, templateId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(templateMappings)
    .where(and(eq(templateMappings.userId, userId.toLowerCase()), eq(templateMappings.templateId, templateId)));
}
