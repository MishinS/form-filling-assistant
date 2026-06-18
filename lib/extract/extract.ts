import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractedValue } from "@/lib/types";
import { PT_FIELDS, type ExtractField } from "./fields";
import { RULES } from "./rules";
import { locatorRu } from "./format";
import { getModel } from "./llm/registry";
import { ModelNotConfigured, type OnAttempt } from "./llm/types";
import { isOwnCompany } from "./own-company";

export interface ExtractResult {
  values: ExtractedValue[];
  warnings: string[];
  llmFailed: boolean;
  usedModel: string | null;
}

function empty(fieldId: string): ExtractedValue {
  return { fieldId, value: "", confidence: "low", source: { fileId: null, locator: "" } };
}

export async function extractFields(
  docs: ParsedDoc[],
  modelId: string,
  fields: ExtractField[] = PT_FIELDS,
  onAttempt?: OnAttempt,
): Promise<ExtractResult> {
  const warnings: string[] = [];
  const byField = new Map<string, ExtractedValue>();
  let llmFailed = false;
  let usedModel: string | null = null;

  // 1) regex pass
  for (const f of fields) {
    if (f.strategy !== "rule" || !f.rule) continue;
    if (f.fillMode === "constant" || f.fillMode === "date") continue;
    const rule = RULES[f.rule];
    if (!rule) continue; // unknown rule key (untrusted input) — skip rather than throw
    let value: ExtractedValue | null = null;
    for (const d of docs) {
      const hit = rule(d.blocks);
      if (hit) {
        value = { fieldId: f.id, value: hit.value, confidence: "high",
          source: { fileId: d.fileId, locator: locatorRu(hit.locator) } };
        break;
      }
    }
    byField.set(f.id, value ?? empty(f.id));
  }

  // 2) llm pass
  const llmFields = fields.filter(
    (f) => f.strategy === "llm" && f.fillMode !== "constant" && f.fillMode !== "date",
  );
  if (llmFields.length) {
    const text = docs.map((d) => d.blocks.map((b) => b.text).join("\n")).join("\n\n");
    let winner: string | null = null;
    const wrapped: OnAttempt = (ev) => {
      if (ev.phase === "win") winner = ev.model;
      onAttempt?.(ev);
    };
    try {
      const model = getModel(modelId);
      const results = await model.extract(llmFields, text, wrapped);
      usedModel = winner;
      for (const f of llmFields) {
        const r = results.find((x) => x.fieldId === f.id);
        if (r && r.value) {
          if (f.isCounterparty && isOwnCompany(r.value)) {
            // Model returned our own company — blank it; user fills in manually.
            byField.set(f.id, empty(f.id));
            warnings.push("Контрагент не распознан — укажите вручную.");
          } else {
            byField.set(f.id, { fieldId: f.id, value: r.value, confidence: r.confidence ?? "med",
              source: locateValue(docs, r.value) });
          }
        } else {
          byField.set(f.id, empty(f.id));
        }
      }
    } catch (e) {
      llmFailed = true;
      usedModel = null;
      warnings.push(e instanceof ModelNotConfigured
        ? e.message
        : `Извлечение LLM не выполнено: ${e instanceof Error ? e.message : String(e)}`);
      for (const f of llmFields) byField.set(f.id, empty(f.id));
    }
  }

  // 3) manual + remaining, in catalog order
  for (const f of fields) if (!byField.has(f.id)) byField.set(f.id, empty(f.id));
  return { values: fields.map((f) => byField.get(f.id)!), warnings, llmFailed, usedModel };
}

function locateValue(docs: ParsedDoc[], value: string): ExtractedValue["source"] {
  for (const d of docs) {
    const b = d.blocks.find((blk) => blk.text.includes(value));
    if (b) return { fileId: d.fileId, locator: locatorRu(b.locator) };
  }
  return { fileId: null, locator: "документ" };
}
