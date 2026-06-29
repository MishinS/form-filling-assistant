import type { PickerRow } from "./custom-model-view";
import type { LocalRuntime } from "@/lib/desktop/tauri";

const KIND_LABEL: Record<LocalRuntime["kind"], string> = { ollama: "Ollama", lmstudio: "LM Studio" };

export function localPickerRows(rt: LocalRuntime | null): PickerRow[] {
  if (!rt) return [];
  return rt.models.map((m) => ({ id: `local:${m.slug}`, name: m.name, provider: KIND_LABEL[rt.kind], local: true }));
}
