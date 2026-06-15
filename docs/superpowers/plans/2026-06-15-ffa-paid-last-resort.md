# Платный last-resort (gemini-2.5-flash-lite) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить одну платную модель `google/gemini-2.5-flash-lite` как гарантированный last-resort в обе LLM-цепочки (извлечение полей и скан шаблона), чтобы операция всегда завершалась реальным результатом, когда free-пул OpenRouter перегружен/завис.

**Architecture:** Платная модель — отдельная константа `PAID_LAST_RESORT` (НЕ внутри `FREE_MODELS`, чтобы не ломать семантику free-каталога). Обе цепочки строят список кандидатов так, что платная либо выбранный primary (впереди), либо зарезервированный хвост (в конце). Резервирование бюджета: free-фаза крутится до `FREE_PHASE_DEADLINE_MS=35с`, затем платному хвосту гарантированно отдаётся `PAID_TIMEOUT_MS=12с` в пределах `CHAIN_DEADLINE_MS=50с` (< route maxDuration 60с) → терминальный результат всегда успевает флашнуться.

**Tech Stack:** TypeScript, Next.js 14 (App Router), Vitest, OpenRouter (OpenAI-совместимый chat/completions).

**Spec:** `docs/superpowers/specs/2026-06-15-ffa-paid-last-resort-design.md`

---

## File Structure

- `lib/extract/llm/catalog.ts` — **Modify.** Новая константа `PAID_LAST_RESORT` + хелпер `isPaidModel`. `FREE_MODELS`/`FREE_MODEL_IDS`/`DEFAULT_MODEL` не меняются.
- `lib/extract/llm/catalog.test.ts` — **Modify.** Тесты для `PAID_LAST_RESORT`/`isPaidModel`.
- `lib/extract/llm/openrouter.ts` — **Modify.** Константы `FREE_PHASE_DEADLINE_MS`/`PAID_TIMEOUT_MS`; построение кандидатов с платным хвостом; reserved-tail бюджет в цикле.
- `lib/extract/llm/openrouter.test.ts` — **Modify.** Новые тесты платного хвоста/primary/дедупа; обновить существующий deadline-тест.
- `lib/templates/scan.ts` — **Modify.** Аппенд платного хвоста + reserved-tail бюджет (переиспользует константы из openrouter).
- `lib/templates/scan.test.ts` — **Modify.** Обновить `total`-ассерт; добавить тест достижения платного хвоста.
- `components/shell/ModelSelect.tsx` — **Modify.** Рендер `[...FREE_MODELS, PAID_LAST_RESORT]`, бейдж «платная», поиск `cur` по объединённому списку, текст футера.

---

## Task 1: Каталог — `PAID_LAST_RESORT` + `isPaidModel`

**Files:**
- Modify: `lib/extract/llm/catalog.ts`
- Test: `lib/extract/llm/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Добавь в `lib/extract/llm/catalog.test.ts` новый импорт и describe-блок (рядом с существующим `free-model catalog`):

```ts
import { PAID_LAST_RESORT, isPaidModel } from "./catalog";

describe("paid last-resort", () => {
  it("defines the paid last-resort model with a non-empty name/provider", () => {
    expect(PAID_LAST_RESORT.id).toBe("google/gemini-2.5-flash-lite");
    expect(PAID_LAST_RESORT.name.length).toBeGreaterThan(0);
    expect(PAID_LAST_RESORT.provider.length).toBeGreaterThan(0);
  });

  it("is NOT part of the free chain (free-caталог semantics intact)", () => {
    expect(FREE_MODEL_IDS).not.toContain(PAID_LAST_RESORT.id);
    expect(isFreeSlug(PAID_LAST_RESORT.id)).toBe(false);
  });

  it("isPaidModel matches only the paid id", () => {
    expect(isPaidModel(PAID_LAST_RESORT.id)).toBe(true);
    expect(isPaidModel("openai/gpt-oss-120b:free")).toBe(false);
    expect(isPaidModel("openrouter/free")).toBe(false);
  });
});
```

(`FREE_MODEL_IDS`/`isFreeSlug` уже импортированы в этом файле — добавь только `PAID_LAST_RESORT, isPaidModel` к существующему import-стейтменту или отдельной строкой.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/extract/llm/catalog.test.ts`
Expected: FAIL — `PAID_LAST_RESORT`/`isPaidModel` не экспортированы.

- [ ] **Step 3: Write minimal implementation**

В `lib/extract/llm/catalog.ts` добавь в конец файла (после `isFreeSlug`):

```ts
// A single PAID model used as a guaranteed last-resort when the free pool is
// exhausted/hung. Kept OUT of FREE_MODELS so the free-каталог and its tests stay
// "everything here is free"; the picker and both chains append it explicitly.
// Billed via OpenRouter credits (account is_free_tier:false) — the proxy avoids
// the regional geoblock that killed the direct free-Gemini tier earlier.
export const PAID_LAST_RESORT = {
  id: "google/gemini-2.5-flash-lite",
  name: "Gemini 2.5 Flash Lite (платная)",
  provider: "Google",
};

export function isPaidModel(id: string): boolean {
  return id === PAID_LAST_RESORT.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/extract/llm/catalog.test.ts`
Expected: PASS (все catalog-тесты, старые + новые).

- [ ] **Step 5: Commit**

```bash
git add lib/extract/llm/catalog.ts lib/extract/llm/catalog.test.ts
git commit -m "feat(catalog): PAID_LAST_RESORT gemini-2.5-flash-lite + isPaidModel"
```

---

## Task 2: Извлечение — платный хвост + reserved-tail бюджет (`openrouter.ts`)

**Files:**
- Modify: `lib/extract/llm/openrouter.ts`
- Test: `lib/extract/llm/openrouter.test.ts`

- [ ] **Step 1: Write the failing tests**

Добавь в `lib/extract/llm/openrouter.test.ts` (внутри `describe("openrouterModel", …)`) три новых теста:

```ts
const PAID = "google/gemini-2.5-flash-lite";
const okFields = (fields: unknown[]) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ fields }) } }] }));

it("falls back to the paid last-resort after the free pool is exhausted", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  global.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string) as { model: string };
    if (body.model === PAID) return okFields([{ fieldId: "f1", value: "X", confidence: "high" }]);
    return new Response("rate limited", { status: 429 });
  }) as unknown as typeof fetch;

  const events: AttemptEvent[] = [];
  const out = await openrouterModel(MODEL).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
  expect(out).toEqual([{ fieldId: "f1", value: "X", confidence: "high" }]);
  const starts = events.filter((e) => e.phase === "start");
  expect(starts[starts.length - 1].model).toBe(PAID); // paid is the appended tail
});

it("runs the paid model first when it is the selected primary", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  global.fetch = vi.fn(async () => okFields([])) as unknown as typeof fetch;
  const events: AttemptEvent[] = [];
  await openrouterModel(PAID).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
  expect(events[0]).toMatchObject({ phase: "start", model: PAID, index: 1 });
  expect(global.fetch).toHaveBeenCalledTimes(1); // succeeded first → no fallback needed
});

it("does not duplicate the paid model when it is primary (dedup)", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  let call = 0;
  global.fetch = vi.fn(async () => {
    call += 1;
    if (call === 1) return new Response("err", { status: 429 }); // paid primary fails
    return okFields([]); // first free fallback succeeds
  }) as unknown as typeof fetch;
  const events: AttemptEvent[] = [];
  await openrouterModel(PAID).extract(PT_FIELDS, "текст", (ev) => events.push(ev));
  const paidStarts = events.filter((e) => e.phase === "start" && e.model === PAID);
  expect(paidStarts).toHaveLength(1); // appears once, NOT re-appended as a tail
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/extract/llm/openrouter.test.ts`
Expected: FAIL — текущая цепочка не аппендит платную (для free primary с 429 пула выбрасывает HTTP 429 вместо вызова PAID); paid primary гонит одну модель без free-резерва.

- [ ] **Step 3: Add the budget constants**

В `lib/extract/llm/openrouter.ts` после строки `export const CHAIN_DEADLINE_MS = 50_000;` добавь:

```ts
// The free pool runs only until FREE_PHASE_DEADLINE_MS so a slice of the chain
// budget is RESERVED for the paid last-resort tail — a hung free model must not
// starve it. The tail then runs under PAID_TIMEOUT_MS within CHAIN_DEADLINE_MS.
// Worst case: 35s free phase + 12s paid = 47s < 50s deadline < 60s route maxDuration.
// Exported for lib/templates/scan.ts, which reuses the same reservation.
export const FREE_PHASE_DEADLINE_MS = 35_000;
export const PAID_TIMEOUT_MS = 12_000;
```

- [ ] **Step 4: Update the imports**

В `lib/extract/llm/openrouter.ts` замени:

```ts
import { FREE_MODEL_IDS, isFreeSlug } from "./catalog";
```

на:

```ts
import { FREE_MODEL_IDS, isFreeSlug, isPaidModel, PAID_LAST_RESORT } from "./catalog";
```

- [ ] **Step 5: Rewrite candidate building**

В `openrouterModel(...).extract`, замени блок:

```ts
      // Primary first, then the curated chain (deduped) — for any free slug,
      // including the openrouter/free auto-router (no ":free" suffix).
      const candidates = isFreeSlug(modelName)
        ? [modelName, ...FREE_FALLBACKS.filter((m) => m !== modelName)]
        : [modelName];
```

на:

```ts
      // Build the candidate chain so the paid last-resort is ALWAYS present:
      //   free primary → [free, ...free pool, PAID tail]
      //   paid primary → [PAID, ...free pool]   (user opted in; paid runs first)
      //   unknown slug → [slug, PAID tail]      (preserve degradation, still backed)
      let candidates: string[];
      if (isPaidModel(modelName)) {
        candidates = [modelName, ...FREE_FALLBACKS];
      } else if (isFreeSlug(modelName)) {
        candidates = [modelName, ...FREE_FALLBACKS, PAID_LAST_RESORT.id];
      } else {
        candidates = [modelName, PAID_LAST_RESORT.id];
      }
      candidates = Array.from(new Set(candidates));

      // The reserved paid tail is the paid model only when it sits AFTER the primary
      // (index > 0). As primary (index 0) it just runs first under the normal budget.
      const paidIdx = candidates.indexOf(PAID_LAST_RESORT.id);
      const paidTailIdx = paidIdx > 0 ? paidIdx : -1;
```

- [ ] **Step 6: Rewrite the per-attempt budget in the loop**

Замени начало тела цикла:

```ts
      for (let i = 0; i < candidates.length; i++) {
        const remaining = CHAIN_DEADLINE_MS - (Date.now() - t0);
        if (remaining <= 0) break;
        const model = candidates[i];
        onAttempt?.({ phase: "start", model, index: i + 1, total: candidates.length });
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), Math.min(ATTEMPT_TIMEOUT_MS, remaining));
```

на:

```ts
      for (let i = 0; i < candidates.length; i++) {
        const elapsed = Date.now() - t0;
        const isTail = i === paidTailIdx;
        // Free candidates are bounded by the free-phase deadline when a paid tail is
        // reserved after them; the tail itself runs under the full chain deadline.
        const phaseDeadline = isTail || paidTailIdx < 0 ? CHAIN_DEADLINE_MS : FREE_PHASE_DEADLINE_MS;
        const phaseRemaining = phaseDeadline - elapsed;
        if (phaseRemaining <= 0) continue; // free phase exhausted → fall through to the paid tail
        const model = candidates[i];
        onAttempt?.({ phase: "start", model, index: i + 1, total: candidates.length });
        const perAttempt = isTail ? PAID_TIMEOUT_MS : ATTEMPT_TIMEOUT_MS;
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), Math.min(perAttempt, phaseRemaining));
```

(Остальное тело цикла — fetch/parse/catch/finally — без изменений.)

- [ ] **Step 7: Update the existing overall-deadline test**

Бюджет изменился: free-фаза (35с) сжигает primary(30с)+одну free(5с), затем зарезервированный платный хвост стартует в пределах 50с. Замени в тесте `"stops the chain at the overall deadline so the route can flush a terminal result"` хвост ассертов:

```ts
    // attempt 1 burns 30s, attempt 2 is capped to the 20s left; nothing may start past 50s
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(events.filter((e) => e.phase === "start")).toHaveLength(2);
```

на:

```ts
    // free phase (35s) burns primary(30s)+one free(5s); the RESERVED paid tail then
    // runs within the 50s chain deadline → 3 attempts, last is the paid last-resort.
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const starts = events.filter((e) => e.phase === "start");
    expect(starts).toHaveLength(3);
    expect(starts[2].model).toBe("google/gemini-2.5-flash-lite");
```

(Ассерт `expect((err as Error).message).toContain("Таймаут");` остаётся — платный хвост тоже зависает в этом тесте и абортится с тем же сообщением.)

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run lib/extract/llm/openrouter.test.ts`
Expected: PASS (старые + 3 новых + обновлённый deadline-тест).

- [ ] **Step 9: Commit**

```bash
git add lib/extract/llm/openrouter.ts lib/extract/llm/openrouter.test.ts
git commit -m "feat(extract): платный last-resort хвост + reserved-tail бюджет в openrouter-цепочке"
```

---

## Task 3: Скан — платный хвост + reserved-tail бюджет (`scan.ts`)

**Files:**
- Modify: `lib/templates/scan.ts`
- Test: `lib/templates/scan.test.ts`

- [ ] **Step 1: Write the failing test + update the total assertion**

В `lib/templates/scan.test.ts` обнови ассерт в тесте `"emits onAttempt start/fail along the chain"`:

```ts
    expect(events[0]).toMatchObject({ phase: "start", model: expect.any(String), index: 1, total: FREE_MODEL_IDS.length });
```

на (платный хвост добавляет +1 кандидата):

```ts
    expect(events[0]).toMatchObject({ phase: "start", model: expect.any(String), index: 1, total: FREE_MODEL_IDS.length + 1 });
```

И добавь новый тест (рядом, внутри `describe("proposeFields", …)`):

```ts
it("falls back to the paid last-resort after the free pool fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string) as { model: string };
    if (body.model === "google/gemini-2.5-flash-lite") return okResponse(PROPOSAL);
    return { ok: false, status: 429 } as Response;
  }));
  const events: AttemptEvent[] = [];
  const { fields, failure } = await proposeFields(SHEETS, (ev) => events.push(ev));
  expect(failure).toBeNull();
  expect(fields).toHaveLength(1);
  const starts = events.filter((e) => e.phase === "start");
  expect(starts[starts.length - 1].model).toBe("google/gemini-2.5-flash-lite");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/templates/scan.test.ts`
Expected: FAIL — `total` всё ещё `FREE_MODEL_IDS.length`; платный слаг не входит в цепочку (все 429 → `failure:"llm"`).

- [ ] **Step 3: Update the imports**

В `lib/templates/scan.ts` замени:

```ts
import { FREE_MODEL_IDS } from "@/lib/extract/llm/catalog";
import { CHAIN_DEADLINE_MS } from "@/lib/extract/llm/openrouter";
```

на:

```ts
import { FREE_MODEL_IDS, PAID_LAST_RESORT } from "@/lib/extract/llm/catalog";
import { CHAIN_DEADLINE_MS, FREE_PHASE_DEADLINE_MS, PAID_TIMEOUT_MS } from "@/lib/extract/llm/openrouter";
```

- [ ] **Step 4: Rewrite the candidate list + loop budget**

В `proposeFields`, замени:

```ts
  const total = FREE_MODEL_IDS.length;
  let understood = false; // a model returned valid {"fields":[…]} → "nofields", not "llm"
  // Same budget guard as openrouter.ts: a hung model must not eat the route's
  // maxDuration=60 and kill the NDJSON stream before a terminal event is flushed.
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const remaining = CHAIN_DEADLINE_MS - (Date.now() - t0);
    if (remaining <= 0) break;
    const model = FREE_MODEL_IDS[i];
    onAttempt?.({ phase: "start", model, index: i + 1, total });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(SCAN_ATTEMPT_TIMEOUT_MS, remaining));
```

на:

```ts
  // The free pool first, then the paid last-resort as a guaranteed reserved tail.
  // Scan ignores the user's model pick by design, so the paid model is NEVER primary.
  const candidates = [...FREE_MODEL_IDS, PAID_LAST_RESORT.id];
  const total = candidates.length;
  const paidTailIdx = total - 1;
  let understood = false; // a model returned valid {"fields":[…]} → "nofields", not "llm"
  // Same budget guard as openrouter.ts: a hung model must not eat the route's
  // maxDuration=60 and kill the NDJSON stream before a terminal event is flushed.
  // The free phase is capped at FREE_PHASE_DEADLINE_MS so the paid tail keeps its slice.
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const elapsed = Date.now() - t0;
    const isTail = i === paidTailIdx;
    const phaseDeadline = isTail ? CHAIN_DEADLINE_MS : FREE_PHASE_DEADLINE_MS;
    const phaseRemaining = phaseDeadline - elapsed;
    if (phaseRemaining <= 0) continue; // free phase exhausted → reach the paid tail
    const model = candidates[i];
    onAttempt?.({ phase: "start", model, index: i + 1, total });
    const perAttempt = isTail ? PAID_TIMEOUT_MS : SCAN_ATTEMPT_TIMEOUT_MS;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(perAttempt, phaseRemaining));
```

(Остальное тело цикла — fetch/parseProposal/catch/finally и финальный `return` — без изменений.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/templates/scan.test.ts`
Expected: PASS (старые + обновлённый total + новый paid-fallback).

- [ ] **Step 6: Commit**

```bash
git add lib/templates/scan.ts lib/templates/scan.test.ts
git commit -m "feat(templates): платный last-resort хвост + reserved-tail бюджет в scan-цепочке"
```

---

## Task 4: Пикер — показать платную модель (`ModelSelect.tsx`)

**Files:**
- Modify: `components/shell/ModelSelect.tsx`

(Компонентных тестов нет — в проекте нет jsdom/testing-library; проверка через tsc/build в Task 5.)

- [ ] **Step 1: Update the import**

В `components/shell/ModelSelect.tsx` замени:

```ts
import { FREE_MODELS } from "@/lib/extract/llm/catalog";
```

на:

```ts
import { FREE_MODELS, PAID_LAST_RESORT, isPaidModel } from "@/lib/extract/llm/catalog";
```

- [ ] **Step 2: Build the combined list and fix `cur`**

Замени строку:

```ts
  const cur = FREE_MODELS.find(m => m.id === sel) ?? FREE_MODELS[0];
```

на:

```ts
  const MODELS = [...FREE_MODELS, PAID_LAST_RESORT];
  const cur = MODELS.find(m => m.id === sel) ?? MODELS[0];
```

- [ ] **Step 3: Render the combined list with a paid badge**

Замени `{FREE_MODELS.map(m => {` на `{MODELS.map(m => {`, и замени бейдж-span (единственная строка с `>free</span>`):

```tsx
                <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ok)", background: "var(--ok-bg)",
                  borderRadius: 99, padding: "2px 7px", flex: "none" }}>free</span>
```

на условный бейдж:

```tsx
                {isPaidModel(m.id) ? (
                  <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-2)", background: "var(--surface-hi)",
                    border: "1px solid var(--line-2)", borderRadius: 99, padding: "2px 7px", flex: "none" }}>платная</span>
                ) : (
                  <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ok)", background: "var(--ok-bg)",
                    borderRadius: 99, padding: "2px 7px", flex: "none" }}>free</span>
                )}
```

- [ ] **Step 4: Update the footer note**

Замени строку футера:

```tsx
            {lang === "ru" ? "Только бесплатные модели — без отдельной оплаты." : "Free models only — no extra billing."}
```

на:

```tsx
            {lang === "ru" ? "Бесплатные модели; платная — резерв при перегрузке." : "Free models; the paid one is a fallback when busy."}
```

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: clean (no errors).

- [ ] **Step 6: Commit**

```bash
git add components/shell/ModelSelect.tsx
git commit -m "feat(ui): пикер показывает платный резерв gemini с бейджем «платная»"
```

---

## Task 5: Полная верификация

**Files:** none (verification only).

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (допустимы только 2 предсуществующих `<img>`-варнинга — не из этой фичи).

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: PASS. Было 290 → стало ~296–298 (catalog +3, openrouter +3, scan +1). Точное число зафиксируй в коммит-сообщении/памяти.

- [ ] **Step 4: Build**

Run: `npx next build`
Expected: green; `/api/extract`, `/api/templates`, `/api/fill` присутствуют; `pt.xlsx` остаётся в `.next/server/app/api/fill/route.js.nft.json`.

Проверка nft-трейса:

Run: `grep -c "pt.xlsx" .next/server/app/api/fill/route.js.nft.json`
Expected: ≥ 1.

- [ ] **Step 5: Commit (если есть незакоммиченное)**

Если все правки уже закоммичены в задачах 1–4 — нечего коммитить, пропусти. Иначе:

```bash
git add -A
git commit -m "chore: финальная верификация платного last-resort"
```

---

## Self-Review (выполнено при написании плана)

**1. Покрытие спека:**
- Каталог `PAID_LAST_RESORT`/`isPaidModel` → Task 1. ✓
- Пикер показывает платную → Task 4. ✓
- Цепочка извлечения (free primary / paid primary / unknown slug + дедуп) → Task 2. ✓
- Цепочка скана (платный хвост всегда последний) → Task 3. ✓
- Резервирование бюджета (FREE_PHASE_DEADLINE_MS / PAID_TIMEOUT_MS) → Task 2 (константы) + Task 2/3 (логика). ✓
- Живой прогресс (`total`+1, имя платной) → покрыто изменениями onAttempt в Task 2/3 + резолв id→name в существующем UI (правок не требует). ✓
- Тесты (catalog/openrouter/scan) → Tasks 1–3. ✓
- Стоимость/баланс → документальная часть спека, кода не требует. ✓

**2. Плейсхолдеры:** нет — весь код приведён дословно.

**3. Согласованность типов/имён:** `PAID_LAST_RESORT.id` = `"google/gemini-2.5-flash-lite"` используется единообразно; `isPaidModel`, `FREE_PHASE_DEADLINE_MS`, `PAID_TIMEOUT_MS` объявлены в Task 1/2 и импортируются в Task 2/3/4 согласованно; `paidTailIdx` семантика (>0 = хвост, иначе primary/нет) идентична в openrouter.ts и scan.ts.

**Замечание для исполнителя:** правки в Task 2 (openrouter.ts) — связный контракт (константы + кандидаты + бюджет + обновление существующего deadline-теста); делай их одним коммитом, как описано. Не дроби деплой так, чтобы тесты падали между шагами.
