import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { userModels } from "./schema";
import { maskKey } from "@/lib/crypto/secrets";

export interface CustomModelRow {
  id: string; email: string; label: string; provider: string;
  baseUrl: string; modelSlug: string; keyCipher: string;
  createdAt: Date; updatedAt: Date; lastOkAt: Date | null;
}
export interface CustomModelDTO {
  id: string; label: string; provider: string; modelSlug: string;
  maskedKey: string; lastOkAt: Date | null;
}

/** Pure: row + decrypted key → client-safe DTO (key masked, cipher dropped). */
export function toDTO(row: CustomModelRow, plainKey: string): CustomModelDTO {
  return {
    id: row.id, label: row.label, provider: row.provider, modelSlug: row.modelSlug,
    maskedKey: maskKey(plainKey), lastOkAt: row.lastOkAt,
  };
}

export async function listModels(email: string): Promise<CustomModelRow[]> {
  return getDb().select().from(userModels).where(eq(userModels.email, email.toLowerCase())) as Promise<CustomModelRow[]>;
}

export async function getModelById(email: string, id: string): Promise<CustomModelRow | null> {
  const rows = await getDb().select().from(userModels)
    .where(and(eq(userModels.email, email.toLowerCase()), eq(userModels.id, id))).limit(1);
  return (rows[0] as CustomModelRow) ?? null;
}

export async function insertModel(row: CustomModelRow): Promise<void> {
  await getDb().insert(userModels).values({ ...row, email: row.email.toLowerCase() });
}

export async function deleteModel(email: string, id: string): Promise<number> {
  const res = await getDb().delete(userModels)
    .where(and(eq(userModels.email, email.toLowerCase()), eq(userModels.id, id)));
  return (res as { rowCount?: number }).rowCount ?? 0;
}
