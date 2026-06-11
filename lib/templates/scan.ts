// LLM scan of an uploaded template: propose fillable fields from sheet texts.
// Deliberately independent of the user's extraction-model pick: uses the
// OpenRouter free chain only and never throws. failure codes:
//   "llm"      — no model produced a usable answer (key missing / all rejected);
//   "nofields" — a model answered, but no valid field survived parsing.
// The caller (POST /api/templates) blocks template creation on any failure.
import { FREE_MODEL_IDS } from "@/lib/extract/llm/catalog";
import { ATTEMPT_TIMEOUT_MS, CHAIN_DEADLINE_MS } from "@/lib/extract/llm/openrouter";
import type { ExtractField } from "@/lib/extract/fields";
import type { FieldKind } from "@/lib/types";
import type { OnAttempt } from "@/lib/extract/llm/types";
import { validateCellRef } from "./cellref";
import type { SheetText } from "./xlsx-scan";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const KINDS: FieldKind[] = ["string", "amount", "date", "text"];
const MAX_FIELDS = 40;

export type ScanFailure = "llm" | "nofields";
export interface ScanResult { fields: ExtractField[]; failure: ScanFailure | null }

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

// Models drift from the requested schema; recover the label from common variants.
function pickLabel(f: Record<string, unknown>): string | null {
  for (const key of ["label_ru", "label", "label_en"]) {
    const v = f[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
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
    const label = pickLabel(f);
    if (!label) continue;
    const kind = typeof f.kind === "string" && KINDS.includes(f.kind as FieldKind) ? (f.kind as FieldKind) : "string";
    // validateCellRef qualifies a sheet-less ref ("A1") with the first allowed sheet.
    const cell = validateCellRef(typeof f.cell === "string" ? f.cell : "", sheetNames);
    if (!cell.ok) continue;
    out.push({
      id: `f${out.length + 1}`,
      group: "req",
      label_ru: label,
      label_en: typeof f.label_en === "string" && f.label_en.trim() ? f.label_en.trim() : label,
      cell: cell.normalized,
      kind,
      required: false,
      strategy: "llm",
    });
  }
  return out;
}

/** Propose fields for an uploaded template. Never throws; see ScanFailure. */
export async function proposeFields(sheets: SheetText[], onAttempt?: OnAttempt): Promise<ScanResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { fields: [], failure: "llm" };
  const prompt = buildScanPrompt(sheets);
  const sheetNames = sheets.map(s => s.name);
  const total = FREE_MODEL_IDS.length;
  let sawResponse = false; // a model produced non-empty content → "nofields", not "llm"
  // Same budget guard as openrouter.ts: a hung model must not eat the route's
  // maxDuration=60 and kill the NDJSON stream before a terminal event is flushed.
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const remaining = CHAIN_DEADLINE_MS - (Date.now() - t0);
    if (remaining <= 0) break;
    const model = FREE_MODEL_IDS[i];
    onAttempt?.({ phase: "start", model, index: i + 1, total });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(ATTEMPT_TIMEOUT_MS, remaining));
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: ac.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        onAttempt?.({ phase: "fail", model, reason: `HTTP ${res.status}` });
        continue;
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";
      if (content.trim()) sawResponse = true;
      const fields = parseProposal(content, sheetNames);
      if (fields.length > 0) return { fields, failure: null };
      onAttempt?.({ phase: "fail", model, reason: "no fields" });
    } catch (e) {
      const reason = ac.signal.aborted
        ? `Таймаут ответа модели (${model})`
        : e instanceof Error ? e.message : String(e);
      onAttempt?.({ phase: "fail", model, reason });
    } finally {
      clearTimeout(timer);
    }
  }
  return { fields: [], failure: sawResponse ? "nofields" : "llm" };
}
