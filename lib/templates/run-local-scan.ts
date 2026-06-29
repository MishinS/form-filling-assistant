import type { ExtractField } from "@/lib/extract/fields";
import type { SheetText } from "./xlsx-scan";
import { buildScanPrompt, coerceFields } from "./scan";
import { invokeLlmChat, getCachedRuntime } from "@/lib/desktop/tauri";

export type LocalScanOutcome = { fields: ExtractField[] } | { error: "llm" | "nofields" };

/** Propose template fields with the selected local model inside the desktop webview.
 *  Single call, no race / no fallback (mirrors localCompatModel). Emits the same
 *  attempt/attempt-fail/attempt-win NDJSON lines NewTemplateModal consumes; the
 *  SAVE is performed by POST /api/templates with the returned fields. */
export async function runLocalScan(
  sheets: SheetText[],
  modelId: string,
  emit: (line: string) => void,
): Promise<LocalScanOutcome> {
  const write = (obj: unknown) => emit(JSON.stringify(obj));
  const rt = getCachedRuntime();
  if (!rt) return { error: "llm" };
  const model = modelId.slice("local:".length);

  // Mirror proposeFields: drop empty sheets so a bare "B1" qualifies to the first
  // sheet WITH content; keep all if every sheet is empty.
  const withContent = sheets.filter((s) => s.lines.length > 0);
  const formSheets = withContent.length > 0 ? withContent : sheets;
  const sheetNames = formSheets.map((s) => s.name);
  const prompt = buildScanPrompt(formSheets);

  write({ type: "attempt", model, total: 1 });
  let txt: string;
  try {
    txt = await invokeLlmChat({ baseUrl: rt.baseUrl, model, prompt });
  } catch {
    write({ type: "attempt-fail", model, reason: "unreachable" });
    return { error: "llm" };
  }

  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: { fields?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { fields?: unknown };
  } catch {
    write({ type: "attempt-fail", model, reason: "bad json" });
    return { error: "llm" };
  }
  if (!Array.isArray(parsed.fields)) {
    write({ type: "attempt-fail", model, reason: "bad json" });
    return { error: "llm" };
  }
  const fields = coerceFields(parsed.fields, sheetNames);
  if (fields.length === 0) {
    write({ type: "attempt-fail", model, reason: "no fields" });
    return { error: "nofields" };
  }
  write({ type: "attempt-win", model });
  return { fields };
}
