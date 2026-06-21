import { sql, eq, and, desc, count } from "drizzle-orm";
import { getDb } from "./client";
import { fills, sourceFiles, extractedValues } from "./schema";
import { buildFillRecord, type FillPayload, type HistoryRowData, type FillDetail, type SourceRowData } from "./map";

/** Atomically persist a completed fill (fills + source_files + extracted_values). */
export async function createFill(userId: string, payload: FillPayload): Promise<string> {
  const db = getDb();
  const { fill, sources, values } = buildFillRecord(crypto.randomUUID(), userId, payload);

  const stmts = [
    db.insert(fills).values(fill),
    ...(sources.length ? [db.insert(sourceFiles).values(sources)] : []),
    ...(values.length ? [db.insert(extractedValues).values(values)] : []),
  ];

  // neon-http has no interactive transaction; batch() runs the statements atomically.
  // batch() wants a non-empty readonly tuple — cast through its own parameter type.
  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
  return fill.id;
}

/** Most-recent fills for one user, with the denormalised summary the dashboard row needs. */
export async function listFills(userId: string, limit = 20): Promise<HistoryRowData[]> {
  const db = getDb();
  // Inside a `.select()` projection, `${fills.id}` renders unqualified as `"id"`, which a
  // correlated subquery resolves to the INNER table's id (sf.id / ev.id) — silently matching
  // nothing. Reference the outer column with an explicit table-qualified raw fragment.
  const fid = sql.raw('"fills"."id"');
  const rows = await db
    .select({
      id: fills.id,
      templateId: fills.templateId,
      status: fills.status,
      createdAt: fills.createdAt,
      fileCount: sql<number>`(select count(*) from ${sourceFiles} sf where sf.fill_id = ${fid})`,
      primaryFile: sql<string | null>`(select sf.name from ${sourceFiles} sf where sf.fill_id = ${fid} order by sf.id limit 1)`,
      counterparty: sql<string | null>`(select ev.value from ${extractedValues} ev where ev.fill_id = ${fid} and ev.field_id = 'f1' limit 1)`,
      amount: sql<string | null>`(select ev.value from ${extractedValues} ev where ev.fill_id = ${fid} and ev.field_id = 'f4' limit 1)`,
      currency: sql<string | null>`(select ev.value from ${extractedValues} ev where ev.fill_id = ${fid} and ev.field_id = 'f5' limit 1)`,
    })
    .from(fills)
    .where(eq(fills.userId, userId))
    .orderBy(desc(fills.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    templateId: r.templateId,
    status: r.status,
    createdAt: (r.createdAt as Date).toISOString(),
    fileCount: Number(r.fileCount ?? 0),
    primaryFile: r.primaryFile,
    counterparty: r.counterparty,
    amount: r.amount,
    currency: r.currency,
  }));
}

export async function listSources(userId: string, limit = 50): Promise<SourceRowData[]> {
  const db = getDb();
  // See listFills: an unqualified `${sourceFiles.fillId}` inside the correlated subquery would
  // resolve to the INNER table (ev), so reference the outer column with an explicit literal.
  const sfFill = sql.raw('"source_files"."fill_id"');
  const rows = await db
    .select({
      id: sourceFiles.id,
      name: sourceFiles.name,
      mime: sourceFiles.mime,
      size: sourceFiles.size,
      pages: sourceFiles.pages,
      blobKey: sourceFiles.blobKey,
      fillId: sourceFiles.fillId,
      createdAt: fills.createdAt,
      counterparty: sql<string | null>`(select ev.value from ${extractedValues} ev where ev.fill_id = ${sfFill} and ev.field_id = 'f1' limit 1)`,
    })
    .from(sourceFiles)
    .innerJoin(fills, eq(fills.id, sourceFiles.fillId))
    .where(eq(fills.userId, userId))
    .orderBy(desc(fills.createdAt), sourceFiles.id)
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    mime: r.mime,
    size: r.size,
    pages: Number(r.pages ?? 1),
    blobKey: r.blobKey,
    fillId: r.fillId,
    createdAt: (r.createdAt as Date).toISOString(),
    counterparty: r.counterparty,
  }));
}

export interface FillStats { total: number; month: number; last: string | null; }

/** Cheap honest stats: total fills, this calendar month, last fill date. */
export async function fillStats(userId: string): Promise<FillStats> {
  const db = getDb();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const [row] = await db
    .select({
      total: count(),
      month: sql<number>`count(*) filter (where ${fills.createdAt} >= ${start.toISOString()})`,
      last: sql<string | null>`max(${fills.createdAt})`,
    })
    .from(fills)
    .where(eq(fills.userId, userId));

  return {
    total: Number(row?.total ?? 0),
    month: Number(row?.month ?? 0),
    last: row?.last ? new Date(row.last).toISOString() : null,
  };
}

/** One persisted fill scoped to its owner, with source files + extracted values. */
export async function getFill(userId: string, id: string): Promise<FillDetail | null> {
  const db = getDb();
  const [fillRows, srcRows, valRows] = await db.batch([
    db.select({
      id: fills.id, templateId: fills.templateId, status: fills.status, createdAt: fills.createdAt,
    }).from(fills).where(and(eq(fills.id, id), eq(fills.userId, userId))).limit(1),
    db.select({
      id: sourceFiles.id, name: sourceFiles.name, mime: sourceFiles.mime,
      size: sourceFiles.size, pages: sourceFiles.pages,
    }).from(sourceFiles).where(eq(sourceFiles.fillId, id)).orderBy(sourceFiles.id),
    db.select({
      fieldId: extractedValues.fieldId, value: extractedValues.value, confidence: extractedValues.confidence,
    }).from(extractedValues).where(eq(extractedValues.fillId, id)).orderBy(extractedValues.id),
  ]);

  const f = fillRows[0];
  if (!f) return null; // missing or not owned — children are discarded, nothing leaks

  return {
    id: f.id,
    templateId: f.templateId,
    status: f.status,
    createdAt: (f.createdAt as Date).toISOString(),
    sources: srcRows.map((s) => ({ id: s.id, name: s.name, mime: s.mime, size: s.size, pages: s.pages })),
    values: valRows.map((v) => ({ fieldId: v.fieldId, value: v.value, confidence: v.confidence })),
  };
}
