## Why

Two defects found in the 2026-07-23 audit cause a batch run to **silently lose
results** — the worst failure class for this feature, because the user is given
no error and only a plausible-looking (but incomplete) output. Fixing both
closes the "batch data loss" gap before batch mode is relied on for real work.

## What Changes

- **ZIP dedup no longer drops files (`lib/batch/zip.ts`).** Today the dedup
  counter is keyed on the sanitized *base* name, but the generated candidate
  (`<base> (n).xlsx`) is never checked against names already placed in the ZIP.
  A source file literally named like a generated suffix (e.g. inputs `report`,
  `report`, `report (2)`) makes the third entry overwrite the second in the
  `files` map, so `zipSync` receives one fewer file — silent loss. The fix
  tracks the **final** entry names and increments until an unused name is found.
- **Backdrop click can no longer discard a live or undownloaded batch
  (`components/batch/BatchModal.tsx`).** The overlay calls `onClose` on any
  backdrop click, including while `running` is true — unmounting the modal
  abandons the in-flight `runBatch` and throws away every result. Dismissal is
  suppressed while a batch is running, and requires confirmation when a finished
  batch has downloadable results that were not yet saved. (The header ✕ button
  follows the same guard.)

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `batch-processing`: strengthen the **ZIP packaging** requirement so
  de-duplication guarantees no entry is dropped even when a source name
  collides with a generated dedup name; extend the **Batch UI** requirement so
  an in-progress or completed-but-undownloaded batch is protected from
  accidental dismissal.

## Impact

- Code: `lib/batch/zip.ts` (dedup logic), `components/batch/BatchModal.tsx`
  (backdrop/close guard). New co-located test `lib/batch/zip.test.ts`.
- No API, schema, or dependency changes. No i18n keys change except one new RU/EN
  string if a confirm prompt is added.
- Behavior change is strictly safety-additive; no breaking changes to callers of
  `zipOutputs` (same signature, same output for non-colliding inputs).

## Non-goals

- No abort/cancel control for a running batch (dismissal is *blocked* while
  running, not made cancellable) — that is a separate UX feature.
- No change to the per-file pipeline, NDJSON parsing, or extraction race logic.
- No redesign of the batch modal layout or progress UI.
