// LLM scan of an uploaded template: propose fillable fields from sheet texts.
// Deliberately independent of the user's extraction-model pick: tries the OpenRouter
// free pool first, then the paid last-resort as a guaranteed tail, and never throws.
// failure codes:
//   "llm"      — no model produced a usable answer (key missing / rejected / junk content);
//   "nofields" — a model UNDERSTOOD the schema (valid {"fields":[…]}), but no field survived.
// Junk (non-JSON / no fields[]) counts as "llm", not "nofields": a weak router-routed
// model's garbage must not masquerade as «модель не распознала поля» — the honest
// verdict is pool failure, and retry is the right affordance.
// The caller (POST /api/templates) blocks template creation on any failure.
import { FREE_MODEL_IDS, PAID_LAST_RESORT } from "@/lib/extract/llm/catalog";
import { PAID_TIMEOUT_MS } from "@/lib/extract/llm/openrouter";
import { raceModels, type Racer } from "@/lib/extract/llm/race";
import type { ExtractField } from "@/lib/extract/fields";
import type { FieldKind } from "@/lib/types";
import type { OnAttempt } from "@/lib/extract/llm/types";
import { validateCellRef } from "./cellref";
import type { SheetText } from "./xlsx-scan";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const KINDS: FieldKind[] = ["string", "amount", "date", "text"];
const MAX_FIELDS = 40;

// Scan answers are small (capped sheet lines) and fast — healthy models respond ≤2s
// locally, ≤10s on Vercel. A tighter per-attempt timeout than extraction's 30s lets
// the chain survive two hung models within the shared 50s CHAIN_DEADLINE_MS.
const SCAN_ATTEMPT_TIMEOUT_MS = 20_000;

export type ScanFailure = "llm" | "nofields";
export interface ScanResult { fields: ExtractField[]; failure: ScanFailure | null }

export function buildScanPrompt(sheets: SheetText[]): string {
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

/** Coerce raw LLM/`client field objects into validated ExtractFields against the
 *  allowed sheet names. Drops fields with no label; caps at MAX_FIELDS. By default
 *  also drops fields with an unresolvable cell ref (strict — cloud pool). With
 *  `keepUnmapped`, such fields are KEPT with `cell: ""` so a weak local model that
 *  returns labels-without-cells still yields a template; the user then assigns the
 *  cells in the mapping editor (fillCustomXlsx skips empty-cell fields). Shared by
 *  parseProposal (server pool) and the desktop local-scan path. */
export function coerceFields(
  raw: unknown[], sheetNames: string[], opts?: { keepUnmapped?: boolean },
): ExtractField[] {
  const out: ExtractField[] = [];
  for (const item of raw) {
    if (out.length >= MAX_FIELDS) break;
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const label = pickLabel(f);
    if (!label) continue;
    const kind = typeof f.kind === "string" && KINDS.includes(f.kind as FieldKind) ? (f.kind as FieldKind) : "string";
    const cell = validateCellRef(typeof f.cell === "string" ? f.cell : "", sheetNames);
    if (!cell.ok && !opts?.keepUnmapped) continue;
    out.push({
      id: `f${out.length + 1}`,
      group: "req",
      label_ru: label,
      label_en: typeof f.label_en === "string" && f.label_en.trim() ? f.label_en.trim() : label,
      cell: cell.ok ? cell.normalized : "",
      kind,
      required: false,
      strategy: "llm",
    });
  }
  return out;
}

// null = junk (not JSON / no fields[] array); otherwise the coerced field list.
function parseProposal(txt: string, sheetNames: string[]): ExtractField[] | null {
  const cleaned = txt.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: { fields?: unknown };
  try {
    parsed = JSON.parse(cleaned) as { fields?: unknown };
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.fields)) return null;
  return coerceFields(parsed.fields, sheetNames);
}

/** Propose fields for an uploaded template. Never throws; see ScanFailure. */
export async function proposeFields(sheets: SheetText[], onAttempt?: OnAttempt): Promise<ScanResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { fields: [], failure: "llm" };
  // Drop empty sheets (blank «Лист1», helper tabs) — they bloat the prompt and would
  // hijack sheet-less cell qualification (a bare "B1" must resolve to the first sheet
  // WITH content, not a leading empty one). Keep all if every sheet is empty.
  const withContent = sheets.filter(s => s.lines.length > 0);
  const formSheets = withContent.length > 0 ? withContent : sheets;
  const prompt = buildScanPrompt(formSheets);
  const sheetNames = formSheets.map(s => s.name);

  const makeRacer = (model: string): Racer<ExtractField[]> => ({
    model,
    run: async (signal) => {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { win: false, reason: `HTTP ${res.status}` };
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";
      const fields = parseProposal(content, sheetNames);
      if (fields === null) return { win: false, reason: "bad json" };
      if (fields.length === 0) return { win: false, reason: "no fields", understood: true };
      return { win: true, value: fields };
    },
  });

  const free = await raceModels(FREE_MODEL_IDS.map(makeRacer), { timeoutMs: SCAN_ATTEMPT_TIMEOUT_MS, onAttempt });
  if (free.ok) return { fields: free.value, failure: null };

  const paid = await raceModels([makeRacer(PAID_LAST_RESORT.id)], { timeoutMs: PAID_TIMEOUT_MS, onAttempt });
  if (paid.ok) return { fields: paid.value, failure: null };

  const understood = [...free.failures, ...paid.failures].some(f => f.understood);
  return { fields: [], failure: understood ? "nofields" : "llm" };
}
