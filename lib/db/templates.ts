import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "./client";
import { templates } from "./schema";
import type { ExtractField } from "@/lib/extract/fields";

export interface TemplateRow {
  id: string;
  code: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  format: "xlsx" | "docx";
  fileKey: string | null;
  sheets: string[];
  userId: string | null;
  deletedAt: Date | null;
  defaultFields: ExtractField[] | null;
}

const cols = {
  id: templates.id, code: templates.code,
  nameRu: templates.nameRu, nameEn: templates.nameEn,
  descRu: templates.descRu, descEn: templates.descEn,
  format: templates.format, fileKey: templates.fileKey, sheets: templates.sheets,
  userId: templates.userId, deletedAt: templates.deletedAt, defaultFields: templates.defaultFields,
};

/** Active templates visible to the user: built-ins + their own. */
export async function listTemplates(email: string): Promise<TemplateRow[]> {
  const db = getDb();
  return db.select(cols).from(templates).where(
    and(isNull(templates.deletedAt), or(isNull(templates.userId), eq(templates.userId, email.toLowerCase()))),
  );
}

/** Names of ALL templates the user could ever see (incl. soft-deleted) — for history rows. */
export async function listTemplateNames(email: string): Promise<Array<Pick<TemplateRow, "id" | "nameRu" | "nameEn">>> {
  const db = getDb();
  return db
    .select({ id: templates.id, nameRu: templates.nameRu, nameEn: templates.nameEn })
    .from(templates)
    .where(or(isNull(templates.userId), eq(templates.userId, email.toLowerCase())));
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const db = getDb();
  const [row] = await db.select(cols).from(templates).where(eq(templates.id, id)).limit(1);
  return row ?? null;
}

export async function createTemplate(t: {
  id: string; code: string; name: string; desc: string;
  fileKey: string; sheets: string[]; userId: string; defaultFields: ExtractField[];
}): Promise<void> {
  const db = getDb();
  await db.insert(templates).values({
    id: t.id, code: t.code,
    nameRu: t.name, nameEn: t.name, descRu: t.desc, descEn: t.desc,
    locale: "ru", format: "xlsx", fileKey: t.fileKey, sheets: t.sheets, primary: false,
    userId: t.userId.toLowerCase(), defaultFields: t.defaultFields,
  });
}

/** Rename own active template. False when not found / not owned / built-in. */
export async function renameTemplate(
  id: string, email: string, patch: { name?: string; desc?: string },
): Promise<boolean> {
  const set: Record<string, string> = {};
  if (patch.name !== undefined) { set.nameRu = patch.name; set.nameEn = patch.name; }
  if (patch.desc !== undefined) { set.descRu = patch.desc; set.descEn = patch.desc; }
  if (Object.keys(set).length === 0) return true;
  const db = getDb();
  const res = await db.update(templates).set(set)
    .where(and(eq(templates.id, id), eq(templates.userId, email.toLowerCase()), isNull(templates.deletedAt)))
    .returning({ id: templates.id });
  return res.length > 0;
}

/** Soft-delete own template. Returns its fileKey for blob cleanup, or ok:false. */
export async function softDeleteTemplate(
  id: string, email: string,
): Promise<{ ok: boolean; fileKey: string | null }> {
  const db = getDb();
  const res = await db.update(templates).set({ deletedAt: new Date() })
    .where(and(eq(templates.id, id), eq(templates.userId, email.toLowerCase()), isNull(templates.deletedAt)))
    .returning({ fileKey: templates.fileKey });
  return res.length > 0 ? { ok: true, fileKey: res[0].fileKey } : { ok: false, fileKey: null };
}
