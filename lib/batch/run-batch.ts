export type BatchStatus = "pending" | "running" | "done" | "error";
export type BatchItem = { fileId: string; name: string; status: BatchStatus; error?: string; bytes?: Uint8Array };
export type RunOne = (file: File, fileId: string) => Promise<Uint8Array>;

/**
 * Fill each file sequentially via `runOne`. A per-file rejection is captured as
 * `status:"error"` and does NOT abort the batch. `onProgress` fires after each
 * status change with a fresh snapshot (safe to store directly in React state).
 */
export async function runBatch(
  files: File[],
  runOne: RunOne,
  onProgress: (items: BatchItem[]) => void,
): Promise<BatchItem[]> {
  const items: BatchItem[] = files.map((f, i) => ({ fileId: `b-${i}`, name: f.name, status: "pending" }));
  const emit = () => onProgress(items.map((it) => ({ ...it })));
  for (let i = 0; i < files.length; i++) {
    items[i] = { ...items[i], status: "running" };
    emit();
    try {
      const bytes = await runOne(files[i], items[i].fileId);
      items[i] = { ...items[i], status: "done", bytes };
    } catch (e) {
      items[i] = { ...items[i], status: "error", error: e instanceof Error ? e.message : String(e) };
    }
    emit();
  }
  return items.map((it) => ({ ...it }));
}
