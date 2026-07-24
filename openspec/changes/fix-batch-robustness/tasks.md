## 1. Error vocabulary (`lib/batch/errors.ts`)

- [x] 1.1 Write failing `lib/batch/errors.test.ts`: `batchError("fill_failed", 502)`
  round-trips through `decodeBatchError` to `{ code: "fill_failed", status: 502 }`;
  a code without status round-trips to `{ code }` with no `status`;
  `decodeBatchError` returns `null` for raw bodies (`"<html>…"`, `"{\"error\":1}"`,
  `""`, `"parse_failed:abc"`, unknown codes). **Test:** `lib/batch/errors.test.ts` (red).
- [x] 1.2 Implement `BatchErrorCode`, `BATCH_ERROR_CODES`, `batchError`,
  `decodeBatchError` per design (`code` or `code:status` message format).
  **Test:** `lib/batch/errors.test.ts` (green).
- [x] 1.3 Add `batch_err_*` RU + EN strings to `lib/seed/pt.ts` for every code
  (RU wording preserved from the current literals), plus `batch_fields_err`
  ("Не удалось загрузить поля шаблона" / EN) for the mapping-load failure hint.
  **Test:** `lib/batch/errors.test.ts` — "has an RU and EN string for every code"
  iterates `BATCH_ERROR_CODES` against `STR`.

## 2. Extract-result validation (`lib/batch/extract-result.ts`)

- [x] 2.1 Extend `lib/batch/extract-result.test.ts` with failing cases: a
  terminal `{"type":"result"}` with no `values` / `values: null` / `values: 42` is
  skipped (parser returns `null`, or an earlier valid result stands); a valid
  result missing `warnings` / `llmFailed` / `usedModel` normalizes to `[]`,
  `false`, `null`. **Test:** `lib/batch/extract-result.test.ts` (red — 4 failures).
- [x] 2.2 Shape-check the terminal event in `parseExtractResult`: `continue` when
  `values` is not an array, normalize the remaining fields. **Test:**
  `lib/batch/extract-result.test.ts` 7/7 green, race-noise cases still pass.

## 3. Pipeline errors (`lib/batch/run-one.ts`)

- [x] 3.1 Replace the four Russian literals and the raw-body throw with
  `batchError(...)`: `parse_failed` + status, `parse_empty`, `extract_failed` +
  status, `extract_empty`, `llm_failed`, and `fill_failed` + `fRes.status`
  (`await fRes.text()` dropped). **Test:** `npx tsc --noEmit` clean; the emitted
  codes are the same union covered by `lib/batch/errors.test.ts`. Runtime
  behavior against a real failing `/api/fill` → task 5.4.

## 4. Batch modal wiring (`components/batch/BatchModal.tsx`)

- [x] 4.1 Render per-file errors through `formatBatchError(it.error, t)`.
  **Deviation from design:** the localized-text assembly was moved out of the
  component into `lib/batch/errors.ts` (`formatBatchError(raw, t)`), because the
  repo does not rendering-test React — keeping it in the component would have
  left the "localized message + status, generic label for anything unknown"
  guarantee unverifiable. **Test:** `lib/batch/errors.test.ts` → `formatBatchError`
  suite: RU/EN wording with `(502)`, no-status case, every code resolves a real
  string in both locales (no raw key, not the generic label), and HTML/JSON/empty
  payloads collapse to «Ошибка» / "Failed".
- [x] 4.2 Wrap `download()` in try/catch: on the Tauri branch toast
  `${t("dl_saved_to")} ${path}`, in the browser toast `t("dl_saved")`, on failure
  toast `t("dl_excel_err")`, with `setSaved(true)` moved into the success path only
  (`useToast` as in `DoneStep`). **Test:** `npx tsc --noEmit` + lint clean;
  behavior → task 5.4.
- [x] 4.3 Fix `selectTpl`: check `r.ok` before `r.json()`, leave
  `customFields[id]` unset on any failure, set/clear the `fieldsErr` flag, and
  render the `batch_fields_err` hint under the template picker. **Test:**
  `npx tsc --noEmit` + lint clean; behavior → task 5.4.
- [x] 4.4 Wrap the body of `run()` in `try { … } finally { setRunning(false); }`
  and drop the removed id from `rawFiles` in `removeFile`. **Test:**
  `npx tsc --noEmit` + lint clean; behavior → task 5.4.

## 5. Verification

- [x] 5.1 Batch suite green: `npx vitest run lib/batch` → 4 files, 25 tests pass.
- [x] 5.2 Full suite, typecheck, lint: `npx vitest run` → 75 files / 509 tests
  pass; `npx tsc --noEmit` exits 0; `npm run lint` reports 0 errors (2 pre-existing
  `<img>` warnings in `ProfileCard`/`Sidebar`, untouched by this change).
- [x] 5.3 `npx openspec validate --strict fix-batch-robustness` → valid.
- [ ] 5.4 Manual UAT in the running app (not performed — needs a live session with
  templates and source files):
  (a) force `/api/fill` to fail → the row shows the localized message with the
  status and no response body; switch language → the message follows;
  (b) desktop: point the download dir at an unwritable path → error toast, and a
  subsequent backdrop click still asks for the discard confirmation;
  (c) make `/api/mappings` fail → the field-load hint appears instead of a silently
  disabled Run; re-selecting the template after recovery loads fields and enables Run;
  (d) remove a file before Run → the batch still runs with the remaining files.
