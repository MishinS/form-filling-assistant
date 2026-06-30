import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractField } from "../fields";
import type { OnAttempt } from "./types";
import { extractFields } from "@/lib/extract/extract";
import { localCompatModel } from "./local-model";
import { getCachedRuntime } from "@/lib/desktop/tauri";
import { estimateLocalMs } from "./eta";

/** Drive extraction for a local:<slug> model inside the desktop webview, emitting
 *  the same newline-delimited JSON events that /api/extract streams. */
export async function runLocalExtract(
  docs: ParsedDoc[],
  modelId: string,
  fields: ExtractField[],
  emit: (line: string) => void,
): Promise<void> {
  const write = (obj: unknown) => emit(JSON.stringify(obj));
  const rt = getCachedRuntime();
  if (!rt) {
    write({ type: "result", values: [], warnings: ["Локальная модель не обнаружена"], llmFailed: true, usedModel: null });
    return;
  }
  const slug = modelId.slice("local:".length);
  const promptText = docs.map((d) => d.blocks.map((b) => b.text).join("\n")).join("\n\n");
  write({ type: "local-eta", ms: estimateLocalMs(promptText) });
  const onAttempt: OnAttempt = (ev) => {
    if (ev.phase === "start") write({ type: "attempt", model: ev.model, total: ev.total });
    else if (ev.phase === "win") write({ type: "attempt-win", model: ev.model });
    else write({ type: "attempt-fail", model: ev.model, reason: ev.reason });
  };
  const { values, warnings, llmFailed, usedModel } =
    await extractFields(docs, modelId, fields, onAttempt, { modelOverride: localCompatModel(rt.baseUrl, slug) });
  write({ type: "result", values, warnings, llmFailed, usedModel });
}
