## Context

Throughput mode is three thin layers: `BatchModal` (state + rendering),
`run-batch.ts` (sequential driver that captures per-file rejections as
`items[i].error: string`), and `run-one.ts` (the upload → parse → extract → fill
pipeline). Failures cross those layers as `Error.message` strings, which is why
`run-one.ts` currently throws Russian prose and, at the fill step, the raw
response body — the modal prints whatever string it receives.

Repo conventions constrain the shape of the fix: logic belongs in pure `lib/`
modules with co-located Vitest tests, React components stay thin and are not
rendering-tested, and all user-facing strings go through `t()` / `STR` in
`lib/seed/pt.ts`. So the interesting decisions are about where the error
vocabulary lives and how it survives the `string`-typed channel through
`run-batch`.

## Goals / Non-Goals

**Goals:**
- Every batch failure mode reaches the user as a localized, bounded message.
- No transient failure can leave a control permanently disabled or the modal
  wedged in `running`.
- The extract-result parser rejects malformed terminal events at the boundary.
- New logic is pure and unit-tested; `BatchModal` only gains wiring.

**Non-Goals:**
- Changing `run-batch`'s `error?: string` item shape (a typed error union would
  ripple through the progress snapshot contract for no user-visible gain).
- Retry/resume of individual failed files.
- Reworking the dropzone's premature "OK" status (IN-04).

## Decisions

### Error vocabulary: encoded `code[:status]` strings in a new `lib/batch/errors.ts`

`run-batch` types the per-item failure as `string`, and that string is the only
thing the modal receives. Rather than widen that contract, `run-one.ts` throws
`Error`s whose message is an encoded token: `"fill_failed:502"`,
`"extract_empty"`. A pure pair of functions owns the format:

```ts
export type BatchErrorCode =
  | "parse_failed" | "parse_empty" | "extract_failed"
  | "extract_empty" | "llm_failed" | "fill_failed";
export function batchError(code: BatchErrorCode, status?: number): Error;
export function decodeBatchError(raw: string): { code: BatchErrorCode; status?: number } | null;
```

`decodeBatchError` returns `null` for anything not in the known-code set, which
is what makes the "never render a raw body" guarantee structural rather than
incidental. The display side is a third pure function in the same module —
`formatBatchError(raw, t)` — returning `t("batch_err_" + code)` (plus ` (status)`
when present) on a decode hit and `t("batch_failed")` on `null`; the modal only
calls it. Keeping the assembly in `lib/` rather than the component is what makes
the guarantee testable at all, since React components here are not
rendering-tested. An unexpected rejection from anywhere in the pipeline — a
`TypeError`, an HTML page, a JSON blob — decodes to `null` and collapses to the
generic label.

*Alternatives considered:* (a) a custom `BatchError` class with fields — lost
across `run-batch`'s `e instanceof Error ? e.message : String(e)` normalization,
so it would have required changing the driver too; (b) translating inside
`run-one.ts` by passing `t` in — puts i18n into a pure pipeline module and makes
messages untranslatable after a language switch; (c) sending the status through a
separate item field — same driver-contract widening as (a).

### Field-mapping failures: absence means "unknown", not "empty"

`selectTpl` caches into `customFields[id]`; `undefined` already means "not
fetched yet" and drives the fetch guard. The fix keeps that meaning and simply
never writes on failure — `r.ok` is checked before `r.json()`, and both the
non-ok and the rejection path leave the key unset while setting a
`fieldsErr` flag. Re-selecting the template therefore retries naturally, with no
new sentinel value to thread through `fields`.

*Alternative considered:* storing `null` for "failed" (the audit's second
suggestion). It distinguishes the states in the cache, but then re-selection no
longer retries — a manual retry affordance would have to be built. Unset +
error flag gets both properties for less code.

### Download: mirror `DoneStep`, don't abstract it

`DoneStep.downloadExcel` already has the exact save-and-report shape (Tauri →
`saveFile` + `dl_saved_to` toast; browser → object URL; `catch` → `dl_excel_err`).
`BatchModal.download` copies that shape rather than extracting a shared helper:
the two differ in payload (single xlsx vs zipped bytes), filename derivation, and
the `saved` bookkeeping, so a shared helper would be mostly parameters. `setSaved(true)`
moves inside the success path so a failed save keeps the unsaved-results
confirmation armed.

### Extract-result validation: skip, don't throw

`parseExtractResult` returns `ExtractResult | null` and callers already treat
`null` as "empty extraction result". A malformed `result` line is therefore
`continue`d rather than thrown on, and `run-one.ts` turns the resulting `null`
into `extract_empty` — one failure path instead of two, and the parser stays
total.

## Risks / Trade-offs

- **Error text wording changes for existing users** → Codes map to strings that
  keep the current Russian phrasing, so RU users see the same messages; only the
  fill-step message changes (from a raw body to a phrase + status).
- **Encoded strings are stringly-typed** → The encode/decode pair is the single
  owner of the format and is unit-tested, including round-trips and the
  unknown-token fallback; nothing else parses the message.
- **A code added in `run-one.ts` without a matching `STR` entry would render the
  raw key** → `t()` returns the key when a string is missing, which is visible but
  harmless; a test asserts every `BatchErrorCode` has a `batch_err_*` entry in
  both locales.
- **`try/finally` in `run()` could clear `running` while in-flight requests
  continue** → `runBatch` awaits the whole sequential loop, so `finally` only runs
  after the last file settles; the guarantee is strictly stronger than today.
