import { sql, eq, and, desc } from "drizzle-orm";
import { getDb } from "./client";
import { fills, sourceFiles, extractedValues } from "./schema";

export interface SearchHit {
  fillId: string;          // navigation target → /fills/[fillId]
  title: string;
  subtitle: string | null;
  ext: string;             // file extension for the glyph ("" if none)
  kind: "fill" | "source";
}
export interface SearchResults { fills: SearchHit[]; sources: SearchHit[]; }

/** Escape LIKE/ILIKE wildcards so user-typed % _ \ match literally (paired with ESCAPE '\'). */
export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** Lowercased file extension, or "" when absent. */
export function extOf(name: string | null): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : "";
}

export function fillHit(r: { id: string; primaryFile: string | null; counterparty: string | null }): SearchHit {
  const title = r.counterparty ?? r.primaryFile ?? "—";
  const subtitle = r.counterparty && r.primaryFile ? r.primaryFile : null;
  return { fillId: r.id, title, subtitle, ext: extOf(r.primaryFile), kind: "fill" };
}

export function sourceHit(r: { id: string; name: string; fillId: string; counterparty: string | null }): SearchHit {
  return { fillId: r.fillId, title: r.name, subtitle: r.counterparty, ext: extOf(r.name), kind: "source" };
}

const EMPTY: SearchResults = { fills: [], sources: [] };

/**
 * Global search over one user's fills + sources, matching counterparty (extracted f1)
 * and file name. Two groups so the same document is not listed twice:
 *  - fills:   one row per fill matching counterparty OR any of its file names;
 *  - sources: one row per file matching its name (counterparty matches are already
 *             represented in the fills group).
 */
export async function searchAll(userId: string, q: string, limit = 6): Promise<SearchResults> {
  const needle = q.trim();
  if (!needle) return EMPTY;
  const db = getDb();
  const pat = `%${escapeLike(needle)}%`;

  // Correlated subqueries must reference the OUTER column with an explicit table-qualified
  // literal — an unqualified id/fill_id would bind to the INNER table. (Same gotcha as listFills.)
  const fid = sql.raw('"fills"."id"');
  const sfFill = sql.raw('"source_files"."fill_id"');

  const [fillRows, srcRows] = await db.batch([
    db
      .select({
        id: fills.id,
        primaryFile: sql<string | null>`(select sf.name from ${sourceFiles} sf where sf.fill_id = ${fid} order by sf.id limit 1)`,
        counterparty: sql<string | null>`(select ev.value from ${extractedValues} ev where ev.fill_id = ${fid} and ev.field_id = 'f1' limit 1)`,
      })
      .from(fills)
      .where(and(
        eq(fills.userId, userId),
        sql`(exists (select 1 from ${extractedValues} ev where ev.fill_id = ${fid} and ev.field_id = 'f1' and ev.value ilike ${pat} escape '\\')
          or exists (select 1 from ${sourceFiles} sf where sf.fill_id = ${fid} and sf.name ilike ${pat} escape '\\'))`,
      ))
      .orderBy(desc(fills.createdAt))
      .limit(limit),
    db
      .select({
        id: sourceFiles.id,
        name: sourceFiles.name,
        fillId: sourceFiles.fillId,
        counterparty: sql<string | null>`(select ev.value from ${extractedValues} ev where ev.fill_id = ${sfFill} and ev.field_id = 'f1' limit 1)`,
      })
      .from(sourceFiles)
      .innerJoin(fills, eq(fills.id, sourceFiles.fillId))
      .where(and(eq(fills.userId, userId), sql`${sourceFiles.name} ilike ${pat} escape '\\'`))
      .orderBy(desc(fills.createdAt), sourceFiles.id)
      .limit(limit),
  ]);

  return {
    fills: fillRows.map(fillHit),
    sources: srcRows.map(sourceHit),
  };
}
