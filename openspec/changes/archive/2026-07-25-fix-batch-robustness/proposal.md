## Why

The 2026-07-23 audit found that throughput mode fails silently in every direction it can:
a Tauri save error during "Download all" is an unhandled rejection with zero feedback,
one transient mapping fetch permanently disables the Run button with no explanation,
a malformed extract stream is trusted as valid data, and a raw `/api/fill` response body
(possibly an HTML proxy error page) is rendered verbatim as the per-file error text.
Batch is the mode users hand their longest jobs to — a dead button or a swallowed failure
there costs minutes of work and offers no way to recover.

## What Changes

- **Download failures are surfaced.** `download()` in `BatchModal` wraps the save path in
  try/catch and reports through `useToast` — the saved path on the Tauri success path,
  `dl_excel_err` on failure — mirroring the established `DoneStep` pattern. `saved` is only
  set after the save actually succeeds, so the unsaved-results confirmation stays honest.
- **Template field-loading failures are recoverable.** `selectTpl` checks `r.ok`, and on
  failure leaves `customFields[id]` unset (so re-selecting the template retries) and renders
  a visible error hint instead of a silently disabled Run button. A genuinely empty field
  list stays distinct from a failed load.
- **The extract-result boundary validates.** `parseExtractResult` shape-checks the terminal
  `result` event: a line whose `values` is not an array is treated as malformed and skipped,
  and `warnings` / `llmFailed` / `usedModel` are normalized. A garbage stream now fails at the
  parse boundary with "empty extraction result" instead of posting `values: undefined` to
  `/api/fill`.
- **Per-file errors become stable codes, translated at render.** `lib/batch/run-one.ts` stops
  throwing hardcoded Russian prose and raw response bodies; it throws encoded
  `code[:status]` errors from a new `lib/batch/errors.ts`. `BatchModal` decodes and translates
  them via `t()`, falling back to the generic `batch_failed` label for anything it does not
  recognize — so unbounded HTML/JSON from a failing proxy can never reach the UI.
- **The modal cannot wedge.** `run()` gets `try/finally` around the batch so `setRunning(false)`
  always executes; `removeFile` also drops the `rawFiles` entry it was leaking.

## Capabilities

### New Capabilities

None — this hardens existing batch behavior.

### Modified Capabilities

- `batch-processing`: three requirements gain robustness guarantees — terminal-result parsing
  MUST validate the event shape and reject malformed results; per-file failures MUST be
  reported as localized messages derived from stable codes (never raw response bodies); and
  the batch UI MUST surface download failures and template field-load failures, must not
  leave the Run control permanently disabled after a transient failure, and must always leave
  the running state when a batch settles.

## Non-goals

- No change to the pipeline's sequencing, concurrency, or the ZIP packaging rules
  (settled by the `fix-batch-data-loss` change).
- No retry/resume of individual failed files — failures stay per-file and terminal for the run.
- Not fixing IN-04 (files shown as "OK"/100% in the dropzone before upload) — that is a
  presentation-model change to the shared `Dropzone`, out of scope here.
- No i18n sweep of the rest of the app; only the batch pipeline's user-facing error strings
  are moved behind `t()`.

## Impact

- **Code:** `components/batch/BatchModal.tsx`, `lib/batch/run-one.ts`,
  `lib/batch/extract-result.ts`, new `lib/batch/errors.ts`, i18n strings in `lib/seed/pt.ts`.
- **Tests:** new `lib/batch/errors.test.ts`; extended `lib/batch/extract-result.test.ts`
  (malformed result lines). No React rendering tests — per repo convention the decode/format
  logic lives in `lib/` and is covered there.
- **APIs / deps:** none. No schema, route, or dependency changes.
- **Behavioral note:** per-file error text visible to users changes wording (now localized,
  status codes preserved in parentheses).
