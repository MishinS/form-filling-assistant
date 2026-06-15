# Скан-декод + активная модель в UI + оверфлоу имени файла — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Раскодировать числовые XML-сущности в скан-промпте (фикс «поля не распознаются»), показать активную модель в UI скана и извлечения, и обрезать длинное имя файла в модалке.

**Architecture:** Один self-contained фикс в `decodeXml` (скан-путь) + общий хелпер `modelLabel` в каталоге, который потребляют оба UI-потока, + два точечных правок в `NewTemplateModal`. Спека: `docs/superpowers/specs/2026-06-15-ffa-scan-decode-model-display-design.md`.

**Tech Stack:** Next.js 14 / TS / Vitest / fflate. Ветка `ffa-scan-decode-model-display` (от `main`@`24182f4`). Рабочая директория: `form_filling_assistent/web`.

---

### Task 1: Раскодировка числовых XML-сущностей в `decodeXml`

**Files:**
- Modify: `lib/templates/xlsx-scan.ts:10-11` (экспортировать `decodeXml`, добавить числовые ссылки)
- Test: `lib/templates/xlsx-scan.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Добавить в `lib/templates/xlsx-scan.test.ts` импорт `decodeXml`:

```ts
import { workbookSheets, sheetTexts, sheetsFromFiles, decodeXml } from "./xlsx-scan";
```

И новый блок (в конец файла):

```ts
describe("decodeXml", () => {
  it("decodes decimal numeric character references (Cyrillic)", () => {
    // &#1055;&#1051;&#1040;&#1058; = ПЛАТ
    expect(decodeXml("&#1055;&#1051;&#1040;&#1058;")).toBe("ПЛАТ");
  });
  it("decodes hex numeric character references", () => {
    // &#x41F; = 0x41F = 1055 = П
    expect(decodeXml("&#x41F;")).toBe("П");
  });
  it("still decodes named entities", () => {
    expect(decodeXml("&lt;a&gt; &amp; &quot;x&quot; &apos;y&apos;")).toBe(`<a> & "x" 'y'`);
  });
  it("does NOT mis-decode a literal &amp;#1055; into П", () => {
    // raw text that means the literal string "&#1055;" must stay literal
    expect(decodeXml("&amp;#1055;")).toBe("&#1055;");
  });
});

describe("sheetTexts numeric entities", () => {
  it("decodes numeric-entity cell text to readable Cyrillic", () => {
    const bytes = zipSync({
      "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="ПТ" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`),
      "xl/worksheets/sheet1.xml": strToU8(
        `<worksheet><sheetData>` +
        `<row r="1"><c r="B1" t="inlineStr"><is><t>&#1055;&#1051;&#1040;&#1058;&#1045;&#1046;</t></is></c></row>` +
        `</sheetData></worksheet>`),
    });
    expect(sheetTexts(bytes)[0].lines).toEqual(["B1: ПЛАТЕЖ"]);
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `npx vitest run lib/templates/xlsx-scan.test.ts --no-coverage`
Expected: FAIL — `decodeXml` не экспортирован / числовые ссылки не раскодированы (`&#1055;…` остаётся как есть).

- [ ] **Step 3: Реализовать фикс**

В `lib/templates/xlsx-scan.ts` заменить строки 10-11:

```ts
// Decode XML char references. Numeric refs (&#NNNN; / &#xHHHH;) MUST be decoded
// BEFORE &amp;→& so a literal "&amp;#1055;" is not mis-decoded into a Cyrillic char.
// This образец-class file stores Cyrillic as numeric refs; without this the LLM
// scan prompt gets unreadable, ~3x-bloated text and times out (see spec).
export const decodeXml = (s: string) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `npx vitest run lib/templates/xlsx-scan.test.ts --no-coverage`
Expected: PASS (все, включая прежние shared/inline/numeric тесты).

- [ ] **Step 5: Commit**

```bash
git add lib/templates/xlsx-scan.ts lib/templates/xlsx-scan.test.ts
git commit -m "fix(scan): decode numeric XML char refs so Cyrillic templates are readable to the LLM

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Общий хелпер `modelLabel(id)` в каталоге

**Files:**
- Modify: `lib/extract/llm/catalog.ts` (добавить экспорт `modelLabel`)
- Test: `lib/extract/llm/catalog.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Добавить в `lib/extract/llm/catalog.test.ts`: расширить импорт и новый блок.

```ts
import { FREE_MODELS, FREE_MODEL_IDS, DEFAULT_MODEL, isFreeSlug, PAID_LAST_RESORT, isPaidModel, modelLabel } from "./catalog";
```

```ts
describe("modelLabel", () => {
  it("resolves a free slug to its catalog name", () => {
    expect(modelLabel(FREE_MODELS[0].id)).toBe(FREE_MODELS[0].name);
  });
  it("resolves the paid last-resort slug to its name (marked платная)", () => {
    expect(modelLabel(PAID_LAST_RESORT.id)).toBe(PAID_LAST_RESORT.name);
    expect(modelLabel(PAID_LAST_RESORT.id)).toContain("платная");
  });
  it("falls back to the raw slug for an unknown model", () => {
    expect(modelLabel("acme/unknown-model")).toBe("acme/unknown-model");
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `npx vitest run lib/extract/llm/catalog.test.ts --no-coverage`
Expected: FAIL — `modelLabel` не экспортирован.

- [ ] **Step 3: Реализовать**

В конец `lib/extract/llm/catalog.ts`:

```ts
// Friendly display name for any model slug, across the free pool and the paid
// last-resort. Single source of truth for the picker, scan modal, and extraction
// Processing screen. Unknown slugs fall back to the slug itself.
export function modelLabel(id: string): string {
  return [...FREE_MODELS, PAID_LAST_RESORT].find((m) => m.id === id)?.name ?? id;
}
```

- [ ] **Step 4: Запустить тесты — убедиться, что проходят**

Run: `npx vitest run lib/extract/llm/catalog.test.ts --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/extract/llm/catalog.ts lib/extract/llm/catalog.test.ts
git commit -m "feat(catalog): modelLabel(id) — friendly name across free pool + paid last-resort

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `Processing.tsx` — использовать `modelLabel` (показывает платную модель именем)

**Files:**
- Modify: `components/wizard/Processing.tsx:6,24,41,63,65`

Контекст: экран извлечения уже показывает текущую модель (`Пробуем {current}…`), но локальный
`modelName` (стр. 24) ищет только в `FREE_MODELS`, поэтому платная `gpt-4.1-nano` показывается
сырым слагом. Заменяем на общий `modelLabel`.

- [ ] **Step 1: Изменить импорт каталога (стр. 6)**

```ts
import { FREE_MODELS, modelLabel } from "@/lib/extract/llm/catalog";
```

(`FREE_MODELS` остаётся — он нужен для switch-model пикера на стр. 162.)

- [ ] **Step 2: Удалить локальный хелпер (стр. 24)**

Удалить строку:

```ts
const modelName = (slug: string) => FREE_MODELS.find((m) => m.id === slug)?.name ?? slug;
```

- [ ] **Step 3: Заменить вызовы `modelName(` на `modelLabel(`**

Стр. 41: `setCurrent(modelName(modelId));` → `setCurrent(modelLabel(modelId));`
Стр. 63: `setCurrent(modelName(ev.model));` → `setCurrent(modelLabel(ev.model));`
Стр. 65: `failed.push(modelName(ev.model));` → `failed.push(modelLabel(ev.model));`

- [ ] **Step 4: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок (нет ссылок на удалённый `modelName`).

- [ ] **Step 5: Commit**

```bash
git add components/wizard/Processing.tsx
git commit -m "feat(extract): show paid last-resort by its friendly name on the Processing screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `NewTemplateModal.tsx` — имя текущей модели в прогрессе скана

**Files:**
- Modify: `lib/seed/pt.ts:168` (ключ `tpl_scan_model` — добавить `{name}`)
- Modify: `components/templates/NewTemplateModal.tsx:7,76-77,109-111`

- [ ] **Step 1: Добавить `{name}` в i18n-ключ `tpl_scan_model`**

`lib/seed/pt.ts` строка 168 заменить на:

```ts
  tpl_scan_model:         { ru: "Сканируем поля — {name} ({i}/{n})…", en: "Scanning fields — {name} ({i}/{n})…" },
```

- [ ] **Step 2: Импортировать `modelLabel` в модалке (стр. 7)**

Добавить к существующему импорту примитивов отдельную строку:

```ts
import { modelLabel } from "@/lib/extract/llm/catalog";
```

- [ ] **Step 3: Расширить `modelStage` именем модели (стр. 76-77)**

Заменить:

```ts
  const modelStage = (i: number, n: number) =>
    t("tpl_scan_model").replace("{i}", String(i)).replace("{n}", String(n));
```

на:

```ts
  const modelStage = (name: string, i: number, n: number) =>
    t("tpl_scan_model").replace("{name}", name).replace("{i}", String(i)).replace("{n}", String(n));
```

- [ ] **Step 4: Передать label модели в обработчике события `attempt` (стр. 109-111)**

Заменить ветку:

```ts
        else if (ev.type === "attempt") {
          const i = ev.index ?? 1; const n = ev.total ?? 1;
          setStage(modelStage(i, n)); setPct(30 + Math.round(((i - 1) / n) * 60));
        }
```

на:

```ts
        else if (ev.type === "attempt") {
          const i = ev.index ?? 1; const n = ev.total ?? 1;
          setStage(modelStage(modelLabel(ev.model), i, n)); setPct(30 + Math.round(((i - 1) / n) * 60));
        }
```

- [ ] **Step 5: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add components/templates/NewTemplateModal.tsx lib/seed/pt.ts
git commit -m "feat(templates): show the current model name in the scan progress

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `NewTemplateModal.tsx` — обрезать длинное имя файла

**Files:**
- Modify: `components/templates/NewTemplateModal.tsx:160-163`

Контекст: кнопка выбора файла рендерит `file.name` без ограничения, поэтому длинное имя с
подчёркиваниями вылезает за 480px-рамку модалки.

- [ ] **Step 1: Добавить обрезку в стиль кнопки**

Заменить (стр. 160-163):

```tsx
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              style={{ ...fieldStyle, textAlign: "left", cursor: "pointer", color: file ? "var(--text-1)" : "var(--text-3)" }}>
              {file ? file.name : "…"}
            </button>
```

на:

```tsx
            <button onClick={() => fileRef.current?.click()} disabled={busy} title={file ? file.name : undefined}
              style={{ ...fieldStyle, textAlign: "left", cursor: "pointer", color: file ? "var(--text-1)" : "var(--text-3)",
                display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {file ? file.name : "…"}
            </button>
```

(`title` показывает полное имя при наведении, раз визуально оно обрезано.)

- [ ] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add components/templates/NewTemplateModal.tsx
git commit -m "fix(templates): truncate a long uploaded file name to the modal width

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Финальная верификация

**Files:** нет (только прогон)

- [ ] **Step 1: Полный прогон Vitest**

Run: `npx vitest run --no-coverage`
Expected: PASS, число тестов выросло на 6 относительно базовых 298 (decodeXml 4 + sheetTexts-numeric 1 + modelLabel 3 = +8 → но catalog/scan считаются по `it()`; ожидаемо ~306). Зафиксировать фактическое число.

- [ ] **Step 2: Типы**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: только 2 предсуществующих `<img>`-warning, без новых ошибок.

- [ ] **Step 4: Build**

Run: `AUTH_SECRET=build-only npm run build`
Expected: зелёный билд; маршруты `/api/templates`, `/api/extract`, `/templates/[id]` присутствуют; `pt.xlsx` остаётся в nft-трейсе `/api/fill`.

- [ ] **Step 5: (опц.) живая проверка скан-фикса** — повторить репродукцию из спеки: реальный
`proposeFields` против `Платежное_требование_образец.xlsx` с `OPENROUTER_API_KEY` из `.env.local`
должен вернуть `failure=null` и непустой список полей (промпт ~3.8k символов, не 13.7k). Throwaway-скрипт удалить.

---

## Self-Review

**Spec coverage:**
- §1 скан-декод → Task 1 (числовые dec/hex + named + `&amp;#NNNN;` edge + sheetTexts-интеграция). ✓
- §2 активная модель: `modelLabel` → Task 2; извлечение → Task 3; скан-модалка → Task 4. ✓
- §3 оверфлоу имени файла → Task 5. ✓
- Тестирование/верификация → Task 6. ✓
- Non-goals (free-пул, `Лист!`, обрезка листов, глоб. статус-бар) — не порождают задач. ✓

**Placeholder scan:** нет TBD/«handle edge cases» — весь код приведён дословно. ✓

**Type consistency:** `decodeXml` экспортируется в Task 1 и импортируется в тестах того же файла; `modelLabel` определяется в Task 2 и импортируется в Tasks 3-4; `modelStage(name,i,n)` — новая сигнатура в Task 4 используется согласованно. ✓
