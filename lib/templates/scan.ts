// LLM scan of an uploaded template: propose fillable fields from sheet texts.
// Deliberately independent of the user's extraction-model pick: uses the
// OpenRouter free chain only, and NEVER throws — a failed scan returns []
// (the template is then created with no fields; the editor's «+ поле» covers it).
import { FREE_MODEL_IDS } from "@/lib/extract/llm/catalog";
import type { ExtractField } from "@/lib/extract/fields";
import type { FieldKind } from "@/lib/types";
import { validateCellRef } from "./cellref";
import type { SheetText } from "./xlsx-scan";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const KINDS: FieldKind[] = ["string", "amount", "date", "text"];
const MAX_FIELDS = 40;

function buildScanPrompt(sheets: SheetText[]): string {
  const body = sheets
    .map(s => `### Лист "${s.name}"\n${s.lines.join("\n") || "(пусто)"}`)
    .join("\n\n");
  return (
    "Это содержимое XLSX-формы (ячейка: значение). Определи ЗАПОЛНЯЕМЫЕ поля формы: " +
    "подписи-метки и ПУСТЫЕ ячейки рядом с ними, куда вписывают значение. " +
    'Ответь СТРОГО валидным JSON вида {"fields":[{"label_ru":"...","label_en":"...","cell":"Лист!A1","kind":"string|amount|date|text"}]} ' +
    "без markdown и пояснений. cell — ячейка ДЛЯ ЗНАЧЕНИЯ (не ячейка подписи), с именем листа.\n\n" +
    body
  );
}

function parseProposal(txt: string, sheetNames: string[]): ExtractField[] {
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: { fields?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { fields?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.fields)) return [];
  const out: ExtractField[] = [];
  for (const raw of parsed.fields) {
    if (out.length >= MAX_FIELDS) break;
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.label_ru !== "string" || !f.label_ru.trim()) continue;
    const kind = typeof f.kind === "string" && KINDS.includes(f.kind as FieldKind) ? (f.kind as FieldKind) : null;
    if (!kind) continue;
    const cell = validateCellRef(typeof f.cell === "string" ? f.cell : "", sheetNames);
    if (!cell.ok) continue;
    out.push({
      id: `f${out.length + 1}`,
      group: "req",
      label_ru: f.label_ru.trim(),
      label_en: typeof f.label_en === "string" && f.label_en.trim() ? f.label_en.trim() : f.label_ru.trim(),
      cell: cell.normalized,
      kind,
      required: false,
      strategy: "llm",
    });
  }
  return out;
}

/** Propose fields for an uploaded template. Returns [] on any failure. */
export async function proposeFields(sheets: SheetText[]): Promise<ExtractField[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return [];
  const prompt = buildScanPrompt(sheets);
  const sheetNames = sheets.map(s => s.name);
  for (const model of FREE_MODEL_IDS) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const fields = parseProposal(data.choices?.[0]?.message?.content ?? "", sheetNames);
      if (fields.length > 0) return fields;
    } catch {
      // network/parse failure → next candidate
    }
  }
  return [];
}
